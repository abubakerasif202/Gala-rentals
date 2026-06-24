import { Mail, MapPin, Phone, Clock3, Send } from 'lucide-react';
import Seo from '../components/Seo';
import { submitInquiry } from '../lib/api';
import { useState, type FormEvent } from 'react';
import { featuredRentalImages } from '../lib/genericRentalImages';

const inputClass =
  'focus-ring-dark rounded-2xl border border-white/10 bg-brand-navy px-5 py-4 text-white outline-none transition-colors placeholder:text-brand-grey/60 focus:border-brand-gold';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey';

export default function Contact() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    const formData = new FormData(event.currentTarget);
    try {
      await submitInquiry({
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        startDate: String(formData.get('startDate') || '').trim(),
        endDate: String(formData.get('endDate') || '').trim(),
        message: String(formData.get('message') || '').trim(),
      });
      setMessage('');
      setStatus('sent');
      event.currentTarget.reset();
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-brand-navy text-white">
      <Seo
        title="Contact | Gala Rentals"
        description="Contact Gala Rentals for rental questions, application support, or subscription onboarding help."
        canonicalPath="/contact"
      />

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold">Contact</p>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
              Reach the team directly.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-300">
              Gala Rentals keeps enquiries simple: ask about rental terms, start dates,
              subscription billing, or application support.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Phone, title: 'Phone', body: '1300 555 828', href: 'tel:1300555828' },
                { icon: Mail, title: 'Email', body: 'hello@gala-rentals.com.au', href: 'mailto:hello@gala-rentals.com.au' },
                { icon: Clock3, title: 'Business hours', body: 'Mon-Fri, 8:30am to 5:30pm AEST' },
                { icon: MapPin, title: 'Service area', body: 'Sydney metro and surrounding suburbs' },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">{item.title}</p>
                    {item.href ? (
                      <a href={item.href} className="focus-ring-dark rounded text-sm text-white transition-colors hover:text-brand-gold">
                        {item.body}
                      </a>
                    ) : (
                      <p className="text-sm text-white">{item.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
              <img
                src={featuredRentalImages[1]}
                alt="Rental application support"
                className="aspect-[16/9] w-full rounded-[1.1rem] object-cover"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold">Message</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Send an enquiry</h2>

            <div className="mt-8 grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="contact-name" className={labelClass}>Your name</label>
                <input id="contact-name" name="name" required autoComplete="name" placeholder="Your name" className={inputClass} />
              </div>
              <div className="grid gap-2">
                <label htmlFor="contact-email" className={labelClass}>Email address</label>
                <input id="contact-email" name="email" type="email" required autoComplete="email" placeholder="Email address" className={inputClass} />
              </div>
              <div className="grid gap-2">
                <label htmlFor="contact-phone" className={labelClass}>Phone number</label>
                <input id="contact-phone" name="phone" required autoComplete="tel" placeholder="Phone number" className={inputClass} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="contact-start-date" className={labelClass}>Preferred start date</label>
                  <input id="contact-start-date" name="startDate" type="date" required className={`${inputClass} [color-scheme:dark]`} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="contact-end-date" className={labelClass}>Preferred end date</label>
                  <input id="contact-end-date" name="endDate" type="date" required className={`${inputClass} [color-scheme:dark]`} />
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="contact-message" className={labelClass}>Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  placeholder="Tell us what you need help with"
                  className={inputClass}
                />
              </div>
            </div>

            {status === 'sent' && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50" role="status">
                Your message has been sent.
              </div>
            )}
            {status === 'error' && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-50" role="alert">
                We could not send your enquiry. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="focus-ring-dark mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gold px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-brand-navy transition-colors hover:bg-brand-gold-light disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {status === 'sending' ? 'Sending' : 'Send enquiry'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
