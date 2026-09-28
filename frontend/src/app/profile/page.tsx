"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type ProfileData = {
  id: number;
  full_name: string;
  email: string;
  profile_info: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  medical_history: string | null;
  current_medications: string | null;
  allergies: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch<{ user: ProfileData }>("/profile");
        setProfile(response.user);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch<{ user: ProfileData; message: string }>("/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: profile.full_name,
          profile_info: profile.profile_info,
          phone: profile.phone,
          date_of_birth: profile.date_of_birth,
          address: profile.address,
          medical_history: profile.medical_history,
          current_medications: profile.current_medications,
          allergies: profile.allergies,
        }),
      });
      setProfile(response.user);
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof ProfileData, value: string) {
    setProfile((current) => current ? { ...current, [field]: value } : current);
  }

  if (loading) return <AppShell><div className="card-panel"><p>Loading profile…</p></div></AppShell>;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>My profile</h1>
        </div>
      </div>

      <section className="card-panel">
        {profile ? <form className="profile-form" onSubmit={handleSave}>
          <div className="form-section-heading">
            <div><h2>Personal information</h2><p className="muted">These details are private to your account.</p></div>
          </div>
          <div className="profile-form-grid">
            <label><span>Full name</span><input value={profile.full_name} onChange={(event) => updateField("full_name", event.target.value)} placeholder="Your full name" required /></label>
            <label><span>Email</span><input value={profile.email} readOnly aria-readonly="true" /></label>
            <label><span>Phone</span><input type="tel" value={profile.phone || ""} onChange={(event) => updateField("phone", event.target.value)} placeholder="Add a phone number (optional)" /></label>
            <label><span>Date of birth</span><input type="date" value={profile.date_of_birth || ""} onChange={(event) => updateField("date_of_birth", event.target.value)} /></label>
            <label className="field-wide"><span>Address</span><input value={profile.address || ""} onChange={(event) => updateField("address", event.target.value)} placeholder="Street, city, region (optional)" /></label>
            <label className="field-wide"><span>About me</span><textarea value={profile.profile_info || ""} onChange={(event) => updateField("profile_info", event.target.value)} placeholder="A few details you'd like to keep with your profile" rows={3} /></label>
          </div>

          <div className="form-section-heading medical-section-heading">
            <div><h2>Medical information</h2><p className="muted">Optional notes for your personal records. This app is not a medical record system.</p></div>
          </div>
          <div className="profile-form-grid">
            <label className="field-wide"><span>Medical history</span><textarea value={profile.medical_history || ""} onChange={(event) => updateField("medical_history", event.target.value)} placeholder="Relevant history you choose to record" rows={3} /></label>
            <label><span>Current medications</span><textarea value={profile.current_medications || ""} onChange={(event) => updateField("current_medications", event.target.value)} placeholder="Medication names (optional)" rows={3} /></label>
            <label><span>Allergies</span><textarea value={profile.allergies || ""} onChange={(event) => updateField("allergies", event.target.value)} placeholder="Known allergies (optional)" rows={3} /></label>
          </div>

          {message ? <p className="success-text" role="status">{message}</p> : null}
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <div className="form-actions"><button type="submit" className="primary-btn" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button></div>
        </form> : <p className="error-text" role="alert">{error || "Profile unavailable."}</p>}
      </section>
    </AppShell>
  );
}
