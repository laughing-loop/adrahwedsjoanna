import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canUpload, readSessionFromCookieStore } from "../../../lib/auth";
import UploadManager from "./upload-manager";

export const metadata = {
  title: "Media Uploads | Joanna & Innocent Wedding"
};

export default function UploadsPage() {
  const session = readSessionFromCookieStore(cookies());
  if (!session) {
    redirect("/admin/login");
  }

  if (!canUpload(session.role)) {
    return (
      <main className="admin-shell">
        <section className="admin-card">
          <h1>Access Restricted</h1>
          <p>Your account does not have upload privileges.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-card">
        <h1>Media Uploads</h1>
        <p>
          Signed uploads go directly to Cloudinary, optimized for fast delivery on the wedding
          site.
        </p>
        <UploadManager user={session} />
      </section>
    </main>
  );
}
