import RequestForm from "./request-form";

export const metadata = {
  title: "Find My Photos | Joanna & Innocent Wedding"
};

export default function FindMyPhotosPage() {
  return (
    <main className="admin-shell">
      <section className="admin-card">
        <h1>Find My Photos</h1>
        <p>
          Upload one selfie so we can locate your photos from the wedding collection. Your request
          will be processed privately.
        </p>
        <RequestForm />
      </section>
    </main>
  );
}
