"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("loading");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Could not sign in.");
      setStatus("idle");
      return;
    }

    router.push("/admin/uploads");
    router.refresh();
  };

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
}
