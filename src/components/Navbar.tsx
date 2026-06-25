import { Link } from 'react-router-dom';

const navLinks = [
  { name: 'Pricing', path: '/pricing' },
  { name: 'About', path: '/faq' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <nav className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#fbf9f4]/95 shadow-[0_10px_30px_rgba(11,31,54,0.08)] backdrop-blur-xl">
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
            <Link
              to="/apply"
              className="focus-ring-light inline-flex min-h-11 items-center justify-center rounded-full bg-brand-navy px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-brand-navy-light"
            >
              Apply Now
            </Link>
          </div>
        </div>

        <div className="public-mobile-links w-full max-w-[320px] gap-2 border-t border-slate-100 pb-4 pt-4">
          <Link
            to="/"
            className="focus-ring-light rounded-2xl bg-slate-50 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-700 hover:text-brand-navy"
          >
            Home
          </Link>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className="focus-ring-light rounded-2xl bg-slate-50 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-700 hover:text-brand-navy"
            >
              {link.name}
            </Link>
          ))}
          <Link
            to="/apply"
            className="focus-ring-light rounded-2xl bg-brand-navy px-3 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white"
          >
            Apply Now
          </Link>
        </div>
      </div>
      </nav>
    </>
  );
}
