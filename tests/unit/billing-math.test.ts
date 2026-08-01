import { describe, expect, it } from "vitest";

import { reconcileBillMath } from "@/lib/billing/math";
import type { BillAmounts } from "@/lib/billing/types";

const demoAmounts: BillAmounts = {
  billedAmount: 2400,
  contractualAdjustment: 1300,
  allowedAmount: 1100,
  deductibleApplied: 500,
  copay: 0,
  coinsuranceAmount: 120,
  nonCoveredAmount: 0,
  insurerPaid: 480,
  patientResponsibility: 620,
};

describe("reconcileBillMath", () => {
  it("reconciles the controlled $620 demo bill", () => {
    expect(reconcileBillMath(demoAmounts)).toEqual({
      mathReconciles: true,
      warnings: [],
    });
  });

  it("accepts a one-cent floating point tolerance", () => {
    expect(
      reconcileBillMath({ ...demoAmounts, insurerPaid: 479.99 }).mathReconciles,
    ).toBe(true);
  });

  it("fails closed on a one-dollar discrepancy", () => {
    const result = reconcileBillMath({ ...demoAmounts, patientResponsibility: 621 });
    expect(result.mathReconciles).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });

  it("rejects invalid amounts", () => {
    expect(
      reconcileBillMath({ ...demoAmounts, billedAmount: Number.NaN }),
    ).toEqual({
      mathReconciles: false,
      warnings: ["The historical claim contains an invalid financial amount."],
    });
  });
});

