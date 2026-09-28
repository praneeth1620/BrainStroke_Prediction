"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type ModelInfo = {
  model_name: string;
  version: string;
  input_size: number[];
  output: Record<string, string>;
  threshold: number;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    roc_auc?: number;
  };
  disclaimer: string;
};

export default function ModelPage() {
  const [model, setModel] = useState<ModelInfo | null>(null);

  useEffect(() => {
    async function load() {
      const data = await apiFetch<ModelInfo>("/model");
      setModel(data);
    }
    load();
  }, []);

  if (!model) return <AppShell><div className="card-panel"><p>Loading model information…</p></div></AppShell>;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Model information</p>
          <h1>{model.model_name}</h1>
        </div>
      </div>

      <section className="card-panel detail-panel">
        <div className="detail-list">
          <p><strong>Model:</strong> {model.model_name}</p>
          <p><strong>Version:</strong> {model.version}</p>
          <p><strong>Input size:</strong> {model.input_size.join(" × ")}</p>
          <p><strong>Output:</strong> {Object.values(model.output).join(" / ")}</p>
          <p><strong>Threshold:</strong> {(model.threshold * 100).toFixed(2)}%</p>
        </div>
        <div className="metrics-grid">
          {model.metrics.accuracy ? <div><span>Accuracy</span><strong>{model.metrics.accuracy.toFixed(4)}</strong></div> : null}
          {model.metrics.precision ? <div><span>Precision</span><strong>{model.metrics.precision.toFixed(4)}</strong></div> : null}
          {model.metrics.recall ? <div><span>Recall</span><strong>{model.metrics.recall.toFixed(4)}</strong></div> : null}
          {model.metrics.f1_score ? <div><span>F1-score</span><strong>{model.metrics.f1_score.toFixed(4)}</strong></div> : null}
          {model.metrics.roc_auc ? <div><span>ROC-AUC</span><strong>{model.metrics.roc_auc.toFixed(4)}</strong></div> : null}
        </div>
        <p className="disclaimer">{model.disclaimer}</p>
      </section>
    </AppShell>
  );
}
