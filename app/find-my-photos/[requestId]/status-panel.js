"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const POLL_INTERVAL_MS = 60000;
const TERMINAL_STATUSES = new Set(["ready", "no_match", "not_found"]);

async function fetchStatus(requestId) {
  const response = await fetch(`/api/find-my-photos/status?requestId=${requestId}`, {
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Unable to fetch request status.");
    error.status = response.status;
    error.retryAt = body.retryAt || null;
    throw error;
  }
  return body;
}

function formatDateTime(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function getRetryAtTimestamp(retryAt) {
  const parsed = Date.parse(retryAt || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function formatElapsed(ageMinutes) {
  if (!Number.isFinite(ageMinutes) || ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes} min`;
  const hours = Math.floor(ageMinutes / 60);
  const minutes = ageMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function getStatusTone(status) {
  if (status === "ready") return "good";
  if (status === "no_match") return "warn";
  if (status === "retrying") return "warn";
  if (status === "not_found") return "bad";
  return "pending";
}

function getStatusLabel(status) {
  if (status === "ready") return "Matched";
  if (status === "no_match") return "No Match Yet";
  if (status === "matching") return "Matching In Progress";
  if (status === "retrying") return "Retrying";
  if (status === "not_found") return "Request Not Found";
  return "In Queue";
}

function buildSteps(status) {
  const queueComplete = status !== "not_found";
  const matchComplete = ["matching", "retrying", "ready", "no_match"].includes(status);
  const doneComplete = ["ready", "no_match"].includes(status);

  return [
    { label: "Request received", done: queueComplete },
    { label: "Face matching", done: matchComplete },
    { label: "Results published", done: doneComplete }
  ];
}

export default function StatusPanel({ requestId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await fetchStatus(requestId);
      setData(body);
      setError("");
      setRateLimitedUntil(null);
      setCheckedAt(new Date());
    } catch (statusError) {
      const retryAt = getRetryAtTimestamp(statusError.retryAt);
      if (statusError.status === 429 && retryAt && retryAt > Date.now()) {
        setRateLimitedUntil(retryAt);
      } else {
        setRateLimitedUntil(null);
      }
      setError(statusError.message || "Status check failed.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const status = data?.status;
    if (status && TERMINAL_STATUSES.has(status)) {
      return undefined;
    }

    if (rateLimitedUntil && rateLimitedUntil > Date.now()) {
      const delay = Math.max(1000, rateLimitedUntil - Date.now() + 1000);
      const retryTimer = window.setTimeout(load, delay);
      return () => window.clearTimeout(retryTimer);
    }

    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [data?.status, load, rateLimitedUntil]);

  const status = data?.status || "queued";
  const tone = getStatusTone(status);
  const statusLabel = getStatusLabel(status);
  const steps = useMemo(() => buildSteps(status), [status]);

  if (!data && loading) {
    return <p>Checking request status...</p>;
  }

  if (!data && error) {
    return (
      <div className="fmp-status-panel">
        <p className="admin-error">{error}</p>
        <button type="button" className="ghost-btn" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Try Again"}
        </button>
      </div>
    );
  }

  if (status === "ready" && Array.isArray(data.images) && data.images.length) {
    return (
      <div className="fmp-status-panel">
        <div className="fmp-status-header">
          <span className={`fmp-badge fmp-badge-${tone}`}>{statusLabel}</span>
          <button type="button" className="ghost-btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p>{data.message || "Your matched photos are ready."}</p>
        <p className="feature-note">
          Submitted: {formatDateTime(data.submittedAt)} | Last checked:{" "}
          {checkedAt ? checkedAt.toLocaleTimeString() : "n/a"}
        </p>

        <div className="upload-results">
          <h2>Your Matched Photos ({data.images.length})</h2>
          <ul className="results-grid">
            {data.images.map((item) => (
              <li key={item.publicId}>
                <img src={item.thumbUrl || item.secureUrl} alt={item.publicId} loading="lazy" />
                <a href={item.secureUrl} target="_blank" rel="noreferrer">
                  Open Full Image
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="fmp-status-panel">
        <p>We could not find this request yet.</p>
        <p className="feature-note">Please verify the link or submit a new selfie request.</p>
      </div>
    );
  }

  return (
    <div className="fmp-status-panel">
      <div className="fmp-status-header">
        <span className={`fmp-badge fmp-badge-${tone}`}>{statusLabel}</span>
        <button type="button" className="ghost-btn" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <p>{data?.message || "Your request is being processed."}</p>
      <div className="fmp-meta">
        <span>Submitted: {formatDateTime(data?.submittedAt)}</span>
        <span>Elapsed: {formatElapsed(data?.ageMinutes)}</span>
        <span>Last checked: {checkedAt ? checkedAt.toLocaleTimeString() : "n/a"}</span>
      </div>
      <ol className="fmp-steps">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? "done" : ""}>
            {step.label}
          </li>
        ))}
      </ol>
      {rateLimitedUntil ? (
        <p className="feature-note">
          Auto-refresh is paused due to Cloudinary API limits and will resume at{" "}
          {new Date(rateLimitedUntil).toLocaleString()}.
        </p>
      ) : null}
      <p className="feature-note">
        Auto-refresh runs every {Math.round(POLL_INTERVAL_MS / 1000)} seconds. Scheduled matching
        runs once daily on this deployment. Ask the admin to run matcher now from the upload
        dashboard for faster results.
      </p>
    </div>
  );
}
