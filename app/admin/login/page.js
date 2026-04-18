import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionFromCookieStore } from "../../../lib/auth";
import LoginForm from "./login-form";

export const metadata = {
  title: "Admin Login | Joanna & Innocent Wedding"
};

export default function AdminLoginPage() {
  const session = readSessionFromCookieStore(cookies());
  if (session) {
    redirect("/admin/uploads");
  }

  return (
    <main className="admin-shell">
      <section className="admin-card">
        <h1>Authorized Upload Portal</h1>
        <p>For photographers, couple, and approved media managers only.</p>
        <LoginForm />
      </section>
    </main>
  );
}
