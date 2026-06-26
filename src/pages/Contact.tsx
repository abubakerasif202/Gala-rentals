import { Mail, MapPin, Phone, Clock3, Send } from 'lucide-react';
import Seo from '../components/Seo';
import { submitInquiry } from '../lib/api';
import { useState, type FormEvent } from 'react';
import { featuredRentalImages } from '../lib/genericRentalImages';

const inputClass =
  'focus-ring-light rounded-2xl border border-stone-200 bg-white px-5 py-4 text-brand-navy outline-none transition-colors placeholder:text-slate-400 focus:border-brand-gold';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500';

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
    <div className="min-h-screen bg-[#e9edf2] text-brand-navy">
      <Seo
        title="Contact | Galarentals"
        description="Contact Galarentals for rental questions, application support, or subscription onboarding help."
        canonicalPath="/contact"
      />

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold-dark">Contact</p>
            <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight sm:text-6xl">
              Reach the team directly.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Galarentals keeps enquiries simple: ask about rental terms, start dates,
              subscription billing, or application support.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Phone, title: 'Phone', body: '+61415228557', href: 'tel:+61415228557' },
                { icon: Mail, title: 'Email', body: 'admin@galarentals.com.au', href: 'mailto:admin@galarentals.com.au' },
                { icon: Clock3, title: 'Business hours', body: 'Mon-Fri, 8:30am to 5:30pm AEST' },
                { icon: MapPin, title: 'Service area', body: 'Sydney metro and surrounding suburbs' },
              ].map((item) => (
                <div key={item.title} className="ambient-shadow flex items-center gap-4 rounded-2xl border border-stone-200 bg-[#fbf9f4] px-5 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold">{item.title}</p>
                    {item.href ? (
                      <a href={item.href} className="focus-ring-light rounded text-sm text-brand-navy transition-colors hover:text-brand-gold-dark">
                        {item.body}
                      </a>
                    ) : (
                      <p className="text-sm text-brand-navy">{item.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="ambient-shadow mt-6 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-[#fbf9f4] p-2">
              <img
                src={featuredRentalImages[1]}
                alt="Premium silver rental sedan ready for customer handover"
                className="aspect-[16/9] w-full rounded-[1.1rem] object-cover"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="ambient-shadow rounded-[2rem] border border-stone-200 bg-[#fbf9f4] p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-brand-gold-dark">Message</p>
            <h2 className="mt-4 text-3xl font-semibold text-brand-navy">Send an enquiry</h2>

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
                  <input id="contact-start-date" name="startDate" type="date" required className={inputClass} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="contact-end-date" className={labelClass}>Preferred end date</label>
                  <input id="contact-end-date" name="endDate" type="date" required className={inputClass} />
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
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700" role="alert">
                We could not send your enquiry. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="focus-ring-light mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-7 py-4 text-xs font-bold uppercase tracking-[0.24em] text-white transition-colors hover:bg-brand-navy-light disabled:opacity-60"
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
