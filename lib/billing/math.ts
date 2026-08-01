import type { BillAmounts, ReconciliationResult } from "./types";

export const BILL_MATH_TOLERANCE = 0.01;

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= BILL_MATH_TOLERANCE;
}

export function reconcileBillMath(amounts: BillAmounts): ReconciliationResult {
  const warnings: string[] = [];
  const values = Object.entries(amounts).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );

  if (values.some(([, value]) => !Number.isFinite(value) || value < 0)) {
    return {
      mathReconciles: false,
      warnings: ["The historical claim contains an invalid financial amount."],
    };
  }

  const calculatedAllowed = amounts.billedAmount - amounts.contractualAdjustment;
  if (!closeEnough(calculatedAllowed, amounts.allowedAmount)) {
    warnings.push("Billed amount minus discount does not equal the allowed amount.");
  }

  const calculatedResponsibility =
    amounts.deductibleApplied +
    amounts.copay +
    amounts.coinsuranceAmount +
    amounts.nonCoveredAmount;
  if (!closeEnough(calculatedResponsibility, amounts.patientResponsibility)) {
    warnings.push(
      "Deductible, copay, coinsurance, and non-covered amounts do not equal patient responsibility.",
    );
  }

  const calculatedInsurerPaid = amounts.allowedAmount - amounts.patientResponsibility;
  if (!closeEnough(calculatedInsurerPaid, amounts.insurerPaid)) {
    warnings.push("Allowed amount minus patient responsibility does not equal insurer paid.");
  }

  return { mathReconciles: warnings.length === 0, warnings };
}

