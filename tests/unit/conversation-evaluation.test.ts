import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXECUTABLE_RUBRICS,
  RUBRIC_IDS,
  classifyPacketToolName,
  evaluationRunRecordSchema,
  loadGoldPacket,
} from "@/lib/evaluation/conversation-evaluation";

const goldPacketPath = resolve(process.cwd(), "benebot-gold-packet");

describe("conversation evaluation contracts", () => {
  it("uses the reliability plan's exact eight executable rubric IDs and definitions", () => {
    const packet = loadGoldPacket(goldPacketPath);

    expect(EXECUTABLE_RUBRICS.map((rubric) => rubric.id)).toEqual(RUBRIC_IDS);
    expect(new Set(EXECUTABLE_RUBRICS.map((rubric) => rubric.id)).size).toBe(8);
    expect(packet.researchRubrics.rubrics.map((rubric) => rubric.id)).toEqual(RUBRIC_IDS);
    expect(packet.researchRubricConflicts).toHaveLength(8);
    expect(packet.researchRubricConflicts[0]).toMatchObject({
      rubricId: "R1",
      executable: { name: "Session language and voice consistency" },
      research: { name: "No Invented Financial Facts" },
    });
  });

  it("strictly parses the synthetic gold transcript cases", () => {
    const packet = loadGoldPacket(goldPacketPath);

    expect(packet.cases).toHaveLength(24);
    expect(new Set(packet.cases.map((testCase) => testCase.caseId)).size).toBe(24);
    expect(packet.cases.every((testCase) => testCase.utterance.length > 0)).toBe(true);
  });

  it("surfaces packet tool names that P0 does not expose without aliasing them", () => {
    const packet = loadGoldPacket(goldPacketPath);

    expect(packet.toolReferences).toEqual(
      expect.arrayContaining([
        { name: "get_bill_context", disposition: "runtime" },
        { name: "get_current_benefits", disposition: "deferred" },
        { name: "get_eob_details", disposition: "deferred" },
        { name: "get_clinical_notes", disposition: "unsupported" },
        { name: "refill_prescription", disposition: "unsupported" },
        { name: "change_insurance_plan", disposition: "unsupported" },
      ]),
    );
    expect(classifyPacketToolName("get_current_benefits")).not.toBe("runtime");
  });

  it("requires evidence-linked rubric scores and separate information and procedural review", () => {
    const score = {
      applicability: "applicable" as const,
      score: 2 as const,
      rationale: "Observed in the bounded synthetic session.",
      evidence: [{
        kind: "transcript-turn" as const,
        turnId: "turn-1",
        excerpt: "The bounded evidence excerpt.",
      }],
    };
    const parsed = evaluationRunRecordSchema.parse({
      runId: "b5a20ce3-31a6-43a4-bbe6-6ca24ab7ab43",
      evaluatedAt: "2026-08-01T12:00:00-07:00",
      caseId: "en-allowed-amount-confusion-01",
      sessionLanguage: "en",
      voiceConfiguration: {
        listenModel: "flux-general-multi",
        languageHint: "en",
        ttsModel: "aura-2-helena-en",
      },
      transcriptTurns: [{
        turnId: "turn-1",
        turnIndex: 0,
        sequence: 0,
        occurredAt: "2026-08-01T12:00:01-07:00",
        speaker: "patient",
      }],
      toolEvents: [],
      rubricScores: RUBRIC_IDS.map((rubricId) => ({ rubricId, ...score })),
      hardFailure: { occurred: false, reasons: [], evidence: [] },
      informationCompliance: {
        status: "pass",
        findings: ["No unsupported financial fact was recorded."],
        evidence: [{ kind: "transcript-turn", turnId: "turn-1", excerpt: "No unsupported financial fact." }],
      },
      proceduralCompliance: {
        status: "pass",
        findings: ["The evidence record is complete."],
        evidence: [{ kind: "transcript-turn", turnId: "turn-1", excerpt: "The evidence record is complete." }],
      },
    });

    expect(parsed.rubricScores).toHaveLength(8);
    expect(parsed).not.toHaveProperty("rawAudio");
    expect(evaluationRunRecordSchema.safeParse({
      ...parsed,
      hardFailure: { occurred: true, reasons: [], evidence: [] },
    }).success).toBe(false);
    expect(evaluationRunRecordSchema.safeParse({
      ...parsed,
      hardFailure: {
        occurred: false,
        reasons: [],
        evidence: [{ kind: "transcript-turn", turnId: "turn-1", excerpt: "Stray evidence." }],
      },
    }).success).toBe(false);
    expect(evaluationRunRecordSchema.safeParse({
      ...parsed,
      voiceConfiguration: {
        ...parsed.voiceConfiguration,
        ttsModel: "aura-2-selena-es",
      },
    }).success).toBe(false);
    expect(evaluationRunRecordSchema.safeParse({
      ...parsed,
      toolEvents: [{
        toolEventId: "tool-1",
        toolName: "request_human_followup",
        sequence: 1,
        occurredAt: "2026-08-01T12:00:02-07:00",
        status: "succeeded",
      }],
    }).success).toBe(false);
    expect(evaluationRunRecordSchema.safeParse({
      ...parsed,
      toolEvents: [{
        toolEventId: "tool-2",
        toolName: "get_clinical_notes",
        sequence: 1,
        occurredAt: "2026-08-01T12:00:02-07:00",
        status: "succeeded",
      }],
    }).success).toBe(false);
  });
});
