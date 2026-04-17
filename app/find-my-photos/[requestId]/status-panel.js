"use client";

import { useEffect, useState } from "react";

async function fetchStatus(requestId) {
  const response = await fetch(`/api/find-my-photos/status?requestId=${requestId}`, {
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Unable to fetch request status.");
  }
  return body;
}

export default function StatusPanel({ requestId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const body = await fetchStatus(requestId);
        if (!active) return;
        setData(body);
        setError("");
      } catch (statusError) {
        if (!active) return;
        setError(statusError.message || "Status check failed.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [requestId]);

  if (loading) {
    return <p>Checking request status...</p>;
  }

  if (error) {
    return <p className="admin-error">{error}</p>;
  }

  if (data?.status === "ready" && Array.isArray(data.images)) {
    return (
      <div className="upload-results">
        <h2>Your Matched Photos</h2>
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
    );
  }

  if (data?.status === "not_found") {
    return (
      <div>
        <p>We could not find this request yet.</p>
        <p className="feature-note">Please verify the link or submit a new selfie request.</p>
      </div>
    );
  }

  return (
    <div>
      <p>{data?.message || "Your request is being processed."}</p>
      <p className="feature-note">This page refreshes automatically every few seconds.</p>
    </div>
  );
}
