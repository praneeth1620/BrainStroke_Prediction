"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getPredictionImageUrl } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type PredictionDetail = {
  id: number;
  prediction: string;
  stroke_probability: number;
  normal_probability: number;
  risk_level: string;
  created_at: string;
  model_name: string;
  model_version: string;
  image_reference?: string;
};

export default function HistoryDetailPage() {
  const params = useParams();
  const [row, setRow] = useState<PredictionDetail | null>(null);

  useEffect(() => {
    async function load() {
      const predictionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
      if (!predictionId) return;
      const data = await apiFetch<{ prediction: PredictionDetail }>(`/predictions/${predictionId}`);
      setRow(data.prediction);
    }
    load();
  }, [params]);

  if (!row) return <AppShell><div className="card-panel"><p>Loading prediction details…</p></div></AppShell>;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Prediction detail</p>
          <h1>{row.prediction}</h1>
        </div>
      </div>

      <section className="card-panel detail-panel">
        <div className="detail-layout">
          {row.image_reference ? (
            <img src={getPredictionImageUrl(row.image_reference) || undefined} alt="Prediction CT" className="result-preview" />
          ) : null}
          <div className="detail-copy">
            <p><strong>Prediction ID:</strong> {row.id}</p>
            <p><strong>Date/time:</strong> {new Date(row.created_at).toLocaleString()}</p>
            <p><strong>Stroke probability:</strong> {(row.stroke_probability * 100).toFixed(2)}%</p>
            <p><strong>Normal probability:</strong> {(row.normal_probability * 100).toFixed(2)}%</p>
            <p><strong>Risk level:</strong> {row.risk_level}</p>
            <p><strong>Model:</strong> {row.model_name}</p>
            <p><strong>Model version:</strong> {row.model_version}</p>
            <p className="disclaimer">This is a research/screening tool and not a clinical diagnosis.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
