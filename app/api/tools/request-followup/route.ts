import { z } from "zod";

import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import { createFollowupTask } from "@/lib/medplum/write-artifacts";
import { MedplumNotConfiguredError } from "@/lib/medplum/server";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

const inputSchema = z
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
    patientIssueSummary: z.string().trim().min(1).max(300),
    preferredContact: z.enum(["phone", "secure-message"]),
    patientConfirmed: z.literal(true),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const claims = await verifyRequestSession(request);
    const rawInput: unknown = await request.json();
    if (
      typeof rawInput !== "object" ||
      rawInput === null ||
      !("patientConfirmed" in rawInput) ||
      rawInput.patientConfirmed !== true
    ) {
      throw new BeneBotError(
        "PATIENT_CONFIRMATION_REQUIRED",
        "The billing-review case was not created because the patient has not confirmed the issue summary.",
        409,
      );
    }
    const input = inputSchema.parse(rawInput);
    let task;
    try {
      task = await createFollowupTask(claims, input);
    } catch (error) {
      if (error instanceof MedplumNotConfiguredError) {
        throw new BeneBotError(
          "MEDPLUM_NOT_CONFIGURED",
          "The billing follow-up was not created because Medplum is not configured.",
          503,
        );
      }
      throw error;
    }
    return Response.json({
      created: true,
      taskId: task.id,
      status: "requested",
      message: "Billing-review case confirmed by the server.",
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
