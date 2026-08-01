export type Language = "en" | "es";

export type ToolName =
  | "get_bill_context"
  | "refresh_current_benefits"
  | "search_support_resources"
  | "request_human_followup"
  | "save_conversation_summary";

export interface GetBillContextResult {
  patientFirstName: string;
  preferredLanguage?: {
    code: Language;
    display: string;
    preferred: true;
  };
  providerName: string;
  serviceDescription: string;
  dateOfService: string;
  encounter: {
    id: string;
    providerName: string;
    facilityName?: string;
    serviceDescription: string;
    dateOfService: string;
    location?: string;
  };
  invoiceIssuedDate: string;
  currentBalance: number;
  historicalAdjudication: {
    billedAmount: number;
    contractualAdjustment: number;
    allowedAmount: number;
    deductibleApplied: number;
    copay: number;
    coinsuranceAmount: number;
    coinsuranceRate?: number;
    insurerPaid: number;
    patientResponsibility: number;
  };
  source: {
    type: "ExplanationOfBenefit";
    createdDate: string;
    label: "Historical claim adjudication";
  };
  mathReconciles: boolean;
  warnings: string[];
}

export interface RefreshBenefitsInput {
  reason:
    | "patient-request"
    | "compare-with-historical-claim"
    | "agent-suggested";
}

export interface RefreshBenefitsResult {
  source: "stedi-live-test" | "medplum-stedi-bot" | "fixture-fallback";
  checkedAt: string;
  coverageActive?: boolean;
  payerName?: string;
  planName?: string;
  benefits: {
    annualDeductible?: number;
    remainingDeductible?: number;
    deductibleMetToDate?: number;
    deductibleScope?: {
      benefitLevel: "individual";
      network: "in" | "out" | "unknown";
      serviceTypeCodes: string[];
    };
    annualOutOfPocketMaximum?: number;
    remainingOutOfPocketMaximum?: number;
    copays: Array<{
      serviceLabel: string;
      amount: number;
      network?: "in" | "out" | "unknown";
    }>;
    coinsurance: Array<{
      serviceLabel: string;
      percentage: number;
      network?: "in" | "out" | "unknown";
    }>;
  };
  medplum: {
    coverageEligibilityResponseId?: string;
    documentReferenceId?: string;
  };
  warnings: string[];
}

export type SupportNeed =
  | "payment-plan"
  | "financial-assistance"
  | "payer-contact"
  | "billing-advocate"
  | "dispute-or-review";

export interface SearchResourcesInput {
  need: SupportNeed;
  language: Language;
}

export interface SupportResource {
  id: string;
  name: string;
  organization: string;
  type: string;
  summary: string;
  phone?: string;
  url?: string;
  instructions?: string[];
  sourceType:
    | "practice-policy"
    | "fictional-demo-provider"
    | "community-reported";
  verification:
    | "practice-provided"
    | "fictional-demo-data"
    | "unverified";
  disclosure: string;
}

export interface SearchResourcesResult {
  query: string;
  provider: "moss" | "local-json";
  resources: SupportResource[];
}

export interface RequestFollowupInput {
  issueType:
    | "bill-explanation"
    | "deductible"
    | "coinsurance"
    | "service-not-recognized"
    | "amount-dispute"
    | "financial-hardship"
    | "other";
  patientIssueSummary: string;
  preferredContact: "phone" | "secure-message";
}

export interface RequestFollowupResult {
  created: boolean;
  taskId?: string;
  status: "requested" | "failed";
  message: string;
}

export interface SaveSummaryInput {
  language: "en" | "es" | "mixed";
  summary: string;
  questionsAnswered: string[];
  resourcesOffered: string[];
  followupTaskId?: string;
  unresolvedIssues: string[];
}

export interface SaveSummaryResult {
  saved: boolean;
  communicationId?: string;
}

export interface ToolActivityEvent {
  tool: ToolName;
  label: string;
  status: "running" | "succeeded" | "failed";
  at: string;
}
