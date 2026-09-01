"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className ?? "text-xs text-purple-600 hover:text-red-400 transition-colors font-medium"}
    >
      Log out
    </button>
  );
}
