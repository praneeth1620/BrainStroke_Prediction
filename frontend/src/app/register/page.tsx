"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, setToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch<{ token: string; user: { id: number } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setToken(response.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow auth-label">Create account</p>
        <h1>Get started</h1>
        <p className="muted">Register to save predictions, reports, and model history.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Full name</span>
            <input value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="Your full name" autoComplete="name" required />
          </label>

          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="you@example.com" autoComplete="email" required />
          </label>

          <label>
            <span>Password</span>
            <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="At least 8 characters" autoComplete="new-password" required />
          </label>

          <label>
            <span>Confirm password</span>
            <input type="password" value={form.confirm_password} onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))} placeholder="Re-enter your password" autoComplete="new-password" required />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="auth-meta">
          <Link href="/login">Already have an account?</Link>
        </div>
      </div>
    </div>
  );
}
