import type {
  Language,
  RequestFollowupInput,
  ToolName,
} from "../contracts";

export interface TextFallbackRoutingState {
  language: Language;
  pendingResourceId?: RequestFollowupInput["resourceId"];
}

export type TextFallbackIntent =
  | { kind: "switch-language"; language: Language }
  | {
      kind: "tool";
      language: Language;
      tool: ToolName;
      arguments: Record<string, unknown>;
    };

const spanishWords =
  /\b(hola|factura|español|espanol|debo|deducible|seguro|ayuda|pagar|terminar|guardar|sí|si)\b/i;
const englishRequest = /\b(english|inglés|ingles)\b/i;
const spanishRequest = /\b(spanish|español|espanol)\b/i;
const billIntent =
  /\b(bill|charge|owe|claim|breakdown|explain|factura|cobro|debo|reclamo|explica|explicar)\b/i;
const benefitsIntent =
  /\b(current benefits?|eligibility|deductible|coverage|beneficios?|elegibilidad|deducible|cobertura)\b/i;
const hardshipIntent =
  /\b(can'?t pay|cannot pay|hardship|payment plan|financial help|afford|ayuda financiera|no puedo pagar|plan de pagos?|dificultad económica)\b/i;
const saveIntent =
  /\b(done|finish|finished|end|save|goodbye|that'?s all|terminar|terminado|guardar|adiós|adios|eso es todo)\b/i;
const explicitConfirmation =
  /^(yes|yes please|please do|confirm|confirmed|go ahead|do it|sí|si|sí por favor|si por favor|confirmo|hazlo|adelante|de acuerdo)[.!]?$/i;

export function inferTextLanguage(message: string, current: Language): Language {
  if (englishRequest.test(message)) return "en";
  if (spanishRequest.test(message) || spanishWords.test(message)) return "es";
  return current;
}

export function routeTextFallbackIntent(
  message: string,
  state: TextFallbackRoutingState,
): TextFallbackIntent {
  const normalized = message.trim();
  const language = inferTextLanguage(normalized, state.language);

  if (saveIntent.test(normalized)) {
    return {
      kind: "tool",
      language,
      tool: "save_conversation_summary",
      arguments: {},
    };
  }

  if (state.pendingResourceId && explicitConfirmation.test(normalized)) {
    return {
      kind: "tool",
      language,
      tool: "request_human_followup",
      arguments: {
        resourceId: state.pendingResourceId,
        preferredContact: "secure-message",
        notes: "Patient confirmed this concise BeneBot billing follow-up request.",
      },
    };
  }

  if (benefitsIntent.test(normalized)) {
    return {
      kind: "tool",
      language,
      tool: "refresh_current_benefits",
      arguments: { reason: "patient-request" },
    };
  }

  if (hardshipIntent.test(normalized)) {
    return {
      kind: "tool",
      language,
      tool: "search_support_resources",
      arguments: { need: "payment-plan", language },
    };
  }

  if ((spanishRequest.test(normalized) || englishRequest.test(normalized)) && !billIntent.test(normalized)) {
    return { kind: "switch-language", language };
  }

  return {
    kind: "tool",
    language,
    tool: "get_bill_context",
    arguments: {},
  };
}

export function summaryLanguage(
  usedEnglish: boolean,
  usedSpanish: boolean,
): "en" | "es" | "mixed" {
  if (usedEnglish && usedSpanish) return "mixed";
  return usedSpanish ? "es" : "en";
}

