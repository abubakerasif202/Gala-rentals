import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Fleet', path: '/fleet' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Apply', path: '/apply' },
  { name: 'FAQ', path: '/faq' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[0_12px_36px_rgba(11,31,54,0.08)] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between md:h-20">
          <div className="flex-1 flex justify-start">
            <Link to="/" className="flex min-w-0 items-center group" onClick={() => setIsOpen(false)} aria-label="Gala Rentals home">
              <img
                src="/logo/gala-logo-navbar.png"
                alt="Gala Rentals logo"
                className="h-10 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[180px]"
              />
            </Link>
          </div>

          <div className="hidden md:flex flex-[2] justify-center items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-600 transition-colors hover:text-brand-navy"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex flex-1 justify-end items-center gap-3">
            <a
              href="tel:1300555828"
              className="rounded-full border border-brand-gold/40 px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-navy transition-all hover:border-brand-gold hover:bg-brand-gold/10"
            >
              1300 555 828
            </a>
          </div>

          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-full border border-slate-200 p-2 text-brand-navy transition-colors hover:border-brand-gold"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-6 py-8 space-y-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 hover:text-brand-navy"
              >
                {link.name}
              </Link>
            ))}
            <div className="space-y-3 border-t border-slate-100 pt-6">
              <Link
                to="/apply"
                onClick={() => setIsOpen(false)}
                className="block rounded-full bg-brand-gold py-3.5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-brand-navy shadow-[0_14px_34px_rgba(185,146,24,0.22)] transition-colors hover:bg-brand-gold-light"
              >
                Apply Now
              </Link>
              <a
                href="tel:1300555828"
                className="block rounded-full border border-brand-gold/40 py-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-brand-navy"
              >
                1300 555 828
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
