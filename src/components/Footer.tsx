import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';

const quickLinks = [
  { label: 'Fleet Guide', path: '/apply' },
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
            <h3 className="mb-8 text-xs font-bold uppercase tracking-widest text-white">Fleet</h3>
            <ul className="space-y-5">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="focus-ring-dark rounded text-sm font-light transition-colors hover:text-brand-gold">
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
                <Link to="/pricing" className="focus-ring-dark rounded text-sm font-light transition-colors hover:text-brand-gold">
                  Weekly rental plans
                </Link>
              </li>
              <li>
                <Link to="/faq" className="focus-ring-dark rounded text-sm font-light transition-colors hover:text-brand-gold">
                  How approval works
                </Link>
              </li>
              <li>
                <Link to="/contact" className="focus-ring-dark rounded text-sm font-light transition-colors hover:text-brand-gold">
                  Sydney support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-8 text-xs font-bold uppercase tracking-widest text-white">Contact</h3>
            <ul className="space-y-5">
              <li className="flex items-center gap-4">
                <Phone className="h-4 w-4 text-brand-gold" />
                <a href="tel:+61415228557" className="focus-ring-dark rounded text-sm font-light tracking-wider transition-colors hover:text-brand-gold">+61415228557</a>
              </li>
              <li className="flex items-center gap-4">
                <Mail className="h-4 w-4 text-brand-gold" />
                <a href="mailto:admin@galarentals.com.au" className="focus-ring-dark rounded text-sm font-light transition-colors hover:text-brand-gold">admin@galarentals.com.au</a>
              </li>
              <li className="flex items-start gap-4">
                <MapPin className="h-4 w-4 text-brand-gold mt-0.5" />
                <span className="text-sm font-light leading-relaxed">
                  Sydney CBD service hub
                  <br />
                  Australia
                </span>
              </li>
              <li className="mt-8 space-y-2 text-xs font-light text-gray-600">
                <p>Premium rental operations</p>
                <p>Business details are supplied in approved customer paperwork.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
