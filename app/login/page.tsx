"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "" });
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  function clearFieldError(field: "username" | "password") {
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setError("");
    setFailed(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = (form.get("username") as string).trim();
    const password = form.get("password") as string;

    const errors = { username: "", password: "" };
    if (!username) errors.username = "Username is required.";
    if (!password) errors.password = "Password is required.";
    if (errors.username || errors.password) {
      setFieldErrors(errors);
      return;
    }

    setError("");
    setFailed(false);
    setLoading(true);

    const result = await signIn("credentials", { username, password, redirect: false });

    setLoading(false);

    if (result?.error) {
      setError("Incorrect username or password. Please try again.");
      setFailed(true);
    } else {
      router.push("/");
    }
  }

  const inputClass = (field: "username" | "password") =>
    [
      "bg-gray-800 border rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors",
      fieldErrors[field] || (failed && field === "password")
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-700 focus:ring-amber-500",
    ].join(" ");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-white mb-8">
          OSRS Bingo
        </h1>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-gray-900 rounded-xl p-8 flex flex-col gap-4 border border-gray-800"
        >
          <h2 className="text-lg font-semibold text-white">Sign in</h2>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              onChange={() => clearFieldError("username")}
              className={inputClass("username")}
            />
            {fieldErrors.username && (
              <p className="text-xs text-red-400">{fieldErrors.username}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              onChange={() => clearFieldError("password")}
              className={inputClass("password")}
            />
            {fieldErrors.password && (
              <p className="text-xs text-red-400">{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
