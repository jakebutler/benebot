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
    <section className="voice-activity" aria-labelledby="benebot-tool-activity">
      <h3 id="benebot-tool-activity">
        {language === "es" ? "Qué está haciendo BeneBot" : "What BeneBot is doing"}
      </h3>
      <ol aria-live="polite">
        {events.slice(-5).map((event, index) => (
          <li
            key={`${event.tool}-${event.at}-${index}`}
            className="voice-activity-event"
          >
            <span
              aria-hidden="true"
              className={`voice-activity-dot ${
                event.status === "succeeded"
                  ? "voice-activity-success"
                  : event.status === "failed"
                    ? "voice-activity-failed"
                    : "voice-activity-running"
              }`}
            />
            <span>{localizedLabels[language][event.tool]}</span>
            <span className="voice-activity-status">
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
