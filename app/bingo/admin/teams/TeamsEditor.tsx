"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MemberSearchInput, { type MemberOption } from "@/app/components/MemberSearchInput";

interface Participant {
  id: string;
  rsn: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
  participants: Participant[];
}

interface Props {
  teams: Team[];
  members: MemberOption[];
}

const inputCls = "bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60";

export default function TeamsEditor({ teams: initialTeams, members }: Props) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [newTeamName, setNewTeamName] = useState("");
  const [newRsn, setNewRsn] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createTeam() {
    if (!newTeamName.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to create team");
      return;
    }
    setNewTeamName("");
    router.refresh();
    const json = await res.json();
    setTeams((prev) => [...prev, { ...json, participants: [] }].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function renameTeam(teamId: string) {
    const name = editName[teamId]?.trim();
    if (!name) return;
    setLoading(true);
    await fetch(`/api/admin/teams/${teamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    setEditName((prev) => { const n = { ...prev }; delete n[teamId]; return n; });
    router.refresh();
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, name } : t)).sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  function setTeamColor(teamId: string, color: string) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, color } : t)));
  }

  async function saveTeamColor(teamId: string, color: string) {
    await fetch(`/api/admin/teams/${teamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
  }

  async function deleteTeam(teamId: string) {
    if (!confirm("Delete this team and all its participants? Submissions will remain but be unlinked.")) return;
    setLoading(true);
    await fetch(`/api/admin/teams/${teamId}`, { method: "DELETE" });
    setLoading(false);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  async function addParticipant(teamId: string) {
    const rsn = newRsn[teamId]?.trim();
    if (!rsn) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/teams/${teamId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsn }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to add participant");
      return;
    }
    const participant = await res.json();
    setNewRsn((prev) => ({ ...prev, [teamId]: "" }));
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, participants: [...t.participants, participant].sort((a, b) => a.rsn.localeCompare(b.rsn)) }
          : t
      )
    );
  }

  async function removeParticipant(teamId: string, participantId: string) {
    setLoading(true);
    await fetch(`/api/admin/teams/${teamId}/participants`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    setLoading(false);
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, participants: t.participants.filter((p) => p.id !== participantId) }
          : t
      )
    );
  }

  const isEditing = (teamId: string) => editName[teamId] !== undefined;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-950/50 border border-red-800/60 rounded-lg px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Create team */}
      <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
        <h2 className="font-semibold text-purple-100 mb-3">New Team</h2>
        <div className="flex gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTeam()}
            placeholder="Team name"
            className={`flex-1 ${inputCls}`}
          />
          <button
            onClick={createTeam}
            disabled={loading || !newTeamName.trim()}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors purple-glow-sm"
          >
            Create
          </button>
        </div>
      </div>

      {/* Team list */}
      {teams.map((team) => (
        <div key={team.id} className="bg-[#0e0820] border border-purple-900/40 rounded-xl overflow-hidden">
          {/* Team header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-purple-900/40">
            {isEditing(team.id) ? (
              <>
                <input
                  value={editName[team.id]}
                  onChange={(e) => setEditName((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") renameTeam(team.id); if (e.key === "Escape") setEditName((prev) => { const n = { ...prev }; delete n[team.id]; return n; }); }}
                  autoFocus
                  className={`flex-1 ${inputCls}`}
                />
                <button onClick={() => renameTeam(team.id)} disabled={loading} className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors">Save</button>
                <button onClick={() => setEditName((prev) => { const n = { ...prev }; delete n[team.id]; return n; })} className="text-xs text-purple-600 hover:text-purple-300 transition-colors">Cancel</button>
              </>
            ) : (
              <>
                <label className="cursor-pointer shrink-0" title="Change team colour">
                  <input
                    type="color"
                    value={team.color}
                    onChange={(e) => setTeamColor(team.id, e.target.value)}
                    onBlur={(e) => saveTeamColor(team.id, e.target.value)}
                    className="sr-only"
                  />
                  <span
                    className="w-5 h-5 rounded-full block ring-1 ring-white/20 hover:ring-2 hover:ring-white/50 transition-all"
                    style={{ background: team.color, boxShadow: `0 0 6px ${team.color}80` }}
                  />
                </label>
                <h3 className="font-semibold text-white flex-1">{team.name}</h3>
                <span className="text-xs text-purple-600">{team.participants.length} members</span>
                <button
                  onClick={() => setEditName((prev) => ({ ...prev, [team.id]: team.name }))}
                  className="text-xs text-purple-500 hover:text-purple-300 transition-colors px-2"
                >
                  Rename
                </button>
                <button
                  onClick={() => deleteTeam(team.id)}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                >
                  Delete team
                </button>
              </>
            )}
          </div>

          {/* Participants */}
          <div className="px-5 py-3 flex flex-col gap-2">
            {team.participants.length === 0 && (
              <p className="text-sm text-purple-700/60 py-1">No members yet.</p>
            )}
            {team.participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-purple-200 font-medium">{p.rsn}</span>
                <button
                  onClick={() => removeParticipant(team.id, p.id)}
                  disabled={loading}
                  className="text-xs text-purple-700 hover:text-red-400 disabled:opacity-40 transition-colors"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add RSN */}
            <div className="flex gap-2 mt-1">
              <div className="flex-1">
                <MemberSearchInput
                  members={members}
                  value={newRsn[team.id] ?? ""}
                  onChange={(v) => setNewRsn((prev) => ({ ...prev, [team.id]: v }))}
                  onKeyDown={(e) => e.key === "Enter" && addParticipant(team.id)}
                  placeholder="Search members or type a name…"
                  className={`w-full ${inputCls} py-1.5`}
                />
              </div>
              <button
                onClick={() => addParticipant(team.id)}
                disabled={loading || !newRsn[team.id]?.trim()}
                className="bg-purple-900/60 hover:bg-purple-800/70 disabled:opacity-40 border border-purple-700/40 text-purple-300 rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ))}

      {teams.length === 0 && (
        <p className="text-purple-600/70 text-sm">No teams yet. Create one above.</p>
      )}
    </div>
  );
}
