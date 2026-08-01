import {
  AgentConversation,
  AgentMessage,
  type ConversationEntry,
} from "@deepgram/ui";
import type { Language } from "@/lib/contracts";

export function Transcript({
  conversation,
  fallbackMessages,
  language,
}: {
  conversation: ConversationEntry[];
  fallbackMessages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  language: Language;
}): React.ReactNode {
  if (conversation.length === 0 && fallbackMessages.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {language === "es"
          ? "Pregunte por esta factura en español. BeneBot mostrará qué herramienta segura usa; nunca se guarda el audio sin procesar."
          : "Ask about this bill in English. BeneBot will show which secure tool it uses; raw audio is never stored."}
      </div>
    );
  }

  return (
    <AgentConversation className="max-h-72 space-y-3 overflow-y-auto" autoScroll>
      {conversation.map((entry) => (
        <div key={entry.id}>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            {entry.role === "user"
              ? language === "es" ? "Usted" : "You"
              : "BeneBot"}
          </span>
          <AgentMessage
            entry={entry}
            showRole={false}
            showTimestamp={false}
            className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
              entry.role === "user"
                ? "ml-8 bg-sky-700 text-white"
                : "mr-8 bg-slate-100 text-slate-800"
            }`}
          />
        </div>
      ))}
      {fallbackMessages.map((entry) => (
        <div
          key={entry.id}
          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            entry.role === "user"
              ? "ml-8 bg-sky-700 text-white"
              : "mr-8 bg-slate-100 text-slate-800"
          }`}
        >
          <span className="mb-1 block text-xs font-semibold uppercase opacity-70">
            {entry.role === "user"
              ? language === "es" ? "Usted" : "You"
              : language === "es" ? "BeneBot por texto" : "BeneBot text fallback"}
          </span>
          {entry.content}
        </div>
      ))}
    </AgentConversation>
  );
}
