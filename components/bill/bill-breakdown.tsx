import type { Language } from "@/lib/contracts";

export function BillBreakdown({ language }: { language: Language }) {
  const isSpanish = language === "es";
  const rows = isSpanish
    ? [
        ["El proveedor facturó", "$2,400"],
        ["Descuento contractual de la aseguradora", "−$1,300"],
        ["Monto permitido", "$1,100"],
        ["Deducible aplicado a la reclamación de julio", "$500"],
        ["Coseguro aplicado a la reclamación de julio", "$120"],
        ["La aseguradora pagó", "−$480"],
      ]
    : [
        ["Provider billed", "$2,400"],
        ["Insurer contractual discount", "−$1,300"],
        ["Allowed amount", "$1,100"],
        ["Deductible applied to the July claim", "$500"],
        ["Coinsurance applied to the July claim", "$120"],
        ["Insurer paid", "−$480"],
      ];
  return (
    <section className="statement-breakdown" aria-labelledby="breakdown-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{isSpanish ? "Cómo se procesó esta reclamación" : "How this claim was processed"}</p>
          <h2 id="breakdown-title">{isSpanish ? "Desglose histórico de su reclamación" : "Your historical claim breakdown"}</h2>
        </div>
        <span className="source-badge historical">{isSpanish ? "EOB histórico · servicio del 8 de julio" : "Historical EOB · July 8 service"}</span>
      </div>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        <div className="patient-responsibility"><dt>{isSpanish ? "Su responsabilidad en esta reclamación" : "Your responsibility for this claim"}</dt><dd>$620</dd></div>
      </dl>
      <p className="fine-print">
        {isSpanish
          ? "Fuente: Explanation of Benefits histórico, creado el 24 de julio de 2026. El deducible de $500 pertenece a esa reclamación histórica; no indica por sí solo su deducible disponible hoy."
          : "Source: historical Explanation of Benefits, created July 24, 2026. The $500 deductible belongs to that historical claim; by itself, it does not indicate the deductible available today."}
      </p>
    </section>
  );
}
