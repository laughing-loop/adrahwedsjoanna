import StatusPanel from "./status-panel";

export const metadata = {
  title: "Find My Photos Status | Joanna & Innocent Wedding"
};

export default function FindMyPhotosStatusPage({ params }) {
  return (
    <main className="admin-shell">
      <section className="admin-card">
        <h1>Find My Photos Status</h1>
        <p>Request ID: {params.requestId}</p>
        <StatusPanel requestId={params.requestId} />
      </section>
    </main>
  );
}
