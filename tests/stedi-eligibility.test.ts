import { describe, expect, it, vi } from "vitest";

import {
  DirectStediTestProvider,
  STEDI_TEST_REQUEST,
  assertStediTestIdentity,
  normalizeStediResponse,
  loadFixtureFallback,
} from "@/lib/stedi/eligibility";

describe("Stedi eligibility", () => {
  it("fails closed before networking when the fixed test identity changes", async () => {
    const fetchImpl = vi.fn();
    const provider = new DirectStediTestProvider({
      apiKey: "test-key",
      endpoint: "https://example.test/eligibility",
      fetchImpl,
    });

    await expect(
      provider.checkCurrentBenefits({
        ...STEDI_TEST_REQUEST,
        subscriber: { ...STEDI_TEST_REQUEST.subscriber, memberId: "OTHER" },
      }),
    ).rejects.toMatchObject({ code: "STEDI_TEST_IDENTITY_MISMATCH" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the literal documented request only after its identity guard", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ benefitsInformation: [{ code: "1", name: "Active Coverage" }] }), { status: 200 }),
    );
    const provider = new DirectStediTestProvider({
      apiKey: "test-key",
      endpoint: "https://example.test/eligibility",
      fetchImpl,
    });

    await provider.checkCurrentBenefits(STEDI_TEST_REQUEST);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/eligibility",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Key test-key" }),
        body: JSON.stringify(STEDI_TEST_REQUEST),
      }),
    );
  });

  it("keeps omitted values unknown instead of turning them into zero", () => {
    const result = normalizeStediResponse({
      benefitsInformation: [{ code: "C", name: "Deductible", benefitAmount: "500" }],
    }, "2026-08-01T18:01:00Z");
    expect(result.benefits.annualDeductible).toBeUndefined();
    expect(result.benefits.remainingDeductible).toBeUndefined();
    expect(result.benefits.copays).toEqual([]);
    expect(result.warnings.join(" ")).toContain("ambiguous scope");
  });

  it("rejects a mismatched organization name", () => {
    expect(() => assertStediTestIdentity({
      ...STEDI_TEST_REQUEST,
      provider: { ...STEDI_TEST_REQUEST.provider, organizationName: "Bayview Imaging" },
    })).toThrow("synthetic Jane Doe");
  });

  it("keeps the captured fixture timestamp and marks the fallback as not live", () => {
    const result = loadFixtureFallback();
    expect(result).toMatchObject({
      source: "fixture-fallback",
      checkedAt: "2026-08-01T18:00:00Z",
    });
    expect(result.warnings.join(" ")).toContain("not a live payer response");
  });
});
