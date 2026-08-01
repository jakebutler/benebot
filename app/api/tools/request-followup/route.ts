import { z } from "zod";

import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import { createFollowupTask } from "@/lib/medplum/write-artifacts";
import { MedplumNotConfiguredError } from "@/lib/medplum/server";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

const inputSchema = z
  .object({
    resourceId: z.enum([
      "bayview-payment-plan",
      "acme-bill-help",
      "aetna-test-member-services",
      "northstar-financial-assistance",
      "billing-review",
    ]),
    preferredContact: z.enum(["phone", "secure-message"]),
    notes: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const claims = await verifyRequestSession(request);
    const input = inputSchema.parse(await request.json());
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
      message: "The billing follow-up was created in Medplum.",
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

