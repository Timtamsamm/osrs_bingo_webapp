"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateUserForm({ maxTeamSize }: { maxTeamSize: number }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"PLAYER" | "ADMIN">("PLAYER");
  const [members, setMembers] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateMember(i: number, val: string) {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? val : m)));
  }

  function addMember() {
    if (members.length < maxTeamSize) setMembers((prev) => [...prev, ""]);
  }

  function removeMember(i: number) {
    setMembers((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        role,
        teamMembers: members.map((m) => m.trim()).filter(Boolean),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create user");
    } else {
      setSuccess(`Team "${username}" created.`);
      setUsername("");
      setPassword("");
      setRole("PLAYER");
      setMembers([""]);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-gray-400">Team name</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Team Hazard"
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-gray-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "PLAYER" | "ADMIN")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="PLAYER">Player</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      {role === "PLAYER" && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400">
            Team members <span className="text-gray-600">(optional — up to {maxTeamSize})</span>
          </label>
          <div className="flex flex-col gap-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={m}
                  onChange={(e) => updateMember(i, e.target.value)}
                  placeholder={`Player ${i + 1} name`}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  disabled={members.length === 1}
                  className="text-gray-600 hover:text-red-400 disabled:opacity-30 transition-colors px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {members.length < maxTeamSize && (
            <button
              type="button"
              onClick={addMember}
              className="self-start text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              + Add player
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="self-start bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
      >
        {loading ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}
