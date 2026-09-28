"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getPredictionImageUrl } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type PredictionRow = {
  id: number;
  prediction: string;
  stroke_probability: number;
  normal_probability: number;
  risk_level: string;
  created_at: string;
  image_reference?: string;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch<{ predictions: PredictionRow[] }>("/predictions");
        setRows(response.predictions || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <AppShell><div className="card-panel"><p>Loading prediction history…</p></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>Prediction records</h1>
        </div>
      </div>

      <section className="card-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Prediction</th>
              <th>Probability</th>
              <th>Risk</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No records yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.prediction}</td>
                  <td>{(row.stroke_probability * 100).toFixed(1)}%</td>
                  <td>{row.risk_level}</td>
                  <td>
                    <div className="inline-actions">
                      <Link href={`/history/${row.id}`}>View</Link>
                      <a href={`/reports/${row.id}`} target="_blank" rel="noreferrer">Report</a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
