import { isResource } from "@medplum/core";
import type { ExplanationOfBenefit } from "@medplum/fhirtypes";
import { describe, expect, it } from "vitest";

import fixture from "@/fixtures/benebot-fhir-seed.json";
import { BillNormalizationError, normalizeEob } from "@/lib/billing/normalize-eob";

function demoEob(): ExplanationOfBenefit {
  const value = fixture.entry.find(
    (entry) => entry.resource.resourceType === "ExplanationOfBenefit",
  )?.resource;
  if (!isResource<ExplanationOfBenefit>(value, "ExplanationOfBenefit")) {
    throw new Error("Test fixture is missing its EOB.");
  }
  return structuredClone(value);
}

describe("normalizeEob", () => {
  it("extracts deterministic historical adjudication without diagnosis data", () => {
    const result = normalizeEob(demoEob(), { controlledDemoFixture: true });
    expect(result.amounts).toEqual({
      billedAmount: 2400,
      contractualAdjustment: 1300,
      allowedAmount: 1100,
      deductibleApplied: 500,
      copay: 0,
      coinsuranceAmount: 120,
      nonCoveredAmount: 0,
      insurerPaid: 480,
      patientResponsibility: 620,
    });
    expect(result.mathReconciles).toBe(true);
    expect(result).not.toHaveProperty("diagnosis");
  });

  it("marks duplicate adjudication categories as not explainable", () => {
    const eob = demoEob();
    eob.total?.push(structuredClone(eob.total[0]));
    const result = normalizeEob(eob, { controlledDemoFixture: true });
    expect(result.mathReconciles).toBe(false);
    expect(result.warnings).toContain(
      "Duplicate historical adjudication category: billedAmount.",
    );
  });

  it("fails when member liability is missing", () => {
    const eob = demoEob();
    eob.total = eob.total?.filter(
      (entry) => entry.category.coding?.[0]?.code !== "memberliability",
    );
    expect(() => normalizeEob(eob, { controlledDemoFixture: true })).toThrow(
      BillNormalizationError,
    );
  });

  it("rejects non-USD amounts", () => {
    const eob = demoEob();
    if (eob.total?.[0]?.amount) eob.total[0].amount.currency = "EUR";
    expect(() => normalizeEob(eob, { controlledDemoFixture: true })).toThrow(
      /not in USD/,
    );
  });

  it("does not infer optional zero categories outside the controlled fixture", () => {
    expect(() => normalizeEob(demoEob())).toThrow(/cannot be inferred as zero/);
  });
});

