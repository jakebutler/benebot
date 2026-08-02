import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import { saveConversationSummaryInputSchema } from "@/lib/deepgram/tool-contracts";
import { createConversationCommunication } from "@/lib/medplum/write-artifacts";
import { MedplumNotConfiguredError } from "@/lib/medplum/server";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const claims = await verifyRequestSession(request);
    const input = saveConversationSummaryInputSchema.parse(await request.json());
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
