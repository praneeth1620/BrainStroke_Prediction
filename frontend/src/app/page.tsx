'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

type DietType = 'veg' | 'non_veg';
type RiskBand = 'low_risk' | 'moderate_risk' | 'high_risk';

const dietSuggestions: Record<RiskBand, {
  label: string;
  range: string;
  description: string;
  veg: string[];
  non_veg: string[];
}> = {
  low_risk: {
    label: 'Supportive choices',
    range: '0-30%',
    description: 'Examples listed in the lower-score group of the supplied diet dataset.',
    veg: [
      'Spinach', 'Kale', 'Broccoli', 'Chia seeds', 'Flaxseeds', 'Oats', 'Quinoa',
      'Walnuts', 'Almonds', 'Blueberries', 'Strawberries', 'Beetroot', 'Carrot',
      'Sweet potato', 'Avocado', 'Banana', 'Oranges', 'Apples', 'Lentils', 'Chickpeas', 'Tofu',
    ],
    non_veg: [
      'Salmon', 'Mackerel', 'Sardines', 'Tuna', 'Skinless chicken breast',
      'Turkey breast', 'Egg whites',
    ],
  },
  moderate_risk: {
    label: 'Balance and moderation',
    range: '31-65%',
    description: 'The dataset places these foods in its moderate group; consider portions and preparation.',
    veg: [
      'White rice', 'Whole milk', 'Regular yogurt', 'Paneer', 'Cottage cheese',
      'Brown sugar', 'Honey', 'White bread', 'Standard pasta', 'Butter',
      'Coconut oil', 'Palm oil', 'Potatoes', 'Tapioca',
    ],
    non_veg: [
      'Egg yolks', 'Whole eggs', 'Shrimp', 'Crab', 'Lobster', 'Lean beef',
      'Pork chops', 'Regular minced beef', 'Duck meat', 'Chicken with skin',
    ],
  },
  high_risk: {
    label: 'Limit these dataset examples',
    range: '66-100%',
    description: 'The supplied dataset flags these foods as higher-risk examples, often due to processing, sodium, sugar, or preparation.',
    veg: [
      'Salted potato chips', 'Instant noodles', 'Namkeen', 'French fries',
      'Milk chocolate', 'Sugary sodas', 'Packaged fruit juices',
      'Pickles in heavy brine', 'High-sodium canned soups', 'Trans-fat pastries', 'Commercial cakes',
    ],
    non_veg: [
      'Fried chicken nuggets', 'Deep-fried fish and chips', 'Commercial mutton kebabs',
      'Bacon', 'Sausages', 'Hot dogs', 'Salami', 'Pepperoni', 'Ham', 'Animal liver', 'Animal brain',
    ],
  },
};

function getRiskBand(probability: number): RiskBand {
  const percentage = probability * 100;
  if (percentage <= 30) return 'low_risk';
  if (percentage <= 65) return 'moderate_risk';
  return 'high_risk';
}

type Prediction = {
  prediction_class: number;
  prediction_label: string;
  stroke_probability: number;
  risk_level: string;
  threshold: number;
  disclaimer: string;
  file_type: string;
  debug: {
    input_shape: number[];
    input_dtype: string;
    input_min: number;
    input_max: number;
    input_mean: number;
    input_std: number;
    raw_model_output: number[][];
    stroke_probability_percent: number;
  };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('Choose an image or PDF to begin.');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isDietDialogOpen, setIsDietDialogOpen] = useState(false);
  const [dietType, setDietType] = useState<DietType | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const checkApi = async () => {
    setStatus('Loading...');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) {
        setStatus('API is reachable.');
      } else {
        setStatus('API returned an error.');
      }
    } catch {
      setStatus('Failed to connect to API.');
    }
  };

  const predict = async () => {
    if (!file) {
      setStatus('Select an image or PDF first.');
      return;
    }
    setIsPredicting(true);
    setPrediction(null);
    setStatus('Analyzing scan...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/predict`, { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || 'Prediction failed.');
      setPrediction(body);
      setDietType(null);
      setIsDietDialogOpen(true);
      setStatus('Analysis complete.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Prediction failed.');
    } finally {
      setIsPredicting(false);
    }
  };

  const selectDietType = (type: DietType) => {
    setDietType(type);
    setIsDietDialogOpen(false);
  };

  const riskBand = prediction ? getRiskBand(prediction.stroke_probability) : null;
  const suggestion = riskBand ? dietSuggestions[riskBand] : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Neuroview home">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>NEUROVIEW <span className="brand-divider">/</span> IMAGING</span>
        </a>
        <div className="topbar-tools">
          <span className={`connection-state ${status === 'API is reachable.' ? 'is-online' : ''}`}>
            <span className="state-dot" />
            {status === 'API is reachable.' ? 'API online' : 'Local review'}
          </span>
          <button className="text-button" type="button" onClick={checkApi}>Check connection</button>
        </div>
      </header>

      <div className="page-content" id="top">
        <section className="intro-row">
          <div>
            <p className="eyebrow">NEUROIMAGING <span>01 / SCREENING</span></p>
            <h1>Clarity for<br /><em>every scan.</em></h1>
          </div>
          <div className="intro-aside">
            <p className="intro-note">AI-assisted review of brain CT images, presented with the model score and input diagnostics.</p>
            <div className="model-stamp">
              <span className="stamp-line" />
              <span><strong>EfficientNetB3</strong><small>SCREENING MODEL · RESEARCH USE</small></span>
            </div>
          </div>
        </section>

        <section className="upload-section" aria-labelledby="upload-heading">
          <div className="section-heading">
            <div>
              <span className="step-index">01</span>
              <h2 id="upload-heading">Scan image</h2>
            </div>
            <span className="file-types">PNG · JPG · JPEG · PDF</span>
          </div>

          <label className="upload-zone">
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                setPreviewUrl(nextFile?.type.startsWith('image/') ? URL.createObjectURL(nextFile) : null);
                setPrediction(null);
                setDietType(null);
                setIsDietDialogOpen(false);
                setStatus(nextFile?.name || 'Choose an image or PDF to begin.');
              }}
            />
            {previewUrl ? (
              <span className="preview-frame"><Image className="preview-image" src={previewUrl} alt="Selected CT scan preview" width={94} height={94} unoptimized /></span>
            ) : (
              <span className={`upload-symbol ${file ? 'pdf-symbol' : ''}`} aria-hidden="true">
                {file ? 'PDF' : <svg viewBox="0 0 32 32" fill="none"><path d="M16 21V5m0 0-6 6m6-6 6 6M6 19v7h20v-7" /></svg>}
              </span>
            )}
            <span className="upload-copy">
              <strong>{file ? file.name : 'Choose a CT image or PDF'}</strong>
              <small>{file ? `${(file.size / 1024).toFixed(1)} KB · selected` : 'Browse files from your device'}</small>
            </span>
            <span className="browse-label">Browse files</span>
          </label>

          <div className="action-row">
            <p className="status-line" aria-live="polite"><span className="status-mark" />{status}</p>
            <button className="analyze-button" type="button" onClick={predict} disabled={!file || isPredicting}>
              {isPredicting ? 'Analyzing scan…' : 'Analyze scan'}
              {!isPredicting && <span aria-hidden="true">↗</span>}
            </button>
          </div>
        </section>

        {prediction && (
          <section className="result-section" aria-labelledby="result-heading">
            <div className="section-heading result-heading">
              <div>
                <span className="step-index">02</span>
                <h2 id="result-heading">Screening result</h2>
              </div>
              <span className="result-file">{file?.name}</span>
            </div>
            <div className="result-layout">
              <div className="result-primary">
                <p className="eyebrow">MODEL CLASSIFICATION</p>
                <h3 className={prediction.prediction_class === 1 ? 'classification-positive' : 'classification-negative'}>
                  {prediction.prediction_label}
                </h3>
                <p className="result-disclaimer">{prediction.disclaimer}</p>
              </div>
              <div className="probability-block">
                <p className="eyebrow">STROKE PROBABILITY</p>
                <p className="probability-value">{(prediction.stroke_probability * 100).toFixed(3)}<span>%</span></p>
                <div className="probability-track" aria-label={`Stroke probability ${(prediction.stroke_probability * 100).toFixed(3)} percent`}>
                  <span style={{ width: `${Math.min(100, Math.max(0, prediction.stroke_probability * 100))}%` }} />
                </div>
                <p className="threshold-line">Decision threshold <strong>{(prediction.threshold * 100).toFixed(3)}%</strong></p>
              </div>
            </div>

            <details className="debug-details">
              <summary>Input diagnostics <span>Open</span></summary>
              <dl className="debug-grid">
                <div><dt>Input shape</dt><dd>{JSON.stringify(prediction.debug.input_shape)}</dd></div>
                <div><dt>Data type</dt><dd>{prediction.debug.input_dtype}</dd></div>
                <div><dt>Minimum</dt><dd>{prediction.debug.input_min.toFixed(6)}</dd></div>
                <div><dt>Maximum</dt><dd>{prediction.debug.input_max.toFixed(6)}</dd></div>
                <div><dt>Mean</dt><dd>{prediction.debug.input_mean.toFixed(6)}</dd></div>
                <div><dt>Standard deviation</dt><dd>{prediction.debug.input_std.toFixed(6)}</dd></div>
                <div><dt>Raw model output</dt><dd>{JSON.stringify(prediction.debug.raw_model_output)}</dd></div>
              </dl>
            </details>
          </section>
        )}

        {prediction && dietType && suggestion && (
          <section className="diet-section" aria-labelledby="diet-heading">
            <div className="section-heading">
              <div>
                <span className="step-index">03</span>
                <h2 id="diet-heading">Food suggestions</h2>
              </div>
              <button className="text-button" type="button" onClick={() => setIsDietDialogOpen(true)}>
                {dietType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} · Change
              </button>
            </div>
            <div className="diet-intro">
              <div>
                <p className="eyebrow">DATASET SCORE BAND · {suggestion.range}</p>
                <h3>{suggestion.label}</h3>
              </div>
              <p>{suggestion.description}</p>
            </div>
            <div className="food-list" aria-label={`${dietType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} food examples`}>
              {suggestion[dietType].map((food) => <span key={food}>{food}</span>)}
            </div>
            {riskBand !== 'low_risk' && (
              <div className="swap-note">
                <span className="swap-mark" aria-hidden="true">↗</span>
                <p><strong>Lower-score alternatives:</strong> {dietSuggestions.low_risk[dietType].slice(0, 8).join(', ')}.</p>
              </div>
            )}
            <p className="nutrition-note">These are general examples from the supplied dataset, not a personalized diet or treatment plan. A model score is not a clinical stroke-risk assessment; consult a qualified clinician or dietitian for personal advice.</p>
          </section>
        )}

        <footer className="page-footer">
          <span>NEUROVIEW · RESEARCH SCREENING</span>
          <span>Not a standalone diagnostic tool</span>
        </footer>
      </div>

      {isDietDialogOpen && prediction && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsDietDialogOpen(false);
        }}>
          <section className="diet-dialog" role="dialog" aria-modal="true" aria-labelledby="diet-dialog-title">
            <button className="dialog-close" type="button" aria-label="Close dietary preference dialog" onClick={() => setIsDietDialogOpen(false)}>×</button>
            <p className="eyebrow">PERSONALIZE SUGGESTIONS</p>
            <h2 id="diet-dialog-title">Which foods do you prefer?</h2>
            <p className="dialog-description">Choose a dietary preference to see food examples matched to this result’s dataset score band.</p>
            <div className="diet-options">
              <button type="button" className="diet-option" onClick={() => selectDietType('veg')}>
                <span className="diet-option-icon veg-icon" aria-hidden="true">V</span>
                <span><strong>Vegetarian</strong><small>Plant-based food examples</small></span>
                <span className="option-arrow" aria-hidden="true">↗</span>
              </button>
              <button type="button" className="diet-option" onClick={() => selectDietType('non_veg')}>
                <span className="diet-option-icon nonveg-icon" aria-hidden="true">N</span>
                <span><strong>Non-vegetarian</strong><small>Includes meat, fish, and eggs</small></span>
                <span className="option-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
            <p className="dialog-footnote">Suggestions are informational only and are not medical advice.</p>
          </section>
        </div>
      )}
    </main>
  );
}
