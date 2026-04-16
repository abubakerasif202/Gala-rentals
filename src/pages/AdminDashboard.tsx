import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
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
  BadgeCheck,
  Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OverviewTab from '../components/admin/tabs/OverviewTab';
import ApplicationsTab from '../components/admin/tabs/ApplicationsTab';
import FleetTab from '../components/admin/tabs/FleetTab';
import RentalsTab from '../components/admin/tabs/RentalsTab';
import FinancialsTab from '../components/admin/tabs/FinancialsTab';
import CustomersTab from '../components/admin/tabs/CustomersTab';
import InvoicesTab from '../components/admin/tabs/InvoicesTab';
import AgreementsTab from '../components/admin/tabs/AgreementsTab';

import * as api from '../lib/api';
import { getApiErrorMessage } from '../lib/errorHandling';
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
import { getTodayInAustralia } from '../../shared/applicationSubmission';

const OPERATIONAL_PAGE_SIZE = 25;
const adminTabLabels: Record<string, string> = {
  agreements: 'Agreements',
  applications: 'Applications',
  cars: 'Fleet',
  customers: 'Customers',
  dashboard: 'Overview',
  financials: 'Financials',
  invoices: 'Invoices',
  rentals: 'Rentals',
};

const matchesSearch = (searchTerm: string, fields: Array<string | number | null | undefined>) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return fields.some((field) => String(field ?? '').toLowerCase().includes(normalizedSearch));
};

const copyTextToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const promptForManualCopy = (value: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.prompt('Copy secure payment link', value);
};

const copyCheckoutLink = async (checkoutUrl: string) => {
  const copied = await copyTextToClipboard(checkoutUrl);

  if (!copied) {
    promptForManualCopy(checkoutUrl);
  }

  return copied;
};

const isRestrictedPaymentLinkError = (error: unknown) =>
  getApiErrorMessage(error, '')
    .toLowerCase()
    .includes('session-capable postgres connection');

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationTimeoutRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    rentalStartDate: getTodayInAustralia(),
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [applicationSearch, setApplicationSearch] = useState('');
  const [rentalSearch, setRentalSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [agreementModalMode, setAgreementModalMode] = useState<'draft' | 'saved'>('draft');
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const deferredInvoiceSearch = useDeferredValue(invoiceSearch.trim());
  const deferredApplicationSearch = useDeferredValue(applicationSearch.trim());
  const deferredRentalSearch = useDeferredValue(rentalSearch.trim());

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

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current !== null) {
        window.clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    if (notificationTimeoutRef.current !== null) {
      window.clearTimeout(notificationTimeoutRef.current);
    }

    setNotification({ message, type });
    notificationTimeoutRef.current = window.setTimeout(() => {
      setNotification(null);
      notificationTimeoutRef.current = null;
    }, 3000);
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
    mutationFn: ({ id, status }: { id: string, status: string }) => api.updateApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showNotification('Application status updated', 'success');
    },
    onError: () => showNotification('Failed to update status', 'error'),
  });

  const saveAgreementMutation = useMutation({
    mutationFn: (payload: { application_id: string; car_id: number; content: string }) => api.saveLeaseAgreement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
      setIsAgreementModalOpen(false);
      setAgreementModalMode('draft');
      showNotification('Agreement saved successfully', 'success');
    },
    onError: () => showNotification('Failed to save agreement', 'error'),
  });

  const approveApplicationPaymentMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
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
    mutationFn: (payload: { application_id: string }) =>
      api.createVehicleCheckoutLink(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
    },
  });

  const retryPaymentReviewActivationMutation = useMutation({
    mutationFn: (id: string) => api.retryApplicationPaymentActivation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['cars'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
    },
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

    queryClient.clear();
    navigate('/admin/login', { replace: true });
  };

  const handleGenerateAgreement = async () => {
    const application_id = selected_agreement_application_id;
    const selectedApplication = applications.find((a) => a.id === application_id);
    const assignedCarId = Number(selectedApplication?.assigned_car_id || 0);
    const car_id = assignedCarId || Number(selected_agreement_car_id);
    
    if (!application_id || !selectedApplication || !car_id) {
      showNotification('Please select both an application and a car', 'error');
      return;
    }

    if (selectedApplication.status !== 'Paid') {
      showNotification('Driver payment must be completed before generating the agreement.', 'error');
      return;
    }

    setIsGeneratingAgreement(true);
    try {
      const selectedCar = cars.find(c => c.id === car_id);

      if (!selectedCar) {
        showNotification('Assigned vehicle could not be found for this application.', 'error');
        return;
      }

      if (assignedCarId && selectedCar.id !== assignedCarId) {
        showNotification('Agreement must use the vehicle assigned during approval.', 'error');
        return;
      }

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
        weeklyRent: `$${Number(selectedApplication.approved_weekly_price ?? selectedCar?.weekly_price ?? 0).toFixed(2)}`,
        rentalStartDate: agreementForm.rentalStartDate,
      };

      const res = await api.renderCarLeaseAgreement(payload);
      setAgreementContent(res.agreement);
      setAgreementModalMode('draft');
      set_selected_agreement_car_id(String(selectedCar.id));
      setIsAgreementModalOpen(true);
    } catch (err) {
      showNotification('Failed to generate agreement', 'error');
    } finally {
      setIsGeneratingAgreement(false);
    }
  };

  const handleCopyVehicleCheckoutLink = async () => {
    const application_id = selected_agreement_application_id;

    if (!application_id) {
      showNotification('Please select an approved application', 'error');
      return;
    }

    try {
      const response = await generateCheckoutLinkMutation.mutateAsync({
        application_id,
      });
      const copied = await copyTextToClipboard(response.checkout_url);

      if (!copied) {
        promptForManualCopy(response.checkout_url);
      }

      showNotification(
        copied
          ? 'Secure payment link copied!'
          : 'Secure payment link generated. Use the prompt to copy it manually.',
        'success'
      );
    } catch (error) {
      showNotification(
        getApiErrorMessage(error, 'Failed to generate secure payment link'),
        'error'
      );
    }
  };

  const handleApproveSelectedApplication = async () => {
    if (!selectedApplication) {
      return;
    }

    const applicationId = selectedApplication.id;
    const assignedCarId = Number(applicationApprovalForm.assigned_car_id);
    const approvedBond = Number(applicationApprovalForm.approved_bond);
    const approvedWeeklyPrice = Number(applicationApprovalForm.approved_weekly_price);

    if (!assignedCarId || approvedBond < 0 || approvedWeeklyPrice <= 0) {
      showNotification('Assign a vehicle and enter valid bond and weekly payment amounts.', 'error');
      return;
    }

    try {
      const response = await approveApplicationPaymentMutation.mutateAsync({
        id: applicationId,
        payload: {
          approved_bond: approvedBond,
          approved_weekly_price: approvedWeeklyPrice,
          assigned_car_id: assignedCarId,
          send_payment_link: true,
        },
      });

      if (!response.email_delivered) {
        const copied = await copyCheckoutLink(response.checkout_url);
        showNotification(
          response.email_reason
            ? copied
              ? 'Pricing saved. Email not sent; payment link copied instead.'
              : 'Pricing saved. Email not sent; use the prompt to copy the payment link.'
            : copied
              ? 'Pricing saved and payment link copied.'
              : 'Pricing saved. Use the prompt to copy the payment link.',
          'success'
        );
      } else {
        showNotification('Application approved and payment link emailed.', 'success');
      }

      setSelectedApplication(null);
    } catch (error) {
      if (isRestrictedPaymentLinkError(error)) {
        try {
          const restrictedApproval = await approveApplicationPaymentMutation.mutateAsync({
            id: applicationId,
            payload: {
              approved_bond: approvedBond,
              approved_weekly_price: approvedWeeklyPrice,
              assigned_car_id: assignedCarId,
              send_payment_link: false,
            },
          });

          let checkoutUrl = restrictedApproval.checkout_url;

          try {
            const generatedLink = await generateCheckoutLinkMutation.mutateAsync({
              application_id: applicationId,
            });
            checkoutUrl = generatedLink.checkout_url;
          } catch (generateLinkError) {
            console.warn(
              'Failed to generate a dedicated checkout link after restricted-mode approval:',
              generateLinkError
            );
          }

          const copied = await copyCheckoutLink(checkoutUrl);
          showNotification(
            copied
              ? 'Pricing saved. Email is unavailable in restricted mode, so the payment link was copied instead.'
              : 'Pricing saved. Email is unavailable in restricted mode; use the prompt to copy the payment link.',
            'success'
          );
          setSelectedApplication(null);
          return;
        } catch (fallbackError) {
          showNotification(
            getApiErrorMessage(
              fallbackError,
              'Failed to approve application and generate a manual payment link'
            ),
            'error'
          );
          return;
        }
      }

      showNotification(
        getApiErrorMessage(error, 'Failed to approve application for payment'),
        'error'
      );
    }
  };

  const handleRetrySelectedApplicationActivation = async () => {
    if (!selectedApplication) {
      return;
    }

    try {
      await retryPaymentReviewActivationMutation.mutateAsync(selectedApplication.id);
      showNotification('Payment activation completed and the rental is now live.', 'success');
      setSelectedApplication(null);
    } catch (error) {
      showNotification(
        getApiErrorMessage(error, 'Failed to retry payment activation'),
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
  const approvedApplications = applications.filter(
    (app) => app.status === 'Approved' || app.status === 'Paid'
  );
  const filteredApplications = applications.filter((app) =>
    matchesSearch(deferredApplicationSearch, [
      app.address,
      app.email,
      app.experience,
      app.name,
      app.phone,
      app.status,
      app.uber_status,
    ])
  );
  const filteredRentals = rentals.filter((rental) =>
    matchesSearch(deferredRentalSearch, [
      rental.applicant_name,
      rental.car_name,
      rental.start_date,
      rental.status,
      rental.weekly_price,
    ])
  );
  const selectedAgreementApplication = applications.find(
    (app) => app.id === selected_agreement_application_id
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
        {' '}<span className="font-mono text-white">DATABASE_URL</span> (preferred, or{' '}
        <span className="font-mono text-white">SUPABASE_DB_URL</span>), then run
        {' '}<span className="font-mono text-white">powershell -ExecutionPolicy Bypass -File scripts/import-operational-history-from-workbooks.ps1 -Apply</span>.
      </div>
    </div>
  );
  const closeAgreementModal = () => {
    setIsAgreementModalOpen(false);
    setAgreementModalMode('draft');
  };

  return (
    <div className="min-h-screen bg-brand-navy">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="min-h-screen overflow-x-hidden px-4 pb-8 pt-0 sm:px-6 lg:ml-72 lg:min-h-screen lg:overflow-y-auto lg:p-12">
        <div className="sticky top-0 z-30 -mx-4 mb-6 flex items-center justify-between border-b border-white/10 bg-brand-navy/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold">Admin Panel</p>
            <h1 className="mt-1 text-lg font-bold uppercase tracking-tight text-white">
              {adminTabLabels[activeTab] || 'Overview'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white transition-all hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <OverviewTab
              stats={stats}
              applications={applications}
              cars={cars}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'applications' && (
            <ApplicationsTab
              applicationSearch={applicationSearch}
              setApplicationSearch={setApplicationSearch}
              filteredApplications={filteredApplications}
              setSelectedApplication={setSelectedApplication}
            />
          )}

          {activeTab === 'cars' && (
            <FleetTab
              cars={cars}
              setIsAddingCar={setIsAddingCar}
              setEditingCar={setEditingCar}
              deleteCarMutation={deleteCarMutation}
            />
          )}

          {activeTab === 'rentals' && (
            <RentalsTab
              rentalSearch={rentalSearch}
              setRentalSearch={setRentalSearch}
              filteredRentals={filteredRentals}
            />
          )}

          {activeTab === 'financials' && (
            <FinancialsTab
              isLoadingWeeklyFinancials={isLoadingWeeklyFinancials}
              weeklyFinancials={weeklyFinancials}
              onRefresh={() => weeklyFinancialsQuery.refetch()}
              formatCurrency={formatCurrency}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersTab
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              isLoadingCustomerDataset={isLoadingCustomerDataset}
              customerHistoryAvailable={customerHistoryAvailable}
              deferredCustomerSearch={deferredCustomerSearch}
              customerTotalItems={customerTotalItems}
              customerTotals={customerTotals}
              customerRecords={customerRecords}
              currentCustomerPage={currentCustomerPage}
              customerTotalPages={customerTotalPages}
              isFetching={customerDatasetQuery.isFetching}
              setCustomerPage={setCustomerPage}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              operationalHistoryMessage={operationalHistoryMessage}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesTab
              invoiceSearch={invoiceSearch}
              setInvoiceSearch={setInvoiceSearch}
              isLoadingInvoiceDataset={isLoadingInvoiceDataset}
              invoiceHistoryAvailable={invoiceHistoryAvailable}
              deferredInvoiceSearch={deferredInvoiceSearch}
              invoiceTotalItems={invoiceTotalItems}
              invoiceTotals={invoiceTotals}
              invoiceRecords={invoiceRecords}
              invoiceCurrentPage={invoiceCurrentPage}
              invoiceTotalPages={invoiceTotalPages}
              isFetching={invoiceDatasetQuery.isFetching}
              setInvoicePage={setInvoicePage}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              operationalHistoryMessage={operationalHistoryMessage}
            />
          )}

          {activeTab === 'agreements' && (
            <AgreementsTab
              applications={applications}
              approvedApplications={approvedApplications}
              cars={cars}
              selected_agreement_application_id={selected_agreement_application_id}
              set_selected_agreement_application_id={set_selected_agreement_application_id}
              selected_agreement_car_id={selected_agreement_car_id}
              set_selected_agreement_car_id={set_selected_agreement_car_id}
              selectedAgreementApplication={selectedAgreementApplication}
              isGeneratingAgreement={isGeneratingAgreement}
              handleGenerateAgreement={handleGenerateAgreement}
              canCopyVehicleCheckoutLink={canCopyVehicleCheckoutLink}
              generateCheckoutLinkMutation={generateCheckoutLinkMutation}
              handleCopyVehicleCheckoutLink={handleCopyVehicleCheckoutLink}
              savedAgreements={savedAgreements}
              setAgreementModalMode={setAgreementModalMode}
              setAgreementContent={setAgreementContent}
              setIsAgreementModalOpen={setIsAgreementModalOpen}
              deleteAgreementMutation={deleteAgreementMutation}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={`fixed inset-x-4 bottom-4 z-[60] flex items-center gap-4 rounded-2xl border px-5 py-4 shadow-2xl sm:px-8 sm:py-5 lg:inset-x-auto lg:left-1/2 lg:min-w-[300px] lg:-translate-x-1/2 ${
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/60 backdrop-blur-xl sm:items-center sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-brand-navy shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-4 sm:p-8">
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

              <div className="max-h-[75vh] space-y-8 overflow-y-auto p-4 sm:p-8">
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
                    <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
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

                {selectedApplication.status === 'Payment Review' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      Payment received, activation pending
                    </p>
                    <p className="text-sm text-brand-grey font-light leading-relaxed">
                      Stripe reported a completed payment, but activation is waiting on a vehicle
                      conflict or maintenance hold. Resolve the blocker and the next matching Stripe
                      completion can finish automatically, or use Retry Activation now.
                    </p>
                    {selectedApplication.paid_at && (
                      <p className="text-xs text-amber-200/80 font-light">
                        Payment recorded {new Date(selectedApplication.paid_at).toLocaleString()}.
                      </p>
                    )}
                    {selectedApplication.pending_checkout_session_id && (
                      <p className="text-[10px] text-amber-200/80 font-mono break-all">
                        Session: {selectedApplication.pending_checkout_session_id}
                      </p>
                    )}
                  </div>
                )}

                {selectedApplication.status !== 'Paid' &&
                  selectedApplication.status !== 'Rejected' &&
                  selectedApplication.status !== 'Payment Review' && (
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
                        <div className="rounded-2xl border border-white/10 bg-brand-navy/40 px-4 py-3 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                            Last payment link sent
                          </p>
                          <p className="text-xs text-white">
                            {new Date(selectedApplication.payment_link_sent_at).toLocaleString()}
                          </p>
                          {selectedApplication.pending_checkout_session_id && (
                            <p className="text-[10px] text-brand-grey font-mono break-all">
                              Session: {selectedApplication.pending_checkout_session_id}
                            </p>
                          )}
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

              <div className="flex flex-col-reverse gap-4 border-t border-white/10 bg-white/5 p-4 sm:flex-row sm:p-8">
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="w-full border border-white/10 py-5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/5 sm:flex-1"
                >
                  Close
                </button>
                {selectedApplication.status !== 'Paid' &&
                  selectedApplication.status !== 'Payment Review' && (
                  <button
                    onClick={() =>
                      updateStatusMutation.mutate({ id: selectedApplication.id, status: 'Rejected' })
                    }
                    className="w-full border border-red-500/30 py-5 text-xs font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/10 sm:flex-1"
                  >
                    Reject Application
                  </button>
                )}
                {selectedApplication.status !== 'Paid' &&
                  selectedApplication.status !== 'Rejected' &&
                  selectedApplication.status !== 'Payment Review' && (
                  <button
                    onClick={handleApproveSelectedApplication}
                    disabled={approveApplicationPaymentMutation.isPending}
                    className="flex w-full items-center justify-center gap-3 bg-brand-gold py-5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light disabled:opacity-50 sm:flex-[2]"
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
                      set_selected_agreement_car_id(
                        selectedApplication.assigned_car_id
                          ? selectedApplication.assigned_car_id.toString()
                          : ''
                      );
                      setSelectedApplication(null);
                      setActiveTab('agreements');
                    }}
                    className="flex w-full items-center justify-center gap-3 bg-brand-gold py-5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light sm:flex-[2]"
                  >
                    <FileText className="w-4 h-4" /> Continue to Agreement
                  </button>
                )}
                {selectedApplication.status === 'Payment Review' && (
                  <button
                    onClick={handleRetrySelectedApplicationActivation}
                    disabled={retryPaymentReviewActivationMutation.isPending}
                    className="flex w-full items-center justify-center gap-3 bg-brand-gold py-5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light disabled:opacity-50 sm:flex-[2]"
                  >
                    {retryPaymentReviewActivationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Retry Activation
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/60 backdrop-blur-xl sm:items-center sm:p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-brand-navy shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-8">
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
              <div className="space-y-8 overflow-y-auto p-6 sm:p-12">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/60 backdrop-blur-xl sm:items-center sm:p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-brand-navy shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-4 sm:p-8">
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Review Lease Agreement</h3>
                  <p className="text-[10px] text-brand-grey uppercase tracking-widest mt-1">Legally binding Markdown contract</p>
                </div>
                <button onClick={closeAgreementModal} className="rounded-full bg-white/5 p-2 text-brand-grey hover:text-white"><XCircle /></button>
              </div>
              <div className="flex-1 overflow-y-auto bg-white/[0.02] p-4 sm:p-12">
                <div className="prose prose-invert prose-brand max-w-none">
                  <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-brand-navy/50 p-4 font-sans text-xs text-brand-grey sm:p-8 sm:text-sm">
                    {agreementContent}
                  </pre>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-4 border-t border-white/10 bg-white/5 p-4 sm:flex-row sm:p-8">
                <button 
                  onClick={closeAgreementModal}
                  className="w-full border border-white/10 py-5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/5 sm:flex-1"
                >
                  {agreementModalMode === 'saved' ? 'Close' : 'Discard'}
                </button>
                {agreementModalMode === 'draft' && (
                  <button 
                    onClick={() => {
                      const application_id = selected_agreement_application_id;
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
                    className="flex w-full items-center justify-center gap-3 bg-brand-gold py-5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light disabled:opacity-50 sm:flex-[2]"
                  >
                    {saveAgreementMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    Finalize & Save Agreement
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
