import "server-only";

import type {
  Coverage,
  ExplanationOfBenefit,
  Identifier,
  Invoice,
  Organization,
  Patient,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";

import { normalizeEob } from "@/lib/billing/normalize-eob";
import type { NormalizedBillContext } from "@/lib/billing/types";

import { DEMO_IDENTIFIERS, IDENTIFIER_SYSTEMS } from "./constants";
import { getFixtureResource, getFixtureResources } from "./demo-fixture";
import { getMedplumClient, MedplumNotConfiguredError } from "./server";

export interface BillSessionScope {
  patientId: string;
  invoiceId: string;
  eobId: string;
  coverageId: string;
  providerOrganizationId: string;
  payerOrganizationId: string;
}

export interface DemoSeedIds extends BillSessionScope {
  encounterId: string;
}

function referenceMatches(reference: string | undefined, resourceType: ResourceType, id: string): boolean {
  return reference === `${resourceType}/${id}`;
}

function requiredId(resource: Resource): string {
  if (!resource.id) {
    throw new Error(`${resource.resourceType} did not include an id.`);
  }
  return resource.id;
}

function requiredInvoiceAmount(invoice: Invoice): number {
  if (invoice.totalNet?.currency !== "USD" || invoice.totalNet.value === undefined) {
    throw new Error("The invoice does not contain a USD total.");
  }
  return invoice.totalNet.value;
}

function identifierValue(
  resource: Resource & { identifier?: Identifier[] },
  system: string,
): string {
  const value = resource.identifier?.find((identifier) => identifier.system === system)?.value;
  if (!value) {
    throw new Error(`${resource.resourceType} is missing its BeneBot stable identifier.`);
  }
  return value;
}

export function buildNormalizedBillContext(input: {
  patient: Patient;
  provider: Organization;
  payer: Organization;
  coverage: Coverage;
  eob: ExplanationOfBenefit;
  invoice: Invoice;
  controlledDemoFixture: boolean;
}): NormalizedBillContext {
  const { patient, provider, payer, coverage, eob, invoice } = input;
  const patientId = requiredId(patient);
  const providerId = requiredId(provider);
  const payerId = requiredId(payer);
  const coverageId = requiredId(coverage);
  const eobId = requiredId(eob);
  const invoiceId = requiredId(invoice);

  if (!referenceMatches(invoice.subject?.reference, "Patient", patientId)) {
    throw new Error("Invoice is not scoped to the session patient.");
  }
  if (!referenceMatches(invoice.issuer?.reference, "Organization", providerId)) {
    throw new Error("Invoice issuer is not scoped to the session provider.");
  }
  if (!referenceMatches(eob.patient.reference, "Patient", patientId)) {
    throw new Error("EOB is not scoped to the session patient.");
  }
  if (!referenceMatches(eob.provider.reference, "Organization", providerId)) {
    throw new Error("EOB provider is not scoped to the session provider.");
  }
  if (!referenceMatches(eob.insurer.reference, "Organization", payerId)) {
    throw new Error("EOB insurer is not scoped to the session payer.");
  }
  if (
    !eob.insurance.some((insurance) =>
      referenceMatches(insurance.coverage.reference, "Coverage", coverageId),
    )
  ) {
    throw new Error("EOB coverage is not scoped to the session coverage.");
  }
  if (!referenceMatches(coverage.beneficiary.reference, "Patient", patientId)) {
    throw new Error("Coverage is not scoped to the session patient.");
  }

  const normalized = normalizeEob(eob, {
    controlledDemoFixture: input.controlledDemoFixture,
  });
  const currentBalance = requiredInvoiceAmount(invoice);
  if (Math.abs(currentBalance - normalized.amounts.patientResponsibility) > 0.01) {
    normalized.warnings.push("Invoice balance does not match EOB patient responsibility.");
    normalized.mathReconciles = false;
  }

  const name = patient.name?.find((entry) => entry.use === "official") ?? patient.name?.[0];
  if (!name?.family || !name.given?.[0] || !patient.birthDate || !provider.name || !payer.name) {
    throw new Error("The bill context is missing required display information.");
  }

  return {
    patient: {
      id: patientId,
      firstName: name.given[0],
      lastName: name.family,
      birthDate: patient.birthDate,
    },
    provider: { id: providerId, name: provider.name },
    payer: { id: payerId, name: payer.name },
    service: {
      description: normalized.serviceDescription,
      dateOfService: normalized.dateOfService,
    },
    invoice: {
      id: invoiceId,
      invoiceNumber: identifierValue(invoice, IDENTIFIER_SYSTEMS.invoice),
      issuedDate: invoice.date ?? "",
      currentBalance,
      currency: "USD",
    },
    adjudication: {
      sourceResourceId: eobId,
      sourceCreatedDate: normalized.sourceCreatedDate,
      ...normalized.amounts,
    },
    confidence: {
      mathReconciles: normalized.mathReconciles,
      source: "explanation-of-benefit",
      warnings: normalized.warnings,
    },
  };
}

export async function getBillContextForSession(
  scope: BillSessionScope,
): Promise<NormalizedBillContext> {
  const client = await getMedplumClient();
  const [patient, provider, payer, coverage, eob, invoice] = await Promise.all([
    client.readResource("Patient", scope.patientId),
    client.readResource("Organization", scope.providerOrganizationId),
    client.readResource("Organization", scope.payerOrganizationId),
    client.readResource("Coverage", scope.coverageId),
    client.readResource("ExplanationOfBenefit", scope.eobId),
    client.readResource("Invoice", scope.invoiceId),
  ]);
  const controlledDemoFixture =
    identifierValue(eob, IDENTIFIER_SYSTEMS.claim) === DEMO_IDENTIFIERS.claim;
  return buildNormalizedBillContext({
    patient,
    provider,
    payer,
    coverage,
    eob,
    invoice,
    controlledDemoFixture,
  });
}

function withFixtureIds<T extends Resource>(resource: T, id: string): T {
  return { ...resource, id };
}

export function getFixtureBillContext(): NormalizedBillContext {
  const patient = withFixtureIds(getFixtureResource("Patient"), "demo-patient-jane-doe");
  const organizations = getFixtureResources("Organization");
  const providerFixture = organizations.find((organization) =>
    organization.identifier?.some((identifier) => identifier.system === IDENTIFIER_SYSTEMS.provider),
  );
  const payerFixture = organizations.find((organization) =>
    organization.identifier?.some((identifier) => identifier.system === IDENTIFIER_SYSTEMS.payer),
  );
  if (!providerFixture || !payerFixture) {
    throw new Error("Fixture provider or payer is missing.");
  }
  const provider = withFixtureIds(providerFixture, "demo-provider-bayview");
  const payer = withFixtureIds(payerFixture, "demo-payer-aetna");
  const coverage = withFixtureIds(getFixtureResource("Coverage"), "demo-coverage-jane-aetna");
  const eob = withFixtureIds(getFixtureResource("ExplanationOfBenefit"), "demo-eob-1001");
  const invoice = withFixtureIds(getFixtureResource("Invoice"), "demo-invoice-1001");

  coverage.beneficiary = { reference: `Patient/${patient.id}` };
  eob.patient = { reference: `Patient/${patient.id}` };
  eob.provider = { reference: `Organization/${provider.id}` };
  eob.insurer = { reference: `Organization/${payer.id}` };
  eob.insurance = [{ focal: true, coverage: { reference: `Coverage/${coverage.id}` } }];
  invoice.subject = { reference: `Patient/${patient.id}` };
  invoice.issuer = { reference: `Organization/${provider.id}` };

  const context = buildNormalizedBillContext({
    patient,
    provider,
    payer,
    coverage,
    eob,
    invoice,
    controlledDemoFixture: true,
  });
  context.confidence.warnings.push("Demo fixture fallback — Medplum is not configured.");
  return context;
}

async function findUniqueByIdentifier<T extends ResourceType>(
  resourceType: T,
  system: string,
  value: string,
): Promise<string> {
  const client = await getMedplumClient();
  const matches = await client.searchResources(resourceType, {
    identifier: `${system}|${value}`,
    _count: "3",
  });
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `${resourceType} ${value} has not been seeded.`
        : `Multiple ${resourceType} resources found for ${value}.`,
    );
  }
  return requiredId(matches[0]);
}

export async function resolveDemoSeedIds(): Promise<DemoSeedIds> {
  const [patientId, providerOrganizationId, payerOrganizationId, coverageId, encounterId, eobId, invoiceId] =
    await Promise.all([
      findUniqueByIdentifier("Patient", IDENTIFIER_SYSTEMS.patient, DEMO_IDENTIFIERS.patient),
      findUniqueByIdentifier("Organization", IDENTIFIER_SYSTEMS.provider, DEMO_IDENTIFIERS.provider),
      findUniqueByIdentifier("Organization", IDENTIFIER_SYSTEMS.payer, DEMO_IDENTIFIERS.payer),
      findUniqueByIdentifier("Coverage", IDENTIFIER_SYSTEMS.coverage, DEMO_IDENTIFIERS.coverage),
      findUniqueByIdentifier("Encounter", IDENTIFIER_SYSTEMS.encounter, DEMO_IDENTIFIERS.encounter),
      findUniqueByIdentifier("ExplanationOfBenefit", IDENTIFIER_SYSTEMS.claim, DEMO_IDENTIFIERS.claim),
      findUniqueByIdentifier("Invoice", IDENTIFIER_SYSTEMS.invoice, DEMO_IDENTIFIERS.invoice),
    ]);
  return {
    patientId,
    providerOrganizationId,
    payerOrganizationId,
    coverageId,
    encounterId,
    eobId,
    invoiceId,
  };
}

export function isMissingMedplum(error: unknown): error is MedplumNotConfiguredError {
  return error instanceof MedplumNotConfiguredError;
}
