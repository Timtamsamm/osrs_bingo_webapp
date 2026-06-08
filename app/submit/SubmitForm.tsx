"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Props {
  tileId: string;
  teamMembers: string[];
}

export default function SubmitForm({ tileId, teamMembers }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [teamMember, setTeamMember] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (teamMembers.length > 0 && !teamMember) {
      setError("Please select which team member is submitting.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tileId", tileId);
      formData.append("note", note);
      if (teamMember) formData.append("teamMember", teamMember);

      const res = await fetch("/api/submit", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());

      router.push("/board");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {teamMembers.length > 0 && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Who is submitting? <span className="text-red-400">*</span>
          </label>
          <select
            value={teamMember}
            onChange={(e) => { setTeamMember(e.target.value); setError(""); }}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select a team member…</option>
            {teamMembers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-2">Screenshot</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          required
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-gray-950 file:font-semibold hover:file:bg-amber-400 cursor-pointer"
        />
      </div>

      {preview && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
          <Image src={preview} alt="Preview" fill className="object-contain" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400" htmlFor="note">
          Note <span className="text-gray-600">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Any context for the reviewer…"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!file || submitting}
        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition-colors"
      >
        {submitting ? "Uploading…" : "Submit"}
      </button>
    </form>
  );
}
