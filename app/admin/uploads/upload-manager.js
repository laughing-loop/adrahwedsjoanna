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
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [failures, setFailures] = useState([]);
  const [jobMessage, setJobMessage] = useState("");

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [items]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const runMatcherNow = async () => {
    setError("");
    setJobMessage("");
    setMatchingBusy(true);
    try {
      const response = await fetch("/api/find-my-photos/run", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Could not run matcher.");
      }

      const processedCount = body.processedCount || 0;
      const failedCount = body.failedCount || 0;
      if (failedCount > 0) {
        setJobMessage(
          `Matcher finished with issues. Processed ${processedCount} request(s), failed ${failedCount}.`
        );
      } else {
        setJobMessage(`Matcher complete. Processed ${processedCount} request(s).`);
      }
    } catch (runError) {
      setError(runError.message || "Matcher failed.");
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
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
            throw new Error(providerMessage);
          }

          uploadedItems.push({
            name: file.name,
            secureUrl: uploadBody.secure_url,
            thumbUrl: toCloudinaryThumb(uploadBody.secure_url, uploadBody.resource_type),
            resourceType: uploadBody.resource_type || resourceType
          });
        } catch (fileError) {
          failedItems.push({
            name: file.name,
            reason: fileError.message || "Upload failed."
          });
        }
      }

      setResults(uploadedItems);
      setFailures(failedItems);
      submitItems.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setItems([]);
      if (failedItems.length && !uploadedItems.length) {
        setError("No files were uploaded. See details below.");
      }
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="uploader-wrap">
      <div className="uploader-meta">
        <p>
          Signed in as <strong>{user.name || user.email}</strong> ({user.role})
        </p>
        <div className="uploader-actions">
          <button type="button" className="ghost-btn" onClick={runMatcherNow} disabled={matchingBusy}>
            {matchingBusy ? "Running Matcher..." : "Run Matcher Now"}
          </button>
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
      {jobMessage ? <p className="feature-note">{jobMessage}</p> : null}

      <form className="admin-form" onSubmit={handleUpload}>
        <label>
          Select images or videos
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files || []);
              setItems((currentItems) => {
                currentItems.forEach((entry) => {
                  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
                });
                return nextFiles.map((file, index) => ({
                  id: `${file.name}-${file.lastModified}-${index}`,
                  file,
                  resourceType: inferResourceType(file),
                  previewUrl: URL.createObjectURL(file)
                }));
              });
            }}
          />
        </label>
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
              </figure>
            ))}
          </div>
        ) : null}
        {error ? <p className="admin-error">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Uploading..." : "Upload to Cloudinary"}
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
