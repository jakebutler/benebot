import type {
  ExplanationOfBenefit,
  ExplanationOfBenefitItemAdjudication,
  ExplanationOfBenefitTotal,
} from "@medplum/fhirtypes";

import { reconcileBillMath } from "./math";
import type { BillAmounts } from "./types";

const FHIR_ADJUDICATION = "http://terminology.hl7.org/CodeSystem/adjudication";
const CARIN_ADJUDICATION = "http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBAdjudication";

const CATEGORY_MAP = {
  submitted: "billedAmount",
  discount: "contractualAdjustment",
  eligible: "allowedAmount",
  deductible: "deductibleApplied",
  copay: "copay",
  coinsurance: "coinsuranceAmount",
  noncovered: "nonCoveredAmount",
  benefit: "insurerPaid",
  memberliability: "patientResponsibility",
} as const;

type AmountKey = (typeof CATEGORY_MAP)[keyof typeof CATEGORY_MAP];
type AdjudicationEntry = ExplanationOfBenefitItemAdjudication | ExplanationOfBenefitTotal;

export interface NormalizeEobOptions {
  controlledDemoFixture?: boolean;
}

export interface NormalizedEobAdjudication {
  amounts: BillAmounts;
  serviceDescription: string;
  dateOfService: string;
  sourceCreatedDate: string;
  mathReconciles: boolean;
  warnings: string[];
}

export class BillNormalizationError extends Error {
  constructor(readonly warnings: string[]) {
    super(warnings.join(" "));
    this.name = "BillNormalizationError";
  }
}

function getCategory(entry: AdjudicationEntry): AmountKey | undefined {
  for (const coding of entry.category.coding ?? []) {
    if (coding.system !== FHIR_ADJUDICATION && coding.system !== CARIN_ADJUDICATION) {
      continue;
    }
    const normalized = coding.code?.toLowerCase().replaceAll("-", "");
    if (normalized && normalized in CATEGORY_MAP) {
      return CATEGORY_MAP[normalized as keyof typeof CATEGORY_MAP];
    }
  }
  return undefined;
}

function readMoney(entry: AdjudicationEntry, key: AmountKey): number {
  if (!entry.amount || entry.amount.value === undefined) {
    throw new BillNormalizationError([`Historical adjudication category ${key} has no amount.`]);
  }
  if (entry.amount.currency !== "USD") {
    throw new BillNormalizationError([`Historical adjudication category ${key} is not in USD.`]);
  }
  return entry.amount.value;
}

function collectAmounts(entries: AdjudicationEntry[]): {
  values: Partial<Record<AmountKey, number>>;
  warnings: string[];
} {
  const values: Partial<Record<AmountKey, number>> = {};
  const warnings: string[] = [];

  for (const entry of entries) {
    const key = getCategory(entry);
    if (!key) {
      continue;
    }
    if (values[key] !== undefined) {
      warnings.push(`Duplicate historical adjudication category: ${key}.`);
      continue;
    }
    values[key] = readMoney(entry, key);
  }

  return { values, warnings };
}

function requireAmount(values: Partial<Record<AmountKey, number>>, key: AmountKey): number {
  const value = values[key];
  if (value === undefined) {
    throw new BillNormalizationError([`Historical adjudication is missing ${key}.`]);
  }
  return value;
}

export function normalizeEob(
  eob: ExplanationOfBenefit,
  options: NormalizeEobOptions = {},
): NormalizedEobAdjudication {
  const entries: AdjudicationEntry[] =
    eob.total && eob.total.length > 0
      ? eob.total
      : (eob.item ?? []).flatMap((item) => item.adjudication ?? []);
  const { values, warnings } = collectAmounts(entries);

  for (const optionalZero of ["copay", "nonCoveredAmount"] as const) {
    if (values[optionalZero] === undefined) {
      if (!options.controlledDemoFixture) {
        throw new BillNormalizationError([
          `Historical adjudication is missing ${optionalZero}; it cannot be inferred as zero.`,
        ]);
      }
      values[optionalZero] = 0;
      warnings.push(`${optionalZero} was omitted and treated as zero for the controlled demo fixture.`);
    }
  }

  const amounts: BillAmounts = {
    billedAmount: requireAmount(values, "billedAmount"),
    contractualAdjustment: requireAmount(values, "contractualAdjustment"),
    allowedAmount: requireAmount(values, "allowedAmount"),
    deductibleApplied: requireAmount(values, "deductibleApplied"),
    copay: requireAmount(values, "copay"),
    coinsuranceAmount: requireAmount(values, "coinsuranceAmount"),
    nonCoveredAmount: requireAmount(values, "nonCoveredAmount"),
    insurerPaid: requireAmount(values, "insurerPaid"),
    patientResponsibility: requireAmount(values, "patientResponsibility"),
  };
  const reconciliation = reconcileBillMath(amounts);
  const firstItem = eob.item?.[0];
  const serviceDescription =
    firstItem?.productOrService.text ??
    firstItem?.productOrService.coding?.[0]?.display ??
    "Billed service";
  const dateOfService =
    firstItem?.servicedDate ?? firstItem?.servicedPeriod?.start ?? eob.billablePeriod?.start;

  if (!dateOfService || !eob.created) {
    throw new BillNormalizationError(["Historical adjudication is missing its service or created date."]);
  }

  return {
    amounts,
    serviceDescription,
    dateOfService,
    sourceCreatedDate: eob.created,
    mathReconciles: reconciliation.mathReconciles && !warnings.some((warning) => warning.startsWith("Duplicate")),
    warnings: [...warnings, ...reconciliation.warnings],
  };
}

