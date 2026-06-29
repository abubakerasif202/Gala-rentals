import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  TrendingUp,
  DollarSign,
  LogOut,
  FileText,
  ScrollText,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  handleLogout,
  isOpen,
  onClose,
}: SidebarProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
    { id: 'applications', icon: Users, label: 'Applications' },
    { id: 'rentals', icon: Calendar, label: 'Rentals' },
    { id: 'customers', icon: Users, label: 'Customers' },
    { id: 'invoices', icon: DollarSign, label: 'Invoices' },
    { id: 'financials', icon: TrendingUp, label: 'Financials' },
    { id: 'agreements', icon: FileText, label: 'Agreements' },
    { id: 'toll-notices', icon: ScrollText, label: 'Toll Notices' },
    { id: 'maintenance', icon: Settings, label: 'Maintenance' },
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    drawerRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-brand-navy/70 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        ref={drawerRef}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-label={isOpen ? 'Admin navigation menu' : undefined}
        tabIndex={isOpen ? -1 : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 bg-[#061425] shadow-[24px_0_80px_rgba(0,0,0,0.24)] transition-transform duration-300 lg:z-20 lg:max-w-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6 lg:p-8">
          <Link to="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-brand-navy" />
            </div>
            <div>
              <h1 className="text-white font-bold tracking-tighter leading-none">GALA</h1>
              <p className="text-[8px] text-brand-gold font-bold tracking-[0.3em] uppercase">Rentals Admin</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-brand-grey transition-all hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="admin-sidebar-nav flex-1 space-y-2 overflow-y-auto p-4 [scrollbar-color:rgba(223,177,37,0.55)_rgba(255,255,255,0.06)] [scrollbar-width:thin] lg:p-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              className={`w-full rounded-2xl px-5 py-4 text-left text-sm font-bold uppercase tracking-widest transition-all ${
                activeTab === item.id
                  ? 'bg-brand-gold text-brand-navy shadow-lg shadow-brand-gold/10'
                  : 'text-brand-grey hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-4">
                <item.icon className="w-5 h-5" />
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <style>{`
          .admin-sidebar-nav::-webkit-scrollbar {
            width: 10px;
          }

          .admin-sidebar-nav::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }

          .admin-sidebar-nav::-webkit-scrollbar-thumb {
            background: rgba(223, 177, 37, 0.55);
            border: 2px solid #061425;
            border-radius: 999px;
          }

          .admin-sidebar-nav::-webkit-scrollbar-thumb:hover {
            background: rgba(223, 177, 37, 0.78);
          }
        `}</style>

        <div className="border-t border-white/10 p-4 lg:p-6">
          <button
            onClick={handleLogout}
            className="w-full rounded-2xl px-5 py-4 text-left text-sm font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500/10"
          >
            <span className="flex items-center gap-4">
              <LogOut className="w-5 h-5" />
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
