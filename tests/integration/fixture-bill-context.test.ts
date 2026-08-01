import { describe, expect, it } from "vitest";

import { getFixtureBillContext } from "@/lib/medplum/queries";
import { DEMO_SESSION_SCOPE } from "@/lib/session";

describe("fixture bill context", () => {
  it("builds a scoped, reconciled context with an explicit fallback warning", () => {
    const context = getFixtureBillContext(DEMO_SESSION_SCOPE);
    expect(context.invoice.currentBalance).toBe(620);
    expect(context.adjudication.patientResponsibility).toBe(620);
    expect(context.confidence.mathReconciles).toBe(true);
    expect(context.confidence.warnings).toContain(
      "Demo fixture fallback — Medplum is not configured.",
    );
    expect(context.patient).not.toHaveProperty("telecom");
    expect(context.patient.preferredLanguage).toEqual({
      code: "es",
      display: "Spanish",
    });
    expect(context.service).toEqual({
      encounterId: DEMO_SESSION_SCOPE.encounterId,
      description: "MRI of the lower back",
      dateOfService: "2026-07-08",
      location: "Bayview Imaging — Mission Campus",
    });
    expect(context.patient.id).toBe(DEMO_SESSION_SCOPE.patientId);
    expect(context.invoice.id).toBe(DEMO_SESSION_SCOPE.invoiceId);
    expect(context.adjudication.sourceResourceId).toBe(DEMO_SESSION_SCOPE.eobId);
  });
});
