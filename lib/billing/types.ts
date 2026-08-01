export interface BillAmounts {
  billedAmount: number;
  contractualAdjustment: number;
  allowedAmount: number;
  deductibleApplied: number;
  copay: number;
  coinsuranceRate?: number;
  coinsuranceAmount: number;
  nonCoveredAmount: number;
  insurerPaid: number;
  patientResponsibility: number;
}

export interface NormalizedBillContext {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    preferredLanguage?: {
      code: "en" | "es";
      display: string;
    };
  };
  provider: { id: string; name: string };
  payer: { id: string; name: string };
  service: {
    encounterId: string;
    description: string;
    dateOfService: string;
    location?: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    issuedDate: string;
    dueDate?: string;
    currentBalance: number;
    currency: "USD";
  };
  adjudication: BillAmounts & {
    sourceResourceId: string;
    sourceCreatedDate: string;
  };
  confidence: {
    mathReconciles: boolean;
    source: "explanation-of-benefit";
    warnings: string[];
  };
}

export interface ReconciliationResult {
  mathReconciles: boolean;
  warnings: string[];
}
