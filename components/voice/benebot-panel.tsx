"use client";

import {
  AgentMicrophoneButton,
  AgentProvider,
  AgentSpeakerButton,
  AgentStartButton,
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
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type {
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

const followupFallbackSchema = z.object({
  created: z.boolean(),
  taskId: z.string().optional(),
  status: z.enum(["requested", "failed"]),
  message: z.string(),
});

const saveSummaryFallbackSchema = z.object({
  saved: z.boolean(),
  communicationId: z.string().optional(),
});

type CurrentBenefits = z.infer<typeof benefitsFallbackSchema>;

interface FallbackContext {
  language: "en" | "es";
  usedEnglish: boolean;
  usedSpanish: boolean;
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

type BillContext = z.infer<typeof billFallbackSchema>;

function historicalBillReply(context: BillContext, language: "en" | "es"): string {
  if (!context.mathReconciles) {
    return language === "es"
      ? "Puedo ver la factura, pero los importes no coinciden con suficiente confianza. Puedo pedir una revisión del equipo de facturación."
      : "I can see the bill, but the amounts do not reconcile confidently enough to explain. I can request a billing-team review.";
  }

  const values = context.historicalAdjudication;
  return language === "es"
    ? `La EOB histórica del ${context.source.createdDate} muestra que ${context.providerName} facturó ${moneyFormatter.format(values.billedAmount)}. El descuento contractual fue ${moneyFormatter.format(values.contractualAdjustment)}, dejando un monto permitido de ${moneyFormatter.format(values.allowedAmount)}. De ese reclamo histórico, ${moneyFormatter.format(values.deductibleApplied)} se aplicaron al deducible y ${moneyFormatter.format(values.coinsuranceAmount)} al coaseguro. El seguro pagó ${moneyFormatter.format(values.insurerPaid)} y la responsabilidad histórica fue ${moneyFormatter.format(values.patientResponsibility)}. La factura actual muestra un saldo de ${moneyFormatter.format(context.currentBalance)}. Así procesó la aseguradora el reclamo; no prueba que sea correcto.`
    : `The historical EOB dated ${context.source.createdDate} shows ${context.providerName} billed ${moneyFormatter.format(values.billedAmount)}. The contractual discount was ${moneyFormatter.format(values.contractualAdjustment)}, leaving an allowed amount of ${moneyFormatter.format(values.allowedAmount)}. On that historical claim, ${moneyFormatter.format(values.deductibleApplied)} applied to deductible and ${moneyFormatter.format(values.coinsuranceAmount)} to coinsurance. The insurer paid ${moneyFormatter.format(values.insurerPaid)}, and historical patient responsibility was ${moneyFormatter.format(values.patientResponsibility)}. The current Invoice balance is ${moneyFormatter.format(context.currentBalance)}. This is how the insurer processed the claim; it does not prove the claim is correct.`;
}

function currentBenefitsReply(
  benefits: CurrentBenefits,
  language: "en" | "es",
): string {
  const source = benefits.source === "fixture-fallback"
    ? language === "es"
      ? "datos de respaldo de demostración, no una respuesta en vivo"
      : "demo fallback data, not a live payer response"
    : benefits.source === "stedi-live-test"
      ? language === "es"
        ? "la respuesta de prueba en vivo de Stedi"
        : "the live Stedi test response"
      : language === "es"
        ? "la respuesta de prueba de Medplum Stedi"
        : "the Medplum Stedi test response";
  const annual = benefits.benefits.annualDeductible;
  const remaining = benefits.benefits.remainingDeductible;
  const met = benefits.benefits.deductibleMetToDate;

  if (language === "es") {
    return `La revisión actual separada consultó ${source} a las ${benefits.checkedAt}. El deducible anual ${annual === undefined ? "no fue devuelto" : `fue ${moneyFormatter.format(annual)}`}; el deducible restante ${remaining === undefined ? "no fue devuelto" : `fue ${moneyFormatter.format(remaining)}`}${met === undefined ? "" : `; la aplicación calculó ${moneyFormatter.format(met)} cumplidos para el mismo alcance`}. Esta respuesta actual no explica ni valida la EOB histórica.`;
  }
  return `The separate current check queried ${source} at ${benefits.checkedAt}. Annual deductible was ${annual === undefined ? "not returned" : moneyFormatter.format(annual)}; remaining deductible was ${remaining === undefined ? "not returned" : moneyFormatter.format(remaining)}${met === undefined ? "" : `; the application derived ${moneyFormatter.format(met)} met for the same scope`}. This current response does not explain or validate the historical EOB.`;
}

function BenefitValue({ label, value }: { label: string; value?: number }): React.ReactNode {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">
        {value === undefined ? "No devuelto" : moneyFormatter.format(value)}
      </dd>
    </div>
  );
}

function CurrentBenefitsCard({ result }: { result: CurrentBenefits }): React.ReactNode {
  const sourceLabel =
    result.source === "stedi-live-test"
      ? "Stedi live test"
      : result.source === "medplum-stedi-bot"
        ? "Medplum Stedi test"
        : "Fixture fallback · not live";

  return (
    <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="Current benefits snapshot">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">Beneficios actuales · revisión separada</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
          {sourceLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">Consultado {result.checkedAt}</p>
      <p className="mt-2 text-sm font-medium text-amber-950">
        Esta respuesta actual no reemplaza, explica ni valida el reclamo histórico.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Cobertura</dt>
          <dd className="font-semibold text-slate-900">
            {result.coverageActive === undefined
              ? "No devuelto"
              : result.coverageActive
                ? "Activa"
                : "Inactiva"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Plan</dt>
          <dd className="font-semibold text-slate-900">{result.planName ?? "No devuelto"}</dd>
        </div>
        <BenefitValue label="Deducible anual actual" value={result.benefits.annualDeductible} />
        <BenefitValue label="Deducible restante actual" value={result.benefits.remainingDeductible} />
        <BenefitValue label="Deducible cumplido actual" value={result.benefits.deductibleMetToDate} />
        <BenefitValue label="Out-of-pocket maximum" value={result.benefits.annualOutOfPocketMaximum} />
        <BenefitValue label="Remaining out-of-pocket" value={result.benefits.remainingOutOfPocketMaximum} />
      </dl>
      {result.benefits.copays.length > 0 || result.benefits.coinsurance.length > 0 ? (
        <div className="mt-3 border-t border-amber-200 pt-3 text-xs text-slate-700">
          {result.benefits.copays.map((copay) => (
            <p key={`copay-${copay.serviceLabel}-${copay.network ?? "unknown"}`}>
              {copay.serviceLabel}: {moneyFormatter.format(copay.amount)} copay
              {copay.network ? ` · ${copay.network} network` : ""}
            </p>
          ))}
          {result.benefits.coinsurance.map((coinsurance) => (
            <p key={`coinsurance-${coinsurance.serviceLabel}-${coinsurance.network ?? "unknown"}`}>
              {coinsurance.serviceLabel}: {coinsurance.percentage}% coinsurance
              {coinsurance.network ? ` · ${coinsurance.network} network` : ""}
            </p>
          ))}
        </div>
      ) : null}
      {result.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-amber-900">
          {result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function ResourceOptions({ resources }: { resources: SupportResource[] }): React.ReactNode {
  if (resources.length === 0) return null;
  return (
    <section className="mt-4 space-y-3" aria-label="Billing support resources">
      <h3 className="text-sm font-semibold text-slate-950">Support options</h3>
      {resources.map((resource) => (
        <article key={resource.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-950">{resource.name}</h4>
              <p className="text-xs text-slate-500">{resource.organization}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
              {resource.verification === "practice-provided"
                ? "Practice provided"
                : resource.verification === "fictional-demo-data"
                  ? "Fictional demo"
                  : "Unverified"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{resource.summary}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">{resource.disclosure}</p>
        </article>
      ))}
    </section>
  );
}

function FollowupStatus({ result }: { result: RequestFollowupResult }): React.ReactNode {
  const confirmed = result.created && result.status === "requested";
  return (
    <div
      role="status"
      className={`mt-4 rounded-2xl border p-4 text-sm ${
        confirmed
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-rose-200 bg-rose-50 text-rose-950"
      }`}
    >
      <strong>
        {confirmed
          ? "Caso de revisión confirmado por el servidor"
          : "El caso de revisión no se completó"}
      </strong>
      <p className="mt-1">{result.message}</p>
      {confirmed && result.taskId ? (
        <p className="mt-1 text-xs">ID del caso: {result.taskId}</p>
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
  events,
  setEvents,
  onClose,
}: BeneBotPanelProps & {
  events: ToolActivityEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ToolActivityEvent[]>>;
}): React.ReactNode {
  const { state, isConnected } = useAgentState();
  const { conversation, sendUserMessage } = useAgentConversation();
  const { mode } = useAgentMode();
  const agentSession = useAgentSession();
  const microphone = useAgentMicrophone();
  const player = useAgentPlayer();
  const [text, setText] = useState("");
  const [fallbackMessages, setFallbackMessages] = useState<FallbackMessage[]>([]);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [fallbackContext, setFallbackContext] = useState<FallbackContext>({
    language: "es",
    usedEnglish: false,
    usedSpanish: true,
    benefitsRefreshed: false,
    resourcesOffered: [],
    clarityAsked: false,
  });
  const [currentBenefits, setCurrentBenefits] = useState<CurrentBenefits>();
  const [followupResult, setFollowupResult] = useState<RequestFollowupResult>();
  const [summaryResult, setSummaryResult] = useState<SaveSummaryResult>();
  const [bargeInDetected, setBargeInDetected] = useState(false);

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
          ? "Claro. Continuaré en español. Puedes pedirme que explique la factura, revise los beneficios actuales o busque ayuda para pagar."
          : "Of course. I'll continue in English. You can ask me to explain the bill, check current benefits, or find payment help.",
      );
      setFallbackBusy(false);
      return;
    }

    if (intent.kind === "allowed-amount-interruption") {
      setBargeInDetected(true);
      appendFallbackMessage(
        "assistant",
        intent.language === "es"
          ? "El monto permitido es la cantidad negociada que el plan usa para procesar este reclamo. Aquí fue $1,100; no es lo mismo que los $2,400 facturados. ¿Quieres que continúe con el desglose?"
          : "The allowed amount is the negotiated amount the plan uses to process this claim. Here it was $1,100, not the same as the $2,400 billed. Would you like me to continue the breakdown?",
      );
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
          ? `Entiendo. Para confirmar: ${intent.issue.patientIssueSummary} ¿Quieres que cree un caso de revisión de facturación por mensaje seguro? Todavía no se ha creado nada.`
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
        const bill = billFallbackSchema.parse(JSON.parse(billResult) as unknown);
        setFallbackContext((current) => ({
          ...current,
          historicalSourceDate: bill.source.createdDate,
        }));

        const benefitsResult = await dispatchBeneBotTool({
          name: "refresh_current_benefits",
          argumentsJson: JSON.stringify({ reason: "compare-with-historical-claim" }),
          sessionToken,
          onActivity: appendActivity,
        });
        const benefits = benefitsFallbackSchema.parse(
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
          `${historicalBillReply(bill, intent.language)} ${currentBenefitsReply(benefits, intent.language)} ${
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
          const context = billFallbackSchema.parse(result);
          setFallbackContext((current) => ({
            ...current,
            historicalSourceDate: context.source.createdDate,
            clarityAsked: true,
          }));
          reply = `${historicalBillReply(context, intent.language)} ${
            intent.language === "es"
              ? "¿Hay algo que todavía no esté claro?"
              : "Is anything still unclear?"
          }`;
          break;
        }
        case "refresh_current_benefits": {
          const benefits = benefitsFallbackSchema.parse(result);
          setCurrentBenefits(benefits);
          setFallbackContext((current) => ({
            ...current,
            benefitsRefreshed: true,
            clarityAsked: true,
          }));
          reply = `${currentBenefitsReply(benefits, intent.language)} ${
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
              const summaryRaw = await dispatchBeneBotTool({
                name: "save_conversation_summary",
                argumentsJson: JSON.stringify({
                  language: summaryLanguage(usedEnglish, usedSpanish),
                  summary:
                    "Se explicó la factura usando la EOB histórica, se revisaron por separado los beneficios actuales y la paciente confirmó un caso de revisión de facturación.",
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
              ? `El servidor confirmó el caso de revisión de facturación. ID del caso: ${followup.taskId}. ${followup.message} ${summarySaved ? "También confirmó el resumen breve para el personal." : "El resumen para el personal no se guardó."}`
              : `The server confirmed the billing-review case. Case ID: ${followup.taskId}. ${followup.message} ${summarySaved ? "It also confirmed the concise staff summary." : "The staff summary was not saved."}`;
          } else {
            reply = intent.language === "es"
              ? `El seguimiento no se completó. ${followup.message}`
              : `The follow-up was not completed. ${followup.message}`;
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
      aria-label="Hablar con BeneBot"
      className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
      data-dg-agent
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Demostración sintética
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Habla sobre esta factura</h2>
          <p className="mt-1 text-sm text-slate-600">
            Español preferido · English supported
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="Cerrar BeneBot"
          >
            Cerrar
          </button>
        ) : null}
      </header>

      <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="font-semibold">Secure billing context verified</p>
        <p className="mt-1">
          Sesión segura — Jane Doe. Ya tengo esta factura desde el portal; no pediré Seguro Social, fecha de nacimiento, número de miembro ni identificación de paciente.
        </p>
      </div>

      {bargeInDetected ? (
        <div role="status" className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-sm font-medium text-violet-950">
          Interrupción detectada por Flux · audio de BeneBot detenido
        </div>
      ) : null}

      <div className="my-5 flex items-center gap-4 rounded-2xl bg-slate-950 p-4 text-white">
        <Orb
          size={72}
          state={mode === "speaking" ? "talking" : mode === "listening" ? "listening" : "idle"}
          getInputVolume={microphone.getInputVolume}
          getOutputVolume={player.getOutputVolume}
          colors={["#38bdf8", "#a78bfa"]}
        />
        <div>
          <AgentStatus
            labels={{
              idle: "Lista para voz o texto",
              connecting: "Solicitando micrófono…",
              connected: mode === "speaking" ? "BeneBot está hablando" : "BeneBot está escuchando",
              reconnecting: "Reconectando…",
              disconnected: "Voz desconectada — el texto sigue disponible",
            }}
          />
          <p className="mt-1 text-xs text-slate-300">No se guarda audio sin procesar.</p>
        </div>
      </div>

      <Transcript conversation={conversation} fallbackMessages={fallbackMessages} />

      {currentBenefits ? <CurrentBenefitsCard result={currentBenefits} /> : null}
      <ResourceOptions resources={fallbackContext.resourcesOffered} />
      {followupResult ? <FollowupStatus result={followupResult} /> : null}
      {summaryResult ? (
        <div
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            summaryResult.saved
              ? "bg-emerald-50 text-emerald-950"
              : "bg-rose-50 text-rose-950"
          }`}
        >
          {summaryResult.saved
            ? "Server confirmed: concise summary saved."
            : "Summary was not saved."}
        </div>
      ) : null}

      <form onSubmit={submitText} className="mt-4 flex gap-2">
        <label htmlFor="benebot-text" className="sr-only">
          Message BeneBot
        </label>
        <input
          id="benebot-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={state === "connected" ? "Escribe en vez de hablar…" : "El texto funciona aunque la voz no…"}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200"
        />
        <button
          type="submit"
          disabled={!text.trim() || fallbackBusy}
          className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fallbackBusy ? "Consultando…" : "Enviar"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AgentStartButton
          startLabel="Iniciar voz"
          connectingLabel="Conectando…"
          stopLabel="Terminar voz"
          reconnectingLabel="Reconectando…"
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
        />
        <AgentMicrophoneButton
          activeLabel="Silenciar micrófono"
          mutedLabel="Activar micrófono"
          disabledLabel="Micrófono no disponible"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <AgentSpeakerButton
          activeLabel="Silenciar audio"
          mutedLabel="Activar audio"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <ToolActivity events={events} />
      </div>
    </section>
  );
}

export function BeneBotPanel({ sessionToken, onClose }: BeneBotPanelProps): React.ReactNode {
  const [events, setEvents] = useState<ToolActivityEvent[]>([]);
  const appendActivity = useCallback(
    (event: ToolActivityEvent) => setEvents((current) => [...current, event]),
    [],
  );

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
    () => createDeepgramAgentConfig(tokenFactory),
    [tokenFactory],
  );

  const handleFunctionCall: NonNullable<AgentProviderProps["onFunctionCall"]> = useCallback(
    async (fn) => {
      const result = await dispatchBeneBotTool({
        name: fn.name,
        argumentsJson: fn.arguments,
        sessionToken,
        onActivity: appendActivity,
      });
      if (fn.name === "request_human_followup") {
        try {
          const followup = followupFallbackSchema.parse(
            JSON.parse(result) as unknown,
          );
          const request = JSON.parse(fn.arguments) as {
            patientIssueSummary?: string;
          };
          if (followup.created && followup.taskId) {
            const summaryArguments = JSON.stringify({
              language: "es",
              summary:
                "Se explicó la factura y la paciente confirmó un caso de revisión de facturación.",
              questionsAnswered: [
                "Historical bill explanation",
                "Current benefits refresh",
              ],
              resourcesOffered: [],
              followupTaskId: followup.taskId,
              unresolvedIssues: request.patientIssueSummary
                ? [request.patientIssueSummary]
                : [],
            });
            // Medplum can briefly lag between confirming the Task write and
            // making that Task readable to the Communication validator.
            await new Promise((resolve) => setTimeout(resolve, 500));
            let summaryResult = await dispatchBeneBotTool({
              name: "save_conversation_summary",
              argumentsJson: summaryArguments,
              sessionToken,
              onActivity: appendActivity,
            });
            if (!saveSummaryFallbackSchema.safeParse(JSON.parse(summaryResult)).success) {
              await new Promise((resolve) => setTimeout(resolve, 750));
              summaryResult = await dispatchBeneBotTool({
                name: "save_conversation_summary",
                argumentsJson: summaryArguments,
                sessionToken,
                onActivity: appendActivity,
              });
            }
          }
        } catch {
          // The confirmed Task remains valid; the tool result must not claim
          // that the separate Communication write succeeded.
        }
      }
      return result;
    },
    [appendActivity, sessionToken],
  );

  return (
    <AgentProvider
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
        onClose={onClose}
        events={events}
        setEvents={setEvents}
      />
    </AgentProvider>
  );
}
