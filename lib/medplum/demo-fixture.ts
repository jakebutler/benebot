import { isResource } from "@medplum/core";
import type {
  Bundle,
  Coverage,
  Encounter,
  ExplanationOfBenefit,
  Invoice,
  Organization,
  Patient,
  Resource,
} from "@medplum/fhirtypes";

import fixtureJson from "@/fixtures/benebot-fhir-seed.json";

type DemoSeedResource =
  | Patient
  | Organization
  | Coverage
  | Encounter
  | ExplanationOfBenefit
  | Invoice;

function parseFixture(): Bundle<DemoSeedResource> {
  if (!isResource<Bundle<Resource>>(fixtureJson, "Bundle") || fixtureJson.type !== "transaction") {
    throw new Error("The BeneBot FHIR fixture is not a transaction Bundle.");
  }

  for (const entry of fixtureJson.entry ?? []) {
    if (!entry.resource) {
      throw new Error("The BeneBot FHIR fixture contains an entry without a resource.");
    }
  }

  return fixtureJson as Bundle<DemoSeedResource>;
}

export const demoSeedBundle = parseFixture();

export function getFixtureResource<T extends DemoSeedResource["resourceType"]>(
  resourceType: T,
): Extract<DemoSeedResource, { resourceType: T }> {
  const resource = getFixtureResources(resourceType)[0];
  if (!resource || resource.resourceType !== resourceType) {
    throw new Error(`The BeneBot FHIR fixture is missing ${resourceType}.`);
  }
  return resource;
}

export function getFixtureResources<T extends DemoSeedResource["resourceType"]>(
  resourceType: T,
): Array<Extract<DemoSeedResource, { resourceType: T }>> {
  return (demoSeedBundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter(
      (resource): resource is Extract<DemoSeedResource, { resourceType: T }> =>
        resource?.resourceType === resourceType,
    );
}
