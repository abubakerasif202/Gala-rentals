import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Seo from '../components/Seo';
import api from '../lib/api';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/login', { username: username.trim(), password });
      navigate('/admin/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Login failed');
      } else {
        setError('Login failed');
      }
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-brand-mist px-4 py-12 sm:px-6 lg:px-8">
      <Seo
        title="Gala Rentals Admin"
        description="Secure Gala Rentals admin sign-in."
        canonicalPath="/admin/login"
        robots="noindex,nofollow,noarchive"
      />

      <div className="w-full max-w-md space-y-8 rounded-[1.75rem] border border-slate-200 bg-white p-8 ambient-shadow-lg sm:p-10">
        <div>
          <img
            src="/logo/gala-logo-navbar.png"
            alt="Galarentals logo"
            className="mx-auto mb-5 h-14 w-auto max-w-[190px] object-contain"
          />
          <h2 className="text-center text-3xl font-serif font-bold text-brand-navy tracking-tight">Admin Access</h2>
          <p className="mt-2 text-center text-xs text-brand-gold font-bold uppercase tracking-[0.3em]">Galarentals Operations</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-red-500 text-xs text-center font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="sr-only">Admin Email</label>
              <input
                id="admin-username"
                type="email"
                required
                className="focus-ring-light relative block w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-brand-navy placeholder:text-slate-400 transition-colors focus:z-10 focus:border-brand-gold focus:bg-white sm:text-sm"
                placeholder="Email Address"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="sr-only">Password</label>
              <input
                id="admin-password"
                type="password"
                required
                className="focus-ring-light relative block w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-brand-navy placeholder:text-slate-400 transition-colors focus:z-10 focus:border-brand-gold focus:bg-white sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="focus-ring-light group relative flex w-full justify-center rounded-full border border-transparent bg-brand-gold px-4 py-4 text-sm font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light"
          >
            Sign in to Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
