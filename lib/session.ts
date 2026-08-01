import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { z } from "zod";

import { BeneBotError } from "./errors";

export const BENEBOT_SESSION_ISSUER = "benebot" as const;
export const BENEBOT_SESSION_AUDIENCE = "benebot-tools" as const;
export const DEFAULT_SESSION_TTL_SECONDS = 15 * 60;

export interface BeneBotSessionClaims extends JWTPayload {
  iss: typeof BENEBOT_SESSION_ISSUER;
  aud: typeof BENEBOT_SESSION_AUDIENCE;
  sub: string;
  patientId: string;
  invoiceId: string;
  eobId: string;
  coverageId: string;
  encounterId: string;
  providerOrganizationId: string;
  payerOrganizationId: string;
  jti: string;
  iat: number;
  exp: number;
  demo: true;
}

export type BeneBotSessionScope = Pick<
  BeneBotSessionClaims,
  | "patientId"
  | "invoiceId"
  | "eobId"
  | "coverageId"
  | "encounterId"
  | "providerOrganizationId"
  | "payerOrganizationId"
>;

export const DEMO_SESSION_SCOPE: BeneBotSessionScope = {
  patientId: "jane-doe",
  invoiceId: "BENEBOT-INV-1001",
  eobId: "BENEBOT-CLM-1001",
  coverageId: "jane-aetna-test",
  encounterId: "bayview-mri-2026-07-08",
  providerOrganizationId: "bayview-imaging",
  payerOrganizationId: "aetna-stedi-test",
};

const claimsSchema = z.object({
  iss: z.literal(BENEBOT_SESSION_ISSUER),
  aud: z.literal(BENEBOT_SESSION_AUDIENCE),
  sub: z.string().regex(/^Patient\/[A-Za-z0-9.-]+$/),
  patientId: z.string().min(1),
  invoiceId: z.string().min(1),
  eobId: z.string().min(1),
  coverageId: z.string().min(1),
  encounterId: z.string().min(1),
  providerOrganizationId: z.string().min(1),
  payerOrganizationId: z.string().min(1),
  jti: z.string().uuid(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  demo: z.literal(true),
});

interface SessionCryptoOptions {
  secret?: string;
  ttlSeconds?: number;
  now?: Date;
}

function getSessionSecret(override?: string): Uint8Array {
  const secret = override ?? process.env.BENEBOT_SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new BeneBotError(
      "SESSION_NOT_CONFIGURED",
      "BeneBot session security is not configured.",
      503,
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createBeneBotSession(
  scope: BeneBotSessionScope,
  options: SessionCryptoOptions = {},
): Promise<{ token: string; claims: BeneBotSessionClaims }> {
  const ttlSeconds = options.ttlSeconds ?? Number(process.env.BENEBOT_SESSION_TTL_SECONDS || DEFAULT_SESSION_TTL_SECONDS);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 3600) {
    throw new BeneBotError(
      "SESSION_TTL_INVALID",
      "BeneBot session duration is invalid.",
      500,
    );
  }

  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const claims: BeneBotSessionClaims = {
    iss: BENEBOT_SESSION_ISSUER,
    aud: BENEBOT_SESSION_AUDIENCE,
    sub: `Patient/${scope.patientId}`,
    ...scope,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttlSeconds,
    demo: true,
  };

  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(getSessionSecret(options.secret));

  return { token, claims };
}

export async function verifyBeneBotSession(
  token: string,
  options: Pick<SessionCryptoOptions, "secret"> = {},
): Promise<BeneBotSessionClaims> {
  try {
    const { payload, protectedHeader } = await jwtVerify(
      token,
      getSessionSecret(options.secret),
      {
        algorithms: ["HS256"],
        issuer: BENEBOT_SESSION_ISSUER,
        audience: BENEBOT_SESSION_AUDIENCE,
      },
    );

    if (protectedHeader.typ !== "JWT") {
      throw new Error("Unexpected token type");
    }

    return claimsSchema.parse(payload) as BeneBotSessionClaims;
  } catch (error) {
    if (error instanceof BeneBotError) {
      throw error;
    }
    throw new BeneBotError(
      "SESSION_INVALID",
      "Your BeneBot session is invalid or has expired.",
      401,
    );
  }
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization ?? "");
  if (!match) {
    throw new BeneBotError(
      "SESSION_REQUIRED",
      "A BeneBot session is required.",
      401,
    );
  }
  return match[1];
}

export async function verifyRequestSession(
  request: Request,
): Promise<BeneBotSessionClaims> {
  return verifyBeneBotSession(getBearerToken(request));
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function enforceDemoRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new BeneBotError(
      "RATE_LIMITED",
      "Please wait a moment before trying again.",
      429,
    );
  }
  current.count += 1;
}
