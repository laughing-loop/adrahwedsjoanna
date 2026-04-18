"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_UPLOAD_BYTES = 10_485_760;

function inferResourceType(file) {
  if (file.type.startsWith("video/")) return "video";
  return "image";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
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

function formatLocalTime(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function isRateLimitMessage(message) {
  return /rate limit exceeded|api limit reached/i.test(String(message || ""));
}

function extractRateLimitReset(message) {
  const match = String(message || "").match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/i);
  return match ? match[0] : null;
}

function normalizeProviderError(message) {
  const raw = String(message || "Upload failed.");
  if (!isRateLimitMessage(raw)) return raw;
  const resetAt = extractRateLimitReset(raw);
  if (resetAt) {
    return `Cloudinary API limit reached. Try again after ${resetAt}.`;
  }
  return "Cloudinary API limit reached. Try again later.";
}

function toCloudinaryThumb(secureUrl, resourceType) {
  if (!secureUrl?.includes("/upload/")) return secureUrl;
  if (resourceType === "video") {
    return secureUrl.replace("/upload/", "/upload/so_0,f_jpg,q_auto,w_460/");
  }
  return secureUrl.replace("/upload/", "/upload/f_auto,q_auto,w_460,c_limit/");
}

export default function UploadManager({ user }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [rateLimitedUntil, setRateLimitedUntil] = useState(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [failures, setFailures] = useState([]);
  const [jobMessage, setJobMessage] = useState("");
  const [matcherFailures, setMatcherFailures] = useState([]);
  const [matcherSummary, setMatcherSummary] = useState(null);
  const [lastMatcherRunAt, setLastMatcherRunAt] = useState(null);
  const isRateLimited = Boolean(rateLimitedUntil && rateLimitedUntil > nowTs);
  const remainingRateLimitMs = isRateLimited ? rateLimitedUntil - nowTs : 0;
  const selectedBytes = items.reduce((total, item) => total + item.file.size, 0);
  const selectedImageCount = items.reduce(
    (count, item) => count + (item.resourceType === "image" ? 1 : 0),
    0
  );
  const selectedVideoCount = items.length - selectedImageCount;

  const parseRetryAtTimestamp = (value) => {
    const extracted = extractRateLimitReset(value);
    const parsed = Date.parse(extracted || value || "");
    return Number.isFinite(parsed) ? parsed : null;
  };

  const revokePreview = (entry) => {
    if (entry?.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl);
    }
  };

  const clearSelections = () => {
    setItems((currentItems) => {
      currentItems.forEach(revokePreview);
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelection = (id) => {
    setItems((currentItems) =>
      currentItems.filter((entry) => {
        if (entry.id === id) {
          revokePreview(entry);
          return false;
        }
        return true;
      })
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelection = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    setItems((currentItems) => {
      currentItems.forEach(revokePreview);
      return nextFiles.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        resourceType: inferResourceType(file),
        previewUrl: URL.createObjectURL(file)
      }));
    });
  };

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        revokePreview(item);
      });
    };
  }, [items]);

  useEffect(() => {
    if (!isRateLimited) return undefined;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isRateLimited]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const runMatcherNow = async () => {
    if (isRateLimited) return;
    setError("");
    setJobMessage("");
    setMatcherFailures([]);
    setMatcherSummary(null);
    setMatchingBusy(true);
    try {
      const response = await fetch("/api/find-my-photos/run", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const normalized = normalizeProviderError(body.error || "Could not run matcher.");
        const retryTs = parseRetryAtTimestamp(body.retryAt || body.error || normalized);
        if (response.status === 429 && retryTs && retryTs > Date.now()) {
          setRateLimitedUntil(retryTs);
        }
        throw new Error(normalized);
      }

      const processedCount = body.processedCount || 0;
      const failedCount = body.failedCount || 0;
      const pendingCount = body.pendingCount || 0;
      const galleryCount = body.galleryCount || 0;
      setRateLimitedUntil(null);
      setLastMatcherRunAt(Date.now());
      setMatcherSummary({ processedCount, failedCount, pendingCount, galleryCount });
      setMatcherFailures(Array.isArray(body.failed) ? body.failed : []);
      if (failedCount > 0) {
        setJobMessage(
          `Matcher finished with issues. Processed ${processedCount} request(s), failed ${failedCount}.`
        );
      } else {
        setJobMessage(`Matcher complete. Processed ${processedCount} request(s).`);
      }
    } catch (runError) {
      const normalized = normalizeProviderError(runError.message || "Matcher failed.");
      const retryTs = parseRetryAtTimestamp(normalized);
      if (retryTs && retryTs > Date.now()) {
        setRateLimitedUntil(retryTs);
      }
      setError(normalized);
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (isRateLimited) {
      setError(
        `Cloudinary API limit reached. Try again after ${new Date(rateLimitedUntil).toUTCString()}.`
      );
      return;
    }
    setError("");
    setResults([]);
    setFailures([]);

    const submitItems = items.length
      ? items
      : Array.from(fileInputRef.current?.files || []).map((file, index) => ({
          id: `${file.name}-${file.lastModified}-${index}`,
          file,
          resourceType: inferResourceType(file),
          previewUrl: ""
        }));

    if (!submitItems.length) {
      setError("Please select at least one image or video.");
      return;
    }

    setBusy(true);
    try {
      const uploadedItems = [];
      const failedItems = [];

      for (const item of submitItems) {
        const file = item.file;

        if (file.size > MAX_UPLOAD_BYTES) {
          failedItems.push({
            name: file.name,
            reason: `File too large (${formatBytes(file.size)}). Max is ${formatBytes(
              MAX_UPLOAD_BYTES
            )}.`
          });
          continue;
        }

        try {
          const resourceType = inferResourceType(file);
          const signingResponse = await fetch("/api/uploads/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceType })
          });

          if (!signingResponse.ok) {
            const body = await signingResponse.json().catch(() => ({}));
            throw new Error(body.error || "Could not sign upload request.");
          }

          const signedData = await signingResponse.json();
          const formData = new FormData();
          formData.append("file", file);
          formData.append("api_key", signedData.apiKey);
          formData.append("timestamp", String(signedData.timestamp));
          formData.append("signature", signedData.signature);
          formData.append("folder", signedData.folder);

          const uploadResponse = await fetch(signedData.uploadUrl, {
            method: "POST",
            body: formData
          });

          const uploadBody = await uploadResponse.json().catch(() => ({}));
          if (!uploadResponse.ok) {
            const providerMessage =
              uploadBody?.error?.message || uploadBody?.error || "Upload failed.";
            throw new Error(normalizeProviderError(providerMessage));
          }

          uploadedItems.push({
            name: file.name,
            secureUrl: uploadBody.secure_url,
            thumbUrl: toCloudinaryThumb(uploadBody.secure_url, uploadBody.resource_type),
            resourceType: uploadBody.resource_type || resourceType
          });
        } catch (fileError) {
          const reason = normalizeProviderError(fileError.message || "Upload failed.");
          failedItems.push({
            name: file.name,
            reason
          });
          if (isRateLimitMessage(reason)) {
            const retryTs = parseRetryAtTimestamp(reason);
            if (retryTs && retryTs > Date.now()) {
              setRateLimitedUntil(retryTs);
            }
            setError(reason);
            break;
          }
        }
      }

      setResults(uploadedItems);
      setFailures(failedItems);
      clearSelections();
      if (failedItems.length && !uploadedItems.length) {
        setError("No files were uploaded. See details below.");
      }
    } catch (uploadError) {
      setError(normalizeProviderError(uploadError.message || "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="uploader-wrap">
      <div className="uploader-meta">
        <div className="uploader-identity">
          <p>
            Signed in as <strong>{user.name || user.email}</strong> ({user.role})
          </p>
          <p className="feature-note">
            Upload media, run matching on demand, and track issues from one dashboard.
          </p>
        </div>
        <div className="uploader-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={runMatcherNow}
            disabled={matchingBusy || isRateLimited}
          >
            {isRateLimited
              ? `Run Matcher Blocked (${formatCountdown(remainingRateLimitMs)})`
              : matchingBusy
                ? "Running Matcher..."
                : "Run Matcher Now"}
          </button>
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <span className="admin-stat-label">Selected Files</span>
          <strong>{items.length}</strong>
          <small>
            {selectedImageCount} image(s), {selectedVideoCount} video(s)
          </small>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">Selection Size</span>
          <strong>{formatBytes(selectedBytes)}</strong>
          <small>Max per file: {formatBytes(MAX_UPLOAD_BYTES)}</small>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">Uploaded This Session</span>
          <strong>{results.length}</strong>
          <small>{failures.length} failed</small>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">Last Matcher Run</span>
          <strong>{lastMatcherRunAt ? formatLocalTime(lastMatcherRunAt) : "Not run yet"}</strong>
          <small>
            {matcherSummary
              ? `Scanned ${matcherSummary.pendingCount} pending request(s)`
              : "Run matcher to check queue health"}
          </small>
        </article>
      </div>

      {isRateLimited ? (
        <p className="admin-alert admin-alert-warn">
          Cloudinary API limit is active. Actions are disabled and will re-enable in{" "}
          <strong>{formatCountdown(remainingRateLimitMs)}</strong> (at{" "}
          {new Date(rateLimitedUntil).toLocaleString()}).
        </p>
      ) : null}
      {jobMessage ? <p className="admin-alert admin-alert-info">{jobMessage}</p> : null}
      {error ? <p className="admin-alert admin-alert-error">{error}</p> : null}
      {matcherSummary ? (
        <p className="feature-note">
          Pending selfies scanned: {matcherSummary.pendingCount}. Gallery images considered:{" "}
          {matcherSummary.galleryCount}. Processed {matcherSummary.processedCount} request(s).
        </p>
      ) : null}
      {matcherFailures.length ? (
        <div className="upload-results">
          <h2>Matcher Failure Details</h2>
          <ul>
            {matcherFailures.map((item, index) => (
              <li key={`${item.requestId || "unknown"}-${index}`} className="matcher-failure-row">
                <span>
                  <strong>Request:</strong> {item.requestId || "unknown"}
                </span>
                <span>
                  <strong>Reason:</strong> {item.error || "Unknown matching failure."}
                </span>
              </li>
            ))}
          </ul>
          <p className="feature-note">
            If the reason mentions CompreFace config, verify `COMPRE_FACE_BASE_URL`,
            `COMPRE_FACE_API_KEY`, and `COMPRE_FACE_VERIFY_PATH` in Vercel project environment
            variables.
          </p>
        </div>
      ) : null}

      <form className="admin-form uploader-form" onSubmit={handleUpload}>
        <label>
          Select images or videos
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            disabled={busy || isRateLimited}
            onChange={handleFileSelection}
          />
        </label>
        <div className="selection-toolbar">
          <p className="field-hint">
            {items.length
              ? `Ready: ${items.length} file(s) • ${formatBytes(selectedBytes)} total`
              : "Select one or many files. You can remove individual files before upload."}
          </p>
          <div className="selection-actions">
            <button
              type="button"
              className="ghost-btn compact-btn"
              onClick={clearSelections}
              disabled={!items.length || busy}
            >
              Clear Selection
            </button>
          </div>
        </div>
        {items.length ? (
          <div className="preview-grid">
            {items.map((item) => (
              <figure key={item.id} className="preview-card">
                {item.resourceType === "image" ? (
                  <img src={item.previewUrl} alt={item.file.name} loading="lazy" />
                ) : (
                  <video src={item.previewUrl} muted playsInline preload="metadata" />
                )}
                <figcaption>
                  <strong>{item.file.name}</strong>
                  <span>{formatBytes(item.file.size)}</span>
                </figcaption>
                <button
                  type="button"
                  className="ghost-btn compact-btn"
                  onClick={() => removeSelection(item.id)}
                  disabled={busy}
                >
                  Remove
                </button>
              </figure>
            ))}
          </div>
        ) : null}
        <button type="submit" disabled={busy || isRateLimited}>
          {isRateLimited
            ? `Upload Blocked (${formatCountdown(remainingRateLimitMs)})`
            : busy
              ? "Uploading..."
              : "Upload to Cloudinary"}
        </button>
      </form>

      {results.length ? (
        <div className="upload-results">
          <h2>Uploaded Files</h2>
          <ul className="results-grid">
            {results.map((item) => (
              <li key={item.secureUrl}>
                {item.resourceType === "image" ? (
                  <img src={item.thumbUrl} alt={item.name} loading="lazy" />
                ) : (
                  <img src={item.thumbUrl} alt={item.name} loading="lazy" />
                )}
                <span className="result-name">{item.name}</span>
                <a href={item.secureUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failures.length ? (
        <div className="upload-results">
          <h2>Failed Files</h2>
          <ul>
            {failures.map((item) => (
              <li key={`${item.name}-${item.reason}`}>
                <span>{item.name}</span>
                <span>{item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
