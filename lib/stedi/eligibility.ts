import { z } from "zod";

import type { RefreshBenefitsResult } from "@/lib/contracts";
import { BeneBotError } from "@/lib/errors";
import fallbackFixture from "@/fixtures/stedi-normalized-fallback.json";

const stediRequestSchema = z
  .object({
    tradingPartnerServiceId: z.string(),
    provider: z.object({ organizationName: z.string(), npi: z.string() }),
    subscriber: z.object({
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string(),
      memberId: z.string(),
    }),
    encounter: z.object({ serviceTypeCodes: z.array(z.string()) }),
  })
  .strict();

export type StediTestRequest = z.infer<typeof stediRequestSchema>;

/** The sole request supported by the Stedi test key in this synthetic demo. */
export const STEDI_TEST_REQUEST: StediTestRequest = {
  tradingPartnerServiceId: "60054",
  provider: {
    organizationName: "Provider Name",
    npi: "1999999984",
  },
  subscriber: {
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "20040404",
    memberId: "AETNA12345",
  },
  encounter: { serviceTypeCodes: ["30"] },
};

export interface EligibilityProvider {
  checkCurrentBenefits(request: StediTestRequest): Promise<RefreshBenefitsResult>;
}

export interface DirectStediProviderOptions {
  apiKey: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const unknownRecordSchema = z.record(z.string(), z.unknown());
const externalBenefitSchema = z
  .object({
    code: z.string().optional(),
    name: z.string().optional(),
    benefitAmount: z.union([z.string(), z.number()]).optional(),
    benefitPercent: z.union([z.string(), z.number()]).optional(),
    serviceTypeCodes: z.array(z.string()).optional(),
    serviceTypes: z.array(z.string()).optional(),
    planCoverage: z.string().optional(),
    networkIndicatorCode: z.string().optional(),
    inPlanNetworkIndicatorCode: z.string().optional(),
    coverageLevelCode: z.string().optional(),
    coverageLevel: z.string().optional(),
    timeQualifierCode: z.string().optional(),
    timeQualifier: z.string().optional(),
  })
  .passthrough();

const externalResponseSchema = z
  .object({
    benefitsInformation: z.array(externalBenefitSchema).optional(),
    payer: unknownRecordSchema.optional(),
    payerName: z.string().optional(),
    planName: z.string().optional(),
  })
  .passthrough();

function decimal(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function networkFromIndicator(value: string | undefined): "in" | "out" | "unknown" {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (["in", "i", "y", "yes"].includes(normalized)) return "in";
  if (["out", "o", "n", "no"].includes(normalized)) return "out";
  return "unknown";
}

type DeductibleScope = NonNullable<
  RefreshBenefitsResult["benefits"]["deductibleScope"]
>;

interface ScopedBenefitAmount {
  amount: number;
  scope: DeductibleScope;
}

function sameScope(left: DeductibleScope, right: DeductibleScope): boolean {
  return (
    left.benefitLevel === right.benefitLevel &&
    left.network === right.network &&
    [...left.serviceTypeCodes].sort().join("|") ===
      [...right.serviceTypeCodes].sort().join("|")
  );
}

/**
 * The only permitted deductible calculation. The model receives the derived
 * amount and never subtracts payer values itself.
 */
export function deriveDeductibleSummary(
  annual: ScopedBenefitAmount | undefined,
  remaining: ScopedBenefitAmount | undefined,
): Pick<
  RefreshBenefitsResult["benefits"],
  | "annualDeductible"
  | "remainingDeductible"
  | "deductibleMetToDate"
  | "deductibleScope"
> {
  const annualValid = annual !== undefined && annual.amount >= 0;
  const remainingValid = remaining !== undefined && remaining.amount >= 0;
  const knownValues = {
    ...(annualValid ? { annualDeductible: annual.amount } : {}),
    ...(remainingValid ? { remainingDeductible: remaining.amount } : {}),
  };
  if (
    !annualValid ||
    !remainingValid ||
    !sameScope(annual.scope, remaining.scope) ||
    remaining.amount > annual.amount
  ) {
    return knownValues;
  }
  return {
    ...knownValues,
    deductibleMetToDate: annual.amount - remaining.amount,
    deductibleScope: annual.scope,
  };
}

function scopedAmount(
  benefit: z.infer<typeof externalBenefitSchema>,
): ScopedBenefitAmount | undefined {
  const amount = decimal(benefit.benefitAmount);
  if (amount === undefined || benefit.coverageLevelCode !== "IND") return undefined;
  const serviceTypeCodes = [...new Set(benefit.serviceTypeCodes ?? [])].sort();
  if (serviceTypeCodes.length === 0) return undefined;
  return {
    amount,
    scope: {
      benefitLevel: "individual",
      network: networkFromIndicator(
        benefit.inPlanNetworkIndicatorCode ?? benefit.networkIndicatorCode,
      ),
      serviceTypeCodes,
    },
  };
}

function exactScopedAmount(
  benefits: Array<z.infer<typeof externalBenefitSchema>>,
  code: "C" | "G",
  qualifier: "annual" | "remaining",
): ScopedBenefitAmount | undefined {
  const candidates = benefits.filter(
    (benefit) =>
      benefit.code === code &&
      benefit.coverageLevelCode === "IND" &&
      networkFromIndicator(
        benefit.inPlanNetworkIndicatorCode ?? benefit.networkIndicatorCode,
      ) === "in" &&
      benefit.serviceTypeCodes?.length === 1 &&
      benefit.serviceTypeCodes[0] === "30",
  );
  const matches = candidates.filter((benefit) =>
    qualifier === "annual"
      ? benefit.timeQualifierCode === "25" ||
        benefit.timeQualifier?.toLowerCase() === "contract"
      : benefit.timeQualifierCode === "29" ||
        benefit.timeQualifier?.toLowerCase() === "remaining",
  );
  return matches.length === 1 ? scopedAmount(matches[0]) : undefined;
}

function serviceLabel(benefit: z.infer<typeof externalBenefitSchema>): string {
  return benefit.serviceTypes?.filter(Boolean).join(", ") ??
    benefit.serviceTypeCodes?.filter(Boolean).join(", ") ??
    "Unspecified service";
}

function payerNameFromResponse(response: z.infer<typeof externalResponseSchema>): string | undefined {
  if (response.payerName) return response.payerName;
  if (!response.payer) return undefined;
  const candidate = response.payer["name"];
  return typeof candidate === "string" ? candidate : undefined;
}

/**
 * Fails closed before any network request. We deliberately compare the whole
 * fixed test request, including Stedi's literal Provider Name fixture value.
 */
export function assertStediTestIdentity(request: StediTestRequest): void {
  const parsed = stediRequestSchema.safeParse(request);
  if (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(STEDI_TEST_REQUEST)) {
    throw new BeneBotError(
      "STEDI_TEST_IDENTITY_MISMATCH",
      "This demo can only check the synthetic Jane Doe Stedi test identity.",
      400,
    );
  }
}

/**
 * Converts only clearly represented response fields. Omitted or ambiguous
 * values stay undefined rather than becoming a made-up benefit amount.
 */
export function normalizeStediResponse(raw: unknown, checkedAt = new Date().toISOString()): RefreshBenefitsResult {
  const parsed = externalResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BeneBotError("STEDI_RESPONSE_INVALID", "The test payer returned an unreadable eligibility response.", 502);
  }

  const benefits = parsed.data.benefitsInformation ?? [];
  const warnings: string[] = [
    "This eligibility response reflects the plan information returned now. It does not replace the historical claim adjudication for your July 8 service.",
  ];
  const activeSignals = benefits.filter((benefit) => benefit.code === "1" || /active coverage/i.test(benefit.name ?? ""));
  const inactiveSignals = benefits.filter((benefit) => /inactive|terminated/i.test(benefit.name ?? ""));
  const coverageActive = activeSignals.length ? true : inactiveSignals.length ? false : undefined;
  if (coverageActive === undefined) warnings.push("The payer did not return an unambiguous active-coverage status.");

  const copays = benefits.flatMap((benefit) => {
    if (benefit.code !== "B") return [];
    const amount = decimal(benefit.benefitAmount);
    if (amount === undefined) return [];
    return [{
      serviceLabel: serviceLabel(benefit),
      amount,
      network: networkFromIndicator(
        benefit.inPlanNetworkIndicatorCode ?? benefit.networkIndicatorCode,
      ),
    }];
  });
  const coinsurance = benefits.flatMap((benefit) => {
    if (benefit.code !== "A") return [];
    const rawPercentage = decimal(benefit.benefitPercent);
    if (rawPercentage === undefined) return [];
    return [{
      serviceLabel: serviceLabel(benefit),
      percentage: rawPercentage <= 1 ? rawPercentage * 100 : rawPercentage,
      network: networkFromIndicator(
        benefit.inPlanNetworkIndicatorCode ?? benefit.networkIndicatorCode,
      ),
    }];
  });

  const annualDeductible = exactScopedAmount(benefits, "C", "annual");
  const remainingDeductible = exactScopedAmount(benefits, "C", "remaining");
  const deductible = deriveDeductibleSummary(
    annualDeductible,
    remainingDeductible,
  );
  if (
    benefits.some((benefit) => benefit.code === "C") &&
    deductible.annualDeductible === undefined
  ) {
    warnings.push("The payer returned deductible information with an ambiguous scope, so no annual or remaining total is shown.");
  }
  const annualOutOfPocket = exactScopedAmount(benefits, "G", "annual");
  const remainingOutOfPocket = exactScopedAmount(benefits, "G", "remaining");
  const annualOutOfPocketMaximum = annualOutOfPocket?.amount;
  const remainingOutOfPocketMaximum = remainingOutOfPocket?.amount;
  if (
    benefits.some((benefit) => benefit.code === "G") &&
    (!annualOutOfPocket ||
      !remainingOutOfPocket ||
      !sameScope(annualOutOfPocket.scope, remainingOutOfPocket.scope))
  ) {
    warnings.push("The payer returned out-of-pocket information with an ambiguous scope, so no annual or remaining total is shown.");
  }
  if (benefits.some((benefit) => !benefit.serviceTypeCodes?.includes("30"))) {
    warnings.push("The payer may return benefits for service types other than the requested general plan-coverage code.");
  }

  return {
    source: "stedi-live-test",
    checkedAt,
    coverageActive,
    payerName: payerNameFromResponse(parsed.data),
    planName: parsed.data.planName ?? benefits.find((benefit) => benefit.planCoverage)?.planCoverage,
    benefits: {
      ...deductible,
      ...(annualOutOfPocketMaximum === undefined ? {} : { annualOutOfPocketMaximum }),
      ...(remainingOutOfPocketMaximum === undefined ? {} : { remainingOutOfPocketMaximum }),
      copays,
      coinsurance,
    },
    medplum: {},
    warnings,
  };
}

export function loadFixtureFallback(): RefreshBenefitsResult {
  return fallbackFixture as RefreshBenefitsResult;
}

export class DirectStediTestProvider implements EligibilityProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: DirectStediProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
  }

  async checkCurrentBenefits(request: StediTestRequest): Promise<RefreshBenefitsResult> {
    assertStediTestIdentity(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.options.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Key ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BeneBotError("STEDI_REQUEST_FAILED", "The current-benefits check was unavailable.", 502);
      }
      return normalizeStediResponse(await response.json());
    } catch (error) {
      if (error instanceof BeneBotError) throw error;
      throw new BeneBotError("STEDI_REQUEST_FAILED", "The current-benefits check was unavailable.", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function createEligibilityProvider(): Promise<EligibilityProvider> {
  // Keep env parsing server-only without preventing pure normalization tests.
  const { getEnv } = await import("@/lib/env");
  const env = getEnv();
  if (!env.STEDI_TEST_API_KEY) {
    throw new BeneBotError("STEDI_NOT_CONFIGURED", "Current-benefits checking is not configured.", 503);
  }
  if (env.STEDI_PROVIDER !== "direct") {
    throw new BeneBotError("STEDI_PROVIDER_NOT_AVAILABLE", "The demo uses the direct Stedi test provider.", 503);
  }
  return new DirectStediTestProvider({
    apiKey: env.STEDI_TEST_API_KEY,
    endpoint: env.STEDI_ELIGIBILITY_ENDPOINT,
  });
}
