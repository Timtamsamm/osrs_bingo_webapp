"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "" });

  function clearFieldError(field: "username" | "password") {
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setError("");
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = (form.get("username") as string).trim();
    const password = form.get("password") as string;

    const errors = { username: "", password: "" };
    if (!username) errors.username = "Username is required.";
    if (!password) errors.password = "Password is required.";
    if (errors.username || errors.password) { setFieldErrors(errors); return; }

    setError("");
    setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Incorrect username or password.");
    } else {
      router.push("/bingo/admin");
    }
  }

  function inputClass(field: "username" | "password") {
    return [
      "bg-[#0e0820] border rounded-lg px-3 py-2.5 text-white placeholder-purple-800 focus:outline-none focus:ring-2 transition-colors",
      fieldErrors[field]
        ? "border-red-500/60 focus:ring-red-500/40"
        : "border-purple-900/50 focus:ring-purple-600/50 focus:border-purple-600/70",
    ].join(" ");
  }

  return (
    <div className="min-h-screen bg-[#080510] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block mb-6 text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
          ← Home
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-cinzel)] text-3xl font-black text-white heading-glow mb-1">
            OSRS Bingo
          </h1>
          <p className="text-purple-500 text-sm">Admin access</p>
        </div>

        <div className="bg-[#0e0820] rounded-2xl border border-purple-900/40 purple-glow-sm p-6">
          <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-purple-400 font-medium" htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                onChange={() => clearFieldError("username")}
                className={inputClass("username")}
              />
              {fieldErrors.username && <p className="text-xs text-red-400">{fieldErrors.username}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-purple-400 font-medium" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                onChange={() => clearFieldError("password")}
                className={inputClass("password")}
              />
              {fieldErrors.password && <p className="text-xs text-red-400">{fieldErrors.password}</p>}
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors purple-glow-sm"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
