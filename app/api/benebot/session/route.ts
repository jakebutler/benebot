import { z } from "zod";

import { safeErrorResponse } from "@/lib/errors";
import {
  createBeneBotSession,
  DEMO_SESSION_SCOPE,
  enforceDemoRateLimit,
} from "@/lib/session";

const requestSchema = z.object({
  invoiceIdentifier: z.literal("BENEBOT-INV-1001"),
}).strict();

function requestKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local-demo"
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    enforceDemoRateLimit(`session:${requestKey(request)}`, 10, 60_000);
    requestSchema.parse(await request.json());

    let scope = DEMO_SESSION_SCOPE;
    try {
      // Load Medplum only when a session is requested; this keeps the local
      // fixture-only startup path independent of Medplum client initialization.
      const { resolveDemoSeedIds } = await import(
        "@/lib/medplum/queries"
      );
      const resolved = await resolveDemoSeedIds();
      scope = resolved;
    } catch (error) {
      // Local hackathon bootstrap: exact synthetic identifiers are the only fallback.
      // A configured-but-broken Medplum setup fails closed rather than minting a
      // misleading token for another patient or bill.
      const { isMissingMedplum } = await import("@/lib/medplum/queries");
      if (!isMissingMedplum(error)) {
        throw error;
      }
    }

    const { token, claims } = await createBeneBotSession(scope);
    return Response.json({
      sessionToken: token,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      patient: { firstName: "Jane" },
      invoice: {
        id: scope.invoiceId,
        identifier: "BENEBOT-INV-1001",
      },
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
