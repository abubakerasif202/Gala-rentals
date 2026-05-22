import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Seo from './components/Seo';

const Home = lazy(() => import('./pages/Home'));
const Success = lazy(() => import('./pages/Success'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Apply = lazy(() => import('./pages/Apply'));
const Checkout = lazy(() => import('./pages/Checkout'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboardRoute'));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function NoIndexRedirect({ to = '/' }: { to?: string }) {
  return (
    <>
      <Seo
        title="Private Page | Maple Painting"
        description="This page is not part of the public Maple Painting website."
        canonicalPath="/"
        robots="noindex,nofollow"
      />
      <Navigate to={to} replace />
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col bg-brand-navy">
      {!isAdminRoute && <Navbar />}
      <main className="flex-grow">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-brand-navy text-white font-serif italic uppercase tracking-widest text-sm">
              Loading Experience...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pricing" element={<NoIndexRedirect />} />
            <Route path="/cars" element={<NoIndexRedirect />} />
            <Route path="/cars/:id" element={<NoIndexRedirect />} />
            <Route path="/checkout" element={<NoIndexRedirect />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/success" element={<Success />} />
            <Route path="/admin" element={<NoIndexRedirect to="/admin/login" />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/agreements" element={<AdminDashboard />} />
            <Route path="/admin/toll-notices" element={<AdminDashboard />} />
            <Route path="/admin/*" element={<NoIndexRedirect to="/admin/login" />} />
            <Route path="/application" element={<NoIndexRedirect />} />
            <Route path="/applications/*" element={<NoIndexRedirect />} />
            <Route path="/driver/*" element={<NoIndexRedirect />} />
            <Route path="/rental/*" element={<NoIndexRedirect />} />
            <Route path="/agreement*" element={<NoIndexRedirect />} />
            <Route path="/toll*" element={<NoIndexRedirect />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppShell />
      </Router>
    </QueryClientProvider>
  );
}
