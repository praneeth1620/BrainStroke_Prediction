"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type AdminResponse = {
  stats: {
    total_users: number;
    total_predictions: number;
    normal_predictions: number;
    stroke_predictions: number;
    model_version: string;
  };
  recent_activity: Array<{ id: number; prediction: string; risk_level: string; created_at: string }>;
};

export default function AdminPage() {
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setForbidden(false);
      try {
        const { user } = await apiFetch<{ user: { role: string } }>("/auth/me");
        if (user.role !== "admin") {
          setForbidden(true);
          return;
        }
        setData(await apiFetch<AdminResponse>("/admin/dashboard"));
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load the admin dashboard.";
        if (message.toLowerCase().includes("admin access required")) setForbidden(true);
        else setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  if (loading) {
    return <AppShell><div className="card-panel"><p>Loading admin dashboard...</p></div></AppShell>;
  }

  if (forbidden) {
    return <AppShell><section className="card-panel access-message"><p className="eyebrow">Restricted area</p><h1>Admins only</h1><p className="muted">This dashboard is available only to administrator accounts.</p></section></AppShell>;
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>System overview</h1>
        </div>
      </div>

      <section className="stats-grid">
        <article className="stat-card"><span>Total users</span><strong>{data?.stats.total_users ?? "--"}</strong></article>
        <article className="stat-card"><span>Total predictions</span><strong>{data?.stats.total_predictions ?? "--"}</strong></article>
        <article className="stat-card"><span>Normal predictions</span><strong>{data?.stats.normal_predictions ?? "--"}</strong></article>
        <article className="stat-card"><span>Stroke predictions</span><strong>{data?.stats.stroke_predictions ?? "--"}</strong></article>
      </section>

      <section className="card-panel">
        <div className="section-heading-row"><div><h2>Recent activity</h2><p className="muted">Latest scans across the platform.</p></div><button type="button" className="secondary-btn" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></div>
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        <div className="list-stack">
          {(data?.recent_activity || []).length === 0 ? <p className="muted">No recent activity.</p> : null}
          {data?.recent_activity.map((item) => (
            <div key={item.id} className="list-row">
              <div>
                <strong>{item.prediction}</strong>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              <span>{item.risk_level}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
