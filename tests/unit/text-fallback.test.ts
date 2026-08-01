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

  it("routes payment hardship to payment-plan resources", () => {
    expect(
      routeTextFallbackIntent("I cannot afford this bill", { language: "en" }),
    ).toMatchObject({
      tool: "search_support_resources",
      arguments: { need: "payment-plan", language: "en" },
    });
  });

  it("requires an offered resource before confirmation can request follow-up", () => {
    expect(
      routeTextFallbackIntent("yes", { language: "en" }),
    ).toMatchObject({ tool: "get_bill_context" });

    expect(
      routeTextFallbackIntent("yes please", {
        language: "en",
        pendingResourceId: "bayview-payment-plan",
      }),
    ).toMatchObject({
      tool: "request_human_followup",
      arguments: {
        resourceId: "bayview-payment-plan",
        preferredContact: "secure-message",
      },
    });
  });

  it("routes ending the session to concise summary persistence", () => {
    expect(
      routeTextFallbackIntent("That's all, save it", { language: "en" }),
    ).toMatchObject({ tool: "save_conversation_summary" });
  });

  it("records mixed language without storing a transcript", () => {
    expect(summaryLanguage(true, true)).toBe("mixed");
    expect(summaryLanguage(false, true)).toBe("es");
  });
});

