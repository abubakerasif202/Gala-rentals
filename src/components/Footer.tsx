import { Link } from 'react-router-dom';
import { Brush, Mail, MapPin, Phone } from 'lucide-react';

const quickLinks = [
  { label: 'Home', path: '/' },
  { label: 'Services', path: '/#services' },
  { label: 'About', path: '/#about' },
  { label: 'Request a Quote', path: '/#quote' },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-brand-navy text-gray-400 py-20 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          <div>
            <Link to="/" className="mb-8 flex items-center gap-3 group">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-brand-gold">
                <Brush className="h-6 w-6" />
              </span>
              <span className="leading-none">
                <span className="block text-lg font-serif font-bold text-white tracking-wide">Maple</span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">Painting</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed font-light">
              Residential painting, commercial painting, interior painting, exterior painting,
              repainting, and property painting services across Sydney.
            </p>
            <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-gray-600 font-light max-w-sm">
              Service areas: Merrylands, Parramatta, Lidcombe, and Greater Sydney
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-8">Painting Links</h3>
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
                <a href="tel:0420550556" className="text-sm hover:text-brand-gold transition-colors font-light tracking-wider">0420 550 556</a>
              </li>
              <li className="flex items-center gap-4">
                <Mail className="h-4 w-4 text-brand-gold" />
                <a href="mailto:hello@maplerentals.com.au" className="text-sm hover:text-brand-gold transition-colors font-light">hello@maplerentals.com.au</a>
              </li>
              <li className="flex items-start gap-4">
                <MapPin className="h-4 w-4 text-brand-gold mt-0.5" />
                <span className="text-sm font-light leading-relaxed">
                  13/27-33 Addlestone Rd
                  <br />
                  Merrylands NSW 2160
                </span>
              </li>
              <li className="text-xs text-gray-600 mt-8 space-y-2 font-light">
                <p>Sarfaraz Rajabi</p>
                <p>Licence No: 317786C</p>
                <p>ABN No: 16623061941</p>
                <p>ACN No: 623061941</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-20 pt-8 text-center text-xs text-gray-600 uppercase tracking-widest font-light">
          <span>&copy; {new Date().getFullYear()} Maple Painting. All rights reserved.</span>
          <Link
            to="/admin/login"
            className="ml-0 mt-4 block text-[10px] text-gray-600 transition-colors hover:text-brand-gold sm:ml-4 sm:mt-0 sm:inline"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
