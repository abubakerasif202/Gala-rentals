import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';

const Pricing = lazy(() => import('./pages/Pricing'));
const Cars = lazy(() => import('./pages/Cars'));
const CarDetails = lazy(() => import('./pages/CarDetails'));
const Success = lazy(() => import('./pages/Success'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Apply = lazy(() => import('./pages/Apply'));
const Checkout = lazy(() => import('./pages/Checkout'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboardRoute'));

export default function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-brand-navy">
        <Navbar />
        <main className="flex-grow">
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-brand-navy text-white font-serif italic uppercase tracking-widest text-sm">Loading Experience...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/cars" element={<Cars />} />
              <Route path="/cars/:id" element={<CarDetails />} />
              <Route path="/checkout/:id" element={<Checkout />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/success" element={<Success />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
