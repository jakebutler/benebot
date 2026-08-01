import type { ToolName } from "@/lib/contracts";

export interface ToolPrerequisite {
  useWhen: string;
  mustBeTrueBeforeOutput: string;
  permittedOutput: string;
  failureBehavior: string;
}

export const TOOL_PREREQUISITES: Record<ToolName, ToolPrerequisite> = {
  get_bill_context: {
    useWhen: "Any patient-specific historical bill, EOB, claim, or exact historical amount is requested.",
    mustBeTrueBeforeOutput: "The signed scoped session is valid and the server returns reconciled bill context.",
    permittedOutput: "Only the returned deterministic historical narration and general approved concept guidance.",
    failureBehavior: "Give no numerical explanation and offer billing review.",
  },
  refresh_current_benefits: {
    useWhen: "Current coverage status, the current deductible, or a historical/current deductible comparison is requested.",
    mustBeTrueBeforeOutput: "The fixed synthetic identity guard passes and a separately timestamped current result returns.",
    permittedOutput: "Only the returned deterministic current-benefits narration, separately labeled from history.",
    failureBehavior: "Preserve unknown values and identify a fixture as fallback, never live.",
  },
  search_support_resources: {
    useWhen: "A patient-specific support option, payer contact, advocate, payment help, or review resource is requested.",
    mustBeTrueBeforeOutput: "The signed session is valid, no patient data is sent to search, and source labels are preserved.",
    permittedOutput: "Only returned source-labeled resources.",
    failureBehavior: "Say no matching option was found or use the visibly labeled local fallback.",
  },
  request_human_followup: {
    useWhen: "The patient has confirmed a narrowly categorized issue summary and preferred contact.",
    mustBeTrueBeforeOutput: "The current conversation contains explicit confirmation and the server returns created=true with a Task ID.",
    permittedOutput: "The confirmed billing-review case ID and server-confirmed status.",
    failureBehavior: "Say the case was not completed.",
  },
  save_conversation_summary: {
    useWhen: "A substantive session is ending or a confirmed billing-review case needs a concise staff summary.",
    mustBeTrueBeforeOutput: "The signed scope is valid and the server returns saved=true with a Communication ID.",
    permittedOutput: "A concise confirmed summary status; never raw audio or a transcript.",
    failureBehavior: "Say the summary was not saved; do not invalidate a separately confirmed Task.",
  },
};

export function createToolPrerequisitePrompt(): string {
  return (Object.entries(TOOL_PREREQUISITES) as Array<[ToolName, ToolPrerequisite]>)
    .map(
      ([tool, rule]) =>
        `- ${tool}: USE WHEN ${rule.useWhen} BEFORE OUTPUT ${rule.mustBeTrueBeforeOutput} PERMITTED ${rule.permittedOutput} ON FAILURE ${rule.failureBehavior}`,
    )
    .join("\n");
}
