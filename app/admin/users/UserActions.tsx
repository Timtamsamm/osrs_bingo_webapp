"use client";

import { useState } from "react";

interface Props {
  id: string;
  role: "PLAYER" | "ADMIN";
  isSelf: boolean;
}

export default function UserActions({ id, role: initialRole, isSelf }: Props) {
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);

  async function toggleRole() {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH" });
    if (res.ok) {
      const data = await res.json();
      setRole(data.role);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggleRole}
      disabled={loading || isSelf}
      title={isSelf ? "Cannot change your own role" : `Switch to ${role === "ADMIN" ? "Player" : "Admin"}`}
      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
        isSelf
          ? "cursor-default opacity-60"
          : "cursor-pointer hover:opacity-80"
      } ${role === "ADMIN" ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-400"}`}
    >
      {role}
    </button>
  );
}
