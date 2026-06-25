export function StatusBadge({ status }) {
  const key = String(status || 'Pending').toLowerCase().replace(/\s+/g, '-');
  return <span className={`gr-badge gr-badge-${key}`}>{status}</span>;
}
