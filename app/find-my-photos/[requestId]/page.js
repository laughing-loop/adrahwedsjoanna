import StatusPanel from "./status-panel";

export const metadata = {
  title: "Find My Photos Status | Joanna & Innocent Wedding"
};

export default function FindMyPhotosStatusPage({ params }) {
  return (
    <main className="admin-shell">
      <section className="admin-card wizard-card">
        <div className="wizard-intro">
          <h1>Find My Photos Status</h1>
          <p className="feature-note">
            Request ID: <strong>{params.requestId}</strong>
          </p>
          <p className="feature-note">
            Keep this page open. It refreshes automatically and shows results as soon as matching
            completes.
          </p>
        </div>
        <StatusPanel requestId={params.requestId} />
      </section>
    </main>
  );
}
