"use client";

import {
  AgentMicrophoneButton,
  AgentProvider,
  AgentSpeakerButton,
  AgentStatus,
  Orb,
  useAgentConversation,
  useAgentMicrophone,
  useAgentMode,
  useAgentPlayer,
  useAgentSession,
  useAgentState,
  type AgentProviderProps,
} from "@deepgram/ui";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import type {
  Language,
  RequestFollowupResult,
  SaveSummaryResult,
  SupportResource,
  ToolActivityEvent,
} from "@/lib/contracts";
import { createDeepgramAgentConfig } from "@/lib/deepgram/config";
import {
  type PendingBillingIssue,
  routeTextFallbackIntent,
  summaryLanguage,
} from "@/lib/deepgram/text-fallback";
import { dispatchBeneBotTool } from "@/lib/deepgram/tools";

import { ToolActivity } from "./tool-activity";
import { Transcript } from "./transcript";

const tokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().positive(),
});

const billFallbackSchema = z.object({
  patientFirstName: z.string(),
  preferredLanguage: z.object({
    code: z.enum(["en", "es"]),
    display: z.string(),
    preferred: z.literal(true),
  }).optional(),
  providerName: z.string(),
  serviceDescription: z.string(),
  dateOfService: z.string(),
  encounter: z.object({
    id: z.string(),
    providerName: z.string(),
    facilityName: z.string().optional(),
    serviceDescription: z.string(),
    dateOfService: z.string(),
    location: z.string().optional(),
  }),
  currentBalance: z.number(),
  historicalAdjudication: z.object({
    billedAmount: z.number(),
    contractualAdjustment: z.number(),
    allowedAmount: z.number(),
    deductibleApplied: z.number(),
    coinsuranceAmount: z.number(),
    insurerPaid: z.number(),
    patientResponsibility: z.number(),
  }),
  source: z.object({ createdDate: z.string() }),
  mathReconciles: z.boolean(),
});

const voiceBillResultSchema = billFallbackSchema.extend({
  requiredSpokenSummary: z.object({
    en: z.string().min(1),
    es: z.string().min(1),
  }),
  requiredAllowedAmountClarification: z.object({
    en: z.string().min(1),
    es: z.string().min(1),
  }),
});

const benefitsFallbackSchema = z.object({
  source: z.enum(["stedi-live-test", "medplum-stedi-bot", "fixture-fallback"]),
  checkedAt: z.string().min(1),
  coverageActive: z.boolean().optional(),
  payerName: z.string().optional(),
  planName: z.string().optional(),
  benefits: z.object({
    annualDeductible: z.number().optional(),
    remainingDeductible: z.number().optional(),
    deductibleMetToDate: z.number().optional(),
    deductibleScope: z.object({
      benefitLevel: z.literal("individual"),
      network: z.enum(["in", "out", "unknown"]),
      serviceTypeCodes: z.array(z.string()),
    }).optional(),
    annualOutOfPocketMaximum: z.number().optional(),
    remainingOutOfPocketMaximum: z.number().optional(),
    copays: z.array(z.object({
      serviceLabel: z.string(),
      amount: z.number(),
      network: z.enum(["in", "out", "unknown"]).optional(),
    })),
    coinsurance: z.array(z.object({
      serviceLabel: z.string(),
      percentage: z.number(),
      network: z.enum(["in", "out", "unknown"]).optional(),
    })),
  }),
  medplum: z.object({
    coverageEligibilityResponseId: z.string().optional(),
    documentReferenceId: z.string().optional(),
  }),
  warnings: z.array(z.string()),
});

const voiceBenefitsResultSchema = benefitsFallbackSchema.extend({
  requiredSpokenSummary: z.object({
    en: z.string().min(1),
    es: z.string().min(1),
  }),
});

const resourceIdSchema = z.enum([
  "bayview-payment-plan",
  "acme-bill-help",
  "aetna-test-member-services",
  "northstar-financial-assistance",
  "billing-review",
]);

const supportResourceSchema = z.object({
  id: resourceIdSchema,
  name: z.string(),
  organization: z.string(),
  type: z.string(),
  summary: z.string(),
  phone: z.string().optional(),
  url: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  sourceType: z.enum([
    "practice-policy",
    "fictional-demo-provider",
    "community-reported",
  ]),
  verification: z.enum([
    "practice-provided",
    "fictional-demo-data",
    "unverified",
  ]),
  disclosure: z.string(),
});

const resourcesFallbackSchema = z.object({
  query: z.string(),
  provider: z.enum(["moss", "local-json"]),
  resources: z.array(supportResourceSchema).max(3),
});

const followupFallbackSchema = z
  .object({
    created: z.boolean(),
    taskId: z.string().trim().min(1).optional(),
    status: z.enum(["requested", "failed"]),
    message: z.string(),
  })
  .superRefine((result, context) => {
    const confirmed = result.created && result.status === "requested" && Boolean(result.taskId);
    const failed = !result.created && result.status === "failed" && !result.taskId;
    if (!confirmed && !failed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A created follow-up requires a Task ID; a failed follow-up must not include one.",
      });
    }
  });

const saveSummaryFallbackSchema = z
  .object({
    saved: z.boolean(),
    communicationId: z.string().trim().min(1).optional(),
  })
  .superRefine((result, context) => {
    if (result.saved !== Boolean(result.communicationId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A saved summary requires a confirmed Communication ID.",
      });
    }
  });

interface VoiceToolFacts {
  historicalBillRead: boolean;
  currentBenefitsRefreshed: boolean;
  resourceIds: string[];
}

type CurrentBenefits = z.infer<typeof benefitsFallbackSchema>;
type VoiceBillContext = z.infer<typeof voiceBillResultSchema>;
type VoiceBenefitsResult = z.infer<typeof voiceBenefitsResultSchema>;

interface FallbackContext {
  language: "en" | "es";
  usedEnglish: boolean;
  usedSpanish: boolean;
  historicalBill?: VoiceBillContext;
  historicalSourceDate?: string;
  benefitsRefreshed: boolean;
  resourcesOffered: SupportResource[];
  pendingIssue?: PendingBillingIssue;
  clarityAsked: boolean;
  followupTaskId?: string;
}

interface FallbackMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function BenefitValue({
  label,
  value,
  language,
}: {
  label: string;
  value?: number;
  language: Language;
}): React.ReactNode {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">
        {value === undefined
          ? language === "es" ? "No devuelto" : "Not returned"
          : moneyFormatter.format(value)}
      </dd>
    </div>
  );
}

function CurrentBenefitsCard({
  result,
  language,
}: {
  result: CurrentBenefits;
  language: Language;
}): React.ReactNode {
  const sourceLabel =
    result.source === "stedi-live-test"
      ? language === "es" ? "Prueba en vivo de Stedi" : "Stedi live test"
      : result.source === "medplum-stedi-bot"
        ? language === "es" ? "Prueba de Medplum Stedi" : "Medplum Stedi test"
        : language === "es" ? "Respaldo de demostración · no en vivo" : "Demo fallback · not live";
  const missing = language === "es" ? "No devuelto" : "Not returned";
  const networkLabel = (network: "in" | "out" | "unknown" | undefined): string => {
    if (!network || network === "unknown") return language === "es" ? "red no indicada" : "network not returned";
    if (network === "in") return language === "es" ? "dentro de la red" : "in network";
    return language === "es" ? "fuera de la red" : "out of network";
  };

  return (
    <section className="voice-result voice-result-current" aria-label={language === "es" ? "Instantánea de beneficios actuales" : "Current benefits snapshot"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">
          {language === "es" ? "Beneficios actuales · revisión separada" : "Current benefits · separate check"}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
          {sourceLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {language === "es" ? "Consultado" : "Checked"} {result.checkedAt}
      </p>
      <p className="mt-2 text-sm font-medium text-amber-950">
        {language === "es"
          ? "Esta respuesta actual no reemplaza, explica ni valida el reclamo histórico."
          : "This current response does not replace, explain, or validate the historical claim."}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">{language === "es" ? "Cobertura" : "Coverage"}</dt>
          <dd className="font-semibold text-slate-900">
            {result.coverageActive === undefined
              ? missing
              : result.coverageActive
                ? language === "es" ? "Activa" : "Active"
                : language === "es" ? "Inactiva" : "Inactive"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Plan</dt>
          <dd className="font-semibold text-slate-900">{result.planName ?? missing}</dd>
        </div>
        <BenefitValue language={language} label={language === "es" ? "Deducible anual actual" : "Current annual deductible"} value={result.benefits.annualDeductible} />
        <BenefitValue language={language} label={language === "es" ? "Deducible restante actual" : "Current remaining deductible"} value={result.benefits.remainingDeductible} />
        <BenefitValue language={language} label={language === "es" ? "Deducible cumplido actual" : "Current deductible met"} value={result.benefits.deductibleMetToDate} />
        <BenefitValue language={language} label={language === "es" ? "Máximo anual de gastos de bolsillo" : "Annual out-of-pocket maximum"} value={result.benefits.annualOutOfPocketMaximum} />
        <BenefitValue language={language} label={language === "es" ? "Máximo restante de gastos de bolsillo" : "Remaining out-of-pocket maximum"} value={result.benefits.remainingOutOfPocketMaximum} />
      </dl>
      {result.benefits.copays.length > 0 || result.benefits.coinsurance.length > 0 ? (
        <div className="mt-3 border-t border-amber-200 pt-3 text-xs text-slate-700">
          {result.benefits.copays.map((copay) => (
            <p key={`copay-${copay.serviceLabel}-${copay.network ?? "unknown"}`}>
              {copay.serviceLabel}: {moneyFormatter.format(copay.amount)} {language === "es" ? "de copago" : "copay"}
              {` · ${networkLabel(copay.network)}`}
            </p>
          ))}
          {result.benefits.coinsurance.map((coinsurance) => (
            <p key={`coinsurance-${coinsurance.serviceLabel}-${coinsurance.network ?? "unknown"}`}>
              {coinsurance.serviceLabel}: {coinsurance.percentage}% {language === "es" ? "de coseguro" : "coinsurance"}
              {` · ${networkLabel(coinsurance.network)}`}
            </p>
          ))}
        </div>
      ) : null}
      {result.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-amber-900">
          {result.warnings.map((warning) => (
            <li key={warning}>
              • {language === "es"
                ? "La respuesta omitió o devolvió información ambigua; los valores no mostrados permanecen desconocidos."
                : warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ResourceOptions({
  resources,
  language,
}: {
  resources: SupportResource[];
  language: Language;
}): React.ReactNode {
  if (resources.length === 0) return null;
  return (
    <section className="mt-4 space-y-3" aria-label={language === "es" ? "Recursos de apoyo de facturación" : "Billing support resources"}>
      <h3 className="text-sm font-semibold text-slate-950">
        {language === "es" ? "Opciones de apoyo" : "Support options"}
      </h3>
      {resources.map((resource) => (
        <article key={resource.id} className="voice-resource">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-950">{resource.name}</h4>
              <p className="text-xs text-slate-500">{resource.organization}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
              {resource.verification === "practice-provided"
                ? language === "es" ? "Proporcionado por la práctica" : "Practice provided"
                : resource.verification === "fictional-demo-data"
                  ? language === "es" ? "Demostración ficticia" : "Fictional demo"
                  : language === "es" ? "No verificado" : "Unverified"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{resource.summary}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">{resource.disclosure}</p>
        </article>
      ))}
    </section>
  );
}

function FollowupStatus({
  result,
  language,
}: {
  result: RequestFollowupResult;
  language: Language;
}): React.ReactNode {
  const confirmed = result.created && result.status === "requested";
  return (
    <div
      role="status"
      className={`voice-followup ${
        confirmed
          ? "voice-followup-confirmed"
          : "voice-followup-failed"
      }`}
    >
      <strong>
        {confirmed
          ? language === "es" ? "Caso de revisión confirmado por el servidor" : "Review case confirmed by the server"
          : language === "es" ? "El caso de revisión no se completó" : "The review case was not completed"}
      </strong>
      {confirmed && result.taskId ? (
        <p className="mt-1 text-xs">{language === "es" ? "ID del caso" : "Case ID"}: {result.taskId}</p>
      ) : null}
    </div>
  );
}

export interface BeneBotPanelProps {
  sessionToken: string;
  onClose?: () => void;
}

function VoicePanelContent({
  sessionToken,
  sessionLanguage,
  onSessionLanguageChange,
  onVoiceSessionStarted,
  events,
  setEvents,
  onClose,
}: BeneBotPanelProps & {
  sessionLanguage: Language;
  onSessionLanguageChange: (language: Language) => void;
  onVoiceSessionStarted: () => void;
  events: ToolActivityEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ToolActivityEvent[]>>;
}): React.ReactNode {
  const { state, isConnected, isActive, start, stop } = useAgentState();
  const { conversation, sendUserMessage } = useAgentConversation();
  const { mode } = useAgentMode();
  const agentSession = useAgentSession();
  const microphone = useAgentMicrophone();
  const player = useAgentPlayer();
  const [text, setText] = useState("");
  const [fallbackMessages, setFallbackMessages] = useState<FallbackMessage[]>([]);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [fallbackContext, setFallbackContext] = useState<FallbackContext>({
    language: sessionLanguage,
    usedEnglish: sessionLanguage === "en",
    usedSpanish: sessionLanguage === "es",
    benefitsRefreshed: false,
    resourcesOffered: [],
    clarityAsked: false,
  });
  const [currentBenefits, setCurrentBenefits] = useState<CurrentBenefits>();
  const [followupResult, setFollowupResult] = useState<RequestFollowupResult>();
  const [summaryResult, setSummaryResult] = useState<SaveSummaryResult>();
  const [bargeInDetected, setBargeInDetected] = useState(false);
  const [voiceError, setVoiceError] = useState<string>();
  const isSpanishSession = sessionLanguage === "es";
  const previousAgentState = useRef(state);

  useEffect(() => {
    const previous = previousAgentState.current;
    if (
      state === "connecting" &&
      (previous === "idle" || previous === "disconnected")
    ) {
      onVoiceSessionStarted();
    }
    previousAgentState.current = state;
  }, [onVoiceSessionStarted, state]);

  useEffect(() => {
    const handleUserStartedSpeaking = (): void => {
      // @deepgram/react immediately flushes queued player audio for this
      // model-level Voice Agent event. This state only makes the demo visible.
      setBargeInDetected(true);
    };
    agentSession.on("user-started-speaking", handleUserStartedSpeaking);
    return () => {
      agentSession.off("user-started-speaking", handleUserStartedSpeaking);
    };
  }, [agentSession]);

  const appendActivity = useCallback(
    (event: ToolActivityEvent) => setEvents((current) => [...current, event]),
    [setEvents],
  );

  const appendFallbackMessage = useCallback(
    (role: FallbackMessage["role"], content: string): void => {
      setFallbackMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role, content },
      ]);
    },
    [],
  );

  const toggleVoice = async (): Promise<void> => {
    if (isActive) {
      stop();
      setVoiceError(undefined);
      return;
    }

    setVoiceError(undefined);
    try {
      await start();
    } catch {
      // The Deepgram session can connect before browser microphone access is
      // rejected. Always stop it so the UI and billing session return to a
      // known text-only state instead of leaving a live, unusable connection.
      stop();
      setVoiceError(
        isSpanishSession
          ? "No se pudo acceder al micrófono. Puede continuar escribiendo; no se perdió nada."
          : "The microphone could not be accessed. You can continue by typing; nothing was lost.",
      );
    }
  };

  const submitText = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const message = text.trim();
    if (!message || fallbackBusy) return;
    setText("");

    if (isConnected) {
      sendUserMessage(message);
      return;
    }

    setFallbackBusy(true);
    appendFallbackMessage("user", message);

    const intent = routeTextFallbackIntent(message, {
      language: fallbackContext.language,
      pendingIssue: fallbackContext.pendingIssue,
      clarityAsked: fallbackContext.clarityAsked,
    });
    const usedEnglish = fallbackContext.usedEnglish || intent.language === "en";
    const usedSpanish = fallbackContext.usedSpanish || intent.language === "es";
    setFallbackContext((current) => ({
      ...current,
      language: intent.language,
      usedEnglish,
      usedSpanish,
    }));

    if (intent.kind === "switch-language") {
      appendFallbackMessage(
        "assistant",
        intent.language === "es"
          ? "Claro. Continuaré en español. Puede pedirme que explique la factura, revise los beneficios actuales o busque ayuda para pagar."
          : "Of course. I'll continue in English. You can ask me to explain the bill, check current benefits, or find payment help.",
      );
      setFallbackBusy(false);
      return;
    }

    if (intent.kind === "allowed-amount-interruption") {
      setBargeInDetected(true);
      try {
        let bill = fallbackContext.historicalBill;
        if (!bill) {
          const billResult = await dispatchBeneBotTool({
            name: "get_bill_context",
            argumentsJson: "{}",
            sessionToken,
            onActivity: appendActivity,
          });
          bill = voiceBillResultSchema.parse(JSON.parse(billResult) as unknown);
          setFallbackContext((current) => ({
            ...current,
            historicalBill: bill,
            historicalSourceDate: bill?.source.createdDate,
          }));
        }
        appendFallbackMessage(
          "assistant",
          bill.requiredAllowedAmountClarification[intent.language],
        );
      } catch {
        appendFallbackMessage(
          "assistant",
          intent.language === "es"
            ? "El monto permitido es el precio negociado que el plan usa para procesar un servicio cubierto y dividir la responsabilidad. No pude verificar las cantidades de esta factura, así que no las voy a repetir."
            : "The allowed amount is the negotiated price the plan uses to process a covered service and divide responsibility. I could not verify this bill's amounts, so I will not repeat them.",
        );
      }
      setFallbackBusy(false);
      return;
    }

    if (intent.kind === "prepare-followup") {
      setFallbackContext((current) => ({
        ...current,
        pendingIssue: intent.issue,
        clarityAsked: true,
      }));
      appendFallbackMessage(
        "assistant",
        intent.language === "es"
          ? `Entiendo. Para confirmar: ${intent.issue.patientIssueSummary} ¿Quiere que cree un caso de revisión de facturación por mensaje seguro? Todavía no se ha creado nada.`
          : `Understood. To confirm: ${intent.issue.patientIssueSummary} Would you like me to create a billing-review case by secure message? Nothing has been created yet.`,
      );
      setFallbackBusy(false);
      return;
    }

    if (intent.kind === "ask-clarity") {
      setFallbackContext((current) => ({ ...current, clarityAsked: true }));
      appendFallbackMessage(
        "assistant",
        intent.language === "es"
          ? "Antes de terminar: ¿hay algo que todavía no esté claro?"
          : "Before we finish: is anything still unclear?",
      );
      setFallbackBusy(false);
      return;
    }

    if (intent.kind === "tool-sequence") {
      try {
        const billResult = await dispatchBeneBotTool({
          name: "get_bill_context",
          argumentsJson: "{}",
          sessionToken,
          onActivity: appendActivity,
        });
        const bill = voiceBillResultSchema.parse(JSON.parse(billResult) as unknown);
        setFallbackContext((current) => ({
          ...current,
          historicalBill: bill,
          historicalSourceDate: bill.source.createdDate,
        }));

        const benefitsResult = await dispatchBeneBotTool({
          name: "refresh_current_benefits",
          argumentsJson: JSON.stringify({ reason: "compare-with-historical-claim" }),
          sessionToken,
          onActivity: appendActivity,
        });
        const benefits: VoiceBenefitsResult = voiceBenefitsResultSchema.parse(
          JSON.parse(benefitsResult) as unknown,
        );
        setCurrentBenefits(benefits);
        setFallbackContext((current) => ({
          ...current,
          benefitsRefreshed: true,
          clarityAsked: true,
        }));
        appendFallbackMessage(
          "assistant",
          `${bill.requiredSpokenSummary[intent.language]} ${benefits.requiredSpokenSummary[intent.language]} ${
            intent.language === "es"
              ? "¿Hay algo que todavía no esté claro?"
              : "Is anything still unclear?"
          }`,
        );
      } catch {
        appendFallbackMessage(
          "assistant",
          intent.language === "es"
            ? "No pude completar las dos consultas. No inventaré valores ni diré que la revisión actual explica el reclamo histórico."
            : "I could not complete both checks. I will not invent values or say the current check explains the historical claim.",
        );
      }
      setFallbackBusy(false);
      return;
    }

    let toolArguments = intent.arguments;
    if (intent.tool === "save_conversation_summary") {
      const questionsAnswered = [
        ...(fallbackContext.historicalSourceDate ? ["Historical bill explanation"] : []),
        ...(fallbackContext.benefitsRefreshed ? ["Current benefits refresh"] : []),
      ];
      const summaryParts = [
        fallbackContext.historicalSourceDate
          ? `Explained historical adjudication dated ${fallbackContext.historicalSourceDate}.`
          : "Historical adjudication was not explained.",
        fallbackContext.benefitsRefreshed
          ? "Refreshed the separate current-benefits snapshot."
          : "Current benefits were not refreshed.",
        fallbackContext.resourcesOffered.length > 0
          ? "Offered labeled billing-support resources."
          : "No support resources were offered.",
      ];
      toolArguments = {
        language: summaryLanguage(usedEnglish, usedSpanish),
        summary: summaryParts.join(" "),
        questionsAnswered,
        resourcesOffered: fallbackContext.resourcesOffered.map((resource) => resource.id),
        ...(fallbackContext.followupTaskId
          ? { followupTaskId: fallbackContext.followupTaskId }
          : {}),
        unresolvedIssues:
          fallbackContext.pendingIssue && !fallbackContext.followupTaskId
            ? [fallbackContext.pendingIssue.patientIssueSummary]
            : [],
      };
    }

    const toolResult = await dispatchBeneBotTool({
      name: intent.tool,
      argumentsJson: JSON.stringify(toolArguments),
      sessionToken,
      onActivity: appendActivity,
    });

    let reply: string;
    try {
      const result: unknown = JSON.parse(toolResult);
      switch (intent.tool) {
        case "get_bill_context": {
          const context = voiceBillResultSchema.parse(result);
          setFallbackContext((current) => ({
            ...current,
            historicalBill: context,
            historicalSourceDate: context.source.createdDate,
            clarityAsked: true,
          }));
          reply = `${context.requiredSpokenSummary[intent.language]} ${
            intent.language === "es"
              ? "¿Hay algo que todavía no esté claro?"
              : "Is anything still unclear?"
          }`;
          break;
        }
        case "refresh_current_benefits": {
          const benefits = voiceBenefitsResultSchema.parse(result);
          setCurrentBenefits(benefits);
          setFallbackContext((current) => ({
            ...current,
            benefitsRefreshed: true,
            clarityAsked: true,
          }));
          reply = `${benefits.requiredSpokenSummary[intent.language]} ${
            intent.language === "es"
              ? "¿Hay algo que todavía no esté claro?"
              : "Is anything still unclear?"
          }`;
          break;
        }
        case "search_support_resources": {
          const resources = resourcesFallbackSchema.parse(result).resources;
          setFallbackContext((current) => ({
            ...current,
            resourcesOffered: resources,
          }));
          if (resources.length === 0) {
            reply = intent.language === "es"
              ? "No encontré una opción de ayuda para pagos en los datos de demostración."
              : "I did not find a payment-help option in the demo data.";
          } else {
            const first = resources[0];
            reply = intent.language === "es"
              ? `Encontré ${resources.length} opción u opciones con etiquetas de fuente. La primera es ${first.name}. ${first.disclosure}`
              : `I found ${resources.length} source-labeled option(s). The first is ${first.name}. ${first.disclosure}`;
          }
          break;
        }
        case "request_human_followup": {
          const followup = followupFallbackSchema.parse(result);
          setFollowupResult(followup);
          if (followup.created && followup.status === "requested" && followup.taskId) {
            setFallbackContext((current) => ({
              ...current,
              pendingIssue: undefined,
              followupTaskId: followup.taskId,
            }));
            let summarySaved = false;
            try {
              const confirmedFacts = [
                ...(fallbackContext.historicalSourceDate
                  ? [intent.language === "es"
                      ? "Se explicó la adjudicación histórica."
                      : "The historical adjudication was explained."]
                  : []),
                ...(fallbackContext.benefitsRefreshed
                  ? [intent.language === "es"
                      ? "Se consultaron por separado los beneficios actuales."
                      : "Current benefits were checked separately."]
                  : []),
                intent.language === "es"
                  ? "La paciente confirmó un caso de revisión de facturación."
                  : "The patient confirmed a billing-review case.",
              ];
              const summaryRaw = await dispatchBeneBotTool({
                name: "save_conversation_summary",
                argumentsJson: JSON.stringify({
                  language: summaryLanguage(usedEnglish, usedSpanish),
                  summary: confirmedFacts.join(" "),
                  questionsAnswered: [
                    ...(fallbackContext.historicalSourceDate
                      ? ["Historical bill explanation"]
                      : []),
                    ...(fallbackContext.benefitsRefreshed
                      ? ["Current benefits refresh"]
                      : []),
                  ],
                  resourcesOffered: fallbackContext.resourcesOffered.map(
                    (resource) => resource.id,
                  ),
                  followupTaskId: followup.taskId,
                  unresolvedIssues: fallbackContext.pendingIssue
                    ? [fallbackContext.pendingIssue.patientIssueSummary]
                    : [],
                }),
                sessionToken,
                onActivity: appendActivity,
              });
              const saved = saveSummaryFallbackSchema.parse(
                JSON.parse(summaryRaw) as unknown,
              );
              setSummaryResult(saved);
              summarySaved = saved.saved;
            } catch {
              setSummaryResult({ saved: false });
            }
            reply = intent.language === "es"
              ? `El servidor confirmó el caso de revisión de facturación. ID del caso: ${followup.taskId}. ${summarySaved ? "También confirmó el resumen breve para el personal." : "El resumen para el personal no se guardó."}`
              : `The server confirmed the billing-review case. Case ID: ${followup.taskId}. ${summarySaved ? "It also confirmed the concise staff summary." : "The staff summary was not saved."}`;
          } else {
            reply = intent.language === "es"
              ? "El seguimiento no se completó."
              : "The follow-up was not completed.";
          }
          break;
        }
        case "save_conversation_summary": {
          const saved = saveSummaryFallbackSchema.parse(result);
          setSummaryResult(saved);
          reply = saved.saved
            ? intent.language === "es"
              ? "El servidor confirmó que se guardó un resumen breve; no se guardó una transcripción completa ni audio."
              : "The server confirmed a concise summary was saved; no full transcript or raw audio was saved."
            : intent.language === "es"
              ? "El resumen no se guardó."
              : "The summary was not saved.";
          break;
        }
      }
    } catch {
      if (intent.tool === "request_human_followup") {
        const failed: RequestFollowupResult = {
          created: false,
          status: "failed",
          message: "The server did not confirm creation. No follow-up is being claimed.",
        };
        setFollowupResult(failed);
        reply = intent.language === "es"
          ? "El servidor no confirmó la creación. El seguimiento no se completó."
          : "The server did not confirm creation. The follow-up was not completed.";
      } else if (intent.tool === "save_conversation_summary") {
        setSummaryResult({ saved: false });
        reply = intent.language === "es" ? "El resumen no se guardó." : "The summary was not saved.";
      } else {
        reply = intent.language === "es"
          ? "No pude completar esa consulta. No inventaré valores ni afirmaré que una acción funcionó."
          : "I could not complete that request. I will not invent values or claim an action succeeded.";
      }
    }

    appendFallbackMessage("assistant", reply);
    setFallbackBusy(false);
  };

  return (
    <section
      aria-label={isSpanishSession ? "Hablar con BeneBot" : "Talk with BeneBot"}
      className="voice-panel"
      data-dg-agent
    >
      <header className="voice-panel-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {isSpanishSession ? "Demostración sintética" : "Synthetic demo"}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {isSpanishSession ? "Habla sobre esta factura" : "Talk about this bill"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {isSpanishSession ? "Voz en español seleccionada" : "English voice selected"}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="voice-close"
            aria-label={isSpanishSession ? "Cerrar BeneBot" : "Close BeneBot"}
          >
            {isSpanishSession ? "Cerrar" : "Close"}
          </button>
        ) : null}
      </header>

      <fieldset
        className="voice-language"
        disabled={isActive}
      >
        <legend className="px-1 text-sm font-semibold text-slate-900">
          {isSpanishSession ? "Idioma de esta sesión de voz" : "Voice-session language"}
        </legend>
        <div className="mt-2 flex gap-2">
          {(["es", "en"] as const).map((language) => {
            const selected = sessionLanguage === language;
            return (
              <button
                key={language}
                type="button"
                aria-pressed={selected}
                onClick={() => onSessionLanguageChange(language)}
                className={`voice-language-option ${
                  selected
                    ? "voice-language-option-selected"
                    : ""
                }`}
              >
                {language === "es" ? "Español" : "English"}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {isSpanishSession
            ? "Elija antes de iniciar. Cada idioma usa una voz nativa; termine la voz para cambiar."
            : "Choose before starting. Each language uses a native voice; end voice to switch."}
        </p>
      </fieldset>

      <div role="status" className="voice-security">
        <p className="font-semibold">Secure billing context verified</p>
        <p className="mt-1">
          {isSpanishSession
            ? "Sesión segura: Jane Doe. Ya tengo esta factura desde el portal; no pediré Seguro Social, fecha de nacimiento, número de miembro ni identificación de paciente."
            : "Secure session: Jane Doe. I already have this bill from the portal; I will not ask for a Social Security number, date of birth, member ID, or patient ID."}
        </p>
      </div>

      {bargeInDetected ? (
        <div role="status" className="voice-interrupt">
          {isSpanishSession
            ? "Interrupción detectada por Flux · audio de BeneBot detenido"
            : "Flux interruption detected · BeneBot audio stopped"}
        </div>
      ) : null}

      <div className="voice-orb-stage">
        <Orb
          size={72}
          state={mode === "speaking" ? "talking" : mode === "listening" ? "listening" : "idle"}
          getInputVolume={microphone.getInputVolume}
          getOutputVolume={player.getOutputVolume}
          colors={["#00c4a7", "#ff3d8b"]}
        />
        <div>
          <AgentStatus
            labels={{
              idle: isSpanishSession ? "Lista para voz o texto" : "Ready for voice or text",
              connecting: isSpanishSession ? "Solicitando micrófono…" : "Requesting microphone…",
              connected: mode === "speaking"
                ? isSpanishSession ? "BeneBot está hablando" : "BeneBot is speaking"
                : isSpanishSession ? "BeneBot está escuchando" : "BeneBot is listening",
              reconnecting: isSpanishSession ? "Reconectando…" : "Reconnecting…",
              disconnected: isSpanishSession
                ? "Voz desconectada. El texto sigue disponible"
                : "Voice disconnected. Text is still available",
            }}
          />
          <p className="mt-1 text-xs text-slate-300">
            {isSpanishSession ? "No se guarda audio sin procesar." : "Raw audio is not stored."}
          </p>
        </div>
      </div>

      <Transcript
        conversation={conversation}
        fallbackMessages={fallbackMessages}
        language={sessionLanguage}
      />

      {currentBenefits ? (
        <CurrentBenefitsCard result={currentBenefits} language={sessionLanguage} />
      ) : null}
      <ResourceOptions
        resources={fallbackContext.resourcesOffered}
        language={sessionLanguage}
      />
      {followupResult ? (
        <FollowupStatus result={followupResult} language={sessionLanguage} />
      ) : null}
      {summaryResult ? (
        <div
          role="status"
          className={`voice-summary-status ${
            summaryResult.saved
              ? "voice-summary-saved"
              : "voice-summary-failed"
          }`}
        >
          {summaryResult.saved
            ? isSpanishSession
              ? "El servidor confirmó que se guardó el resumen breve."
              : "Server confirmed: concise summary saved."
            : isSpanishSession
              ? "El resumen no se guardó."
              : "Summary was not saved."}
        </div>
      ) : null}

      <form onSubmit={submitText} className="voice-text-form">
        <label htmlFor="benebot-text" className="sr-only">
          {isSpanishSession ? "Enviar mensaje a BeneBot" : "Message BeneBot"}
        </label>
        <input
          id="benebot-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={state === "connected"
            ? isSpanishSession ? "Escribe en vez de hablar…" : "Type instead of speaking…"
            : isSpanishSession ? "El texto funciona aunque la voz no…" : "Text works even when voice does not…"}
          className="voice-text-input"
        />
        <button
          type="submit"
          disabled={!text.trim() || fallbackBusy}
          className="voice-send"
        >
          {fallbackBusy
            ? isSpanishSession ? "Consultando…" : "Checking…"
            : isSpanishSession ? "Enviar" : "Send"}
        </button>
      </form>

      {voiceError ? (
        <div role="alert" className="voice-summary-status voice-summary-failed">
          {voiceError}
        </div>
      ) : null}

      <div className="voice-controls">
        <button
          type="button"
          onClick={() => void toggleVoice()}
          disabled={state === "connecting" || state === "reconnecting"}
          className="voice-start"
        >
          {state === "connecting"
            ? isSpanishSession ? "Conectando…" : "Connecting…"
            : state === "reconnecting"
              ? isSpanishSession ? "Reconectando…" : "Reconnecting…"
              : isActive
                ? isSpanishSession ? "Terminar voz" : "End voice"
                : isSpanishSession ? "Iniciar voz" : "Start voice"}
        </button>
        <AgentMicrophoneButton
          activeLabel={isSpanishSession ? "Silenciar micrófono" : "Mute microphone"}
          mutedLabel={isSpanishSession ? "Activar micrófono" : "Unmute microphone"}
          disabledLabel={isSpanishSession ? "Micrófono no disponible" : "Microphone unavailable"}
          className="voice-control"
        />
        <AgentSpeakerButton
          activeLabel={isSpanishSession ? "Silenciar audio" : "Mute audio"}
          mutedLabel={isSpanishSession ? "Activar audio" : "Unmute audio"}
          className="voice-control"
        />
      </div>

      <div className="voice-activity-shell">
        <ToolActivity events={events} language={sessionLanguage} />
      </div>
    </section>
  );
}

export function BeneBotPanel({ sessionToken, onClose }: BeneBotPanelProps): React.ReactNode {
  const [events, setEvents] = useState<ToolActivityEvent[]>([]);
  const [sessionLanguage, setSessionLanguage] = useState<Language>("es");
  const voiceToolFacts = useRef<VoiceToolFacts>({
    historicalBillRead: false,
    currentBenefitsRefreshed: false,
    resourceIds: [],
  });
  const appendActivity = useCallback(
    (event: ToolActivityEvent) => setEvents((current) => [...current, event]),
    [],
  );
  const resetVoiceSessionEvidence = useCallback((): void => {
    voiceToolFacts.current = {
      historicalBillRead: false,
      currentBenefitsRefreshed: false,
      resourceIds: [],
    };
    setEvents([]);
  }, []);
  const selectSessionLanguage = useCallback((language: Language): void => {
    resetVoiceSessionEvidence();
    setSessionLanguage(language);
  }, [resetVoiceSessionEvidence]);

  const tokenFactory = useCallback(async (): Promise<string> => {
    const response = await fetch("/api/deepgram-token", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Voice token unavailable");
    }
    return tokenResponseSchema.parse(await response.json()).accessToken;
  }, [sessionToken]);

  const config = useMemo(
    () => createDeepgramAgentConfig(tokenFactory, sessionLanguage),
    [sessionLanguage, tokenFactory],
  );

  const handleFunctionCall: NonNullable<AgentProviderProps["onFunctionCall"]> = useCallback(
    async (fn) => {
      const result = await dispatchBeneBotTool({
        name: fn.name,
        argumentsJson: fn.arguments,
        sessionToken,
        onActivity: appendActivity,
      });
      let resultForAgent = result;
      try {
        const parsedResult: unknown = JSON.parse(result);
        if (
          fn.name === "get_bill_context" &&
          voiceBillResultSchema.safeParse(parsedResult).success
        ) {
          voiceToolFacts.current.historicalBillRead = true;
          const bill = voiceBillResultSchema.parse(parsedResult);
          resultForAgent = JSON.stringify({
            instruction:
              "Speak requiredResponse verbatim. Do not paraphrase, omit details, or add a calculation.",
            requiredResponse: bill.requiredSpokenSummary[sessionLanguage],
            interruptionInstruction:
              "If the patient interrupts to ask what allowed amount means, speak requiredAllowedAmountClarification verbatim.",
            requiredAllowedAmountClarification:
              bill.requiredAllowedAmountClarification[sessionLanguage],
          });
        } else if (
          fn.name === "refresh_current_benefits" &&
          voiceBenefitsResultSchema.safeParse(parsedResult).success
        ) {
          voiceToolFacts.current.currentBenefitsRefreshed = true;
          const benefits = voiceBenefitsResultSchema.parse(parsedResult);
          resultForAgent = JSON.stringify({
            instruction:
              "Speak requiredResponse verbatim. Do not paraphrase, omit details, or add an interpretation.",
            requiredResponse: benefits.requiredSpokenSummary[sessionLanguage],
          });
        } else if (fn.name === "search_support_resources") {
          const resources = resourcesFallbackSchema.safeParse(parsedResult);
          if (resources.success) {
            voiceToolFacts.current.resourceIds = resources.data.resources.map(
              (resource) => resource.id,
            );
          }
        } else if (fn.name === "request_human_followup") {
          const followup = followupFallbackSchema.safeParse(parsedResult);
          if (followup.success) {
            const confirmed =
              followup.data.created &&
              followup.data.status === "requested" &&
              followup.data.taskId;
            resultForAgent = JSON.stringify({
              created: followup.data.created,
              status: followup.data.status,
              ...(followup.data.taskId ? { taskId: followup.data.taskId } : {}),
              instruction: "Speak requiredResponse verbatim.",
              requiredResponse: confirmed
                ? sessionLanguage === "es"
                  ? `El servidor confirmó el caso de revisión de facturación. ID del caso: ${followup.data.taskId}.`
                  : `The server confirmed the billing-review case. Case ID: ${followup.data.taskId}.`
                : sessionLanguage === "es"
                  ? "El caso de revisión no se completó."
                  : "The billing-review case was not completed.",
            });
          }
        }
      } catch {
        // The tool activity already records the sanitized failure.
      }
      if (fn.name === "request_human_followup") {
        try {
          const followup = followupFallbackSchema.parse(
            JSON.parse(result) as unknown,
          );
          const request = JSON.parse(fn.arguments) as {
            patientIssueSummary?: string;
          };
          if (followup.created && followup.taskId) {
            const observedFacts = [
              ...(voiceToolFacts.current.historicalBillRead
                ? [sessionLanguage === "es"
                    ? "Se explicó la adjudicación histórica."
                    : "The historical adjudication was explained."]
                : []),
              ...(voiceToolFacts.current.currentBenefitsRefreshed
                ? [sessionLanguage === "es"
                    ? "Se consultaron por separado los beneficios actuales."
                    : "Current benefits were checked separately."]
                : []),
              sessionLanguage === "es"
                ? "La paciente confirmó un caso de revisión de facturación."
                : "The patient confirmed a billing-review case.",
            ];
            const summaryArguments = JSON.stringify({
              language: sessionLanguage,
              summary: observedFacts.join(" "),
              questionsAnswered: [
                ...(voiceToolFacts.current.historicalBillRead
                  ? ["Historical bill explanation"]
                  : []),
                ...(voiceToolFacts.current.currentBenefitsRefreshed
                  ? ["Current benefits refresh"]
                  : []),
              ],
              resourcesOffered: voiceToolFacts.current.resourceIds,
              followupTaskId: followup.taskId,
              unresolvedIssues: request.patientIssueSummary
                ? [request.patientIssueSummary]
                : [],
            });
            // Medplum can briefly lag between confirming the Task write and
            // making that Task readable to the Communication validator.
            await new Promise((resolve) => setTimeout(resolve, 500));
            let parsedSummary = saveSummaryFallbackSchema.safeParse(
              JSON.parse(
                await dispatchBeneBotTool({
                  name: "save_conversation_summary",
                  argumentsJson: summaryArguments,
                  sessionToken,
                }),
              ) as unknown,
            );
            if (!parsedSummary.success || !parsedSummary.data.saved) {
              await new Promise((resolve) => setTimeout(resolve, 750));
              parsedSummary = saveSummaryFallbackSchema.safeParse(
                JSON.parse(
                  await dispatchBeneBotTool({
                    name: "save_conversation_summary",
                    argumentsJson: summaryArguments,
                    sessionToken,
                  }),
                ) as unknown,
              );
            }
            if (!parsedSummary.success || !parsedSummary.data.saved) {
              appendActivity({
                tool: "save_conversation_summary",
                label: "Saving concise summary",
                status: "failed",
                at: new Date().toISOString(),
              });
            } else {
              appendActivity({
                tool: "save_conversation_summary",
                label: "Saving concise summary",
                status: "succeeded",
                at: new Date().toISOString(),
              });
            }
          }
        } catch {
          // The confirmed Task remains valid; the tool result must not claim
          // that the separate Communication write succeeded.
          appendActivity({
            tool: "save_conversation_summary",
            label: "Saving concise summary",
            status: "failed",
            at: new Date().toISOString(),
          });
        }
      }
      return resultForAgent;
    },
    [appendActivity, sessionLanguage, sessionToken],
  );

  return (
    <AgentProvider
      key={sessionLanguage}
      config={config}
      microphone
      microphoneOptions={{
        sampleRate: 16_000,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      }}
      tts
      playerSampleRate={24_000}
      autoStart={false}
      onFunctionCall={handleFunctionCall}
    >
      <VoicePanelContent
        sessionToken={sessionToken}
        sessionLanguage={sessionLanguage}
        onSessionLanguageChange={selectSessionLanguage}
        onVoiceSessionStarted={resetVoiceSessionEvidence}
        onClose={onClose}
        events={events}
        setEvents={setEvents}
      />
    </AgentProvider>
  );
}
