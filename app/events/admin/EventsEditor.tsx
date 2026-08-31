"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ImageCropper from "@/app/components/ImageCropper";
import MemberSearchInput, { type MemberOption } from "@/app/components/MemberSearchInput";

interface Event {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  participantNames: string[];
}

interface Props {
  events: Event[];
  members: MemberOption[];
}

const inputCls = "bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getStatus(startsAt: string, endsAt: string): "Active" | "Upcoming" | "Past" {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now < start) return "Upcoming";
  if (now > end) return "Past";
  return "Active";
}

const statusStyles: Record<string, string> = {
  Active: "bg-green-500/15 text-green-400 border-green-700/40",
  Upcoming: "bg-purple-500/15 text-purple-300 border-purple-700/40",
  Past: "bg-white/5 text-purple-700 border-purple-900/40",
};

interface FormState {
  title: string;
  description: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  participantNames: string[];
}

const emptyForm: FormState = { title: "", description: "", imageUrl: null, startsAt: "", endsAt: "", participantNames: [] };

function EventForm({
  initial,
  eventId,
  members,
  submitLabel,
  loading,
  error,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  eventId?: string;
  members: MemberOption[];
  submitLabel: string;
  loading: boolean;
  error: string;
  onSubmit: (form: FormState) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [participantInput, setParticipantInput] = useState("");

  function addParticipant(name: string) {
    const trimmed = name.trim();
    if (!trimmed || form.participantNames.includes(trimmed)) return;
    setForm((f) => ({ ...f, participantNames: [...f.participantNames, trimmed] }));
    setParticipantInput("");
  }

  function removeParticipant(name: string) {
    setForm((f) => ({ ...f, participantNames: f.participantNames.filter((n) => n !== name) }));
  }

  function onFileSelected(file: File) {
    setCropSrc(URL.createObjectURL(file));
  }

  async function onCropDone(blob: Blob) {
    const src = cropSrc;
    setCropSrc(null);
    if (src) URL.revokeObjectURL(src);
    setImageUploading(true);
    const uploadForm = new FormData();
    uploadForm.append("file", blob, "event.jpg");
    if (eventId) uploadForm.append("eventId", eventId);
    const res = await fetch("/api/admin/events/image", { method: "POST", body: uploadForm });
    if (res.ok) {
      const { url } = await res.json();
      setForm((f) => ({ ...f, imageUrl: url }));
    }
    setImageUploading(false);
  }

  function onCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function removeImage() {
    if (eventId && form.imageUrl) {
      await fetch("/api/admin/events/image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
    } else if (form.imageUrl) {
      await fetch("/api/admin/events/image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.imageUrl }),
      });
    }
    setForm((f) => ({ ...f, imageUrl: null }));
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-950/50 border border-red-800/60 rounded-lg px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <input
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Event name"
        className={inputCls}
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="Description"
        rows={3}
        className={`${inputCls} resize-y`}
      />

      {/* Image */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-purple-500">Image (optional)</label>
        {cropSrc ? (
          <ImageCropper imageSrc={cropSrc} aspect={16 / 9} onDone={onCropDone} onCancel={onCropCancel} />
        ) : (
          <>
            {form.imageUrl && (
              <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#130a28]">
                <Image src={form.imageUrl} alt="" fill sizes="600px" className="object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-0.5 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
            <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-purple-900/50 hover:border-purple-700/60 rounded-lg py-3 text-sm text-purple-500 cursor-pointer transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.target.value = ""; }} />
              {imageUploading ? "Uploading…" : form.imageUrl ? "Replace image" : "Upload image"}
            </label>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-purple-500">Starts</label>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-purple-500">Ends</label>
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            className={inputCls}
          />
        </div>
      </div>

      {/* Participants */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-purple-500">Participants (optional)</label>
        {form.participantNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.participantNames.map((name) => (
              <span key={name} className="flex items-center gap-1.5 bg-purple-900/40 border border-purple-700/40 text-purple-200 text-xs rounded-full pl-3 pr-1.5 py-1">
                {name}
                <button type="button" onClick={() => removeParticipant(name)} className="text-purple-500 hover:text-red-400 transition-colors" title="Remove">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <MemberSearchInput
              members={members}
              value={participantInput}
              onChange={setParticipantInput}
              onPick={addParticipant}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(participantInput); } }}
              placeholder="Search members or type a name…"
              className={`w-full ${inputCls} py-1.5`}
            />
          </div>
          <button
            type="button"
            onClick={() => addParticipant(participantInput)}
            disabled={!participantInput.trim()}
            className="bg-purple-900/60 hover:bg-purple-800/70 disabled:opacity-40 border border-purple-700/40 text-purple-300 rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.title.trim() || !form.startsAt || !form.endsAt}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors purple-glow-sm"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="text-sm text-purple-600 hover:text-purple-300 transition-colors px-2">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function EventsEditor({ events: initialEvents, members }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createEvent(form: FormState) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        imageUrl: form.imageUrl,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        participantNames: form.participantNames,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to create event");
      return;
    }
    const event = await res.json();
    setEvents((prev) => [event, ...prev]);
    router.refresh();
  }

  async function updateEvent(id: string, form: FormState) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        imageUrl: form.imageUrl,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        participantNames: form.participantNames,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to update event");
      return;
    }
    const updated = await res.json();
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    setEditingId(null);
    router.refresh();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    setLoading(false);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
        <h2 className="font-semibold text-purple-100 mb-3">New Event</h2>
        <EventForm
          initial={emptyForm}
          members={members}
          submitLabel="Create"
          loading={loading}
          error={editingId === null ? error : ""}
          onSubmit={createEvent}
        />
      </div>

      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <div key={event.id} className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
            {editingId === event.id ? (
              <EventForm
                eventId={event.id}
                members={members}
                initial={{
                  title: event.title,
                  description: event.description ?? "",
                  imageUrl: event.imageUrl,
                  startsAt: toLocalInput(event.startsAt),
                  endsAt: toLocalInput(event.endsAt),
                  participantNames: event.participantNames,
                }}
                submitLabel="Save"
                loading={loading}
                error={error}
                onSubmit={(form) => updateEvent(event.id, form)}
                onCancel={() => { setEditingId(null); setError(""); }}
              />
            ) : (
              <>
                {event.imageUrl && (
                  <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#130a28] mb-3">
                    <Image src={event.imageUrl} alt="" fill sizes="600px" className="object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{event.title}</h3>
                    <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 ${statusStyles[getStatus(event.startsAt, event.endsAt)]}`}>
                      {getStatus(event.startsAt, event.endsAt)}
                    </span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => setEditingId(event.id)} className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
                      Edit
                    </button>
                    <button onClick={() => deleteEvent(event.id)} disabled={loading} className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors font-medium">
                      Delete
                    </button>
                  </div>
                </div>
                {event.description && <p className="text-sm text-purple-300/70 mb-2">{event.description}</p>}
                <p className="text-xs text-purple-600">
                  {new Date(event.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  {" → "}
                  {new Date(event.endsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {event.participantNames.length > 0 && (
                  <p className="text-xs text-purple-500 mt-1">
                    {event.participantNames.length} participant{event.participantNames.length !== 1 ? "s" : ""}: {event.participantNames.join(", ")}
                  </p>
                )}
              </>
            )}
          </div>
        ))}

        {events.length === 0 && <p className="text-purple-600/70 text-sm">No events yet. Create one above.</p>}
      </div>
    </div>
  );
}
