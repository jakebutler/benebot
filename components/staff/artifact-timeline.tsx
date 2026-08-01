export interface WorkflowArtifact { type: "ExplanationOfBenefit" | "Invoice" | "CoverageEligibilityResponse" | "Task" | "Communication"; id?: string; timestamp?: string; detail: string; source: string; }

export function ArtifactTimeline({ artifacts }: { artifacts: WorkflowArtifact[] }) {
  return <ol className="artifact-timeline" aria-label="FHIR workflow artifacts">{artifacts.map((artifact) => <li key={artifact.type}><div className="artifact-marker" aria-hidden="true" /><div className="artifact-copy"><div className="artifact-title-row"><strong>{artifact.type}</strong><span>{artifact.id ? `ID ${artifact.id}` : "Awaiting BeneBot session"}</span></div><p>{artifact.detail}</p><small>{artifact.timestamp ?? "Not created yet"} · {artifact.source}</small></div></li>)}</ol>;
}
