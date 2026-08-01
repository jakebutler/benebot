import { describe, expect, it } from "vitest";

import goldRuntimeConcepts from "@/benebot-gold-packet/runtime-concepts.json";
import { createApprovedConceptGuidance } from "@/lib/deepgram/concept-guidance";
import { createBeneBotAgentPrompt } from "@/lib/deepgram/prompt";
import { TOOL_PREREQUISITES } from "@/lib/deepgram/prerequisites";

const demoFinancialStrings = [
  "$2,400",
  "$1,300",
  "$1,100",
  "$620",
  "$500",
  "$480",
  "$120",
  "2,400 dollars",
  "1,100 dollars",
  "620 dollars",
  "500 dollars",
];

describe("BeneBot agent prompt", () => {
  it.each(["en", "es"] as const)(
    "contains no Jane-specific financial values in the %s prompt",
    (language) => {
      const prompt = createBeneBotAgentPrompt(language);
      for (const value of demoFinancialStrings) {
        expect(prompt).not.toContain(value);
      }
    },
  );

  it("compiles the six adjudicated concepts without importing numbered examples", () => {
    const goldIds = goldRuntimeConcepts.map((concept) => concept.conceptId);
    const guidance = createApprovedConceptGuidance("es");

    expect(goldIds).toEqual([
      "allowed-amount",
      "explanation-of-benefits",
      "deductible",
      "coinsurance",
      "copayment",
      "out-of-pocket-maximum",
    ]);
    for (const conceptId of goldIds) expect(guidance).toContain(`- ${conceptId}:`);
    expect(guidance).toContain("presupuesto de proyecto aprobado");
    expect(guidance).toContain("copiloto");
    expect(guidance).not.toContain("$1,100");
    expect(guidance).not.toContain("20%");
  });

  it("encodes the exact closed five-tool prerequisite set", () => {
    const prompt = createBeneBotAgentPrompt("en");
    const tools = Object.keys(TOOL_PREREQUISITES);

    expect(tools).toEqual([
      "get_bill_context",
      "refresh_current_benefits",
      "search_support_resources",
      "request_human_followup",
      "save_conversation_summary",
    ]);
    for (const tool of tools) expect(prompt).toContain(`- ${tool}: USE WHEN`);
    expect(prompt).not.toContain("get_current_benefits");
    expect(prompt).not.toContain("get_eob_details");
  });

  it("requires deterministic tool narration and keeps session language fixed", () => {
    const englishPrompt = createBeneBotAgentPrompt("en");
    const spanishPrompt = createBeneBotAgentPrompt("es");

    expect(englishPrompt).toContain("read its requiredResponse verbatim");
    expect(englishPrompt).toContain(
      "first call get_bill_context and read its deterministic historical requiredResponse",
    );
    expect(englishPrompt).toContain("Then call refresh_current_benefits");
    expect(englishPrompt).toContain(
      "Make a historical/current comparison only after both calls succeed",
    );
    expect(englishPrompt).toContain("Always respond in English");
    expect(spanishPrompt).toContain("Always respond in Spanish");
    expect(englishPrompt).toContain(
      "BeneBot supports only English and Spanish",
    );
    expect(englishPrompt).toContain("do not call a tool or guess at the request");
    expect(spanishPrompt).toContain("APPROVED CONCEPT GUIDANCE — ES-419");
    expect(englishPrompt).not.toContain("¿");
    expect(englishPrompt).not.toContain("monto permitido");
    expect(englishPrompt).not.toContain("todavía no esté claro");
    expect(spanishPrompt).not.toContain("Would you like me to continue");
  });
});
