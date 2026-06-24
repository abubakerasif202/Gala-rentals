import { Link } from 'react-router-dom';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Apply', path: '/apply' },
  { name: 'FAQ', path: '/faq' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[0_12px_36px_rgba(11,31,54,0.08)] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between md:h-20">
          <div className="flex-1 flex justify-start">
            <Link to="/" className="focus-ring-light flex min-w-0 items-center group" aria-label="Gala Rentals home">
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
                className="focus-ring-light rounded text-[11px] font-bold tracking-[0.2em] uppercase text-slate-600 transition-colors hover:text-brand-navy"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex flex-1 justify-end items-center gap-3">
            <a
              href="tel:1300555828"
              className="focus-ring-light rounded-full border border-brand-gold/40 px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-navy transition-all hover:border-brand-gold hover:bg-brand-gold/10"
            >
              1300 555 828
            </a>
          </div>
        </div>

        <div className="public-mobile-links w-full max-w-[320px] gap-2 border-t border-slate-100 pb-4 pt-4">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="focus-ring-light rounded-2xl bg-slate-50 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-700 hover:text-brand-navy"
            >
              {link.name}
            </Link>
          ))}
              <a
                href="tel:1300555828"
                className="focus-ring-light rounded-2xl border border-brand-gold/40 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-brand-navy"
              >
                1300 555 828
              </a>
        </div>
      </div>
    </nav>
  );
}
