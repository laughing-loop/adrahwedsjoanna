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

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
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
  const [nextAutoRefreshAt, setNextAutoRefreshAt] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const isRateLimited = Boolean(rateLimitedUntil && rateLimitedUntil > nowTs);
  const remainingRateLimitMs = isRateLimited ? rateLimitedUntil - nowTs : 0;
  const hasUpcomingAutoRefresh = Boolean(nextAutoRefreshAt && nextAutoRefreshAt > nowTs);
  const remainingAutoRefreshMs = hasUpcomingAutoRefresh ? nextAutoRefreshAt - nowTs : 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await fetchStatus(requestId);
      setData(body);
      setError("");
      setRateLimitedUntil(null);
      setCheckedAt(new Date());
      if (TERMINAL_STATUSES.has(body.status)) {
        setNextAutoRefreshAt(null);
      } else {
        setNextAutoRefreshAt(Date.now() + POLL_INTERVAL_MS);
      }
    } catch (statusError) {
      const retryAt = getRetryAtTimestamp(statusError.retryAt);
      if (statusError.status === 429 && retryAt && retryAt > Date.now()) {
        setRateLimitedUntil(retryAt);
        setNextAutoRefreshAt(retryAt);
      } else {
        setRateLimitedUntil(null);
        setNextAutoRefreshAt(null);
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
      setNextAutoRefreshAt(null);
      return undefined;
    }

    if (rateLimitedUntil && rateLimitedUntil > Date.now()) {
      const delay = Math.max(1000, rateLimitedUntil - Date.now() + 1000);
      setNextAutoRefreshAt(Date.now() + delay);
      const retryTimer = window.setTimeout(load, delay);
      return () => window.clearTimeout(retryTimer);
    }

    setNextAutoRefreshAt(Date.now() + POLL_INTERVAL_MS);
    const timer = window.setInterval(() => {
      setNextAutoRefreshAt(Date.now() + POLL_INTERVAL_MS);
      load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [data?.status, load, rateLimitedUntil]);

  useEffect(() => {
    if (!isRateLimited && !hasUpcomingAutoRefresh) return undefined;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasUpcomingAutoRefresh, isRateLimited]);

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
        <p className="admin-alert admin-alert-error">{error}</p>
        {isRateLimited ? (
          <p className="feature-note">
            Auto-refresh is paused and will resume in {formatCountdown(remainingRateLimitMs)} (at{" "}
            {new Date(rateLimitedUntil).toLocaleString()}).
          </p>
        ) : null}
        {hasUpcomingAutoRefresh && !isRateLimited ? (
          <p className="feature-note">
            Next automatic check in {formatCountdown(remainingAutoRefreshMs)}.
          </p>
        ) : null}
        <button
          type="button"
          className="ghost-btn"
          onClick={load}
          disabled={loading || isRateLimited}
        >
          {isRateLimited
            ? `Try Again In ${formatCountdown(remainingRateLimitMs)}`
            : loading
              ? "Refreshing..."
              : "Try Again"}
        </button>
      </div>
    );
  }

  if (status === "ready" && Array.isArray(data.images) && data.images.length) {
    return (
      <div className="fmp-status-panel">
        <div className="fmp-status-header">
          <span className={`fmp-badge fmp-badge-${tone}`}>{statusLabel}</span>
          <button
            type="button"
            className="ghost-btn"
            onClick={load}
            disabled={loading || isRateLimited}
          >
            {isRateLimited
              ? `Refresh In ${formatCountdown(remainingRateLimitMs)}`
              : loading
                ? "Refreshing..."
                : "Refresh"}
          </button>
        </div>
        <p className={`fmp-status-copy fmp-status-copy-${tone}`}>
          {data.message || "Your matched photos are ready."}
        </p>
        <div className="fmp-meta">
          <span>Submitted: {formatDateTime(data.submittedAt)}</span>
          <span>Elapsed: {formatElapsed(data.ageMinutes)}</span>
          <span>Last checked: {checkedAt ? checkedAt.toLocaleTimeString() : "n/a"}</span>
        </div>
        {hasUpcomingAutoRefresh && !isRateLimited ? (
          <p className="feature-note">
            Next automatic check in {formatCountdown(remainingAutoRefreshMs)}.
          </p>
        ) : null}

        <div className="fmp-gallery-wrap">
          <div className="fmp-gallery-head">
            <h2>Your Matched Photos ({data.images.length})</h2>
            <p className="feature-note">
              Tap any photo card to open the full-resolution image in a new tab.
            </p>
          </div>
          <ul className="fmp-gallery-grid">
            {data.images.map((item, index) => (
              <li key={item.publicId} className="fmp-photo-card">
                <a
                  className="fmp-photo-media watermark-surface"
                  href={item.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open matched photo ${index + 1}`}
                >
                  <img
                    src={item.thumbUrl || item.secureUrl}
                    alt={`Matched wedding photo ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="fmp-photo-chip">Photo {index + 1}</span>
                </a>
                <div className="fmp-photo-foot">
                  <span className="fmp-photo-name">{item.publicId?.split("/").pop() || "Photo"}</span>
                  <a href={item.secureUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
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
        <div className="fmp-status-header">
          <span className={`fmp-badge fmp-badge-${tone}`}>{statusLabel}</span>
          <button type="button" className="ghost-btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className={`fmp-status-copy fmp-status-copy-${tone}`}>We could not find this request yet.</p>
        <p className="feature-note">Please verify the link or submit a new selfie request.</p>
        <a className="action-link" href="/find-my-photos">
          Start New Request
        </a>
      </div>
    );
  }

  return (
    <div className="fmp-status-panel">
      <div className="fmp-status-header">
        <span className={`fmp-badge fmp-badge-${tone}`}>{statusLabel}</span>
        <button
          type="button"
          className="ghost-btn"
          onClick={load}
          disabled={loading || isRateLimited}
        >
          {isRateLimited
            ? `Refresh In ${formatCountdown(remainingRateLimitMs)}`
            : loading
              ? "Refreshing..."
              : "Refresh"}
        </button>
      </div>
      {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
      <p className={`fmp-status-copy fmp-status-copy-${tone}`}>
        {data?.message || "Your request is being processed."}
      </p>
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
          {new Date(rateLimitedUntil).toLocaleString()} ({formatCountdown(remainingRateLimitMs)}).
        </p>
      ) : null}
      {hasUpcomingAutoRefresh && !isRateLimited ? (
        <p className="feature-note">
          Next automatic check in {formatCountdown(remainingAutoRefreshMs)}.
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
