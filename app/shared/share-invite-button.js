"use client";

import { useState } from "react";

export default function ShareInviteButton() {
  const [label, setLabel] = useState("Share Invitation");

  const handleShare = async () => {
    const payload = {
      title: "Joanna & Innocent Wedding Invitation",
      text: "Join us on 30 May 2026 at 1:00 PM.",
      url: window.location.href
    };

    if (navigator.share) {
      await navigator.share(payload);
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    setLabel("Link Copied");
    window.setTimeout(() => setLabel("Share Invitation"), 2000);
  };

  return (
    <button type="button" className="share-link" onClick={handleShare}>
      {label}
    </button>
  );
}
