import Link from "next/link";

import { ArtifactTimeline, type WorkflowArtifact } from "@/components/staff/artifact-timeline";
import { resolveDemoSeedIds } from "@/lib/medplum/queries";
import { getMedplumClient, isMedplumConfigured } from "@/lib/medplum/server";

const seededArtifacts: WorkflowArtifact[] = [
  { type: "ExplanationOfBenefit", id: "BENEBOT-CLM-1001", timestamp: "24 jul 2026", detail: "Adjudicación histórica de la resonancia de Jane del 8 de julio, incluido el deducible aplicado de $500.", source: "EOB sintético sembrado" },
  { type: "Invoice", id: "BENEBOT-INV-1001", timestamp: "28 jul 2026", detail: "Estado de cuenta para pacientes con saldo actual de $620.", source: "Factura sintética sembrada" },
  { type: "CoverageEligibilityResponse", detail: "Aparece después de consultar los beneficios actuales; su fecha y fuente son independientes del EOB histórico.", source: "Elegibilidad actual" },
  { type: "Task", detail: "Aparece solo después de que Jane confirme una solicitud de caso de revisión de facturación.", source: "Caso de BeneBot" },
  { type: "Communication", detail: "Aparece después de guardar un resumen conciso, sin audio ni transcripción completa.", source: "Resumen de BeneBot" },
];

export const dynamic = "force-dynamic";

function timestamp(value: { meta?: { lastUpdated?: string } }): string | undefined {
  return value.meta?.lastUpdated
    ? new Date(value.meta.lastUpdated).toLocaleString("es-US", { dateStyle: "medium", timeStyle: "short" })
    : undefined;
}

function taskInputText(task: { input?: Array<{ type?: { text?: string }; valueString?: string }>; description?: string }): string | undefined {
  const summary = task.input?.find((input) => input.type?.text === "Patient issue summary")?.valueString;
  return summary ?? task.description;
}

interface WorkflowView {
  artifacts: WorkflowArtifact[];
  status: string;
  currentBenefits: string;
  unresolvedConcern: string;
  caseStatus: string;
}

async function loadWorkflowArtifacts(): Promise<WorkflowView> {
  if (!isMedplumConfigured()) {
    return {
      artifacts: seededArtifacts,
      status: "Medplum no está configurado; esta vista muestra solo los registros históricos sembrados y no afirma que se haya creado un caso.",
      currentBenefits: "Aún no consultados",
      unresolvedConcern: "Aún no se ha confirmado una inquietud de facturación.",
      caseStatus: "No solicitado",
    };
  }
  try {
    const client = await getMedplumClient();
    const ids = await resolveDemoSeedIds();
    const [eligibility, tasks, communications] = await Promise.all([
      client.searchResources("CoverageEligibilityResponse", { patient: `Patient/${ids.patientId}`, _sort: "-_lastUpdated", _count: "10" }),
      client.searchResources("Task", { patient: `Patient/${ids.patientId}`, focus: `Invoice/${ids.invoiceId}`, _sort: "-_lastUpdated", _count: "10" }),
      client.searchResources("Communication", { subject: `Patient/${ids.patientId}`, _sort: "-_lastUpdated", _count: "10" }),
    ]);
    const latestEligibility = eligibility.find(
      (response) =>
        response.patient.reference === `Patient/${ids.patientId}` &&
        response.insurer.reference === `Organization/${ids.payerOrganizationId}` &&
        response.insurance?.some(
          (insurance) => insurance.coverage.reference === `Coverage/${ids.coverageId}`,
        ),
    );
    const latestTask = tasks.find(
      (task) =>
        task.owner?.reference === `Organization/${ids.providerOrganizationId}` &&
        task.input?.some(
          (input) => input.valueReference?.reference === `Encounter/${ids.encounterId}`,
        ),
    );
    const requiredAbout = [
      `Invoice/${ids.invoiceId}`,
      `ExplanationOfBenefit/${ids.eobId}`,
      `Encounter/${ids.encounterId}`,
    ];
    const latestCommunication = communications.find(
      (communication) =>
        communication.subject?.reference === `Patient/${ids.patientId}` &&
        requiredAbout.every((reference) =>
          communication.about?.some((about) => about.reference === reference),
        ),
    );
    const concern = latestTask ? taskInputText(latestTask) : undefined;
    return {
      status: "Los registros confirmados por el servidor de Medplum se muestran abajo.",
      currentBenefits: latestEligibility
        ? `Consultados ${timestamp(latestEligibility) ?? "en la sesión"}`
        : "Aún no consultados",
      unresolvedConcern: concern ?? "Aún no se ha confirmado una inquietud de facturación.",
      caseStatus: latestTask?.id ? `Caso confirmado: ${latestTask.id}` : "No solicitado",
      artifacts: [
        { type: "ExplanationOfBenefit", id: ids.eobId, timestamp: "24 jul 2026", detail: "Adjudicación histórica de la resonancia de Jane del 8 de julio, incluido el deducible aplicado de $500.", source: "EOB sintético sembrado" },
        { type: "Invoice", id: ids.invoiceId, timestamp: "28 jul 2026", detail: "Estado de cuenta para pacientes con saldo actual de $620.", source: "Factura sintética sembrada" },
        latestEligibility
          ? { type: "CoverageEligibilityResponse", id: latestEligibility.id, timestamp: timestamp(latestEligibility), detail: "Respuesta de beneficios actuales. Es una instantánea separada y no explica la reclamación histórica.", source: latestEligibility.disposition ?? "Elegibilidad actual" }
          : seededArtifacts[2],
        latestTask
          ? { type: "Task", id: latestTask.id, timestamp: timestamp(latestTask), detail: concern ?? "Caso de revisión de facturación confirmado.", source: "Caso de BeneBot confirmado por Medplum" }
          : seededArtifacts[3],
        latestCommunication
          ? { type: "Communication", id: latestCommunication.id, timestamp: timestamp(latestCommunication), detail: "Resumen conciso de BeneBot guardado sin audio ni transcripción completa.", source: "Resumen de BeneBot confirmado por Medplum" }
          : seededArtifacts[4],
      ],
    };
  } catch {
    return {
      artifacts: seededArtifacts,
      status: "Medplum no se pudo leer, por lo que no se afirman artefactos de flujo en vivo.",
      currentBenefits: "No disponible",
      unresolvedConcern: "No se pudo confirmar una inquietud de facturación.",
      caseStatus: "No confirmado",
    };
  }
}

export default async function StaffPage() {
  const { artifacts, status, currentBenefits, unresolvedConcern, caseStatus } = await loadWorkflowArtifacts();
  return (
    <main className="staff-shell">
      <nav className="topline" aria-label="Navegación de personal de BeneBot">
        <Link className="wordmark" href="/">Bene<span>Bot</span></Link>
        <Link className="quiet-link" href="/bill/BENEBOT-INV-1001">Abrir portal de Jane</Link>
      </nav>
      <header className="staff-header">
        <div>
          <p className="eyebrow">Vista de prueba para personal</p>
          <h1>Una conversación, un caso auditable.</h1>
          <p>Todos los registros usan datos sintéticos. No se conservan audio ni transcripciones completas del paciente.</p>
        </div>
        <span className="demo-badge">Demostración sintética</span>
      </header>
      <section className="session-summary" aria-labelledby="session-summary-title">
        <div>
          <p className="eyebrow">Sesión de demostración</p>
          <h2 id="session-summary-title">Jane Doe · BENEBOT-INV-1001</h2>
        </div>
        <dl>
          <div><dt>Saldo actual</dt><dd>$620</dd></div>
          <div><dt>EOB histórico</dt><dd>Deducible de $500 · 24 jul</dd></div>
          <div><dt>Beneficios actuales</dt><dd>{currentBenefits}</dd></div>
          <div><dt>Preocupación sin resolver</dt><dd>{unresolvedConcern}</dd></div>
          <div><dt>Caso de facturación</dt><dd>{caseStatus}</dd></div>
        </dl>
      </section>
      <section className="staff-artifacts" aria-labelledby="artifacts-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Línea de tiempo de artefactos FHIR</p>
            <h2 id="artifacts-title">EOB, factura, elegibilidad, caso y comunicación</h2>
          </div>
          <span className="source-badge historical">Auditoría de flujo</span>
        </div>
        <ArtifactTimeline artifacts={artifacts} />
      </section>
      <p className="staff-empty-note">{status}</p>
    </main>
  );
}
