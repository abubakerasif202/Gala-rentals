const AB_STUDIO_URL = 'https://www.abwebstudio.com.au/';

export default function ABDeveloperCredit() {
  return (
    <div className="developer-credit">
      <span className="developer-credit__label">Designed &amp; Developed by</span>
      <a
        href={AB_STUDIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="developer-credit__link focus-ring-dark"
        aria-label="Visit AB Digital Solutions"
      >
        <img
          src="/branding/ab-digital-solutions-watermark.webp"
          alt="AB Digital Solutions"
          width="672"
          height="309"
          className="developer-credit__logo"
        />
        <span className="developer-credit__arrow" aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
