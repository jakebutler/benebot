"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/components/site/language-provider";

const demoHref = "/bill/BENEBOT-INV-1001";

export function SiteHeader() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === "es";
  const isBill = pathname.startsWith("/bill/");

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label={isSpanish ? "Navegación principal" : "Main navigation"}>
        <Link className="wordmark" href="/" aria-label={isSpanish ? "BeneBot, inicio" : "BeneBot, home"}>
          Bene<span>Bot</span>
        </Link>

        <div className="site-nav-links">
          <Link href="/#sources">{isSpanish ? "Cómo funciona" : "How it works"}</Link>
          <Link href="/staff">{isSpanish ? "Vista del personal" : "Staff view"}</Link>
        </div>

        <div className="site-header-actions">
          <div
            className="language-switcher"
            role="group"
            aria-label={isSpanish ? "Idioma del sitio" : "Site language"}
            translate="no"
          >
            <button
              type="button"
              lang="en"
              translate="no"
              className={language === "en" ? "is-selected" : ""}
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
            <button
              type="button"
              lang="es"
              translate="no"
              className={language === "es" ? "is-selected" : ""}
              aria-pressed={language === "es"}
              onClick={() => setLanguage("es")}
            >
              ES
            </button>
          </div>
          <Link className="header-demo-cta" href={isBill ? "#benebot-demo" : demoHref}>
            {isBill
              ? isSpanish ? "Hablar con BeneBot" : "Talk to BeneBot"
              : isSpanish ? "Probar demo" : "Try the demo"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
