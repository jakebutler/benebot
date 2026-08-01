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
      <div className="voice-transcript-empty">
        {language === "es"
          ? "Pregunte por esta factura en español. BeneBot mostrará qué herramienta segura usa; nunca se guarda el audio sin procesar."
          : "Ask about this bill in English. BeneBot will show which secure tool it uses; raw audio is never stored."}
      </div>
    );
  }

  return (
    <AgentConversation className="voice-transcript" autoScroll>
      {conversation.map((entry) => (
        <div key={entry.id}>
          <span className="voice-message-label">
            {entry.role === "user"
              ? language === "es" ? "Usted" : "You"
              : "BeneBot"}
          </span>
          <AgentMessage
            entry={entry}
            showRole={false}
            showTimestamp={false}
            className={`voice-message ${
              entry.role === "user"
                ? "voice-message-user"
                : "voice-message-agent"
            }`}
          />
        </div>
      ))}
      {fallbackMessages.map((entry) => (
        <div
          key={entry.id}
          className={`voice-message ${
            entry.role === "user"
              ? "voice-message-user"
              : "voice-message-agent"
          }`}
        >
          <span className="voice-message-label">
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
