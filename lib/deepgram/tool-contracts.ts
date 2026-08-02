import { z } from "zod";

export const TOOL_INPUT_LIMITS = {
  followupIssueSummary: 300,
  summary: 600,
  summaryListItem: 200,
  summaryListItems: 10,
  followupTaskId: 80,
} as const;

const summaryList = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(TOOL_INPUT_LIMITS.summaryListItem),
  )
  .max(TOOL_INPUT_LIMITS.summaryListItems);

export const requestFollowupInputSchema = z
  .object({
    issueType: z.enum([
      "bill-explanation",
      "deductible",
      "coinsurance",
      "service-not-recognized",
      "amount-dispute",
      "financial-hardship",
      "other",
    ]),
    patientIssueSummary: z
      .string()
      .trim()
      .min(1)
      .max(TOOL_INPUT_LIMITS.followupIssueSummary),
    preferredContact: z.enum(["phone", "secure-message"]),
    patientConfirmed: z.literal(true),
  })
  .strict();

export const saveConversationSummaryInputSchema = z
  .object({
    language: z.enum(["en", "es", "mixed"]),
    summary: z.string().trim().min(1).max(TOOL_INPUT_LIMITS.summary),
    questionsAnswered: summaryList,
    resourcesOffered: summaryList,
    followupTaskId: z
      .string()
      .trim()
      .min(1)
      .max(TOOL_INPUT_LIMITS.followupTaskId)
      .optional(),
    unresolvedIssues: summaryList,
  })
  .strict();
