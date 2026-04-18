import RequestForm from "./request-form";

export const metadata = {
  title: "Find My Photos | Joanna & Innocent Wedding"
};

export default function FindMyPhotosPage() {
  return (
    <main className="admin-shell">
      <section className="admin-card wizard-card">
        <div className="wizard-intro">
          <h1>Find My Photos</h1>
          <p>
            Upload one selfie so we can locate your photos from the wedding collection. Your
            request is private and visible only to your shared result link.
          </p>
        </div>
        <ol className="wizard-steps-list">
          <li>
            <strong>1. Share your details</strong>
            <span>Add your name and email so we can tag this request.</span>
          </li>
          <li>
            <strong>2. Upload one selfie</strong>
            <span>Use a clear face photo for better matching accuracy.</span>
          </li>
          <li>
            <strong>3. Check status</strong>
            <span>Keep your status page open until your matched photos appear.</span>
          </li>
        </ol>
        <RequestForm />
      </section>
    </main>
  );
}
