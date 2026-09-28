"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { apiFetch, getPredictionImageUrl } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

type PredictionResult = {
  prediction_id?: number;
  stroke_probability: number;
  normal_probability: number;
  prediction: string;
  risk_level: string;
  model_name: string;
  model_version: string;
  disclaimer: string;
  timestamp?: string;
  image_reference?: string;
};

type ApiConnection = "checking" | "live" | "offline";

export default function ScanPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready to upload a grayscale CT scan.");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [apiConnection, setApiConnection] = useState<ApiConnection>("checking");
  const [connectionCheckKey, setConnectionCheckKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<{ status: string }>("/health")
      .then((health) => {
        if (active) setApiConnection(health.status === "healthy" ? "live" : "offline");
      })
      .catch(() => {
        if (active) setApiConnection("offline");
      });
    return () => { active = false; };
  }, [connectionCheckKey]);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] || null);
  }

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile && nextFile.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(nextFile));
    } else {
      setPreview(null);
    }
    setStatus(nextFile ? `Selected: ${nextFile.name}` : "Ready to upload a grayscale CT scan.");
    setResult(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  }

  async function handleAnalyze() {
    if (!file) {
      setStatus("Please select a CT image first.");
      return;
    }

    setLoading(true);
    setStatus("Uploading image...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch<PredictionResult>("/predict", {
        method: "POST",
        body: formData,
      });

      setResult(response);
      setStatus("Prediction complete.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">New Scan</p>
          <h1>Brain CT analysis</h1>
        </div>
      </div>

      <section className="card-panel upload-card">
        <div className={`api-health ${apiConnection}`} role="status" aria-live="polite" aria-busy={apiConnection === "checking"}>
          <span className="api-health-dot" aria-hidden="true" />
          <span className="api-health-label">
            {apiConnection === "checking" ? "Checking API connection..." : apiConnection === "live" ? "API connection is live" : "API connection unavailable"}
          </span>
          <button
            type="button"
            className="secondary-btn api-health-check"
            disabled={apiConnection === "checking"}
            onClick={() => {
              setApiConnection("checking");
              setConnectionCheckKey((key) => key + 1);
            }}
          >
            {apiConnection === "checking" ? "Checking..." : "Check connection"}
          </button>
        </div>
        <div
          className={`upload-zone${isDragging ? " is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,.pdf" onChange={handleFileSelection} />
          {preview ? <img src={preview} alt="Selected preview" className="preview-image" /> : <div className="upload-empty">Drop a grayscale brain CT image here</div>}
        </div>

        <div className="upload-actions">
          <button type="button" className="secondary-btn" onClick={() => fileInputRef.current?.click()}>Browse files</button>
          <button type="button" className="primary-btn" onClick={handleAnalyze} disabled={!file || loading}>
            {loading ? "Analyzing..." : "Start Prediction"}
          </button>
        </div>

        <div className="status-box">{status}</div>
        <div className="meta-row">
          <span>Supported formats: JPG, PNG, PDF</span>
          {file ? <span>{file.name}</span> : null}
        </div>
        {file ? <span className="meta-row">File size: {(file.size / 1024).toFixed(1)} KB</span> : null}
      </section>

      {result ? (
        <section className="card-panel result-panel">
          <div className="result-header">
            <div>
              <p className="eyebrow">Prediction</p>
              <h2>{result.prediction}</h2>
            </div>
            <span className={`risk-pill ${result.risk_level.toLowerCase().replace(/\s+/g, "-")}`}>{result.risk_level}</span>
          </div>

          <div className="values-grid">
            <div>
              <span>Stroke probability</span>
              <strong>{(result.stroke_probability * 100).toFixed(2)}%</strong>
            </div>
            <div>
              <span>Normal probability</span>
              <strong>{(result.normal_probability * 100).toFixed(2)}%</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>{result.model_name}</strong>
            </div>
            <div>
              <span>Version</span>
              <strong>{result.model_version}</strong>
            </div>
          </div>

          <div className="signal-row">
            <div className="probability-bar"><span style={{ width: `${Math.max(0, Math.min(100, result.stroke_probability * 100))}%` }} /></div>
          </div>

          {result.image_reference ? (
            <div className="preview-wrap">
              <img src={getPredictionImageUrl(result.image_reference) || undefined} alt="Prediction scan" className="result-preview" />
            </div>
          ) : null}

          <p className="disclaimer">{result.disclaimer}</p>
        </section>
      ) : null}
    </AppShell>
  );
}
