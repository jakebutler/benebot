import Link from "next/link";
import { ArtifactTimeline, type WorkflowArtifact } from "@/components/staff/artifact-timeline";
import { resolveDemoSeedIds } from "@/lib/medplum/queries";
import { getMedplumClient, isMedplumConfigured } from "@/lib/medplum/server";

const seededArtifacts: WorkflowArtifact[] = [
  { type: "ExplanationOfBenefit", id: "BENEBOT-CLM-1001", timestamp: "Jul 24, 2026", detail: "Historical claim adjudication for Jane’s July 8 MRI service.", source: "Seeded synthetic EOB" },
  { type: "Invoice", id: "BENEBOT-INV-1001", timestamp: "Jul 28, 2026", detail: "Patient-facing statement with a $620 balance.", source: "Seeded synthetic invoice" },
  { type: "CoverageEligibilityResponse", detail: "Appears after current benefits are refreshed. A fallback is always labeled, never presented as live.", source: "Current eligibility" },
  { type: "Task", detail: "Appears only after Jane confirms a billing follow-up request.", source: "BeneBot follow-up workflow" },
  { type: "Communication", detail: "Appears after BeneBot saves a concise conversation summary, without raw audio or full transcript.", source: "BeneBot session summary" },
];

export const dynamic = "force-dynamic";

function timestamp(value: { meta?: { lastUpdated?: string } }): string | undefined {
  return value.meta?.lastUpdated ? new Date(value.meta.lastUpdated).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : undefined;
}

async function loadWorkflowArtifacts(): Promise<{ artifacts: WorkflowArtifact[]; status: string }> {
  if (!isMedplumConfigured()) return { artifacts: seededArtifacts, status: "Medplum is not configured, so only the seeded historical records are shown." };
  try {
    const client = await getMedplumClient();
    const ids = await resolveDemoSeedIds();
    const [eligibility, tasks, communications] = await Promise.all([
      client.searchResources("CoverageEligibilityResponse", { patient: `Patient/${ids.patientId}`, _sort: "-_lastUpdated", _count: "1" }),
      client.searchResources("Task", { for: `Patient/${ids.patientId}`, focus: `Invoice/${ids.invoiceId}`, _sort: "-_lastUpdated", _count: "1" }),
      client.searchResources("Communication", { subject: `Patient/${ids.patientId}`, _sort: "-_lastUpdated", _count: "1" }),
    ]);
    const latestEligibility = eligibility[0];
    const latestTask = tasks[0];
    const latestCommunication = communications[0];
    return {
      status: "Server-confirmed Medplum records are shown below.",
      artifacts: [
        { type: "ExplanationOfBenefit", id: ids.eobId, timestamp: "Jul 24, 2026", detail: "Historical claim adjudication for Jane’s July 8 MRI service.", source: "Seeded synthetic EOB" },
        { type: "Invoice", id: ids.invoiceId, timestamp: "Jul 28, 2026", detail: "Patient-facing statement with a $620 balance.", source: "Seeded synthetic invoice" },
        latestEligibility ? { type: "CoverageEligibilityResponse", id: latestEligibility.id, timestamp: timestamp(latestEligibility), detail: "Current benefits response returned through the Stedi test workflow.", source: "Current eligibility" } : seededArtifacts[2],
        latestTask ? { type: "Task", id: latestTask.id, timestamp: timestamp(latestTask), detail: latestTask.description ?? "Requested billing follow-up.", source: "BeneBot follow-up workflow" } : seededArtifacts[3],
        latestCommunication ? { type: "Communication", id: latestCommunication.id, timestamp: timestamp(latestCommunication), detail: "Concise BeneBot summary saved without raw audio or a full transcript.", source: "BeneBot session summary" } : seededArtifacts[4],
      ],
    };
  } catch {
    return { artifacts: seededArtifacts, status: "Medplum could not be read, so live workflow artifacts are not claimed." };
  }
}

export default async function StaffPage() {
  const { artifacts, status } = await loadWorkflowArtifacts();
  return <main className="staff-shell">
  <nav className="topline" aria-label="BeneBot staff navigation"><Link className="wordmark" href="/">Bene<span>Bot</span></Link><Link className="quiet-link" href="/bill/BENEBOT-INV-1001">Open patient statement</Link></nav>
  <header className="staff-header"><div><p className="eyebrow">Staff proof view</p><h1>One conversation, auditable workflow.</h1><p>All records below use synthetic demo data. Patient-provided audio and full transcripts are not retained.</p></div><span className="demo-badge">Workflow ready</span></header>
  <section className="session-summary" aria-labelledby="session-summary-title"><div><p className="eyebrow">Demo session</p><h2 id="session-summary-title">Jane Doe · BENEBOT-INV-1001</h2></div><dl><div><dt>Amount</dt><dd>$620</dd></div><div><dt>Historical source</dt><dd>EOB created Jul 24</dd></div><div><dt>Current benefits</dt><dd>Not checked yet</dd></div><div><dt>Follow-up</dt><dd>Not requested</dd></div></dl></section>
  <section className="staff-artifacts" aria-labelledby="artifacts-title"><div className="section-heading"><div><p className="eyebrow">FHIR artifact timeline</p><h2 id="artifacts-title">What BeneBot creates and when</h2></div><span className="source-badge historical">Workflow audit</span></div><ArtifactTimeline artifacts={artifacts} /></section>
  <p className="staff-empty-note">{status}</p>
</main>;
}
