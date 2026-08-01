import type { Language } from "@/lib/contracts";

export interface WorkflowArtifact { type: "ExplanationOfBenefit" | "Invoice" | "CoverageEligibilityResponse" | "Task" | "Communication"; id?: string; timestamp?: string; detail: string; source: string; }

export function ArtifactTimeline({ artifacts, language = "es" }: { artifacts: WorkflowArtifact[]; language?: Language }) {
  const isSpanish = language === "es";
  return <ol className="artifact-timeline" aria-label={isSpanish ? "Artefactos del flujo FHIR" : "FHIR workflow artifacts"}>{artifacts.map((artifact) => <li key={artifact.type}><div className="artifact-marker" aria-hidden="true" /><div className="artifact-copy"><div className="artifact-title-row"><strong>{artifact.type}</strong><span>{artifact.id ? `ID ${artifact.id}` : isSpanish ? "Esperando la sesión de BeneBot" : "Awaiting BeneBot session"}</span></div><p>{artifact.detail}</p><small>{artifact.timestamp ?? (isSpanish ? "Aún no creado" : "Not created yet")} · {artifact.source}</small></div></li>)}</ol>;
}
