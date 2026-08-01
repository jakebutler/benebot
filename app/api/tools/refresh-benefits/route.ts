import { z } from "zod";

import { getEnv } from "@/lib/env";
import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import { persistEligibilityResult } from "@/lib/medplum/write-artifacts";
import {
  STEDI_TEST_REQUEST,
  createEligibilityProvider,
  loadFixtureFallback,
} from "@/lib/stedi/eligibility";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

const refreshSchema = z.object({
  reason: z.enum(["patient-request", "compare-with-historical-claim", "agent-suggested"]),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await verifyRequestSession(request);
    refreshSchema.parse(await request.json());
    const env = getEnv();
    try {
      const result = await (await createEligibilityProvider()).checkCurrentBenefits(STEDI_TEST_REQUEST);
      try {
        result.medplum = await persistEligibilityResult(session, result);
      } catch {
        // The payer call did succeed. Be explicit that workflow persistence did not.
        result.warnings.push("Current eligibility was returned, but its Medplum workflow record was not saved.");
      }
      return Response.json(result);
    } catch (error) {
      // A test-identity error is a safety failure, never a reason to show fallback data.
      if (env.STEDI_ALLOW_FIXTURE_FALLBACK === "true" && !(error instanceof BeneBotError && error.code === "STEDI_TEST_IDENTITY_MISMATCH")) {
        return Response.json(loadFixtureFallback());
      }
      throw error;
    }
  } catch (error) {
    return safeErrorResponse(error);
  }
}
