"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStep("code");
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong");
    }
    setLoading(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setError(data.error || "Invalid code");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-zinc-900">Admin Login</h1>

          {step === "email" ? (
            <>
              <p className="mb-6 text-sm text-zinc-500">
                Enter your email to receive a login code.
              </p>
              <form onSubmit={requestCode}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mb-4 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  autoFocus
                  required
                />
                {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Sending code..." : "Send login code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mb-6 text-sm text-zinc-500">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
              <form onSubmit={verifyCode}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mb-4 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  autoFocus
                  required
                />
                {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                  }}
                  className="mt-3 w-full text-sm text-zinc-500 hover:text-zinc-700"
                >
                  Use a different email
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
