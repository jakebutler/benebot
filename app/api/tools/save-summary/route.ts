import { z } from "zod";

import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import { createConversationCommunication } from "@/lib/medplum/write-artifacts";
import { MedplumNotConfiguredError } from "@/lib/medplum/server";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

const shortList = z.array(z.string().trim().min(1).max(120)).max(10);
const inputSchema = z
  .object({
    language: z.enum(["en", "es", "mixed"]),
    summary: z.string().trim().min(1).max(600),
    questionsAnswered: shortList,
    resourcesOffered: shortList,
    followupTaskId: z.string().trim().min(1).max(80).optional(),
    unresolvedIssues: shortList,
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const claims = await verifyRequestSession(request);
    const input = inputSchema.parse(await request.json());
    let communication;
    try {
      communication = await createConversationCommunication(claims, input);
    } catch (error) {
      if (error instanceof MedplumNotConfiguredError) {
        throw new BeneBotError(
          "MEDPLUM_NOT_CONFIGURED",
          "The conversation summary was not saved because Medplum is not configured.",
          503,
        );
      }
      throw error;
    }
    return Response.json({ saved: true, communicationId: communication.id });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

