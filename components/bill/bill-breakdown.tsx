const rows = [
  ["El proveedor facturó", "$2,400"],
  ["Descuento contractual de la aseguradora", "−$1,300"],
  ["Monto permitido", "$1,100"],
  ["Deducible aplicado a la reclamación de julio", "$500"],
  ["Coseguro aplicado a la reclamación de julio", "$120"],
  ["La aseguradora pagó", "−$480"],
];

export function BillBreakdown() {
  return (
    <section className="statement-breakdown" aria-labelledby="breakdown-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cómo se procesó esta reclamación</p>
          <h2 id="breakdown-title">Desglose histórico de su reclamación</h2>
        </div>
        <span className="source-badge historical">EOB histórico · servicio del 8 de julio</span>
      </div>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        <div className="patient-responsibility"><dt>Su responsabilidad en esta reclamación</dt><dd>$620</dd></div>
      </dl>
      <p className="fine-print">Fuente: Explanation of Benefits histórico, creado el 24 de julio de 2026. El deducible de $500 pertenece a esa reclamación histórica; no indica por sí solo su deducible disponible hoy.</p>
    </section>
  );
}
