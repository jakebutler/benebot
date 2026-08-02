import { describe, expect, it } from "vitest";

import {
  requestFollowupInputSchema,
  saveConversationSummaryInputSchema,
  TOOL_INPUT_LIMITS,
} from "@/lib/deepgram/tool-contracts";
import { DEEPGRAM_TOOL_DEFINITIONS } from "@/lib/deepgram/tools";

const followupInput = {
  issueType: "service-not-recognized" as const,
  patientIssueSummary: "x".repeat(TOOL_INPUT_LIMITS.followupIssueSummary),
  preferredContact: "secure-message" as const,
  patientConfirmed: true as const,
};

const summaryInput = {
  language: "es" as const,
  summary: "s".repeat(TOOL_INPUT_LIMITS.summary),
  questionsAnswered: ["q".repeat(TOOL_INPUT_LIMITS.summaryListItem)],
  resourcesOffered: [],
  followupTaskId: "t".repeat(TOOL_INPUT_LIMITS.followupTaskId),
  unresolvedIssues: [],
};

describe("shared Deepgram and route input contracts", () => {
  it("accepts exact server boundaries", () => {
    expect(requestFollowupInputSchema.safeParse(followupInput).success).toBe(true);
    expect(saveConversationSummaryInputSchema.safeParse(summaryInput).success).toBe(true);
  });

  it("rejects values immediately above server boundaries", () => {
    expect(
      requestFollowupInputSchema.safeParse({
        ...followupInput,
        patientIssueSummary: `${followupInput.patientIssueSummary}x`,
      }).success,
    ).toBe(false);
    expect(
      saveConversationSummaryInputSchema.safeParse({
        ...summaryInput,
        summary: `${summaryInput.summary}s`,
      }).success,
    ).toBe(false);
    expect(
      saveConversationSummaryInputSchema.safeParse({
        ...summaryInput,
        questionsAnswered: [`${summaryInput.questionsAnswered[0]}q`],
      }).success,
    ).toBe(false);
    expect(
      saveConversationSummaryInputSchema.safeParse({
        ...summaryInput,
        followupTaskId: `${summaryInput.followupTaskId}t`,
      }).success,
    ).toBe(false);
  });

  it("publishes the same limits in the Voice Agent JSON schemas", () => {
    const followup = DEEPGRAM_TOOL_DEFINITIONS.find(
      (tool) => tool.name === "request_human_followup",
    );
    const summary = DEEPGRAM_TOOL_DEFINITIONS.find(
      (tool) => tool.name === "save_conversation_summary",
    );

    expect(followup?.parameters.properties.patientIssueSummary.maxLength).toBe(
      TOOL_INPUT_LIMITS.followupIssueSummary,
    );
    expect(summary?.parameters.properties.summary.maxLength).toBe(
      TOOL_INPUT_LIMITS.summary,
    );
    expect(summary?.parameters.properties.followupTaskId.maxLength).toBe(
      TOOL_INPUT_LIMITS.followupTaskId,
    );
    expect(summary?.parameters.properties.unresolvedIssues.items.maxLength).toBe(
      TOOL_INPUT_LIMITS.summaryListItem,
    );
  });
});
