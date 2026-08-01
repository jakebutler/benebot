import { z } from "zod";

import type { ToolActivityEvent, ToolName } from "../contracts";

export const DEEPGRAM_TOOL_DEFINITIONS = [
  {
    name: "get_bill_context",
    description:
      "Get reconciled historical EOB adjudication and the current invoice balance for this session's bill. Call before discussing exact amounts.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "refresh_current_benefits",
    description:
      "Refresh the synthetic patient's current test eligibility. This never explains or validates the historical claim.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: [
            "patient-request",
            "compare-with-historical-claim",
            "agent-suggested",
          ],
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "search_support_resources",
    description:
      "Find up to three billing-help resources. Results identify practice-provided, fictional demo, and unverified community sources.",
    parameters: {
      type: "object",
      properties: {
        need: {
          type: "string",
          enum: [
            "payment-plan",
            "financial-assistance",
            "payer-contact",
            "billing-advocate",
            "dispute-or-review",
          ],
        },
        language: { type: "string", enum: ["en", "es"] },
      },
      required: ["need", "language"],
      additionalProperties: false,
    },
  },
  {
    name: "request_human_followup",
    description:
      "Create a Medplum billing follow-up only after the patient clearly confirms the summarized action.",
    parameters: {
      type: "object",
      properties: {
        resourceId: {
          type: "string",
          enum: [
            "bayview-payment-plan",
            "acme-bill-help",
            "aetna-test-member-services",
            "northstar-financial-assistance",
            "billing-review",
          ],
        },
        preferredContact: {
          type: "string",
          enum: ["phone", "secure-message"],
        },
        notes: { type: "string", maxLength: 500 },
      },
      required: ["resourceId", "preferredContact"],
      additionalProperties: false,
    },
  },
  {
    name: "save_conversation_summary",
    description:
      "Save a concise structured conversation summary. Never provide a full transcript or raw audio.",
    parameters: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["en", "es", "mixed"] },
        summary: { type: "string", maxLength: 1000 },
        questionsAnswered: { type: "array", items: { type: "string" } },
        resourcesOffered: { type: "array", items: { type: "string" } },
        followupTaskId: { type: "string" },
        unresolvedIssues: { type: "array", items: { type: "string" } },
      },
      required: [
        "language",
        "summary",
        "questionsAnswered",
        "resourcesOffered",
        "unresolvedIssues",
      ],
      additionalProperties: false,
    },
  },
] as const;

const toolArguments = {
  get_bill_context: z.object({}).strict(),
  refresh_current_benefits: z.object({
    reason: z.enum([
      "patient-request",
      "compare-with-historical-claim",
      "agent-suggested",
    ]),
  }).strict(),
  search_support_resources: z.object({
    need: z.enum([
      "payment-plan",
      "financial-assistance",
      "payer-contact",
      "billing-advocate",
      "dispute-or-review",
    ]),
    language: z.enum(["en", "es"]),
  }).strict(),
  request_human_followup: z.object({
    resourceId: z.enum([
      "bayview-payment-plan",
      "acme-bill-help",
      "aetna-test-member-services",
      "northstar-financial-assistance",
      "billing-review",
    ]),
    preferredContact: z.enum(["phone", "secure-message"]),
    notes: z.string().max(500).optional(),
  }).strict(),
  save_conversation_summary: z.object({
    language: z.enum(["en", "es", "mixed"]),
    summary: z.string().min(1).max(1000),
    questionsAnswered: z.array(z.string().max(200)).max(10),
    resourcesOffered: z.array(z.string().max(200)).max(10),
    followupTaskId: z.string().max(100).optional(),
    unresolvedIssues: z.array(z.string().max(200)).max(10),
  }).strict(),
} satisfies Record<ToolName, z.ZodType>;

const toolRoutes: Record<ToolName, string> = {
  get_bill_context: "/api/tools/get-bill-context",
  refresh_current_benefits: "/api/tools/refresh-benefits",
  search_support_resources: "/api/tools/search-resources",
  request_human_followup: "/api/tools/request-followup",
  save_conversation_summary: "/api/tools/save-summary",
};

export const TOOL_LABELS: Record<ToolName, string> = {
  get_bill_context: "Reading historical bill",
  refresh_current_benefits: "Checking current benefits",
  search_support_resources: "Finding support resources",
  request_human_followup: "Requesting human follow-up",
  save_conversation_summary: "Saving concise summary",
};

export function isToolName(value: string): value is ToolName {
  return value in toolRoutes;
}

export async function dispatchBeneBotTool(options: {
  name: string;
  argumentsJson: string;
  sessionToken: string;
  onActivity?: (event: ToolActivityEvent) => void;
}): Promise<string> {
  const { name, argumentsJson, sessionToken, onActivity } = options;
  if (!isToolName(name)) {
    return JSON.stringify({ error: "Unsupported BeneBot tool." });
  }

  const activity = (status: ToolActivityEvent["status"]): void =>
    onActivity?.({
      tool: name,
      label: TOOL_LABELS[name],
      status,
      at: new Date().toISOString(),
    });

  try {
    activity("running");
    const rawArguments: unknown = argumentsJson ? JSON.parse(argumentsJson) : {};
    const input = toolArguments[name].parse(rawArguments);
    const response = await fetch(toolRoutes[name], {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error("Tool route failed");
    }
    activity("succeeded");
    return JSON.stringify(result);
  } catch {
    activity("failed");
    return JSON.stringify({
      error: "BeneBot could not complete that tool request.",
    });
  }
}
