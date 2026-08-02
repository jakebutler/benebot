import type { Language } from "@/lib/contracts";

import { TOOL_INPUT_LIMITS } from "./tool-contracts";

export interface VoiceConfirmationEvidence {
  latestUserMessage?: string;
  promptBeforeLatestUser?: string;
}

export interface ConfirmationConversationEntry {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceConfirmationTracker {
  assistantSinceLastUser: string[];
  evidence: VoiceConfirmationEvidence;
}

export interface GuardedToolDispatchResult {
  dispatched: boolean;
  result: string;
}

const explicitConfirmation =
  /^(?:yes|yes,?\s*please|yes,?\s*create (?:the )?case|please do|confirm|confirmed|go ahead|do it|sí|si|sí,?\s*por favor|si,?\s*por favor|sí,?\s*cree el caso|si,?\s*cree el caso|confirmo|hazlo|adelante|de acuerdo)[.!¡¿?]*$/iu;

export function createVoiceConfirmationTracker(): VoiceConfirmationTracker {
  return { assistantSinceLastUser: [], evidence: {} };
}

export function recordVoiceConversationEntry(
  tracker: VoiceConfirmationTracker,
  entry: ConfirmationConversationEntry,
): VoiceConfirmationTracker {
  if (entry.role === "assistant") {
    return {
      ...tracker,
      assistantSinceLastUser: [...tracker.assistantSinceLastUser, entry.content],
    };
  }
  return {
    assistantSinceLastUser: [],
    evidence: {
      latestUserMessage: entry.content,
      promptBeforeLatestUser: tracker.assistantSinceLastUser.join(" "),
    },
  };
}

export function isExplicitFollowupConfirmation(value: string | undefined): boolean {
  return value !== undefined && explicitConfirmation.test(value.trim());
}

export function isExplicitFollowupPrompt(
  value: string | undefined,
  language: Language,
): boolean {
  if (!value) return false;
  if (language === "es") {
    return (
      /caso de revisión/i.test(value) &&
      /(mensaje seguro|teléfono)/i.test(value) &&
      /(¿quiere|¿desea|confirma|autoriza)/i.test(value)
    );
  }
  return (
    /billing[- ]review case/i.test(value) &&
    /(secure message|phone|telephone)/i.test(value) &&
    /(would you like|do you confirm|do you authorize|shall i)/i.test(value)
  );
}

function defaultIssueSummary(language: Language): string {
  return language === "es"
    ? "La paciente no reconoce el servicio incluido en la factura."
    : "The patient does not recognize the service listed on the bill.";
}

function validatedIssueSummary(argumentsJson: string, language: Language): string {
  try {
    const parsed: unknown = JSON.parse(argumentsJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "patientIssueSummary" in parsed &&
      typeof parsed.patientIssueSummary === "string"
    ) {
      const summary = parsed.patientIssueSummary.trim();
      if (
        summary.length > 0 &&
        summary.length <= TOOL_INPUT_LIMITS.followupIssueSummary
      ) {
        return summary;
      }
    }
  } catch {
    // Invalid model arguments are never reflected into the patient prompt.
  }
  return defaultIssueSummary(language);
}

function confirmationRequiredResponse(
  argumentsJson: string,
  language: Language,
): string {
  const patientIssueSummary = validatedIssueSummary(argumentsJson, language);
  return language === "es"
    ? `Para confirmar: ${patientIssueSummary} ¿Quiere que cree un caso de revisión de facturación por mensaje seguro? Todavía no se ha creado nada.`
    : `To confirm: ${patientIssueSummary} Would you like me to create a billing-review case by secure message? Nothing has been created yet.`;
}

export async function dispatchWithFollowupConfirmation(options: {
  toolName: string;
  argumentsJson: string;
  language: Language;
  evidence: VoiceConfirmationEvidence;
  dispatch: () => Promise<string>;
}): Promise<GuardedToolDispatchResult> {
  const { toolName, argumentsJson, language, evidence, dispatch } = options;
  if (
    toolName === "request_human_followup" &&
    (!isExplicitFollowupConfirmation(evidence.latestUserMessage) ||
      !isExplicitFollowupPrompt(evidence.promptBeforeLatestUser, language))
  ) {
    const requiredResponse = confirmationRequiredResponse(argumentsJson, language);
    return {
      dispatched: false,
      result: JSON.stringify({
        created: false,
        status: "failed",
        error: "EXPLICIT_PATIENT_CONFIRMATION_REQUIRED",
        instruction:
          "Speak requiredResponse verbatim. Do not call the tool again until the patient explicitly confirms.",
        requiredResponse,
      }),
    };
  }
  return { dispatched: true, result: await dispatch() };
}
