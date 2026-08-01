import { z } from "zod";

import { BeneBotError, safeErrorResponse } from "@/lib/errors";
import {
  enforceDemoRateLimit,
  verifyRequestSession,
} from "@/lib/session";

const deepgramGrantSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await verifyRequestSession(request);
    enforceDemoRateLimit(`deepgram-token:${session.jti}`, 6, 60_000);

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new BeneBotError(
        "DEEPGRAM_NOT_CONFIGURED",
        "Voice is not configured. You can still use the text option.",
        503,
      );
    }

    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new BeneBotError(
        "DEEPGRAM_TOKEN_FAILED",
        "Voice could not start. You can still use the text option.",
        502,
      );
    }

    const grant = deepgramGrantSchema.parse(await response.json());
    return Response.json(
      { accessToken: grant.access_token, expiresIn: grant.expires_in },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

