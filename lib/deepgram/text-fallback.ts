import type { Language, RequestFollowupInput, ToolName } from "../contracts";

export interface PendingBillingIssue {
  issueType: RequestFollowupInput["issueType"];
  patientIssueSummary: string;
}

export interface TextFallbackRoutingState {
  language: Language;
  pendingIssue?: PendingBillingIssue;
  clarityAsked?: boolean;
}

export type TextFallbackIntent =
  | { kind: "switch-language"; language: Language }
  | { kind: "allowed-amount-interruption"; language: Language }
  | { kind: "prepare-followup"; language: Language; issue: PendingBillingIssue }
  | { kind: "ask-clarity"; language: Language }
  | {
      kind: "tool";
      language: Language;
      tool: ToolName;
      arguments: Record<string, unknown>;
    }
  | {
      kind: "tool-sequence";
      language: Language;
      tools: Array<{
        tool: "get_bill_context" | "refresh_current_benefits";
        arguments: Record<string, unknown>;
      }>;
    };

const spanishWords =
  /\b(hola|factura|español|espanol|debo|deducible|seguro|ayuda|pagar|terminar|guardar|sí|si|monto|permitido|resonancia|todavía|todavia|confundida|confundido)\b/i;
const englishRequest = /\b(english|inglés|ingles)\b/i;
const spanishRequest = /\b(spanish|español|espanol)\b/i;
const billIntent =
  /\b(bill|charge|owe|claim|breakdown|explain|allowed amount|factura|cobro|debo|reclamo|explica|explicar|monto permitido|resonancia)\b/i;
const benefitsIntent =
  /\b(current benefits?|eligibility|deductible|coverage|beneficios?|elegibilidad|deducible|cobertura|todavía me quedan|todavia me quedan)\b/i;
const hardshipIntent =
  /\b(can'?t pay|cannot pay|hardship|payment plan|financial help|afford|ayuda financiera|no puedo pagar|plan de pagos?|dificultad económica)\b/i;
const saveIntent =
  /\b(done|finish|finished|end|save|goodbye|that'?s all|terminar|terminado|guardar|adiós|adios|eso es todo)\b/i;
const explicitConfirmation =
  /^(yes|yes please|please do|confirm|confirmed|go ahead|do it|sí|si|sí por favor|si por favor|confirmo|hazlo|adelante|de acuerdo)[.!]?$/i;
const confusionIntent =
  /\b(still confused|still unclear|don'?t understand|do not understand|doesn'?t make sense|no entiendo|sigo confundida|sigo confundido|todavía no entiendo|todavia no entiendo|no me queda claro|aún no|aun no)\b/i;
const allowedAmountInterruption =
  /(?:espere|espera|wait).*(?:qué|que|what).*(?:monto permitido|allowed amount)|(?:qué|que|what)\s+(?:significa|is)\s+(?:el\s+)?(?:monto permitido|allowed amount)/i;

export function inferTextLanguage(message: string, current: Language): Language {
  if (englishRequest.test(message)) return "en";
  if (spanishRequest.test(message) || spanishWords.test(message)) return "es";
  return current;
}

export function categorizeBillingIssue(
  message: string,
  language: Language,
): PendingBillingIssue {
  const normalized = message.toLowerCase();
  if (/deductible|deducible/.test(normalized)) {
    return {
      issueType: "deductible",
      patientIssueSummary:
        language === "es"
          ? "La paciente sigue confundida sobre el deducible aplicado al reclamo histórico y el deducible actual."
          : "The patient remains confused about the historical claim deductible and the current deductible.",
    };
  }
  if (/coinsurance|coaseguro|coseguro/.test(normalized)) {
    return {
      issueType: "coinsurance",
      patientIssueSummary:
        language === "es"
          ? "La paciente sigue confundida sobre el coaseguro de la factura."
          : "The patient remains confused about the bill's coinsurance.",
    };
  }
  if (/not mine|didn'?t receive|don'?t recognize|no recibí|no recibi|no reconozco/.test(normalized)) {
    return {
      issueType: "service-not-recognized",
      patientIssueSummary:
        language === "es"
          ? "La paciente no reconoce el servicio incluido en la factura."
          : "The patient does not recognize the service on the bill.",
    };
  }
  if (/wrong amount|dispute|incorrect|cantidad incorrecta|monto incorrecto|disput/.test(normalized)) {
    return {
      issueType: "amount-dispute",
      patientIssueSummary:
        language === "es"
          ? "La paciente disputa el monto de la factura y solicita una revisión."
          : "The patient disputes the bill amount and requests review.",
    };
  }
  if (hardshipIntent.test(normalized)) {
    return {
      issueType: "financial-hardship",
      patientIssueSummary:
        language === "es"
          ? "La paciente informa dificultad financiera para pagar la factura."
          : "The patient reports financial hardship paying the bill.",
    };
  }
  return {
    issueType: "bill-explanation",
    patientIssueSummary:
      language === "es"
        ? "La paciente sigue confundida sobre cómo se calculó su responsabilidad de $620."
        : "The patient remains confused about how the $620 responsibility was determined.",
  };
}

export function routeTextFallbackIntent(
  message: string,
  state: TextFallbackRoutingState,
): TextFallbackIntent {
  const normalized = message.trim();
  const language = inferTextLanguage(normalized, state.language);

  if (state.pendingIssue && explicitConfirmation.test(normalized)) {
    return {
      kind: "tool",
      language,
      tool: "request_human_followup",
      arguments: {
        ...state.pendingIssue,
        preferredContact: "secure-message",
        patientConfirmed: true,
      },
    };
  }

  if (allowedAmountInterruption.test(normalized)) {
    return { kind: "allowed-amount-interruption", language };
  }

  if (confusionIntent.test(normalized)) {
    return {
      kind: "prepare-followup",
      language,
      issue: categorizeBillingIssue(normalized, language),
    };
  }

  if (saveIntent.test(normalized)) {
    if (!state.clarityAsked) return { kind: "ask-clarity", language };
    return {
      kind: "tool",
      language,
      tool: "save_conversation_summary",
      arguments: {},
    };
  }

  const asksAboutBill = billIntent.test(normalized);
  const asksAboutBenefits = benefitsIntent.test(normalized);
  if (asksAboutBill && asksAboutBenefits) {
    return {
      kind: "tool-sequence",
      language,
      tools: [
        { tool: "get_bill_context", arguments: {} },
        {
          tool: "refresh_current_benefits",
          arguments: { reason: "compare-with-historical-claim" },
        },
      ],
    };
  }

  if (asksAboutBenefits) {
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

  if (
    (spanishRequest.test(normalized) || englishRequest.test(normalized)) &&
    !asksAboutBill
  ) {
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
