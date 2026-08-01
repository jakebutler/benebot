import {
  AgentConversation,
  AgentMessage,
  type ConversationEntry,
} from "@deepgram/ui";

export function Transcript({
  conversation,
  fallbackMessages,
}: {
  conversation: ConversationEntry[];
  fallbackMessages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}): React.ReactNode {
  if (conversation.length === 0 && fallbackMessages.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Ask about the $620 bill in English or Spanish. BeneBot will show which
        secure tool it uses; raw audio is never stored.
      </div>
    );
  }

  return (
    <AgentConversation className="max-h-72 space-y-3 overflow-y-auto" autoScroll>
      {conversation.map((entry) => (
        <AgentMessage
          key={entry.id}
          entry={entry}
          showRole
          showTimestamp={false}
          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            entry.role === "user"
              ? "ml-8 bg-sky-700 text-white"
              : "mr-8 bg-slate-100 text-slate-800"
          }`}
        />
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
            {entry.role === "user" ? "You" : "BeneBot text fallback"}
          </span>
          {entry.content}
        </div>
      ))}
    </AgentConversation>
  );
}
