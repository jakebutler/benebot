import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  BENEBOT_SESSION_ISSUER,
  createBeneBotSession,
  DEMO_SESSION_SCOPE,
  verifyBeneBotSession,
} from "../../lib/session";

const secret = "benebot-test-secret-is-at-least-32-bytes-long";

describe("BeneBot signed sessions", () => {
  it("accepts a valid scoped token", async () => {
    const { token } = await createBeneBotSession(DEMO_SESSION_SCOPE, {
      secret,
      now: new Date("2026-08-01T20:00:00.000Z"),
    });

    const claims = await verifyBeneBotSession(token, { secret });
    expect(claims.patientId).toBe("jane-doe");
    expect(claims.invoiceId).toBe("BENEBOT-INV-1001");
    expect(claims.eobId).toBe("BENEBOT-CLM-1001");
    expect(claims.encounterId).toBe("bayview-mri-2026-07-08");
    expect(claims.demo).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const { token } = await createBeneBotSession(DEMO_SESSION_SCOPE, { secret });
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    const tampered = `${header}.${payload}.${tamperedSignature}`;
    await expect(verifyBeneBotSession(tampered, { secret })).rejects.toMatchObject({
      code: "SESSION_INVALID",
      status: 401,
    });
  });

  it("rejects an expired token", async () => {
    const { token } = await createBeneBotSession(DEMO_SESSION_SCOPE, {
      secret,
      ttlSeconds: 1,
      now: new Date("2020-01-01T00:00:00.000Z"),
    });
    await expect(verifyBeneBotSession(token, { secret })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects the wrong audience", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      ...DEMO_SESSION_SCOPE,
      sub: `Patient/${DEMO_SESSION_SCOPE.patientId}`,
      demo: true,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 900,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(BENEBOT_SESSION_ISSUER)
      .setAudience("not-benebot-tools")
      .sign(new TextEncoder().encode(secret));

    await expect(verifyBeneBotSession(token, { secret })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("requires every bill-scope claim", async () => {
    const now = Math.floor(Date.now() / 1000);
    const incompleteScope = {
      patientId: DEMO_SESSION_SCOPE.patientId,
      eobId: DEMO_SESSION_SCOPE.eobId,
      coverageId: DEMO_SESSION_SCOPE.coverageId,
      encounterId: DEMO_SESSION_SCOPE.encounterId,
      providerOrganizationId: DEMO_SESSION_SCOPE.providerOrganizationId,
      payerOrganizationId: DEMO_SESSION_SCOPE.payerOrganizationId,
    };
    const token = await new SignJWT({
      ...incompleteScope,
      sub: `Patient/${DEMO_SESSION_SCOPE.patientId}`,
      demo: true,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 900,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(BENEBOT_SESSION_ISSUER)
      .setAudience("benebot-tools")
      .sign(new TextEncoder().encode(secret));

    await expect(verifyBeneBotSession(token, { secret })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });
});
