export const IDENTIFIER_SYSTEMS = {
  patient: "https://benebot.health/fhir/identifier/demo-patient",
  provider: "https://benebot.health/fhir/identifier/demo-provider",
  payer: "https://benebot.health/fhir/identifier/demo-payer",
  coverage: "https://benebot.health/fhir/identifier/demo-coverage",
  encounter: "https://benebot.health/fhir/identifier/demo-encounter",
  claim: "https://benebot.health/fhir/identifier/demo-claim",
  invoice: "https://benebot.health/fhir/identifier/demo-invoice",
  session: "https://benebot.health/fhir/identifier/demo-session",
} as const;

export const DEMO_IDENTIFIERS = {
  patient: "jane-doe",
  provider: "bayview-imaging",
  payer: "aetna-stedi-test",
  coverage: "jane-aetna-test",
  encounter: "bayview-mri-2026-07-08",
  claim: "BENEBOT-CLM-1001",
  invoice: "BENEBOT-INV-1001",
} as const;

