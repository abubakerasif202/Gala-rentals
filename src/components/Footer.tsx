import { Link } from 'react-router-dom';
import { Mail20Regular, Location20Regular, Phone20Regular } from '@fluentui/react-icons';
import { companyDetails, formatCompanyAddress } from '../../shared/companyDetails';
import { publicContactEmail, publicContactMailto } from '../../shared/contactConfig';
import ABDeveloperCredit from './ABDeveloperCredit';

// inline-flex + min-h keeps the hit area at the WCAG 2.5.8 minimum of 24px
// without changing the visible type scale or list spacing.
const footerLinkClass =
  'focus-ring-dark inline-flex min-h-[24px] items-center rounded text-sm font-light transition-colors hover:text-brand-gold';

const quickLinks = [
  { label: 'Apply Now', path: '/apply' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'About', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

export default function Footer() {
  return (
    <footer id="contact" className="public-footer mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-14 py-16 md:grid-cols-4">
          <div>
            <Link to="/" className="focus-ring-dark mb-8 flex w-fit items-center group" aria-label="Galarentals home">
              <img
                src="/logo/gala-logo-footer.png"
                alt="Galarentals logo"
                className="h-14 w-auto max-w-[172px] object-contain sm:h-16 sm:max-w-[210px]"
                loading="lazy"
              />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-slate-400">
              Premium weekly car rentals for Sydney drivers who want clear pricing, approved quotes,
              and a polished handover process.
            </p>
            <p className="mt-5 max-w-sm text-[11px] font-light uppercase tracking-[0.2em] text-slate-500">
              Sydney based support. Application-first approval. Secure subscription checkout.
            </p>
            <p className="mt-6 text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Galarentals Sydney. All rights reserved.
            </p>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-bold uppercase tracking-widest text-white">Quick Links</h3>
            <ul className="space-y-5">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className={footerLinkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-bold uppercase tracking-widest text-white">Company</h3>
            <ul className="space-y-5">
              <li>
                <Link to="/pricing" className={footerLinkClass}>
                  Weekly rental plans
                </Link>
              </li>
              <li>
                <Link to="/faq" className={footerLinkClass}>
                  How approval works
                </Link>
              </li>
              <li>
                <Link to="/contact" className={footerLinkClass}>
                  Sydney support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-bold uppercase tracking-widest text-white">Contact</h3>
            <ul className="space-y-5">
              {companyDetails.phone && (
                <li className="flex items-center gap-4">
                  <Phone20Regular className="text-brand-gold" aria-hidden="true" />
                  <a href={`tel:${companyDetails.phone}`} className={`${footerLinkClass} tracking-wider`}>{companyDetails.phone}</a>
                </li>
              )}
              <li className="flex items-center gap-4">
                <Mail20Regular className="text-brand-gold" aria-hidden="true" />
                <a href={publicContactMailto} className={footerLinkClass}>{publicContactEmail}</a>
              </li>
              <li className="flex items-start gap-4">
                <Location20Regular className="mt-0.5 text-brand-gold" aria-hidden="true" />
                <span className="text-sm font-light leading-relaxed">
                  {formatCompanyAddress() || 'NSW, Australia'}
                </span>
              </li>
              <li className="mt-8 space-y-2 text-xs font-light text-gray-600">
                <p>Premium rental operations</p>
                <p>Business details are supplied in approved customer paperwork.</p>
              </li>
            </ul>
          </div>
        </div>
        <div className="developer-credit-boundary">
          <ABDeveloperCredit />
        </div>
      </div>
    </footer>
  );
}
