import Link from "next/link";
import { notFound } from "next/navigation";

import { BillBreakdown } from "@/components/bill/bill-breakdown";
import { BillExperience } from "@/components/bill/bill-experience";

export default async function BillPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (invoiceId !== "BENEBOT-INV-1001") notFound();
  return <main className="patient-shell">
    <nav className="topline" aria-label="BeneBot demo navigation"><Link className="wordmark" href="/">Bene<span>Bot</span></Link><span className="demo-badge">Synthetic demo data</span></nav>
    <section className="statement-hero" aria-labelledby="statement-title"><div><p className="eyebrow">Bayview Imaging</p><h1 id="statement-title">Your July statement</h1><p className="statement-number">Statement {invoiceId} · Issued July 28, 2026</p></div><div className="amount-due" aria-label="Amount due, 620 dollars"><span>Amount due</span><strong>$620</strong><small>Due August 27, 2026</small></div></section>
    <BillBreakdown />
    <BillExperience invoiceIdentifier={invoiceId} />
    <section className="clarity-note" aria-label="Source distinction"><span className="note-icon" aria-hidden="true">i</span><p><strong>Two different questions, two different sources.</strong> This statement comes from your July claim. Any plan details BeneBot refreshes are a separate, current snapshot and do not validate this bill.</p></section>
  </main>;
}
