import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';

const quickLinks = [
  { label: 'Home', path: '/' },
  { label: 'Fleet', path: '/fleet' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Apply', path: '/apply' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
  { label: 'Admin Login', path: '/admin/login' },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-brand-charcoal text-gray-400 py-20 border-t border-brand-gold/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          <div>
            <Link to="/" className="mb-8 flex w-fit items-center group" aria-label="Gala Rentals home">
              <img
                src="/logo/gala-logo-footer.png"
                alt="Gala Rentals logo"
                className="h-14 w-auto max-w-[172px] object-contain sm:h-16 sm:max-w-[210px]"
                loading="lazy"
              />
            </Link>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed font-light">
              Premium car rental and subscription programs for Australian drivers who want clean approvals,
              clear pricing, and a polished handover process.
            </p>
            <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-slate-500 font-light max-w-sm">
              Service areas: Sydney, Parramatta, Liverpool, Blacktown, and the greater metro area
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-8">Rental Links</h3>
            <ul className="space-y-5">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-sm hover:text-brand-gold transition-colors font-light">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-8">Contact Us</h3>
            <ul className="space-y-5">
              <li className="flex items-center gap-4">
                <Phone className="h-4 w-4 text-brand-gold" />
                <a href="tel:1300555828" className="text-sm hover:text-brand-gold transition-colors font-light tracking-wider">1300 555 828</a>
              </li>
              <li className="flex items-center gap-4">
                <Mail className="h-4 w-4 text-brand-gold" />
                <a href="mailto:hello@gala-rentals.com.au" className="text-sm hover:text-brand-gold transition-colors font-light">hello@gala-rentals.com.au</a>
              </li>
              <li className="flex items-start gap-4">
                <MapPin className="h-4 w-4 text-brand-gold mt-0.5" />
                <span className="text-sm font-light leading-relaxed">
                  Sydney CBD service hub
                  <br />
                  Australia
                </span>
              </li>
              <li className="text-xs text-gray-600 mt-8 space-y-2 font-light">
                <p>Premium rental operations</p>
                <p>ABN and licence details supplied in customer paperwork</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-20 pt-8 text-center text-xs text-slate-500 uppercase tracking-widest font-light">
          &copy; {new Date().getFullYear()} Gala Rentals. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
