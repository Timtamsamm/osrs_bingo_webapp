"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import GameFrame from "@/app/components/GameFrame";

type Mode = "signin" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "", confirm: "" });

  function clearFieldError(field: "username" | "password" | "confirm") {
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setError("");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setFieldErrors({ username: "", password: "", confirm: "" });
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = (form.get("username") as string).trim();
    const password = form.get("password") as string;

    const errors = { username: "", password: "", confirm: "" };
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
      router.push("/");
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = (form.get("username") as string).trim();
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    const errors = { username: "", password: "", confirm: "" };
    if (!username) errors.username = "Username is required.";
    if (!password) errors.password = "Password is required.";
    if (password && password.length < 6) errors.password = "Password must be at least 6 characters.";
    if (password && confirm !== password) errors.confirm = "Passwords do not match.";
    if (errors.username || errors.password || errors.confirm) { setFieldErrors(errors); return; }

    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Registration failed.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Account created but sign in failed. Please sign in manually.");
      switchMode("signin");
    } else {
      router.push("/");
    }
  }

  function inputClass(field: "username" | "password" | "confirm") {
    return [
      "bg-stone-800 border rounded-lg px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:ring-2 transition-colors",
      fieldErrors[field] ? "border-red-500 focus:ring-red-500" : "border-stone-700 focus:ring-amber-500",
    ].join(" ");
  }

  return (
    <GameFrame>
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-center text-white mb-8">OSRS Bingo</h1>

          <div className="bg-stone-900 rounded-xl border border-stone-700/60 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-stone-700/60">
              {(["signin", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mode === m
                      ? "bg-stone-800 text-white border-b-2 border-amber-500"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {/* Sign in form */}
            {mode === "signin" && (
              <form onSubmit={handleSignIn} noValidate className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-stone-400" htmlFor="username">Username</label>
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

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-stone-400" htmlFor="password">Password</label>
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
                  <div className="bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition-colors"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            {/* Create account form */}
            {mode === "register" && (
              <form onSubmit={handleRegister} noValidate className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-stone-400" htmlFor="reg-username">Username</label>
                  <input
                    id="reg-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    onChange={() => clearFieldError("username")}
                    className={inputClass("username")}
                  />
                  {fieldErrors.username && <p className="text-xs text-red-400">{fieldErrors.username}</p>}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-stone-400" htmlFor="reg-password">Password</label>
                  <input
                    id="reg-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    onChange={() => clearFieldError("password")}
                    className={inputClass("password")}
                  />
                  {fieldErrors.password && <p className="text-xs text-red-400">{fieldErrors.password}</p>}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-stone-400" htmlFor="reg-confirm">Confirm password</label>
                  <input
                    id="reg-confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    onChange={() => clearFieldError("confirm")}
                    className={inputClass("confirm")}
                  />
                  {fieldErrors.confirm && <p className="text-xs text-red-400">{fieldErrors.confirm}</p>}
                </div>

                {error && (
                  <div className="bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition-colors"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </GameFrame>
  );
}
