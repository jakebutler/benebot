import { describe, expect, it } from "vitest";

import {
  routeTextFallbackIntent,
  summaryLanguage,
} from "../../lib/deepgram/text-fallback";

describe("disconnected text fallback routing", () => {
  it("routes historical bill questions to reconciled bill context", () => {
    expect(
      routeTextFallbackIntent("Why do I owe $620?", { language: "en" }),
    ).toMatchObject({ tool: "get_bill_context", arguments: {} });
  });

  it("routes current deductible questions to current benefits", () => {
    expect(
      routeTextFallbackIntent("Is that still my deductible?", { language: "en" }),
    ).toMatchObject({
      tool: "refresh_current_benefits",
      arguments: { reason: "patient-request" },
    });
  });

  it("switches to Spanish without an external call", () => {
    expect(
      routeTextFallbackIntent("Español, por favor", { language: "en" }),
    ).toEqual({ kind: "switch-language", language: "es" });
  });

  it("routes a Spanish explanation through historical bill context", () => {
    expect(
      routeTextFallbackIntent("Explica mi factura en español", { language: "en" }),
    ).toMatchObject({ language: "es", tool: "get_bill_context" });
  });

  it("runs the Spanish complex demo question as historical then current checks", () => {
    expect(
      routeTextFallbackIntent(
        "Me cobraron $2,400 por la resonancia, pero el monto permitido fue $1,100 y todavía debo $620. ¿Cómo llegaron a esa cantidad? ¿Y significa que todavía me quedan $500 de deducible?",
        { language: "es" },
      ),
    ).toEqual({
      kind: "tool-sequence",
      language: "es",
      tools: [
        { tool: "get_bill_context", arguments: {} },
        {
          tool: "refresh_current_benefits",
          arguments: { reason: "compare-with-historical-claim" },
        },
      ],
    });
  });

  it("handles the rehearsed allowed-amount interruption without a tool call", () => {
    expect(
      routeTextFallbackIntent("Espere — ¿qué significa monto permitido?", {
        language: "es",
      }),
    ).toEqual({ kind: "allowed-amount-interruption", language: "es" });
  });

  it("routes payment hardship to payment-plan resources", () => {
    expect(
      routeTextFallbackIntent("I cannot afford this bill", { language: "en" }),
    ).toMatchObject({
      tool: "search_support_resources",
      arguments: { need: "payment-plan", language: "en" },
    });
  });

  it("requires a categorized issue before confirmation can create a case", () => {
    expect(
      routeTextFallbackIntent("yes", { language: "en" }),
    ).toMatchObject({ tool: "get_bill_context" });

    expect(
      routeTextFallbackIntent("sí", {
        language: "es",
        pendingIssue: {
          issueType: "deductible",
          patientIssueSummary:
            "La paciente sigue confundida sobre el deducible aplicado al reclamo histórico y el deducible actual.",
        },
      }),
    ).toMatchObject({
      tool: "request_human_followup",
      arguments: {
        issueType: "deductible",
        patientIssueSummary:
          "La paciente sigue confundida sobre el deducible aplicado al reclamo histórico y el deducible actual.",
        preferredContact: "secure-message",
        patientConfirmed: true,
      },
    });
  });

  it("categorizes confusion and asks confirmation before creating a case", () => {
    expect(
      routeTextFallbackIntent(
        "Todavía no entiendo la diferencia entre el deducible de julio y el actual",
        { language: "es", clarityAsked: true },
      ),
    ).toMatchObject({
      kind: "prepare-followup",
      language: "es",
      issue: { issueType: "deductible" },
    });
  });

  it("asks whether anything is unclear before ending", () => {
    expect(
      routeTextFallbackIntent("That's all, save it", { language: "en" }),
    ).toEqual({ kind: "ask-clarity", language: "en" });

    expect(
      routeTextFallbackIntent("Eso es todo", {
        language: "es",
        clarityAsked: true,
      }),
    ).toMatchObject({ tool: "save_conversation_summary" });
  });

  it("records mixed language without storing a transcript", () => {
    expect(summaryLanguage(true, true)).toBe("mixed");
    expect(summaryLanguage(false, true)).toBe("es");
  });
});
