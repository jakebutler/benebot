import "server-only";

import type {
  Communication,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  CoverageEligibilityResponseInsuranceItem,
  Task,
} from "@medplum/fhirtypes";

import type {
  RefreshBenefitsResult,
  RequestFollowupInput,
  SaveSummaryInput,
} from "@/lib/contracts";
import type { BeneBotSessionClaims } from "@/lib/session";

import { IDENTIFIER_SYSTEMS } from "./constants";
import { getMedplumClient } from "./server";

async function validateSessionReferences(claims: BeneBotSessionClaims): Promise<void> {
  const client = await getMedplumClient();
  const [patient, invoice, coverage, provider, payer] = await Promise.all([
    client.readResource("Patient", claims.patientId),
    client.readResource("Invoice", claims.invoiceId),
    client.readResource("Coverage", claims.coverageId),
    client.readResource("Organization", claims.providerOrganizationId),
    client.readResource("Organization", claims.payerOrganizationId),
  ]);
  if (
    invoice.subject?.reference !== `Patient/${patient.id}` ||
    invoice.issuer?.reference !== `Organization/${provider.id}` ||
    coverage.beneficiary.reference !== `Patient/${patient.id}` ||
    !coverage.payor.some((payor) => payor.reference === `Organization/${payer.id}`)
  ) {
    throw new Error("Medplum resources are not bound to the signed BeneBot session.");
  }
}

function concise(value: string, maxLength: number): string {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function createFollowupTask(
  claims: BeneBotSessionClaims,
  input: RequestFollowupInput,
): Promise<Task & { id: string }> {
  await validateSessionReferences(claims);
  const client = await getMedplumClient();
  const stableValue = `${claims.jti}:followup:${input.resourceId}`;
  const task: Task = {
    resourceType: "Task",
    identifier: [{ system: IDENTIFIER_SYSTEMS.session, value: stableValue }],
    status: "requested",
    intent: "order",
    code: { text: "Patient billing follow-up" },
    description: `Contact the patient regarding ${input.resourceId} for BeneBot demo invoice BENEBOT-INV-1001.`,
    for: { reference: `Patient/${claims.patientId}` },
    focus: { reference: `Invoice/${claims.invoiceId}` },
    authoredOn: new Date().toISOString(),
    requester: { reference: `Patient/${claims.patientId}` },
    owner: { reference: `Organization/${claims.providerOrganizationId}` },
    input: [
      { type: { text: "Requested support resource" }, valueString: input.resourceId },
      { type: { text: "Preferred contact" }, valueString: input.preferredContact },
      ...(input.notes
        ? [{ type: { text: "Patient note" }, valueString: concise(input.notes, 300) }]
        : []),
    ],
  };
  const created = await client.createResourceIfNoneExist(
    task,
    `identifier=${encodeURIComponent(`${IDENTIFIER_SYSTEMS.session}|${stableValue}`)}`,
  );
  if (!created.id) {
    throw new Error("Medplum did not confirm the follow-up Task id.");
  }
  return created;
}

function buildSummary(
  input: SaveSummaryInput,
  metadata: { historicalSourceDate: string; eligibilitySummary: string },
): string {
  const parts = [
    concise(input.summary, 600),
    `Historical EOB created: ${metadata.historicalSourceDate}.`,
    `Current eligibility: ${metadata.eligibilitySummary}.`,
    `Language: ${input.language}.`,
    `Questions answered: ${input.questionsAnswered.map((value) => concise(value, 100)).join(", ") || "none"}.`,
    `Resources offered: ${input.resourcesOffered.map((value) => concise(value, 100)).join(", ") || "none"}.`,
    `Follow-up Task: ${input.followupTaskId ? concise(input.followupTaskId, 80) : "none"}.`,
    `Unresolved issues: ${input.unresolvedIssues.map((value) => concise(value, 100)).join(", ") || "none"}.`,
  ];
  return parts.join(" ");
}

export async function createConversationCommunication(
  claims: BeneBotSessionClaims,
  input: SaveSummaryInput,
): Promise<Communication & { id: string }> {
  await validateSessionReferences(claims);
  const client = await getMedplumClient();
  const [eob, eligibilityResponses] = await Promise.all([
    client.readResource("ExplanationOfBenefit", claims.eobId),
    client.searchResources("CoverageEligibilityResponse", {
      identifier: `${IDENTIFIER_SYSTEMS.session}|${claims.jti}:eligibility-response`,
      _count: "2",
    }),
  ]);
  if (input.followupTaskId) {
    const task = await client.readResource("Task", input.followupTaskId);
    if (
      task.for?.reference !== `Patient/${claims.patientId}` ||
      task.focus?.reference !== `Invoice/${claims.invoiceId}`
    ) {
      throw new Error("Follow-up Task is not scoped to this BeneBot session.");
    }
  }
  const stableValue = `${claims.jti}:summary`;
  const communication: Communication = {
    resourceType: "Communication",
    identifier: [{ system: IDENTIFIER_SYSTEMS.session, value: stableValue }],
    status: "completed",
    category: [{ text: "BeneBot billing explanation" }],
    subject: { reference: `Patient/${claims.patientId}` },
    about: [
      { reference: `Invoice/${claims.invoiceId}` },
      { reference: `ExplanationOfBenefit/${claims.eobId}` },
      ...(input.followupTaskId ? [{ reference: `Task/${input.followupTaskId}` }] : []),
    ],
    sender: { reference: `Organization/${claims.providerOrganizationId}` },
    recipient: [{ reference: `Patient/${claims.patientId}` }],
    sent: new Date().toISOString(),
    payload: [
      {
        contentString: buildSummary(input, {
          historicalSourceDate: eob.created,
          eligibilitySummary:
            eligibilityResponses.length === 0
              ? "not refreshed"
              : `refreshed ${eligibilityResponses[0].created}; ${eligibilityResponses[0].disposition ?? "source recorded in Medplum"}`,
        }),
      },
    ],
  };
  const created = await client.createResourceIfNoneExist(
    communication,
    `identifier=${encodeURIComponent(`${IDENTIFIER_SYSTEMS.session}|${stableValue}`)}`,
  );
  if (!created.id) {
    throw new Error("Medplum did not confirm the Communication id.");
  }
  return created;
}

function eligibilityItems(result: RefreshBenefitsResult): CoverageEligibilityResponseInsuranceItem[] {
  const items: CoverageEligibilityResponseInsuranceItem[] = [];
  const addMoney = (name: string, amount: number | undefined): void => {
    if (amount !== undefined) {
      items.push({
        name,
        benefit: [{ type: { text: name }, allowedMoney: { value: amount, currency: "USD" } }],
      });
    }
  };
  addMoney("Annual deductible", result.benefits.annualDeductible);
  addMoney("Remaining deductible", result.benefits.remainingDeductible);
  addMoney("Annual out-of-pocket maximum", result.benefits.annualOutOfPocketMaximum);
  addMoney("Remaining out-of-pocket maximum", result.benefits.remainingOutOfPocketMaximum);
  for (const copay of result.benefits.copays) {
    items.push({
      name: concise(copay.serviceLabel, 120),
      description: copay.network ? `Copay; network: ${copay.network}` : "Copay",
      benefit: [{ type: { text: "Copay" }, allowedMoney: { value: copay.amount, currency: "USD" } }],
    });
  }
  for (const coinsurance of result.benefits.coinsurance) {
    items.push({
      name: concise(coinsurance.serviceLabel, 120),
      description: coinsurance.network
        ? `Coinsurance; network: ${coinsurance.network}`
        : "Coinsurance",
      benefit: [{ type: { text: "Coinsurance" }, allowedString: `${coinsurance.percentage}%` }],
    });
  }
  return items;
}

export async function persistEligibilityResult(
  claims: BeneBotSessionClaims,
  result: RefreshBenefitsResult,
): Promise<{ coverageEligibilityResponseId?: string }> {
  if (result.source === "fixture-fallback") {
    return {};
  }
  await validateSessionReferences(claims);
  const client = await getMedplumClient();
  const requestIdentifier = `${claims.jti}:eligibility-request`;
  const eligibilityRequest: CoverageEligibilityRequest = {
    resourceType: "CoverageEligibilityRequest",
    identifier: [{ system: IDENTIFIER_SYSTEMS.session, value: requestIdentifier }],
    status: "active",
    purpose: ["benefits", "validation"],
    patient: { reference: `Patient/${claims.patientId}` },
    servicedDate: result.checkedAt.slice(0, 10),
    created: result.checkedAt,
    provider: { reference: `Organization/${claims.providerOrganizationId}` },
    insurer: { reference: `Organization/${claims.payerOrganizationId}` },
    insurance: [{ focal: true, coverage: { reference: `Coverage/${claims.coverageId}` } }],
  };
  const request = await client.createResourceIfNoneExist(
    eligibilityRequest,
    `identifier=${encodeURIComponent(`${IDENTIFIER_SYSTEMS.session}|${requestIdentifier}`)}`,
  );
  if (!request.id) {
    throw new Error("Medplum did not confirm the CoverageEligibilityRequest id.");
  }

  const responseIdentifier = `${claims.jti}:eligibility-response`;
  const response: CoverageEligibilityResponse = {
    resourceType: "CoverageEligibilityResponse",
    identifier: [{ system: IDENTIFIER_SYSTEMS.session, value: responseIdentifier }],
    status: "active",
    purpose: ["benefits", "validation"],
    patient: { reference: `Patient/${claims.patientId}` },
    servicedDate: result.checkedAt.slice(0, 10),
    created: result.checkedAt,
    requestor: { reference: `Organization/${claims.providerOrganizationId}` },
    request: { reference: `CoverageEligibilityRequest/${request.id}` },
    outcome: "complete",
    disposition: `${result.source}; checked ${result.checkedAt}`,
    insurer: { reference: `Organization/${claims.payerOrganizationId}` },
    insurance: [
      {
        coverage: { reference: `Coverage/${claims.coverageId}` },
        inforce: result.coverageActive,
        item: eligibilityItems(result),
      },
    ],
  };
  const created = await client.createResourceIfNoneExist(
    response,
    `identifier=${encodeURIComponent(`${IDENTIFIER_SYSTEMS.session}|${responseIdentifier}`)}`,
  );
  if (!created.id) {
    throw new Error("Medplum did not confirm the CoverageEligibilityResponse id.");
  }
  return { coverageEligibilityResponseId: created.id };
}
