"use client";

import { ArtifactTimeline, type WorkflowArtifact } from "@/components/staff/artifact-timeline";
import { useLanguage } from "@/components/site/language-provider";

interface StaffPageContentProps {
  artifacts: WorkflowArtifact[];
  status: string;
  currentBenefits: string;
  unresolvedConcern: string;
  caseStatus: string;
}

const englishStatus: Record<string, string> = {
  "Medplum no está configurado; esta vista muestra solo los registros históricos sembrados y no afirma que se haya creado un caso.": "Medplum is not configured. This view shows only seeded historical records and does not claim that a case was created.",
  "Aún no consultados": "Not checked yet",
  "Aún no se ha confirmado una inquietud de facturación.": "No billing concern has been confirmed yet.",
  "No solicitado": "Not requested",
  "Los registros confirmados por el servidor de Medplum se muestran abajo.": "Records confirmed by the Medplum server appear below.",
  "Medplum no se pudo leer, por lo que no se afirman artefactos de flujo en vivo.": "Medplum could not be read, so no live workflow artifacts are claimed.",
  "No disponible": "Unavailable",
  "No se pudo confirmar una inquietud de facturación.": "A billing concern could not be confirmed.",
  "No confirmado": "Not confirmed",
};

const englishArtifactCopy: Partial<Record<WorkflowArtifact["type"], { detail: string; source: string }>> = {
  ExplanationOfBenefit: { detail: "Historical adjudication for Jane’s July 8 MRI, including the $500 deductible applied.", source: "Seeded synthetic EOB" },
  Invoice: { detail: "Patient statement with a current balance of $620.", source: "Seeded synthetic invoice" },
  CoverageEligibilityResponse: { detail: "Current-benefits response. This separate snapshot does not explain the historical claim.", source: "Current eligibility" },
  Task: { detail: "Appears only after Jane confirms a billing-review request.", source: "BeneBot case" },
  Communication: { detail: "A concise BeneBot summary saved without audio or a full transcript.", source: "BeneBot summary" },
};

export function StaffPageContent(props: StaffPageContentProps) {
  const { language } = useLanguage();
  const isSpanish = language === "es";
  const translateStatus = (value: string): string => isSpanish ? value : englishStatus[value] ?? value;
  const artifacts = isSpanish
    ? props.artifacts
    : props.artifacts.map((artifact) => ({
        ...artifact,
        timestamp: artifact.timestamp
          ?.replace("24 jul 2026", "Jul 24, 2026")
          .replace("28 jul 2026", "Jul 28, 2026"),
        detail: englishArtifactCopy[artifact.type]?.detail ?? artifact.detail,
        source: englishArtifactCopy[artifact.type]?.source ?? artifact.source,
      }));

  return (
    <main className="staff-shell" lang={language}>
      <header className="staff-header">
        <div>
          <p className="eyebrow">{isSpanish ? "Vista de prueba para personal" : "Staff proof view"}</p>
          <h1>{isSpanish ? "Una conversación, un caso auditable." : "One conversation, one auditable case."}</h1>
          <p>{isSpanish ? "Todos los registros usan datos sintéticos. No se conservan audio ni transcripciones completas del paciente." : "Every record uses synthetic data. No patient audio or complete transcript is retained."}</p>
        </div>
        <span className="demo-badge">{isSpanish ? "Demostración sintética" : "Synthetic demo"}</span>
      </header>
      <section className="session-summary" aria-labelledby="session-summary-title">
        <div>
          <p className="eyebrow">{isSpanish ? "Sesión de demostración" : "Demo session"}</p>
          <h2 id="session-summary-title">Jane Doe · BENEBOT-INV-1001</h2>
        </div>
        <dl>
          <div><dt>{isSpanish ? "Saldo actual" : "Current balance"}</dt><dd>$620</dd></div>
          <div><dt>{isSpanish ? "EOB histórico" : "Historical EOB"}</dt><dd>{isSpanish ? "Deducible de $500 · 24 jul" : "$500 deductible · Jul 24"}</dd></div>
          <div><dt>{isSpanish ? "Beneficios actuales" : "Current benefits"}</dt><dd>{translateStatus(props.currentBenefits)}</dd></div>
          <div><dt>{isSpanish ? "Preocupación sin resolver" : "Unresolved concern"}</dt><dd>{translateStatus(props.unresolvedConcern)}</dd></div>
          <div><dt>{isSpanish ? "Caso de facturación" : "Billing case"}</dt><dd>{translateStatus(props.caseStatus)}</dd></div>
        </dl>
      </section>
      <section className="staff-artifacts" aria-labelledby="artifacts-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{isSpanish ? "Línea de tiempo de artefactos FHIR" : "FHIR artifact timeline"}</p>
            <h2 id="artifacts-title">{isSpanish ? "EOB, factura, elegibilidad, caso y comunicación" : "EOB, invoice, eligibility, case, and communication"}</h2>
          </div>
          <span className="source-badge historical">{isSpanish ? "Auditoría de flujo" : "Workflow audit"}</span>
        </div>
        <ArtifactTimeline artifacts={artifacts} language={language} />
      </section>
      <p className="staff-empty-note">{translateStatus(props.status)}</p>
    </main>
  );
}
