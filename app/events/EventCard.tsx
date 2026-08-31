import Image from "next/image";

type EventStatus = "Active" | "Upcoming" | "Past";

interface Props {
  title: string;
  description: string | null;
  imageUrl?: string | null;
  participantNames?: string[];
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
}

const statusStyles: Record<EventStatus, string> = {
  Active: "bg-green-500/15 text-green-400 border-green-700/40",
  Upcoming: "bg-purple-500/15 text-purple-300 border-purple-700/40",
  Past: "bg-white/5 text-purple-700 border-purple-900/40",
};

export default function EventCard({ title, description, imageUrl, participantNames, startsAt, endsAt, status }: Props) {
  return (
    <div className={`rounded-xl border overflow-hidden ${status === "Active" ? "border-green-700/40 bg-green-500/5 purple-glow-sm" : "border-purple-900/40 bg-[#0e0820]"}`}>
      {imageUrl && (
        <div className="relative w-full aspect-[16/9] bg-[#130a28]">
          <Image src={imageUrl} alt="" fill sizes="700px" className="object-cover" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-white">{title}</h3>
          <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 shrink-0 ${statusStyles[status]}`}>
            {status}
          </span>
        </div>
        {description && <p className="text-sm text-purple-300/70 mb-2">{description}</p>}
        <p className="text-xs text-purple-600">
          {startsAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          {" → "}
          {endsAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
        {participantNames && participantNames.length > 0 && (
          <p className="text-xs text-purple-500 mt-2">
            {participantNames.length} participant{participantNames.length !== 1 ? "s" : ""}: {participantNames.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
