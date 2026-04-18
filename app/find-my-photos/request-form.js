"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [selfie, setSelfie] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        Full Name
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          placeholder="Your full name"
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
        />
      </label>
      <label>
        Upload Selfie
        <input
          type="file"
          accept="image/*"
          required
          onChange={(event) => {
            setSelfie(event.target.files?.[0] || null);
            setError("");
          }}
        />
        <span className="field-hint">
          {selfie ? `Selected: ${selfie.name}` : "Choose one clear selfie (max 10MB)."}
        </span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I consent to face matching for wedding photo discovery and understand this request may
          be processed after event photos are uploaded.
        </span>
      </label>
      <p className="feature-note">
        Matching runs automatically every 15 minutes. You will be redirected to a live status page
        after submission.
      </p>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={busy}>
        {busy ? "Submitting..." : "Submit Request"}
      </button>
    </form>
  );
}
