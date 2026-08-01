import { isResource, MedplumClient, type WithId } from "@medplum/core";
import type { Identifier, Resource } from "@medplum/fhirtypes";
import { loadEnvConfig } from "@next/env";

import { normalizeEob } from "../lib/billing/normalize-eob";
import { DEMO_IDENTIFIERS, IDENTIFIER_SYSTEMS } from "../lib/medplum/constants";
import { demoSeedBundle } from "../lib/medplum/demo-fixture";

loadEnvConfig(process.cwd());

type IdentifiedResource = Resource & { identifier?: Identifier[] };

function primaryIdentifier(resource: IdentifiedResource): { system: string; value: string } {
  const identifier = resource.identifier?.find(
    (entry) => entry.system?.startsWith("https://benebot.health/fhir/identifier/") && entry.value,
  );
  if (!identifier?.system || !identifier.value) {
    throw new Error(`${resource.resourceType} is missing a stable BeneBot identifier.`);
  }
  return { system: identifier.system, value: identifier.value };
}

function conditionalQuery(system: string, value: string): string {
  return `identifier=${encodeURIComponent(`${system}|${value}`)}`;
}

async function searchUnique<T extends IdentifiedResource>(
  client: MedplumClient,
  resource: T,
): Promise<WithId<T> | undefined> {
  const identifier = primaryIdentifier(resource);
  const matches = await client.searchResources(resource.resourceType, {
    identifier: `${identifier.system}|${identifier.value}`,
    _count: "3",
  });
  if (matches.length > 1) {
    throw new Error(
      `Multiple ${resource.resourceType} resources found for ${identifier.value}; remove duplicates before seeding.`,
    );
  }
  return matches[0] as WithId<T> | undefined;
}

async function validateOnServer(client: MedplumClient, resource: Resource): Promise<void> {
  const outcome = await client.validateResource(resource);
  const blocking = outcome.issue?.filter(
    (issue) => issue.severity === "error" || issue.severity === "fatal",
  );
  if (blocking && blocking.length > 0) {
    const detail = blocking.map((issue) => issue.details?.text ?? issue.diagnostics ?? issue.code).join("; ");
    throw new Error(`${resource.resourceType} failed FHIR validation: ${detail}`);
  }
}

async function seedResource<T extends IdentifiedResource>(client: MedplumClient, resource: T): Promise<WithId<T>> {
  await validateOnServer(client, resource);
  const identifier = primaryIdentifier(resource);
  const existing = await searchUnique(client, resource);
  let written: WithId<T>;
  if (existing) {
    written = await client.updateResource({
      ...resource,
      id: existing.id,
      meta: existing.meta,
    });
  } else {
    written = await client.createResourceIfNoneExist(
      resource,
      conditionalQuery(identifier.system, identifier.value),
    );
  }
  if (!written.id) {
    throw new Error(`Medplum did not return an id for ${resource.resourceType}.`);
  }
  const confirmed = await searchUnique(client, resource);
  if (!confirmed || confirmed.id !== written.id) {
    throw new Error(`Could not uniquely confirm ${resource.resourceType} after seed write.`);
  }
  return written;
}

function resolveFixtureReferences<T extends Resource>(
  resource: T,
  references: ReadonlyMap<string, string>,
): T {
  let serialized = JSON.stringify(resource);
  for (const [fixtureUrl, actualReference] of references) {
    serialized = serialized.replaceAll(fixtureUrl, actualReference);
  }
  const parsed: unknown = JSON.parse(serialized);
  if (!isResource<T>(parsed, resource.resourceType)) {
    throw new Error(`Reference resolution corrupted ${resource.resourceType}.`);
  }
  return parsed;
}

function assertCanonicalDemo(resources: Resource[]): void {
  const eob = resources.find((resource) => resource.resourceType === "ExplanationOfBenefit");
  const invoice = resources.find((resource) => resource.resourceType === "Invoice");
  const coverage = resources.find((resource) => resource.resourceType === "Coverage");
  if (!eob || !invoice || !coverage) {
    throw new Error("FHIR seed fixture is missing the EOB, Invoice, or Coverage.");
  }
  const normalized = normalizeEob(eob, { controlledDemoFixture: true });
  if (!normalized.mathReconciles || normalized.amounts.patientResponsibility !== 620) {
    throw new Error("FHIR seed EOB does not reconcile to the required $620 responsibility.");
  }
  if (invoice.totalNet?.currency !== "USD" || invoice.totalNet.value !== 620) {
    throw new Error("FHIR seed Invoice must have a $620 USD total.");
  }
  if (coverage.subscriberId !== "AETNA12345") {
    throw new Error("FHIR seed Coverage does not match the fixed Stedi test member.");
  }
}

async function main(): Promise<void> {
  const entries = demoSeedBundle.entry ?? [];
  const resources = entries.flatMap((entry) => (entry.resource ? [entry.resource] : []));
  assertCanonicalDemo(resources);

  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "MEDPLUM_NOT_CONFIGURED: set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET before seeding.",
    );
  }
  const client = new MedplumClient({
    baseUrl: process.env.MEDPLUM_BASE_URL || "https://api.medplum.com/",
  });
  await client.startClientLogin(clientId, clientSecret);
  const resolvedReferences = new Map<string, string>();
  const ids = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.resource || !entry.fullUrl) {
      throw new Error("Every seed entry must include a resource and fullUrl.");
    }
    const resource = resolveFixtureReferences(entry.resource, resolvedReferences);
    const written = await seedResource(client, resource);
    resolvedReferences.set(entry.fullUrl, `${written.resourceType}/${written.id}`);
    const identifier = primaryIdentifier(written);
    ids.set(identifier.value, written.id);
  }

  console.log(
    JSON.stringify(
      {
        patientId: ids.get(DEMO_IDENTIFIERS.patient),
        coverageId: ids.get(DEMO_IDENTIFIERS.coverage),
        eobId: ids.get(DEMO_IDENTIFIERS.claim),
        invoiceId: ids.get(DEMO_IDENTIFIERS.invoice),
        providerOrganizationId: ids.get(DEMO_IDENTIFIERS.provider),
        payerOrganizationId: ids.get(DEMO_IDENTIFIERS.payer),
        identifierSystems: IDENTIFIER_SYSTEMS,
      },
      undefined,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed failure";
  console.error(`Medplum seed failed: ${message}`);
  process.exitCode = 1;
});
