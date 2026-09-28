"use client";

import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow auth-label">Password reset</p>
        <h1>Forgot password?</h1>
        <p className="muted">Password reset is available through the backend admin flow in this demo.</p>
        <Link href="/login" className="secondary-btn">Back to login</Link>
      </div>
    </div>
  );
}
