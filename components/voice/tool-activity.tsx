import type { ToolActivityEvent } from "@/lib/contracts";

export function ToolActivity({
  events,
}: {
  events: ToolActivityEvent[];
}): React.ReactNode {
  if (events.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="benebot-tool-activity">
      <h3 id="benebot-tool-activity" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        What BeneBot is doing
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
            <span>{event.label}</span>
            <span className="text-xs text-slate-500">
              {event.status === "running"
                ? "Running"
                : event.status === "succeeded"
                  ? "Done"
                  : "Could not complete"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

