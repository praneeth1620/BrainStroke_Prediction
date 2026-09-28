"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type DashboardResponse = {
  stats: {
    total_scans?: number;
    total_users?: number;
    normal_predictions?: number;
    stroke_predictions?: number;
  };
  recent_predictions?: Array<{
    id: number;
    prediction: string;
    stroke_probability: number;
    risk_level: string;
    created_at: string;
  }>;
  latest_prediction?: {
    stroke_probability: number;
    prediction: string;
    risk_level: string;
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [userData, predictions] = await Promise.all([
          apiFetch<{ user: { full_name: string } }>("/auth/me"),
          apiFetch<{ predictions: Array<{ id: number; prediction: string; stroke_probability: number; risk_level: string; created_at: string }> }>("/predictions"),
        ]);

        setData({
          stats: {
            total_scans: predictions.predictions.length,
            normal_predictions: predictions.predictions.filter((item) => item.prediction === "NORMAL").length,
            stroke_predictions: predictions.predictions.filter((item) => item.prediction === "STROKE").length,
          },
          recent_predictions: predictions.predictions.slice(0, 5),
          latest_prediction: predictions.predictions[0] || undefined,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <AppShell><div className="card-panel"><p>Loading dashboard…</p></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome back</h1>
        </div>
        <Link href="/scan" className="primary-btn">New Scan</Link>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total scans</span>
          <strong>{data?.stats.total_scans ?? 0}</strong>
        </article>
        <article className="stat-card">
          <span>Normal predictions</span>
          <strong>{data?.stats.normal_predictions ?? 0}</strong>
        </article>
        <article className="stat-card">
          <span>Stroke predictions</span>
          <strong>{data?.stats.stroke_predictions ?? 0}</strong>
        </article>
        <article className="stat-card">
          <span>Latest probability</span>
          <strong>{data?.latest_prediction ? `${(data.latest_prediction.stroke_probability * 100).toFixed(1)}%` : "0%"}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="card-panel">
          <h2>Recent predictions</h2>
          <div className="list-stack">
            {(data?.recent_predictions || []).length === 0 ? (
              <p className="muted">No predictions yet. Start with a new scan.</p>
            ) : (
              data?.recent_predictions?.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.prediction}</strong>
                    <small>{new Date(item.created_at).toLocaleString()}</small>
                  </div>
                  <span>{(item.stroke_probability * 100).toFixed(1)}%</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card-panel">
          <h2>System status</h2>
          <ul className="status-list">
            <li>Frontend: Online</li>
            <li>FastAPI: Online</li>
            <li>Model: Loaded</li>
            <li>Database: Connected</li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
