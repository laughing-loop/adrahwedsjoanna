"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function RequestForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [selfie, setSelfie] = useState(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (selfiePreviewUrl) {
        URL.revokeObjectURL(selfiePreviewUrl);
      }
    };
  }, [selfiePreviewUrl]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!selfie) {
      setError("Please upload a selfie to continue.");
      return;
    }

    if (!consent) {
      setError("Please provide consent for photo matching.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("consent", consent ? "yes" : "no");
      formData.append("selfie", selfie);

      const response = await fetch("/api/find-my-photos/request", {
        method: "POST",
        body: formData
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Could not submit request.");
      }

      router.push(body.statusUrl || `/find-my-photos/${body.requestId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError.message || "Submission failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-form wizard-form" onSubmit={onSubmit}>
      <section className="wizard-panel">
        <p className="wizard-step-label">Step 1</p>
        <h2>Your Details</h2>
        <div className="form-split">
          <label>
            Full Name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              placeholder="Your full name"
              disabled={busy}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
              disabled={busy}
            />
          </label>
        </div>
      </section>

      <section className="wizard-panel">
        <p className="wizard-step-label">Step 2</p>
        <h2>Upload One Selfie</h2>
        <label>
          Choose Selfie
          <input
            type="file"
            accept="image/*"
            required
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setSelfie(file);
              setError("");
              setSelfiePreviewUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return file ? URL.createObjectURL(file) : "";
              });
            }}
          />
          <span className="field-hint">
            {selfie
              ? `Selected: ${selfie.name} (${formatBytes(selfie.size)})`
              : "Use a clear front-facing selfie (max 10MB)."}
          </span>
        </label>
        {selfiePreviewUrl ? (
          <div className="file-preview-card">
            <img src={selfiePreviewUrl} alt="Selfie preview" />
            <div>
              <strong>{selfie?.name || "Selected selfie"}</strong>
              <span>Preview only. Image is submitted when you tap Submit Request.</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="wizard-panel">
        <p className="wizard-step-label">Step 3</p>
        <h2>Consent and Submit</h2>
        <label className="check-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={busy}
          />
          <span>
            I consent to face matching for wedding photo discovery and understand this request may
            be processed after event photos are uploaded.
          </span>
        </label>
        <p className="feature-note">
          Matching runs automatically once daily on this site. For faster results, the admin can
          run matcher manually after new gallery uploads.
        </p>
      </section>

      {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
      <button type="submit" disabled={busy}>
        {busy ? "Submitting..." : "Submit Request"}
      </button>
    </form>
  );
}
