"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
}

export default function UserRowActions({ id }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resetPassword() {
    const password = prompt("Enter new password:");
    if (!password) return;
    setLoading(true);
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
  }

  async function remove() {
    if (!confirm("Delete this user and all their submissions?")) return;
    setLoading(true);
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={resetPassword}
        disabled={loading}
        title="Reset password"
        className="text-xs text-gray-500 hover:text-blue-400 transition-colors disabled:opacity-50"
      >
        Reset Password
      </button>
      <button
        onClick={remove}
        disabled={loading}
        title="Delete user"
        className="text-gray-500 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-50"
      >
        🗑
      </button>
    </div>
  );
}
