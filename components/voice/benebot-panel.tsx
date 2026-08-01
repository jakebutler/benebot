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
  useAgentState,
  type AgentProviderProps,
} from "@deepgram/ui";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { z } from "zod";

import type {
  RequestFollowupResult,
  SaveSummaryResult,
  SupportResource,
  ToolActivityEvent,
} from "@/lib/contracts";
import { createDeepgramAgentConfig } from "@/lib/deepgram/config";
import {
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
  providerName: z.string(),
  serviceDescription: z.string(),
  dateOfService: z.string(),
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
  pendingResourceId?: z.infer<typeof resourceIdSchema>;
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

function BenefitValue({ label, value }: { label: string; value?: number }): React.ReactNode {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">
        {value === undefined ? "Not returned" : moneyFormatter.format(value)}
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
        <h3 className="font-semibold text-slate-950">Current benefits snapshot</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
          {sourceLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">Checked {result.checkedAt}</p>
      <p className="mt-2 text-sm font-medium text-amber-950">
        This current response does not replace or explain the historical claim.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Coverage</dt>
          <dd className="font-semibold text-slate-900">
            {result.coverageActive === undefined
              ? "Not returned"
              : result.coverageActive
                ? "Active"
                : "Inactive"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Plan</dt>
          <dd className="font-semibold text-slate-900">{result.planName ?? "Not returned"}</dd>
        </div>
        <BenefitValue label="Annual deductible" value={result.benefits.annualDeductible} />
        <BenefitValue label="Remaining deductible" value={result.benefits.remainingDeductible} />
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

function ResourceOptions({
  resources,
  pendingResourceId,
  onSelect,
}: {
  resources: SupportResource[];
  pendingResourceId?: string;
  onSelect: (resource: SupportResource) => void;
}): React.ReactNode {
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
          <button
            type="button"
            onClick={() => onSelect(resource)}
            className="mt-3 rounded-lg border border-sky-700 px-3 py-2 text-xs font-semibold text-sky-800"
          >
            {pendingResourceId === resource.id ? "Selected · type yes to confirm" : "Choose for follow-up"}
          </button>
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
      <strong>{confirmed ? "Server confirmed follow-up" : "Follow-up not completed"}</strong>
      <p className="mt-1">{result.message}</p>
      {confirmed && result.taskId ? <p className="mt-1 text-xs">Task {result.taskId}</p> : null}
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
  const microphone = useAgentMicrophone();
  const player = useAgentPlayer();
  const [text, setText] = useState("");
  const [fallbackMessages, setFallbackMessages] = useState<FallbackMessage[]>([]);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [fallbackContext, setFallbackContext] = useState<FallbackContext>({
    language: "en",
    usedEnglish: false,
    usedSpanish: false,
    benefitsRefreshed: false,
    resourcesOffered: [],
  });
  const [currentBenefits, setCurrentBenefits] = useState<CurrentBenefits>();
  const [followupResult, setFollowupResult] = useState<RequestFollowupResult>();
  const [summaryResult, setSummaryResult] = useState<SaveSummaryResult>();

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

  const chooseResource = useCallback((resource: SupportResource): void => {
    const resourceId = resourceIdSchema.parse(resource.id);
    setFallbackContext((current) => ({ ...current, pendingResourceId: resourceId }));
    appendFallbackMessage(
      "assistant",
      `You selected ${resource.name}. Type “yes” to confirm a secure-message follow-up, or choose another option. Nothing has been created yet.`,
    );
  }, [appendFallbackMessage]);

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
      pendingResourceId: fallbackContext.pendingResourceId,
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
          fallbackContext.pendingResourceId && !fallbackContext.followupTaskId
            ? ["Offered follow-up was not confirmed or completed."]
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
          }));
          if (!context.mathReconciles) {
            reply = intent.language === "es"
              ? "Puedo ver la factura, pero los importes no coinciden con suficiente confianza. Puedo pedir una revisión del equipo de facturación."
              : "I can see the bill, but the amounts do not reconcile confidently enough to explain. I can request a billing-team review.";
          } else {
            const values = context.historicalAdjudication;
            reply = intent.language === "es"
              ? `La adjudicación histórica del ${context.source.createdDate} muestra que ${context.providerName} facturó $${values.billedAmount}. El descuento contractual fue $${values.contractualAdjustment}, dejando $${values.allowedAmount}. Se aplicaron $${values.deductibleApplied} al deducible y $${values.coinsuranceAmount} al coseguro. El seguro pagó $${values.insurerPaid}; la responsabilidad del paciente fue $${values.patientResponsibility}. Así procesó la aseguradora el reclamo; no prueba que sea correcto.`
              : `The historical adjudication dated ${context.source.createdDate} shows ${context.providerName} billed $${values.billedAmount}. The contractual discount was $${values.contractualAdjustment}, leaving $${values.allowedAmount}. Of that, $${values.deductibleApplied} applied to deductible and $${values.coinsuranceAmount} to coinsurance. The insurer paid $${values.insurerPaid}; patient responsibility was $${values.patientResponsibility}. This is how the insurer processed the claim; it does not prove the claim is correct.`;
          }
          break;
        }
        case "refresh_current_benefits": {
          const benefits = benefitsFallbackSchema.parse(result);
          setCurrentBenefits(benefits);
          setFallbackContext((current) => ({ ...current, benefitsRefreshed: true }));
          const source = benefits.source === "fixture-fallback"
            ? intent.language === "es" ? "datos de respaldo de demostración, no una respuesta en vivo" : "demo fallback data, not a live payer response"
            : benefits.source === "stedi-live-test"
              ? intent.language === "es" ? "la respuesta de prueba en vivo de Stedi" : "the live Stedi test response"
              : intent.language === "es" ? "la respuesta de prueba de Medplum Stedi" : "the Medplum Stedi test response";
          const remaining = benefits.benefits.remainingDeductible;
          reply = intent.language === "es"
            ? `Revisé ${source} a las ${benefits.checkedAt}. El deducible restante ${remaining === undefined ? "no fue devuelto" : `fue ${moneyFormatter.format(remaining)}`}. Esta información actual no reemplaza ni explica la adjudicación histórica del reclamo.`
            : `I checked ${source} at ${benefits.checkedAt}. Remaining deductible was ${remaining === undefined ? "not returned" : moneyFormatter.format(remaining)}. This current information does not replace or explain the historical claim adjudication.`;
          break;
        }
        case "search_support_resources": {
          const resources = resourcesFallbackSchema.parse(result).resources;
          setFallbackContext((current) => ({
            ...current,
            resourcesOffered: resources,
            pendingResourceId: resources[0]?.id,
          }));
          if (resources.length === 0) {
            reply = intent.language === "es"
              ? "No encontré una opción de ayuda para pagos en los datos de demostración."
              : "I did not find a payment-help option in the demo data.";
          } else {
            const first = resources[0];
            reply = intent.language === "es"
              ? `Encontré ${resources.length} opción u opciones con etiquetas de fuente. La primera es ${first.name}. ${first.disclosure} Si quieres un seguimiento por mensaje seguro para esta opción, escribe “sí”. Aún no se ha creado nada.`
              : `I found ${resources.length} source-labeled option(s). The first is ${first.name}. ${first.disclosure} If you want a secure-message follow-up for this option, type “yes.” Nothing has been created yet.`;
          }
          break;
        }
        case "request_human_followup": {
          const followup = followupFallbackSchema.parse(result);
          setFollowupResult(followup);
          if (followup.created && followup.status === "requested") {
            setFallbackContext((current) => ({
              ...current,
              pendingResourceId: undefined,
              followupTaskId: followup.taskId,
            }));
            reply = intent.language === "es"
              ? `El servidor confirmó el seguimiento. ${followup.message}`
              : `The server confirmed the follow-up. ${followup.message}`;
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
      aria-label="Talk with BeneBot"
      className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
      data-dg-agent
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Synthetic demo
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Talk about this bill</h2>
          <p className="mt-1 text-sm text-slate-600">
            English · Español · switch anytime
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="Close BeneBot"
          >
            Close
          </button>
        ) : null}
      </header>

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
              idle: "Ready for voice or text",
              connecting: "Requesting microphone…",
              connected: mode === "speaking" ? "BeneBot is speaking" : "BeneBot is listening",
              reconnecting: "Reconnecting…",
              disconnected: "Voice disconnected — text still works",
            }}
          />
          <p className="mt-1 text-xs text-slate-300">No raw audio is stored.</p>
        </div>
      </div>

      <Transcript conversation={conversation} fallbackMessages={fallbackMessages} />

      {currentBenefits ? <CurrentBenefitsCard result={currentBenefits} /> : null}
      <ResourceOptions
        resources={fallbackContext.resourcesOffered}
        pendingResourceId={fallbackContext.pendingResourceId}
        onSelect={chooseResource}
      />
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
          placeholder={state === "connected" ? "Type instead of speaking…" : "Text works even if voice doesn't…"}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200"
        />
        <button
          type="submit"
          disabled={!text.trim() || fallbackBusy}
          className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fallbackBusy ? "Checking…" : "Send"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AgentStartButton
          startLabel="Start voice"
          connectingLabel="Connecting…"
          stopLabel="End voice"
          reconnectingLabel="Reconnecting…"
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
        />
        <AgentMicrophoneButton
          activeLabel="Mute mic"
          mutedLabel="Unmute mic"
          disabledLabel="Mic unavailable"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <AgentSpeakerButton
          activeLabel="Mute sound"
          mutedLabel="Unmute sound"
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
    (fn) =>
      dispatchBeneBotTool({
        name: fn.name,
        argumentsJson: fn.arguments,
        sessionToken,
        onActivity: appendActivity,
      }),
    [appendActivity, sessionToken],
  );

  return (
    <AgentProvider
      config={config}
      microphone
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
