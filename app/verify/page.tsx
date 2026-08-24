"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import GameFrame from "@/app/components/GameFrame";

export default function VerifyPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) { setError("Please enter the event passcode."); return; }

    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: passcode.trim() }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Incorrect passcode. Try again.");
      setPasscode("");
      return;
    }

    router.push("/board");
    router.refresh();
  }

  return (
    <GameFrame>
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-center text-white mb-8">OSRS Bingo</h1>

          <div className="bg-stone-900 rounded-xl border border-stone-700/60 p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Event passcode</h2>
              <p className="text-sm text-stone-400 mt-1">Enter the passcode provided by your event organiser to continue.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-stone-400" htmlFor="passcode">Passcode</label>
                <input
                  id="passcode"
                  type="password"
                  autoComplete="off"
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setError(""); }}
                  className={`bg-stone-800 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 transition-colors ${
                    error ? "border-red-500 focus:ring-red-500" : "border-stone-700 focus:ring-amber-500"
                  }`}
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition-colors"
              >
                {loading ? "Verifying…" : "Continue"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors text-center"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}
