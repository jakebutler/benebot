import { describe, expect, it } from "vitest";

import { getFixtureBillContext } from "@/lib/medplum/queries";

describe("fixture bill context", () => {
  it("builds a scoped, reconciled context with an explicit fallback warning", () => {
    const context = getFixtureBillContext();
    expect(context.invoice.currentBalance).toBe(620);
    expect(context.adjudication.patientResponsibility).toBe(620);
    expect(context.confidence.mathReconciles).toBe(true);
    expect(context.confidence.warnings).toContain(
      "Demo fixture fallback — Medplum is not configured.",
    );
    expect(context.patient).not.toHaveProperty("telecom");
  });
});

