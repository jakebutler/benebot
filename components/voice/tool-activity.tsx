import type { Language, ToolActivityEvent, ToolName } from "@/lib/contracts";

const localizedLabels: Record<Language, Record<ToolName, string>> = {
  en: {
    get_bill_context: "Reading historical bill",
    refresh_current_benefits: "Checking current benefits",
    search_support_resources: "Finding support resources",
    request_human_followup: "Creating billing-review case",
    save_conversation_summary: "Saving concise summary",
  },
  es: {
    get_bill_context: "Leyendo la factura histórica",
    refresh_current_benefits: "Consultando beneficios actuales",
    search_support_resources: "Buscando recursos de apoyo",
    request_human_followup: "Creando el caso de revisión",
    save_conversation_summary: "Guardando el resumen breve",
  },
};

export function ToolActivity({
  events,
  language,
}: {
  events: ToolActivityEvent[];
  language: Language;
}): React.ReactNode {
  if (events.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="benebot-tool-activity">
      <h3 id="benebot-tool-activity" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {language === "es" ? "Qué está haciendo BeneBot" : "What BeneBot is doing"}
      </h3>
      <ol className="mt-2 space-y-2" aria-live="polite">
        {events.slice(-5).map((event, index) => (
          <li
            key={`${event.tool}-${event.at}-${index}`}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                event.status === "succeeded"
                  ? "bg-emerald-500"
                  : event.status === "failed"
                    ? "bg-rose-500"
                    : "animate-pulse bg-amber-500"
              }`}
            />
            <span>{localizedLabels[language][event.tool]}</span>
            <span className="text-xs text-slate-500">
              {event.status === "running"
                ? language === "es" ? "En curso" : "Running"
                : event.status === "succeeded"
                  ? language === "es" ? "Listo" : "Done"
                  : language === "es" ? "No se completó" : "Could not complete"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
