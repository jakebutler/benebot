import { describe, expect, it } from "vitest";

import {
  buildAllowedAmountClarification,
  buildHistoricalRequiredSpokenSummary,
} from "@/lib/billing/historical-narration";
import type { GetBillContextResult } from "@/lib/contracts";

const reconciledContext: GetBillContextResult = {
  patientFirstName: "Jane",
  preferredLanguage: {
    code: "es",
    display: "Spanish",
    preferred: true,
  },
  providerName: "Summit Imaging Center",
  serviceDescription: "Lumbar MRI",
  dateOfService: "2025-07-11",
  encounter: {
    id: "encounter-demo",
    providerName: "Summit Imaging Center",
    facilityName: "Summit Imaging Center",
    serviceDescription: "Lumbar MRI",
    dateOfService: "2025-07-11",
  },
  invoiceIssuedDate: "2025-07-22",
  currentBalance: 620,
  historicalAdjudication: {
    billedAmount: 2400,
    contractualAdjustment: 1300,
    allowedAmount: 1100,
    deductibleApplied: 500,
    copay: 0,
    coinsuranceAmount: 120,
    coinsuranceRate: 0.2,
    insurerPaid: 480,
    patientResponsibility: 620,
  },
  source: {
    type: "ExplanationOfBenefit",
    createdDate: "2025-07-20",
    label: "Historical claim adjudication",
  },
  mathReconciles: true,
  warnings: [],
};

describe("buildHistoricalRequiredSpokenSummary", () => {
  it.each([
    ["en", "$2,400.00", "$1,300.00", "$1,100.00", "$500.00", "$0.00", "$120.00", "$480.00", "$620.00"],
    ["es", "2,400.00 dólares", "1,300.00 dólares", "1,100.00 dólares", "500.00 dólares", "0.00 dólares", "120.00 dólares", "480.00 dólares", "620.00 dólares"],
  ] as const)(
    "includes every server-provided amount in the %s summary",
    (language, ...expectedAmounts) => {
      const summary = buildHistoricalRequiredSpokenSummary(reconciledContext)[language];

      for (const amount of expectedAmounts) {
        expect(summary).toContain(amount);
      }
    },
  );

  it("names the historical source, source date, provider, and temporal limitation", () => {
    const summary = buildHistoricalRequiredSpokenSummary(reconciledContext);

    expect(summary.en).toContain("Summit Imaging Center");
    expect(summary.en).toContain("an MRI of the lower back");
    expect(summary.en).toContain("July 11, 2025");
    expect(summary.en).toContain("July 20, 2025");
    expect(summary.en).toContain("historical Explanation of Benefits");
    expect(summary.en).toContain("not proof that the claim or bill is correct");
    expect(summary.en).toContain("do not explain or validate this historical claim");

    expect(summary.es).toContain("Summit Imaging Center");
    expect(summary.es).toContain("una resonancia magnética lumbar");
    expect(summary.es).toContain("11 de julio de 2025");
    expect(summary.es).toContain("20 de julio de 2025");
    expect(summary.es).toContain("Explicación de Beneficios histórica");
    expect(summary.es).toContain("no una prueba de que el reclamo o la factura sean correctos");
    expect(summary.es).toContain("no explican ni validan este reclamo histórico");
  });

  it("does not narrate any financial number when reconciliation fails", () => {
    const summary = buildHistoricalRequiredSpokenSummary({
      ...reconciledContext,
      mathReconciles: false,
      warnings: ["Patient responsibility mismatch: 620 vs 621"],
    });

    for (const language of ["en", "es"] as const) {
      expect(summary[language]).not.toMatch(/[0-9]/);
      expect(summary[language]).not.toContain("$");
      expect(summary[language]).toMatch(/review|revisión/);
    }
  });

  it("is a pure formatter and does not replace tool-returned values with recalculated ones", () => {
    const summary = buildHistoricalRequiredSpokenSummary({
      ...reconciledContext,
      currentBalance: 619.37,
      historicalAdjudication: {
        ...reconciledContext.historicalAdjudication,
        insurerPaid: 479.42,
      },
    });

    expect(summary.en).toContain("$619.37");
    expect(summary.en).toContain("$479.42");
    expect(summary.es).toContain("619.37 dólares");
    expect(summary.es).toContain("479.42 dólares");
  });
});

describe("buildAllowedAmountClarification", () => {
  it("uses only returned billed and allowed amounts in both languages", () => {
    const clarification = buildAllowedAmountClarification(reconciledContext);

    expect(clarification.en).toContain("$1,100.00");
    expect(clarification.en).toContain("$2,400.00");
    expect(clarification.en).not.toContain("$620.00");
    expect(clarification.es).toContain("1,100.00 dólares");
    expect(clarification.es).toContain("2,400.00 dólares");
    expect(clarification.es).toContain("¿Quiere que continúe");
  });

  it("contains no figures when reconciliation fails", () => {
    const clarification = buildAllowedAmountClarification({
      ...reconciledContext,
      mathReconciles: false,
    });

    expect(clarification.en).not.toMatch(/[0-9$]/);
    expect(clarification.es).not.toMatch(/[0-9$]/);
  });
});
