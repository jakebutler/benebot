import Link from "next/link";
import { notFound } from "next/navigation";

import { BillBreakdown } from "@/components/bill/bill-breakdown";
import { BillExperience } from "@/components/bill/bill-experience";

export default async function BillPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (invoiceId !== "BENEBOT-INV-1001") notFound();

  return (
    <main className="patient-shell" lang="es">
      <nav className="topline" aria-label="Navegación del portal de BeneBot">
        <Link className="wordmark" href="/">Bene<span>Bot</span></Link>
        <div className="portal-badges" aria-label="Authenticated demo context">
          <span className="secure-badge">Sesión segura: Jane Doe</span>
          <span className="language-badge">Idioma preferido: Español</span>
          <span className="demo-badge">Portal de demostración sintético</span>
        </div>
      </nav>

      <section className="secure-context-event" role="status" aria-label="Secure billing context verified">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Secure billing context verified</strong>
          <p>Este portal de demostración ya está vinculado a la factura, cobertura y reclamación de Jane. BeneBot no le pedirá SSN, fecha de nacimiento, ID de miembro ni ID de paciente.</p>
        </div>
      </section>

      <section className="statement-hero" aria-labelledby="statement-title">
        <div>
          <p className="eyebrow">Bayview Imaging</p>
          <h1 id="statement-title">Su estado de cuenta de julio</h1>
          <p className="statement-number">Factura {invoiceId} · Emitida el 28 de julio de 2026</p>
        </div>
        <div className="amount-due" aria-label="Saldo actual de 620 dólares">
          <span>Saldo actual</span>
          <strong>$620</strong>
          <small>Vence el 27 de agosto de 2026</small>
        </div>
      </section>

      <BillBreakdown />
      <BillExperience invoiceIdentifier={invoiceId} />

      <section className="clarity-note" aria-label="Diferencia entre fuentes">
        <span className="note-icon" aria-hidden="true">i</span>
        <p><strong>Dos preguntas distintas, dos fuentes distintas.</strong> El EOB histórico explica cómo se procesó la reclamación del 8 de julio. Cualquier beneficio que BeneBot consulte hoy será una instantánea actual con su propia fecha y fuente; no explica ni valida esta factura de $620.</p>
      </section>
    </main>
  );
}
