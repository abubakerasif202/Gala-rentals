import React, { useDeferredValue, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Clock,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  FileText,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Car,
  Users,
  Mail,
  Phone,
  MapPin,
  BadgeCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import {
  Car as CarType,
  Application,
  Rental,
  DashboardStats,
  AdminDatasetResponse,
  OperationalCustomer,
  OperationalInvoice,
} from '../types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../components/admin/Sidebar';

const OPERATIONAL_PAGE_SIZE = 25;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAddingCar, setIsAddingCar] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [newCar, setNewCar] = useState<Partial<CarType>>({
    name: '',
    model_year: new Date().getFullYear(),
    weekly_price: 0,
    bond: 500,
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=1600&auto=format&fit=crop'
  });

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [openingDocument, setOpeningDocument] = useState<'license_photo' | 'license_back_photo' | null>(null);
  const [applicationApprovalForm, setApplicationApprovalForm] = useState({
    assigned_car_id: '',
    approved_bond: '',
    approved_weekly_price: '',
  });
  
  // Agreement Management State
  const [isGeneratingAgreement, setIsGeneratingAgreement] = useState(false);
  const [selected_agreement_application_id, set_selected_agreement_application_id] = useState<string>('');
  const [selected_agreement_car_id, set_selected_agreement_car_id] = useState<string>('');
  const [agreementContent, setAgreementContent] = useState<string>('');
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [agreementForm, setAgreementForm] = useState({
    renteeName: '',
    vehicleYear: '',
    weeklyRent: '',
    rentalStartDate: new Date().toISOString().split('T')[0],
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const deferredInvoiceSearch = useDeferredValue(invoiceSearch.trim());

  useEffect(() => {
    setCustomerPage(1);
  }, [deferredCustomerSearch]);

  useEffect(() => {
    setInvoicePage(1);
  }, [deferredInvoiceSearch]);

  useEffect(() => {
    if (!selectedApplication) {
      return;
    }

    setApplicationApprovalForm({
      assigned_car_id: selectedApplication.assigned_car_id
        ? String(selectedApplication.assigned_car_id)
        : '',
      approved_bond:
        selectedApplication.approved_bond != null ? String(selectedApplication.approved_bond) : '',
      approved_weekly_price:
        selectedApplication.approved_weekly_price != null
          ? String(selectedApplication.approved_weekly_price)
          : '',
    });
  }, [selectedApplication]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const shouldLoadStats = activeTab === 'dashboard' || activeTab === 'financials';
  const shouldLoadCars = activeTab === 'dashboard' || activeTab === 'cars' || activeTab === 'agreements';
  const shouldLoadApplications =
    activeTab === 'dashboard' || activeTab === 'applications' || activeTab === 'agreements';
  const shouldLoadRentals = activeTab === 'rentals';
  const shouldLoadCustomers = activeTab === 'customers';
  const shouldLoadInvoices = activeTab === 'invoices';
  const shouldLoadWeeklyFinancials = activeTab === 'financials';
  const shouldLoadAgreements = activeTab === 'agreements';

  // Queries
  const statsQuery = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: () => api.fetchStats(),
    enabled: shouldLoadStats,
  });

  const carsQuery = useQuery<CarType[]>({
    queryKey: ['cars'],
    queryFn: () => api.fetchCars(),
    enabled: shouldLoadCars,
  });

  const applicationsQuery = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.fetchApplications(),
    enabled: shouldLoadApplications,
  });

  const rentalsQuery = useQuery<Rental[]>({
    queryKey: ['rentals'],
    queryFn: () => api.fetchRentals(),
    enabled: shouldLoadRentals,
  });

  const customerDatasetQuery = useQuery<AdminDatasetResponse<OperationalCustomer>>({
    queryKey: ['operational-customers', deferredCustomerSearch, customerPage, OPERATIONAL_PAGE_SIZE],
    queryFn: () =>
      api.fetchOperationalCustomers({
        page: customerPage,
        pageSize: OPERATIONAL_PAGE_SIZE,
        search: deferredCustomerSearch,
      }),
    enabled: shouldLoadCustomers,
    placeholderData: (previousData) => previousData,
  });

  const invoiceDatasetQuery = useQuery<AdminDatasetResponse<OperationalInvoice>>({
    queryKey: ['operational-invoices', deferredInvoiceSearch, invoicePage, OPERATIONAL_PAGE_SIZE],
    queryFn: () =>
      api.fetchOperationalInvoices({
        page: invoicePage,
        pageSize: OPERATIONAL_PAGE_SIZE,
        search: deferredInvoiceSearch,
      }),
    enabled: shouldLoadInvoices,
    placeholderData: (previousData) => previousData,
  });

  const weeklyFinancialsQuery = useQuery<api.WeeklyFinancials>({
    queryKey: ['weekly-financials'],
    queryFn: () => api.fetchWeeklyFinancials(),
    enabled: shouldLoadWeeklyFinancials,
  });

  const savedAgreementsQuery = useQuery({
    queryKey: ['agreements'],
    queryFn: () => api.fetchSavedLeaseAgreements(),
    enabled: shouldLoadAgreements,
  });

  // Mutations
  const addCarMutation = useMutation({
    mutationFn: (car: Partial<CarType>) => api.createCar(car),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      setIsAddingCar(false);
      setNewCar({
        name: '',
        model_year: new Date().getFullYear(),
        weekly_price: 0,
        bond: 500,
        status: 'Available',
        image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=1600&auto=format&fit=crop'
      });
      showNotification('Vehicle added successfully', 'success');
    },
    onError: () => showNotification('Failed to add vehicle', 'error'),
  });

  const updateCarMutation = useMutation({
    mutationFn: (car: CarType) => api.updateCar(car.id, car),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      setEditingCar(null);
      showNotification('Vehicle updated successfully', 'success');
    },
    onError: () => showNotification('Failed to update vehicle', 'error'),
  });

  const deleteCarMutation = useMutation({
    mutationFn: (id: number) => api.deleteCar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      showNotification('Vehicle deleted successfully', 'success');
    },
    onError: () => showNotification('Failed to delete vehicle', 'error'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => api.updateApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showNotification('Application status updated', 'success');
    },
    onError: () => showNotification('Failed to update status', 'error'),
  });

  const saveAgreementMutation = useMutation({
    mutationFn: (payload: { application_id: number; car_id: number; content: string }) => api.saveLeaseAgreement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
      setIsAgreementModalOpen(false);
      showNotification('Agreement saved successfully', 'success');
    },
    onError: () => showNotification('Failed to save agreement', 'error'),
  });

  const approveApplicationPaymentMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        approved_bond: number;
        approved_weekly_price: number;
        assigned_car_id: number;
        send_payment_link?: boolean;
      };
    }) => api.approveApplicationForPayment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
    },
  });

  const generateCheckoutLinkMutation = useMutation({
    mutationFn: (payload: { application_id: number }) =>
      api.createVehicleCheckoutLink(payload),
  });

  const deleteAgreementMutation = useMutation({
    mutationFn: (id: number) => api.deleteSavedLeaseAgreement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
      showNotification('Agreement deleted successfully', 'success');
    },
    onError: () => showNotification('Failed to delete agreement', 'error'),
  });

  const handleLogout = async () => {
    try {
      await api.logoutAdmin();
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const handleGenerateAgreement = async () => {
    const application_id = Number(selected_agreement_application_id);
    const car_id = Number(selected_agreement_car_id);
    
    if (!application_id || !car_id) {
      showNotification('Please select both an application and a car', 'error');
      return;
    }

    setIsGeneratingAgreement(true);
    try {
      const selectedApplication = applications.find(a => a.id === application_id);
      const selectedCar = cars.find(c => c.id === car_id);

      const payload = {
        agreementDate: new Date().toLocaleDateString('en-AU'),
        renteeName: selectedApplication?.name,
        renteeEmail: selectedApplication?.email,
        renteeContact: selectedApplication?.phone,
        renteeAddress: selectedApplication?.address,
        renteeLicenseNumber: selectedApplication?.license_number,
        vehicleMake: 'Toyota',
        vehicleModel: selectedCar?.name.includes('Camry') ? 'Camry Hybrid' : selectedCar?.name,
        vehicleYear: selectedCar?.model_year.toString(),
        weeklyRent: `$${selectedCar?.weekly_price.toFixed(2)}`,
        rentalStartDate: agreementForm.rentalStartDate,
      };

      const res = await api.renderCarLeaseAgreement(payload);
      setAgreementContent(res.agreement);
      setIsAgreementModalOpen(true);
    } catch (err) {
      showNotification('Failed to generate agreement', 'error');
    } finally {
      setIsGeneratingAgreement(false);
    }
  };

  const handleCopyVehicleCheckoutLink = async () => {
    const application_id = Number(selected_agreement_application_id);

    if (!application_id) {
      showNotification('Please select an approved application', 'error');
      return;
    }

    try {
      const response = await generateCheckoutLinkMutation.mutateAsync({
        application_id,
      });
      await navigator.clipboard.writeText(response.checkout_url);
      showNotification('Secure payment link copied!', 'success');
    } catch (error: any) {
      showNotification(
        error?.response?.data?.error || 'Failed to generate secure payment link',
        'error'
      );
    }
  };

  const handleApproveSelectedApplication = async () => {
    if (!selectedApplication) {
      return;
    }

    const assignedCarId = Number(applicationApprovalForm.assigned_car_id);
    const approvedBond = Number(applicationApprovalForm.approved_bond);
    const approvedWeeklyPrice = Number(applicationApprovalForm.approved_weekly_price);

    if (!assignedCarId || approvedBond < 0 || approvedWeeklyPrice <= 0) {
      showNotification('Assign a vehicle and enter valid bond and weekly payment amounts.', 'error');
      return;
    }

    try {
      const response = await approveApplicationPaymentMutation.mutateAsync({
        id: selectedApplication.id,
        payload: {
          approved_bond: approvedBond,
          approved_weekly_price: approvedWeeklyPrice,
          assigned_car_id: assignedCarId,
          send_payment_link: true,
        },
      });

      if (!response.email_delivered) {
        await navigator.clipboard.writeText(response.checkout_url);
        showNotification(
          response.email_reason
            ? `Pricing saved. Email not sent; payment link copied instead.`
            : 'Pricing saved and payment link copied.',
          'success'
        );
      } else {
        showNotification('Application approved and payment link emailed.', 'success');
      }

      setSelectedApplication(null);
    } catch (error: any) {
      showNotification(
        error?.response?.data?.error || 'Failed to approve application for payment',
        'error'
      );
    }
  };

  const handleOpenApplicationDocument = async (
    document: 'license_photo' | 'license_back_photo'
  ) => {
    if (!selectedApplication) {
      return;
    }

    setOpeningDocument(document);

    try {
      const response = await api.fetchApplicationDocumentUrl(selectedApplication.id, document);
      window.open(response.url, '_blank', 'noopener,noreferrer');
    } catch {
      showNotification('Failed to open the latest signed document link', 'error');
    } finally {
      setOpeningDocument(null);
    }
  };

  const stats = statsQuery.data;
  const cars = carsQuery.data || [];
  const applications = applicationsQuery.data || [];
  const rentals = rentalsQuery.data || [];
  const customerDataset = customerDatasetQuery.data;
  const invoiceDataset = invoiceDatasetQuery.data;
  const weeklyFinancials = weeklyFinancialsQuery.data;
  const savedAgreements = savedAgreementsQuery.data || [];
  const isLoadingCustomerDataset = shouldLoadCustomers && customerDatasetQuery.isPending && !customerDataset;
  const isLoadingInvoiceDataset = shouldLoadInvoices && invoiceDatasetQuery.isPending && !invoiceDataset;
  const isLoadingWeeklyFinancials =
    shouldLoadWeeklyFinancials && weeklyFinancialsQuery.isPending && !weeklyFinancials;
  const approvedApplications = applications.filter(app => app.status === 'Approved' || app.status === 'Paid');
  const selectedAgreementApplication = applications.find(
    (app) => app.id === Number(selected_agreement_application_id)
  );
  const selectedApplicationAssignedCar = cars.find(
    (car) =>
      car.id ===
      Number(applicationApprovalForm.assigned_car_id || selectedApplication?.assigned_car_id || 0)
  );
  const canCopyVehicleCheckoutLink =
    Boolean(selectedAgreementApplication) &&
    selectedAgreementApplication?.status === 'Approved' &&
    Boolean(selectedAgreementApplication?.assigned_car_id);
  const formatCurrency = (value?: number | string | null) => `$${Number(value ?? 0).toFixed(2)}`;
  const formatDate = (value?: string | null) => {
    if (!value) {
      return 'N/A';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString();
  };
  const customerRecords = customerDataset?.items || [];
  const invoiceRecords = invoiceDataset?.items || [];
  const customerHistoryAvailable = customerDataset ? customerDataset.available !== false : true;
  const invoiceHistoryAvailable = invoiceDataset ? invoiceDataset.available !== false : true;
  const operationalHistoryMessage =
    customerDataset?.message ||
    invoiceDataset?.message ||
    'Operational history is not installed in this environment yet.';
  const customerTotals = {
    total_billed: customerRecords.reduce((sum, customer) => sum + (Number(customer.total_billed) || 0), 0),
    outstanding_balance: customerRecords.reduce(
      (sum, customer) => sum + (Number(customer.outstanding_balance) || 0),
      0
    ),
  };
  const invoiceTotals = {
    total_amount: invoiceRecords.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0),
    outstanding_balance: invoiceRecords.reduce((sum, invoice) => sum + (Number(invoice.balance) || 0), 0),
    open_count: invoiceRecords.filter((invoice) => invoice.status === 'Open').length,
  };
  const currentCustomerPage = customerDataset?.page || 1;
  const customerTotalPages = customerDataset?.totalPages || 1;
  const customerTotalItems = customerDataset?.totalItems || 0;
  const invoiceCurrentPage = invoiceDataset?.page || 1;
  const invoiceTotalPages = invoiceDataset?.totalPages || 1;
  const invoiceTotalItems = invoiceDataset?.totalItems || 0;
  const renderLoadingPanel = (message: string) => (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-10 flex items-center gap-4 text-sm text-brand-grey">
      <Loader2 className="w-5 h-5 animate-spin text-brand-gold" />
      <span>{message}</span>
    </div>
  );
  const renderOperationalUnavailable = (title: string) => (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-10 space-y-4">
      <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center border border-brand-gold/20">
        <AlertCircle className="w-5 h-5 text-brand-gold" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-brand-grey leading-relaxed">{operationalHistoryMessage}</p>
      </div>
      <div className="bg-brand-navy/60 border border-white/10 rounded-2xl px-5 py-4 text-[11px] text-brand-grey font-light">
        Run <span className="font-mono text-white">npm run migrate:operational-history</span> with
        {' '}<span className="font-mono text-white">SUPABASE_DB_URL</span>, then run
        {' '}<span className="font-mono text-white">powershell -ExecutionPolicy Bypass -File scripts/import-operational-history-from-workbooks.ps1 -Apply</span>.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-navy flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout} 
      />

      {/* Main Content */}
      <div className="flex-1 ml-72 p-12 overflow-y-auto min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Dashboard <span className="text-brand-gold italic">Overview</span></h2>
                  <p className="text-brand-grey font-light">Performance metrics and recent activities.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('financials')}
                    className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    <TrendingUp className="w-4 h-4 text-brand-gold" /> View Detailed Financials
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Total Applications', value: stats?.total_applications || 0, icon: Users, color: 'text-blue-500' },
                  { label: 'Active Rentals', value: stats?.active_rentals || 0, icon: Car, color: 'text-green-500' },
                  { label: 'Weekly Revenue', value: `$${stats?.total_weekly_income || 0}`, icon: DollarSign, color: 'text-brand-gold' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[10px] text-brand-grey font-bold uppercase tracking-[0.2em] mb-4">{stat.label}</p>
                      <div className="flex items-baseline gap-4">
                        <h3 className="text-4xl font-bold text-white tracking-tighter">{stat.value}</h3>
                        <stat.icon className={`w-6 h-6 ${stat.color} opacity-50`} />
                      </div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                      <stat.icon size={120} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                  <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-8 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-brand-gold" /> Pending Applications
                  </h3>
                  <div className="space-y-4">
                    {applications.filter(a => a.status === 'Pending').slice(0, 5).map((app) => (
                      <div key={app.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-gold/10 rounded-full flex items-center justify-center text-brand-gold font-bold text-xs">
                            {app.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{app.name}</p>
                            <p className="text-[10px] text-brand-grey uppercase tracking-widest">{app.uber_status}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveTab('applications')}
                          className="text-brand-gold hover:text-white transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    {applications.filter(a => a.status === 'Pending').length === 0 && (
                      <p className="text-center py-8 text-brand-grey text-xs font-light italic">No pending applications</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                  <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-8 flex items-center gap-3">
                    <Car className="w-4 h-4 text-brand-gold" /> Fleet Availability
                  </h3>
                  <div className="space-y-4">
                    {cars.slice(0, 5).map((car) => (
                      <div key={car.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <img src={car.image} alt="" className="w-12 h-8 object-cover rounded-lg" />
                          <div>
                            <p className="text-sm font-bold text-white">{car.name}</p>
                            <p className="text-[10px] text-brand-grey uppercase tracking-widest">{car.model_year} Model</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
                          car.status === 'Available' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-brand-navy text-brand-grey border-white/10'
                        }`}>
                          {car.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'applications' && (
            <motion.div
              key="applications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Driver <span className="text-brand-gold italic">Applications</span></h2>
                  <p className="text-brand-grey font-light">Manage and review incoming driver requests.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      placeholder="Search drivers..."
                      className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-4 text-sm text-white focus:border-brand-gold outline-none transition-all w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Driver</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Experience</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Status</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Date</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-white/5 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-gold/10 rounded-full flex items-center justify-center text-brand-gold font-bold text-sm">
                              {app.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{app.name}</p>
                              <p className="text-[10px] text-brand-grey">{app.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div>
                            <p className="text-xs text-white">{app.experience}</p>
                            <p className="text-[10px] text-brand-grey uppercase tracking-widest">{app.uber_status}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            app.status === 'Approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            app.status === 'Paid' ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20' :
                            app.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            'bg-brand-navy text-brand-grey border-white/10'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-xs text-brand-grey">
                          {new Date(app.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              className="p-2 bg-white/5 text-brand-grey rounded-lg hover:bg-brand-gold hover:text-brand-navy transition-all"
                              title="Review Application"
                              onClick={() => setSelectedApplication(app)}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'cars' && (
            <motion.div
              key="cars"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Fleet <span className="text-brand-gold italic">Management</span></h2>
                  <p className="text-brand-grey font-light">Control and update your vehicle inventory.</p>
                </div>
                <button 
                  onClick={() => setIsAddingCar(true)}
                  className="bg-brand-gold text-brand-navy px-8 py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-brand-gold-light transition-all shadow-lg flex items-center gap-3"
                >
                  <Plus className="w-4 h-4" /> Add New Vehicle
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {cars.map((car) => (
                  <div key={car.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-brand-gold/30 transition-all duration-500">
                    <div className="aspect-video relative overflow-hidden">
                      <img src={car.image} alt={car.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border ${
                          car.status === 'Available' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-brand-navy/60 text-brand-grey border-white/10'
                        }`}>
                          {car.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-brand-gold transition-colors">{car.name}</h3>
                          <div className="text-xs text-brand-grey mt-1 font-light">{car.model_year} Model</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-brand-grey uppercase tracking-widest mb-1">Weekly</div>
                          <div className="text-sm font-bold text-white">${car.weekly_price}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-6 border-t border-white/5">
                        <button 
                          onClick={() => setEditingCar(car)}
                          className="flex-1 py-3 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-navy hover:border-brand-gold transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this vehicle?')) {
                              deleteCarMutation.mutate(car.id);
                            }
                          }}
                          className="flex-1 py-3 bg-white/5 border border-white/10 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'rentals' && (
            <motion.div
              key="rentals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Active <span className="text-brand-gold italic">Rentals</span></h2>
                  <p className="text-brand-grey font-light">Monitor current driver subscriptions and vehicle usage.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      placeholder="Search rentals..."
                      className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-4 text-sm text-white focus:border-brand-gold outline-none transition-all w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Driver & Vehicle</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Start Date</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Rate</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Status</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rentals.map((rental) => (
                      <tr key={rental.id} className="hover:bg-white/5 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-gold/10 rounded-xl flex items-center justify-center text-brand-gold font-bold text-xs">
                              <Car className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{rental.applicant_name}</p>
                              <p className="text-[10px] text-brand-grey uppercase tracking-widest">{rental.car_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-xs text-brand-grey">
                          {new Date(rental.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-6">
                            <div className="text-sm font-bold text-white">${rental.weekly_price}/wk</div>
                            <div className="text-[8px] text-brand-grey uppercase tracking-widest">Incl. Insurance</div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            rental.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {rental.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button className="p-2 bg-white/5 text-brand-grey rounded-lg hover:bg-brand-gold hover:text-brand-navy transition-all">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'customers' && (
            <motion.div
              key="customers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Legacy <span className="text-brand-gold italic">Customers</span></h2>
                  <p className="text-brand-grey font-light">Private customer records imported from the operational client roster.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="Search customers..."
                      className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-4 text-sm text-white focus:border-brand-gold outline-none transition-all w-72"
                    />
                  </div>
                </div>
              </div>

              {isLoadingCustomerDataset ? (
                renderLoadingPanel('Loading customer history...')
              ) : !customerHistoryAvailable ? (
                renderOperationalUnavailable('Customer history schema is not installed')
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      {
                        label: deferredCustomerSearch ? 'Matching Customers' : 'Imported Customers',
                        value: customerTotalItems,
                        helper: deferredCustomerSearch
                          ? 'Records matching the current search'
                          : 'Rows in the private customer roster',
                        icon: Users,
                      },
                      {
                        label: 'Visible Billed',
                        value: formatCurrency(customerTotals.total_billed),
                        helper: 'Linked invoice value on the current page',
                        icon: DollarSign,
                      },
                      {
                        label: 'Visible Outstanding',
                        value: formatCurrency(customerTotals.outstanding_balance),
                        helper: 'Open balances on the current page',
                        icon: AlertCircle,
                      },
                    ].map((card) => (
                      <div key={card.label} className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div>
                            <p className="text-[10px] text-brand-grey font-bold uppercase tracking-[0.2em] mb-3">{card.label}</p>
                            <h3 className="text-3xl font-bold text-white tracking-tighter">{card.value}</h3>
                          </div>
                          <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center border border-brand-gold/20">
                            <card.icon className="w-5 h-5 text-brand-gold" />
                          </div>
                        </div>
                        <p className="text-xs text-brand-grey font-light">{card.helper}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Customer</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Contact</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Invoice Activity</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Outstanding</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Last Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {customerRecords.map((customer) => (
                          <tr key={customer.id} className="hover:bg-white/5 transition-all">
                            <td className="px-8 py-6">
                              <div>
                                <p className="text-sm font-bold text-white">{customer.full_name}</p>
                                <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                                  {customer.staff_number || customer.external_id || 'Legacy record'}
                                </p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="space-y-1">
                                <p className="text-xs text-white">{customer.email || 'No email on file'}</p>
                                <p className="text-[10px] text-brand-grey">{customer.phone || 'No phone on file'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div>
                                <p className="text-sm font-bold text-white">{customer.invoice_count} invoices</p>
                                <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                                  {formatCurrency(customer.total_billed)} billed
                                </p>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-sm font-bold text-white">
                              {formatCurrency(customer.outstanding_balance)}
                            </td>
                            <td className="px-8 py-6 text-xs text-brand-grey">
                              {formatDate(customer.last_invoice_date)}
                            </td>
                          </tr>
                        ))}
                        {customerRecords.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-8 py-12 text-center text-brand-grey text-xs font-light italic">
                              No customer records matched the current search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 px-8 py-6">
                      <p className="text-[11px] text-brand-grey">
                        Page {currentCustomerPage} of {customerTotalPages}
                        {' '}• {customerTotalItems} records
                        {customerDatasetQuery.isFetching ? ' • Updating...' : ''}
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
                          disabled={currentCustomerPage <= 1 || customerDatasetQuery.isFetching}
                          className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerPage((page) => Math.min(customerTotalPages, page + 1))}
                          disabled={currentCustomerPage >= customerTotalPages || customerDatasetQuery.isFetching}
                          className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'invoices' && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Invoice <span className="text-brand-gold italic">History</span></h2>
                  <p className="text-brand-grey font-light">Imported legacy invoice history for operational review and reconciliation.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-brand-grey absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={invoiceSearch}
                      onChange={(event) => setInvoiceSearch(event.target.value)}
                      placeholder="Search invoices..."
                      className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-4 text-sm text-white focus:border-brand-gold outline-none transition-all w-72"
                    />
                  </div>
                </div>
              </div>

              {isLoadingInvoiceDataset ? (
                renderLoadingPanel('Loading invoice history...')
              ) : !invoiceHistoryAvailable ? (
                renderOperationalUnavailable('Invoice history schema is not installed')
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      {
                        label: deferredInvoiceSearch ? 'Matching Invoices' : 'Imported Invoices',
                        value: invoiceTotalItems,
                        helper: deferredInvoiceSearch
                          ? 'Invoices matching the current search'
                          : 'Rows imported from the workbook export',
                        icon: FileText,
                      },
                      {
                        label: 'Visible Balance',
                        value: formatCurrency(invoiceTotals.outstanding_balance),
                        helper: 'Outstanding balance on the current page',
                        icon: AlertCircle,
                      },
                      {
                        label: 'Open on Page',
                        value: invoiceTotals.open_count,
                        helper: 'Invoices with remaining balance on this page',
                        icon: DollarSign,
                      },
                    ].map((card) => (
                      <div key={card.label} className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div>
                            <p className="text-[10px] text-brand-grey font-bold uppercase tracking-[0.2em] mb-3">{card.label}</p>
                            <h3 className="text-3xl font-bold text-white tracking-tighter">{card.value}</h3>
                          </div>
                          <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center border border-brand-gold/20">
                            <card.icon className="w-5 h-5 text-brand-gold" />
                          </div>
                        </div>
                        <p className="text-xs text-brand-grey font-light">{card.helper}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Invoice</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Customer</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Vehicle</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Amount / Balance</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Invoice Date</th>
                          <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {invoiceRecords.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-white/5 transition-all">
                            <td className="px-8 py-6">
                              <div>
                                <p className="text-sm font-bold text-white">#{invoice.external_invoice_number}</p>
                                <p className="text-[10px] text-brand-grey uppercase tracking-widest">{invoice.due_label || 'No due label'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div>
                                <p className="text-sm font-bold text-white">{invoice.customer_name}</p>
                                <p className="text-[10px] text-brand-grey">{invoice.customer_email || 'No linked email'}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-xs text-brand-grey">
                              {invoice.car_registration || 'N/A'}
                            </td>
                            <td className="px-8 py-6">
                              <div>
                                <p className="text-sm font-bold text-white">{formatCurrency(invoice.amount)}</p>
                                <p className="text-[10px] text-brand-grey uppercase tracking-widest">
                                  Balance {formatCurrency(invoice.balance)}
                                </p>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-xs text-brand-grey">
                              {formatDate(invoice.invoice_date)}
                            </td>
                            <td className="px-8 py-6">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                invoice.status === 'Paid'
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                  : 'bg-brand-gold/10 text-brand-gold border-brand-gold/20'
                              }`}>
                                {invoice.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {invoiceRecords.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-8 py-12 text-center text-brand-grey text-xs font-light italic">
                              No invoice records matched the current search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 px-8 py-6">
                      <p className="text-[11px] text-brand-grey">
                        Page {invoiceCurrentPage} of {invoiceTotalPages}
                        {' '}• {invoiceTotalItems} records
                        {invoiceDatasetQuery.isFetching ? ' • Updating...' : ''}
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setInvoicePage((page) => Math.max(1, page - 1))}
                          disabled={invoiceCurrentPage <= 1 || invoiceDatasetQuery.isFetching}
                          className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoicePage((page) => Math.min(invoiceTotalPages, page + 1))}
                          disabled={invoiceCurrentPage >= invoiceTotalPages || invoiceDatasetQuery.isFetching}
                          className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'financials' && (
            <motion.div
              key="financials"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Weekly <span className="text-brand-gold italic">Financials</span></h2>
                  <p className="text-brand-grey font-light">Projected revenue, payout performance, and recent transfers.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ['weekly-financials'] });
                    void queryClient.invalidateQueries({ queryKey: ['stats'] });
                  }}
                  className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-brand-gold" /> Refresh Data
                </button>
              </div>

              {isLoadingWeeklyFinancials ? (
                renderLoadingPanel('Loading weekly financials...')
              ) : (
                <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                {[
                  {
                    label: 'Projected Gross',
                    value: formatCurrency(weeklyFinancials?.projected_gross_weekly),
                    helper: 'Total billed weekly',
                    icon: DollarSign,
                  },
                  {
                    label: 'Projected Net',
                    value: formatCurrency(weeklyFinancials?.projected_net_weekly),
                    helper: 'After estimated fees',
                    icon: TrendingUp,
                  },
                  {
                    label: 'Platform Fees',
                    value: formatCurrency(weeklyFinancials?.estimated_platform_fees),
                    helper: 'Estimated weekly costs',
                    icon: AlertCircle,
                  },
                  {
                    label: 'Recent Payouts',
                    value: formatCurrency(weeklyFinancials?.actual_payouts_weekly),
                    helper: 'Paid out this week',
                    icon: ShieldCheck,
                  },
                ].map((card) => (
                  <div key={card.label} className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <p className="text-[10px] text-brand-grey font-bold uppercase tracking-[0.2em] mb-3">{card.label}</p>
                        <h3 className="text-3xl font-bold text-white tracking-tighter">{card.value}</h3>
                      </div>
                      <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center border border-brand-gold/20">
                        <card.icon className="w-5 h-5 text-brand-gold" />
                      </div>
                    </div>
                    <p className="text-xs text-brand-grey font-light">{card.helper}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Recent Stripe Payouts</h3>
                    <p className="text-brand-grey text-xs font-light mt-2">Latest payout activity reported by the financials API.</p>
                  </div>
                </div>

                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Payout ID</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Arrival Date</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Amount</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(weeklyFinancials?.recent_payouts || []).map((payout) => (
                      <tr key={payout.id} className="hover:bg-white/5 transition-all">
                        <td className="px-8 py-6 text-xs text-brand-gold font-bold">{payout.id}</td>
                        <td className="px-8 py-6 text-xs text-brand-grey">
                          {new Date(payout.arrival_date).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-6 text-sm text-white font-bold">{formatCurrency(payout.amount)}</td>
                        <td className="px-8 py-6">
                          <span className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-white/5 text-brand-grey border-white/10">
                            {payout.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!weeklyFinancials?.recent_payouts || weeklyFinancials.recent_payouts.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-brand-grey text-xs font-light italic">
                          No payout data available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'agreements' && (
            <motion.div
              key="agreements"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Lease <span className="text-brand-gold italic">Agreements</span></h2>
                  <p className="text-brand-grey font-light">Generate and manage legally binding rental contracts.</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Select Approved Application</label>
                    <select
                      value={selected_agreement_application_id}
                      onChange={(e) => set_selected_agreement_application_id(e.target.value)}
                      className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light appearance-none"
                    >
                      <option value="">Select a driver...</option>
                      {approvedApplications.map(app => (
                        <option key={app.id} value={app.id}>{app.name} ({app.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Select Assigned Vehicle</label>
                    <select
                      value={selected_agreement_car_id}
                      onChange={(e) => set_selected_agreement_car_id(e.target.value)}
                      className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light appearance-none"
                    >
                      <option value="">Select a car...</option>
                      {cars.map(car => (
                        <option key={car.id} value={car.id}>
                          {car.name} ({car.model_year}) - {car.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      disabled={isGeneratingAgreement || !selected_agreement_application_id || !selected_agreement_car_id}
                      onClick={handleGenerateAgreement}
                      className="bg-brand-gold text-brand-navy h-[58px] font-bold uppercase tracking-widest text-[10px] hover:bg-brand-gold-light transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isGeneratingAgreement ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Generate New Agreement
                    </button>
                    <button
                      disabled={!canCopyVehicleCheckoutLink || generateCheckoutLinkMutation.isPending}
                      onClick={handleCopyVehicleCheckoutLink}
                      className="bg-white/5 border border-white/10 text-white h-[58px] font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {generateCheckoutLinkMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 text-brand-gold" />
                      )}
                      Copy Secure Payment Link
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-brand-grey font-light">
                  Secure payment links are signed and time-limited. Approve the application first so the assigned vehicle and pricing are locked before copying a fresh link.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Agreement ID</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Driver & Vehicle</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest">Generated On</th>
                      <th className="px-8 py-6 text-[10px] font-bold text-brand-grey uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {savedAgreements.map((agreement: any) => (
                      <tr key={agreement.id} className="hover:bg-white/5 transition-all group">
                        <td className="px-8 py-6 text-xs text-brand-gold font-bold">
                          #{agreement.id.toString().padStart(6, '0')}
                        </td>
                        <td className="px-8 py-6">
                          <div>
                            <p className="text-sm font-bold text-white">{agreement.applicant_name}</p>
                            <p className="text-[10px] text-brand-grey uppercase tracking-widest">{agreement.car_name}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-xs text-brand-grey">
                          {new Date(agreement.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              className="p-2 bg-white/5 text-brand-grey rounded-lg hover:bg-brand-gold hover:text-brand-navy transition-all"
                              onClick={() => {
                                setAgreementContent(agreement.content);
                                setIsAgreementModalOpen(true);
                              }}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button 
                              className="p-2 bg-white/5 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                              onClick={() => {
                                if (confirm('Delete this agreement?')) {
                                  deleteAgreementMutation.mutate(agreement.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {savedAgreements.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-brand-grey text-xs font-light italic">No agreements generated yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-12 left-1/2 z-50 px-8 py-5 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px] border ${
              notification.type === 'success' ? 'bg-green-500 border-green-400 text-white' : 'bg-red-500 border-red-400 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="text-xs font-bold uppercase tracking-widest">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Review Modal */}
      <AnimatePresence>
        {selectedApplication && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-brand-navy/60">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-brand-navy border border-white/10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Review Application</h3>
                  <p className="text-[10px] text-brand-grey uppercase tracking-widest mt-1">Driver profile and submitted documents</p>
                </div>
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="text-brand-grey hover:text-white p-2 bg-white/5 rounded-full"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Applicant Details</h4>
                    <div className="space-y-4 text-sm">
                      <div className="flex items-center gap-3 text-white"><BadgeCheck className="w-4 h-4 text-brand-gold" /> {selectedApplication.name}</div>
                      <div className="flex items-center gap-3 text-brand-grey"><Mail className="w-4 h-4 text-brand-gold" /> {selectedApplication.email}</div>
                      <div className="flex items-center gap-3 text-brand-grey"><Phone className="w-4 h-4 text-brand-gold" /> {selectedApplication.phone}</div>
                      <div className="flex items-start gap-3 text-brand-grey"><MapPin className="w-4 h-4 text-brand-gold mt-0.5" /> <span>{selectedApplication.address}</span></div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Application Snapshot</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-brand-grey uppercase tracking-widest mb-2">Status</p>
                        <p className="text-white font-bold">{selectedApplication.status}</p>
                      </div>
                      <div>
                        <p className="text-brand-grey uppercase tracking-widest mb-2">Uber Status</p>
                        <p className="text-white font-bold">{selectedApplication.uber_status}</p>
                      </div>
                      <div>
                        <p className="text-brand-grey uppercase tracking-widest mb-2">Experience</p>
                        <p className="text-white font-bold">{selectedApplication.experience}</p>
                      </div>
                      <div>
                        <p className="text-brand-grey uppercase tracking-widest mb-2">Start Date</p>
                        <p className="text-white font-bold">{selectedApplication.intended_start_date}</p>
                      </div>
                      <div>
                        <p className="text-brand-grey uppercase tracking-widest mb-2">License #</p>
                        <p className="text-white font-bold">{selectedApplication.license_number}</p>
                      </div>
                      <div>
                        <p className="text-brand-grey uppercase tracking-widest mb-2">Expiry</p>
                        <p className="text-white font-bold">{selectedApplication.license_expiry}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Licence Front Photo</h4>
                    {selectedApplication.license_photo ? (
                      <button
                        type="button"
                        onClick={() => handleOpenApplicationDocument('license_photo')}
                        disabled={openingDocument !== null}
                        className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-brand-gold text-brand-navy font-bold uppercase tracking-widest text-[10px] hover:bg-brand-gold-light transition-all disabled:opacity-50"
                      >
                        {openingDocument === 'license_photo' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4" />
                        )}
                        Open Licence Front Photo
                      </button>
                    ) : (
                      <div className="px-6 py-4 border border-white/10 rounded-2xl text-brand-grey text-xs font-light">
                        No licence front photo uploaded.
                      </div>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Licence Back Photo</h4>
                    {selectedApplication.license_back_photo ? (
                      <button
                        type="button"
                        onClick={() => handleOpenApplicationDocument('license_back_photo')}
                        disabled={openingDocument !== null}
                        className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all disabled:opacity-50"
                      >
                        {openingDocument === 'license_back_photo' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-brand-gold" />
                        ) : (
                          <ExternalLink className="w-4 h-4 text-brand-gold" />
                        )}
                        Open Licence Back Photo
                      </button>
                    ) : (
                      <div className="px-6 py-4 border border-white/10 rounded-2xl text-brand-grey text-xs font-light">
                        No licence back photo uploaded.
                      </div>
                    )}
                  </div>
                </div>

                {selectedApplication.status !== 'Paid' && selectedApplication.status !== 'Rejected' && (
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                          Approval & Payment Quote
                        </h4>
                        <p className="text-sm text-brand-grey font-light mt-3 max-w-2xl">
                          Assign the vehicle, set the approved bond and weekly payment, then email a fresh secure payment link.
                        </p>
                      </div>
                      {selectedApplication.payment_link_sent_at && (
                        <div className="rounded-2xl border border-white/10 bg-brand-navy/40 px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                            Last payment link sent
                          </p>
                          <p className="text-xs text-white mt-2">
                            {new Date(selectedApplication.payment_link_sent_at).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                          Assigned Vehicle
                        </label>
                        <select
                          value={applicationApprovalForm.assigned_car_id}
                          onChange={(e) => {
                            const nextCarId = e.target.value;
                            const matchedCar = cars.find((car) => car.id === Number(nextCarId));
                            setApplicationApprovalForm((current) => ({
                              assigned_car_id: nextCarId,
                              approved_bond:
                                current.approved_bond || !matchedCar ? current.approved_bond : String(matchedCar.bond),
                              approved_weekly_price:
                                current.approved_weekly_price || !matchedCar
                                  ? current.approved_weekly_price
                                  : String(matchedCar.weekly_price),
                            }));
                          }}
                          className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light appearance-none"
                        >
                          <option value="">Select a car...</option>
                          {cars
                            .filter(
                              (car) =>
                                car.status === 'Available' ||
                                car.id === selectedApplication?.assigned_car_id
                            )
                            .map((car) => (
                              <option key={car.id} value={car.id}>
                                {car.name} ({car.model_year}) - {car.status}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                          Approved Bond (AUD)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={applicationApprovalForm.approved_bond}
                          onChange={(e) =>
                            setApplicationApprovalForm((current) => ({
                              ...current,
                              approved_bond: e.target.value,
                            }))
                          }
                          className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                          Approved Weekly Payment (AUD)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={applicationApprovalForm.approved_weekly_price}
                          onChange={(e) =>
                            setApplicationApprovalForm((current) => ({
                              ...current,
                              approved_weekly_price: e.target.value,
                            }))
                          }
                          className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                        />
                      </div>
                    </div>

                    {selectedApplicationAssignedCar && (
                      <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-5 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                          Approved payment summary
                        </p>
                        <p className="text-sm text-brand-grey font-light leading-relaxed">
                          Vehicle: <span className="text-white font-bold">{selectedApplicationAssignedCar.name}</span>
                          {' '}| Bond:{' '}
                          <span className="text-white font-bold">
                            ${Number(applicationApprovalForm.approved_bond || 0).toFixed(2)}
                          </span>
                          {' '}| Weekly payment:{' '}
                          <span className="text-white font-bold">
                            ${Number(applicationApprovalForm.approved_weekly_price || 0).toFixed(2)}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/10 bg-white/5 flex gap-4">
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="flex-1 py-5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
                >
                  Close
                </button>
                {selectedApplication.status !== 'Paid' && (
                  <button
                    onClick={() =>
                      updateStatusMutation.mutate({ id: selectedApplication.id, status: 'Rejected' })
                    }
                    className="flex-1 py-5 border border-red-500/30 text-red-400 font-bold uppercase tracking-widest text-xs hover:bg-red-500/10 transition-all"
                  >
                    Reject Application
                  </button>
                )}
                {selectedApplication.status !== 'Paid' && selectedApplication.status !== 'Rejected' && (
                  <button
                    onClick={handleApproveSelectedApplication}
                    disabled={approveApplicationPaymentMutation.isPending}
                    className="flex-[2] bg-brand-gold text-brand-navy py-5 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {approveApplicationPaymentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    {selectedApplication.status === 'Approved'
                      ? 'Update Quote & Resend Payment Link'
                      : 'Approve & Send Payment Link'}
                  </button>
                )}
                {selectedApplication.status === 'Paid' && (
                  <button
                    onClick={() => {
                      set_selected_agreement_application_id(selectedApplication.id.toString());
                      setSelectedApplication(null);
                      setActiveTab('agreements');
                    }}
                    className="flex-[2] bg-brand-gold text-brand-navy py-5 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all shadow-lg flex items-center justify-center gap-3"
                  >
                    <FileText className="w-4 h-4" /> Continue to Agreement
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Car Modal */}
      <AnimatePresence>
        {(isAddingCar || editingCar) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-brand-navy/60">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-brand-navy border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                  {editingCar ? 'Edit Vehicle' : 'Add New Vehicle'}
                </h3>
                <button 
                  onClick={() => { setIsAddingCar(false); setEditingCar(null); }}
                  className="p-2 hover:bg-white/5 rounded-full transition-all text-brand-grey hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-12 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Model Name</label>
                    <input 
                      value={editingCar ? editingCar.name : newCar.name}
                      onChange={(e) => editingCar ? setEditingCar({...editingCar, name: e.target.value}) : setNewCar({...newCar, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Weekly Rental (AUD)</label>
                    <input 
                      type="number"
                      value={editingCar ? editingCar.weekly_price : newCar.weekly_price}
                      onChange={(e) => editingCar ? setEditingCar({...editingCar, weekly_price: Number(e.target.value)}) : setNewCar({...newCar, weekly_price: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Model Year</label>
                    <input 
                      type="number"
                      value={editingCar ? editingCar.model_year : newCar.model_year}
                      onChange={(e) => editingCar ? setEditingCar({...editingCar, model_year: Number(e.target.value)}) : setNewCar({...newCar, model_year: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Security Bond (AUD)</label>
                    <input 
                      type="number"
                      value={editingCar ? editingCar.bond : newCar.bond}
                      onChange={(e) => editingCar ? setEditingCar({...editingCar, bond: Number(e.target.value)}) : setNewCar({...newCar, bond: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Vehicle Image URL</label>
                  <input 
                    value={editingCar ? editingCar.image : newCar.image}
                    onChange={(e) => editingCar ? setEditingCar({...editingCar, image: e.target.value}) : setNewCar({...newCar, image: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                  />
                </div>
                <button 
                  onClick={() => {
                    if (editingCar) {
                      updateCarMutation.mutate(editingCar);
                    } else {
                      addCarMutation.mutate(newCar);
                    }
                  }}
                  disabled={addCarMutation.isPending || updateCarMutation.isPending}
                  className="w-full bg-brand-gold text-brand-navy py-5 font-bold uppercase tracking-widest text-sm hover:bg-brand-gold-light transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {addCarMutation.isPending || updateCarMutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  {editingCar ? 'Update Vehicle' : 'Add Vehicle to Fleet'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Agreement Modal */}
      <AnimatePresence>
        {isAgreementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-brand-navy/60">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-brand-navy border border-white/10 w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Review Lease Agreement</h3>
                  <p className="text-[10px] text-brand-grey uppercase tracking-widest mt-1">Legally binding Markdown contract</p>
                </div>
                <button onClick={() => setIsAgreementModalOpen(false)} className="text-brand-grey hover:text-white p-2 bg-white/5 rounded-full"><XCircle /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 bg-white/[0.02]">
                <div className="prose prose-invert prose-brand max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-brand-grey bg-brand-navy/50 p-8 border border-white/10 rounded-2xl">
                    {agreementContent}
                  </pre>
                </div>
              </div>
              <div className="p-8 border-t border-white/10 bg-white/5 flex gap-4">
                <button 
                  onClick={() => setIsAgreementModalOpen(false)}
                  className="flex-1 py-5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={() => {
                    const application_id = Number(selected_agreement_application_id);
                    const car_id = Number(selected_agreement_car_id);
                    if (application_id && car_id) {
                      saveAgreementMutation.mutate({
                        application_id,
                        car_id,
                        content: agreementContent
                      });
                    }
                  }}
                  disabled={saveAgreementMutation.isPending}
                  className="flex-[2] bg-brand-gold text-brand-navy py-5 font-bold uppercase tracking-widest text-xs hover:bg-brand-gold-light transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {saveAgreementMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  Finalize & Save Agreement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
