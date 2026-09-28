"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Database, Gauge, History, MonitorCheck, ScanLine, Server, ShieldAlert, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type DashboardResponse = {
  user_name?: string;
  system_status: {
    frontend: boolean;
    fastapi: boolean;
    model: boolean;
    database: boolean;
  };
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

type AnimatedNumberProps = { value: number; decimals?: number; suffix?: string };

function AnimatedNumber({ value, decimals = 0, suffix = "" }: AnimatedNumberProps) {
  const [shownValue, setShownValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 720;
    let frame = 0;

    function animate(now: number) {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShownValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shownValue.toFixed(decimals)}{suffix}</>;
}

function StatusRow({ Icon, label, value, healthy }: { Icon: typeof Activity; label: string; value: string; healthy: boolean }) {
  return (
    <li className="system-row">
      <span className="system-icon"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="system-name">{label}</span>
      <span className={`system-state${healthy ? " is-healthy" : " is-unavailable"}`}>
        <span className="status-dot" aria-hidden="true" />{value}
      </span>
    </li>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [userResult, predictionsResult, healthResult] = await Promise.allSettled([
          apiFetch<{ user: { full_name: string } }>("/auth/me"),
          apiFetch<{ predictions: Array<{ id: number; prediction: string; stroke_probability: number; risk_level: string; created_at: string }> }>("/predictions"),
          apiFetch<{ status: string; database: string; model: string }>("/health"),
        ]);
        if (userResult.status === "rejected") throw userResult.reason;
        if (predictionsResult.status === "rejected") throw predictionsResult.reason;

        const health = healthResult.status === "fulfilled" ? healthResult.value : null;
        const predictions = predictionsResult.value;

        setData({
          user_name: userResult.value.user.full_name,
          system_status: {
            frontend: true,
            fastapi: health?.status === "healthy",
            model: health?.model === "loaded",
            database: health?.database === "connected",
          },
          stats: {
            total_scans: predictions.predictions.length,
            normal_predictions: predictions.predictions.filter((item) => item.prediction === "NORMAL").length,
            stroke_predictions: predictions.predictions.filter((item) => item.prediction === "STROKE").length,
          },
          recent_predictions: predictions.predictions.slice(0, 5),
          latest_prediction: predictions.predictions[0] || undefined,
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the dashboard.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <AppShell><div className="card-panel"><p>Loading dashboard…</p></div></AppShell>;
  }

  if (error) {
    return <AppShell><section className="card-panel access-message"><p className="eyebrow">Dashboard unavailable</p><h1>Sign in to continue</h1><p className="muted">{error}</p><Link href="/login" className="primary-btn">Go to login</Link></section></AppShell>;
  }

  const totalScans = data?.stats.total_scans ?? 0;
  const normalPredictions = data?.stats.normal_predictions ?? 0;
  const strokePredictions = data?.stats.stroke_predictions ?? 0;
  const latestPrediction = data?.latest_prediction;
  const allSystemsHealthy = Object.values(data?.system_status || {}).every(Boolean);
  const normalShare = totalScans ? Math.round((normalPredictions / totalScans) * 100) : null;
  const strokeProbability = latestPrediction ? Math.max(0, Math.min(100, latestPrediction.stroke_probability * 100)) : 0;

  return (
    <AppShell>
      <section className="dashboard-welcome">
        <div>
          <p className="eyebrow"><Activity size={14} /> Dashboard overview</p>
          <h1>Welcome back, <span>{data?.user_name || "there"}</span></h1>
          <p className="welcome-subtitle">Your <span>AI-powered</span> brain CT screening dashboard</p>
        </div>
        <div className="welcome-actions">
          <span className={`operational-pill${allSystemsHealthy ? " is-healthy" : " is-unavailable"}`}>
            <span className="status-dot" aria-hidden="true" />
            {allSystemsHealthy ? "System operational" : "Service attention needed"}
          </span>
          <Link href="/scan" className="primary-btn dashboard-cta"><ScanLine size={17} /> New Scan <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="stats-grid dashboard-stats" aria-label="Prediction summary">
        <article className="stat-card stat-total">
          <div className="stat-topline"><span className="stat-icon"><ScanLine size={19} /></span><span className="stat-kicker">ACTIVITY</span></div>
          <span className="stat-label">Total scans</span>
          <strong className="stat-value"><AnimatedNumber value={totalScans} /></strong>
          <span className="stat-note">{totalScans ? "Saved in your history" : "No scans saved yet"}</span>
        </article>
        <article className="stat-card stat-normal">
          <div className="stat-topline"><span className="stat-icon"><CheckCircle2 size={19} /></span><span className="stat-kicker">NORMAL</span></div>
          <span className="stat-label">Normal predictions</span>
          <strong className="stat-value"><AnimatedNumber value={normalPredictions} /></strong>
          <span className="stat-note">{normalShare === null ? "No scans to summarize" : `${normalShare}% of recorded scans`}</span>
        </article>
        <article className="stat-card stat-stroke">
          <div className="stat-topline"><span className="stat-icon"><ShieldAlert size={19} /></span><span className="stat-kicker">STROKE</span></div>
          <span className="stat-label">Stroke predictions</span>
          <strong className="stat-value"><AnimatedNumber value={strokePredictions} /></strong>
          <span className="stat-note">{strokePredictions ? `${strokePredictions} recorded prediction${strokePredictions === 1 ? "" : "s"}` : "No stroke predictions"}</span>
        </article>
        <article className="stat-card stat-latest">
          <div className="stat-topline"><span className="stat-icon"><Gauge size={19} /></span><span className="stat-kicker">LATEST OUTPUT</span></div>
          <span className="stat-label">Stroke probability</span>
          <strong className="stat-value">{latestPrediction ? <AnimatedNumber value={strokeProbability} decimals={1} suffix="%" /> : "--"}</strong>
          <span className="stat-note">{latestPrediction ? `${latestPrediction.risk_level} · latest scan` : "Available after your first scan"}</span>
          {latestPrediction ? <div className="metric-progress" aria-label={`Stroke probability ${(strokeProbability).toFixed(1)} percent`}><span style={{ width: `${strokeProbability}%` }} /></div> : null}
        </article>
      </section>

      <section className="dashboard-content-grid">
        <article className="card-panel recent-panel">
          <header className="panel-heading">
            <div><p className="eyebrow">Your activity</p><h2>Recent predictions</h2></div>
            <Link href="/history" className="text-action">View all <ArrowRight size={15} /></Link>
          </header>
          <div className="prediction-list">
            {(data?.recent_predictions || []).length === 0 ? (
              <div className="dashboard-empty-state">
                <span className="empty-icon"><BrainCircuit size={24} /></span>
                <h3>No predictions yet</h3>
                <p>Your prediction history will appear here after your first scan.</p>
                <Link href="/scan" className="secondary-btn empty-action"><ScanLine size={16} /> Start a scan</Link>
              </div>
            ) : (
              data?.recent_predictions?.map((item) => (
                <Link href={`/history/${item.id}`} key={item.id} className="prediction-row">
                  <span className={`prediction-marker ${item.prediction === "STROKE" ? "is-stroke" : "is-normal"}`}>
                    {item.prediction === "STROKE" ? <ShieldAlert size={17} /> : <CheckCircle2 size={17} />}
                  </span>
                  <span className="prediction-copy">
                    <strong>{item.prediction}</strong>
                    <span>{new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                  <span className="prediction-measure">
                    <strong>{(item.stroke_probability * 100).toFixed(1)}%</strong>
                    <span className={`risk-tag risk-${item.risk_level.toLowerCase().replace(/\s+/g, "-")}`}>{item.risk_level}</span>
                  </span>
                  <ArrowRight className="row-arrow" size={16} />
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="card-panel system-panel">
          <header className="panel-heading"><div><p className="eyebrow">Live environment</p><h2>System status</h2></div><span className={`system-health-mark${allSystemsHealthy ? " is-healthy" : " is-unavailable"}`}><span className="status-dot" /></span></header>
          <ul className="system-list">
            <StatusRow Icon={MonitorCheck} label="Frontend" value={data?.system_status.frontend ? "Online" : "Offline"} healthy={data?.system_status.frontend ?? false} />
            <StatusRow Icon={Server} label="FastAPI" value={data?.system_status.fastapi ? "Online" : "Offline"} healthy={data?.system_status.fastapi ?? false} />
            <StatusRow Icon={BrainCircuit} label="Model" value={data?.system_status.model ? "Loaded" : "Unavailable"} healthy={data?.system_status.model ?? false} />
            <StatusRow Icon={Database} label="Database" value={data?.system_status.database ? "Connected" : "Unavailable"} healthy={data?.system_status.database ?? false} />
          </ul>
          <p className="system-footnote"><Activity size={14} /> Research screening support, not a diagnosis</p>
        </article>
      </section>

      <section className="quick-actions-section">
        <header className="panel-heading"><div><p className="eyebrow">Continue your workflow</p><h2>Quick actions</h2></div></header>
        <div className="quick-actions-grid">
          <Link href="/scan" className="quick-action quick-scan"><span className="quick-icon"><ScanLine size={19} /></span><span><strong>New scan</strong></span><ArrowRight size={16} className="quick-arrow" /></Link>
          <Link href="/history" className="quick-action quick-history"><span className="quick-icon"><History size={19} /></span><span><strong>Prediction history</strong></span><ArrowRight size={16} className="quick-arrow" /></Link>
          <Link href="/model" className="quick-action quick-model"><span className="quick-icon"><BrainCircuit size={19} /></span><span><strong>Model information</strong></span><ArrowRight size={16} className="quick-arrow" /></Link>
          <Link href="/food" className="quick-action quick-food"><span className="quick-icon"><Sparkles size={19} /></span><span><strong>Food & lifestyle</strong></span><ArrowRight size={16} className="quick-arrow" /></Link>
        </div>
      </section>
    </AppShell>
  );
}
