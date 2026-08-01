import { z } from "zod";

import { safeErrorResponse } from "@/lib/errors";
import { localSupportResourceProvider } from "@/lib/resources/provider";
import { verifyRequestSession } from "@/lib/session";

export const runtime = "nodejs";

const searchSchema = z.object({
  need: z.enum([
    "payment-plan",
    "financial-assistance",
    "payer-contact",
    "billing-advocate",
    "dispute-or-review",
  ]),
  language: z.enum(["en", "es"]),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await verifyRequestSession(request);
    const input = searchSchema.parse(await request.json());
    // Only generic need/language filters reach this provider. Patient or claim data never does.
    return Response.json(await localSupportResourceProvider.search({ ...input, limit: 3 }));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
