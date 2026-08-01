const rows = [["Provider charged", "$2,400"], ["Insurance discount", "−$1,300"], ["Allowed amount", "$1,100"], ["Insurance paid", "−$480"]];

export function BillBreakdown() {
  return <section className="statement-breakdown" aria-labelledby="breakdown-title">
    <div className="section-heading"><div><p className="eyebrow">How this was processed</p><h2 id="breakdown-title">Your claim breakdown</h2></div><span className="source-badge historical">Historical claim · July 8 service</span></div>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div className="patient-responsibility"><dt>Your responsibility</dt><dd>$620</dd></div></dl>
    <p className="fine-print">From the historical Explanation of Benefits, created July 24, 2026. This shows how the insurer processed the July 8 claim.</p>
  </section>;
}
