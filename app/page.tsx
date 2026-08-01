import Link from "next/link";

const invoiceId = "BENEBOT-INV-1001";

export default function Home() {
  return (
    <main className="home-shell" lang="es">
      <nav className="topline" aria-label="Navegación de BeneBot">
        <Link className="wordmark" href="/">Bene<span>Bot</span></Link>
        <span className="demo-badge">Demostración con datos sintéticos</span>
      </nav>

      <section className="email-preview" aria-labelledby="email-subject">
        <div className="email-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="email-meta">
          <div>
            <p className="eyebrow">Vista previa de correo sintético</p>
            <strong>Bayview Imaging · Facturación</strong>
          </div>
          <time dateTime="2026-07-28">28 de julio de 2026</time>
        </div>
        <p className="email-to">Para: Jane Doe · Portal de demostración seguro</p>
        <div className="email-copy">
          <h1 id="email-subject">Tiene una factura nueva de Bayview Imaging.</h1>
          <p>
            Su saldo actual es <strong>$620</strong> por una resonancia magnética lumbar del 8 de julio.
            Puede ver el desglose de la factura en su portal seguro.
          </p>
          <p>
            BeneBot puede explicarle esta factura en español o inglés. Este es un correo de demostración: no se envía correo real.
          </p>
          <Link className="button button-primary" href={`/bill/${invoiceId}`}>
            Quiero hablar sobre esta factura
          </Link>
        </div>
        <footer className="email-footer">
          <span>Sesión de demostración autenticada para Jane Doe</span>
          <span>Factura {invoiceId}</span>
        </footer>
      </section>

      <aside className="language-note" aria-label="Language availability">
        <strong>Español primero.</strong> English is also available in the conversation.
      </aside>
    </main>
  );
}
