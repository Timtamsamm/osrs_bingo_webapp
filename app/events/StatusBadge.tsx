import type { EventStatus } from "@/lib/clanEvents";

export default function StatusBadge({ status }: { status: EventStatus }) {
  const styles: Record<EventStatus, string> = {
    live: "bg-green-500/15 text-green-300 border-green-500/40",
    upcoming: "bg-purple-500/15 text-purple-300 border-purple-500/40",
    ended: "bg-white/5 text-purple-400/70 border-purple-900/50",
  };
  const labels: Record<EventStatus, string> = { live: "Live", upcoming: "Upcoming", ended: "Ended" };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 shrink-0 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
