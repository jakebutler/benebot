import type { MedplumClient } from "@medplum/core";
import type { Resource, Task } from "@medplum/fhirtypes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBeneBotSession, DEMO_SESSION_SCOPE } from "@/lib/session";

const mocks = vi.hoisted(() => ({
  getMedplumClient: vi.fn(),
}));

vi.mock("@/lib/medplum/server", () => ({
  getMedplumClient: mocks.getMedplumClient,
}));

import { createFollowupTask } from "@/lib/medplum/write-artifacts";

const secret = "benebot-test-secret-is-at-least-32-bytes-long";

function scopedResources(): Record<string, Resource> {
  const patientReference = `Patient/${DEMO_SESSION_SCOPE.patientId}`;
  const providerReference = `Organization/${DEMO_SESSION_SCOPE.providerOrganizationId}`;
  const payerReference = `Organization/${DEMO_SESSION_SCOPE.payerOrganizationId}`;
  const coverageReference = `Coverage/${DEMO_SESSION_SCOPE.coverageId}`;
  const encounterReference = `Encounter/${DEMO_SESSION_SCOPE.encounterId}`;
  return {
    Patient: { resourceType: "Patient", id: DEMO_SESSION_SCOPE.patientId },
    Invoice: {
      resourceType: "Invoice",
      id: DEMO_SESSION_SCOPE.invoiceId,
      status: "issued",
      subject: { reference: patientReference },
      issuer: { reference: providerReference },
    },
    Coverage: {
      resourceType: "Coverage",
      id: DEMO_SESSION_SCOPE.coverageId,
      status: "active",
      beneficiary: { reference: patientReference },
      payor: [{ reference: payerReference }],
    },
    Encounter: {
      resourceType: "Encounter",
      id: DEMO_SESSION_SCOPE.encounterId,
      status: "finished",
      class: { code: "AMB" },
      subject: { reference: patientReference },
      serviceProvider: { reference: providerReference },
    },
    ExplanationOfBenefit: {
      resourceType: "ExplanationOfBenefit",
      id: DEMO_SESSION_SCOPE.eobId,
      status: "active",
      type: {},
      use: "claim",
      patient: { reference: patientReference },
      created: "2026-07-24T16:00:00Z",
      insurer: { reference: payerReference },
      provider: { reference: providerReference },
      outcome: "complete",
      insurance: [{ focal: true, coverage: { reference: coverageReference } }],
      item: [
        {
          sequence: 1,
          productOrService: { text: "MRI of the lower back" },
          encounter: [{ reference: encounterReference }],
        },
      ],
    },
    Organization: {
      resourceType: "Organization",
      id: DEMO_SESSION_SCOPE.providerOrganizationId,
    },
  };
}

describe("Medplum billing-review Task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists only the confirmed scoped issue summary and contact preference", async () => {
    const resources = scopedResources();
    const createResourceIfNoneExist = vi.fn(async (resource: Task) => ({
      ...resource,
      id: "billing-case-123",
    }));
    const readResource = vi.fn(async (resourceType: string, id: string) => {
      if (resourceType === "Organization") {
        return {
          resourceType: "Organization",
          id,
        };
      }
      const resource = resources[resourceType];
      if (!resource) {
        throw new Error(`Unexpected read: ${resourceType}/${id}`);
      }
      return resource;
    });
    mocks.getMedplumClient.mockResolvedValue({
      readResource,
      createResourceIfNoneExist,
    } as unknown as MedplumClient);
    const { claims } = await createBeneBotSession(DEMO_SESSION_SCOPE, { secret });

    const created = await createFollowupTask(claims, {
      issueType: "deductible",
      patientIssueSummary:
        "Jane sigue confundida sobre si los $500 históricos son su deducible restante actual.",
      preferredContact: "secure-message",
      patientConfirmed: true,
    });

    expect(created.id).toBe("billing-case-123");
    const task = createResourceIfNoneExist.mock.calls[0]?.[0];
    expect(task).toMatchObject({
      resourceType: "Task",
      status: "requested",
      code: { text: "Patient billing review case" },
      for: { reference: `Patient/${DEMO_SESSION_SCOPE.patientId}` },
      focus: { reference: `Invoice/${DEMO_SESSION_SCOPE.invoiceId}` },
      owner: {
        reference: `Organization/${DEMO_SESSION_SCOPE.providerOrganizationId}`,
      },
    });
    expect(task?.input).toEqual([
      { type: { text: "Billing issue type" }, valueString: "deductible" },
      {
        type: { text: "Patient issue summary" },
        valueString:
          "Jane sigue confundida sobre si los $500 históricos son su deducible restante actual.",
      },
      { type: { text: "Preferred contact" }, valueString: "secure-message" },
      {
        type: { text: "Billing encounter" },
        valueReference: {
          reference: `Encounter/${DEMO_SESSION_SCOPE.encounterId}`,
        },
      },
    ]);
    expect(JSON.stringify(task)).not.toContain("transcript");
  });

  it("rejects a session whose encounter is not linked from the EOB", async () => {
    const resources = scopedResources();
    const eob = resources.ExplanationOfBenefit;
    if (eob.resourceType !== "ExplanationOfBenefit") {
      throw new Error("Test fixture EOB is missing.");
    }
    eob.item = eob.item?.map((item) => ({ ...item, encounter: [] }));
    const readResource = vi.fn(async (resourceType: string, id: string) => {
      if (resourceType === "Organization") {
        return { resourceType: "Organization", id };
      }
      return resources[resourceType];
    });
    const createResourceIfNoneExist = vi.fn();
    mocks.getMedplumClient.mockResolvedValue({
      readResource,
      createResourceIfNoneExist,
    } as unknown as MedplumClient);
    const { claims } = await createBeneBotSession(DEMO_SESSION_SCOPE, { secret });

    await expect(
      createFollowupTask(claims, {
        issueType: "deductible",
        patientIssueSummary: "Deducible histórico frente al deducible actual.",
        preferredContact: "phone",
        patientConfirmed: true,
      }),
    ).rejects.toThrow("Medplum resources are not bound");
    expect(createResourceIfNoneExist).not.toHaveBeenCalled();
  });
});
