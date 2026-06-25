export function DetailCard({ title, status, children }) {
  return (
    <section className="gr-detail-card">
      <header>
        <div>
          <p className="gr-eyebrow">Application Detail</p>
          <h3>{title}</h3>
        </div>
        {status}
      </header>
      <div className="gr-detail-card-body">{children}</div>
    </section>
  );
}
