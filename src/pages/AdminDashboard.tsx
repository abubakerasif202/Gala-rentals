import React, { Suspense, lazy, useDeferredValue, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Users,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Menu,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getDateRangeForPreset,
  type DateRangeValue,
} from '../components/admin/DateRangePicker';

import * as api from '../lib/api';
import { getApiErrorMessage } from '../lib/errorHandling';
import {
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
const OverviewTab = lazy(() => import('../components/admin/tabs/OverviewTab'));
const ApplicationsTab = lazy(() => import('../components/admin/tabs/ApplicationsTab'));
const RentalsTab = lazy(() => import('../components/admin/tabs/RentalsTab'));
const FinancialsTab = lazy(() => import('../components/admin/tabs/FinancialsTab'));
const CustomersTab = lazy(() => import('../components/admin/tabs/CustomersTab'));
const InvoicesTab = lazy(() => import('../components/admin/tabs/InvoicesTab'));
const AgreementsTab = lazy(() => import('../components/admin/tabs/AgreementsTab'));
const TollStatDecTab = lazy(() => import('../components/admin/tabs/TollStatDecTab'));
const MaintenanceTab = lazy(() => import('../components/admin/tabs/MaintenanceTab'));

const adminTabLabels: Record<string, string> = {
  agreements: 'Agreements',
  applications: 'Applications',
  customers: 'Customers',
  dashboard: 'Overview',
  financials: 'Financials',
  invoices: 'Invoices',
  rentals: 'Rentals',
  'toll-notices': 'Toll Notices',
  maintenance: 'Maintenance',
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

const renderTabLoadingPanel = (label: string) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-sm text-brand-grey">
    <div className="flex items-center gap-4">
      <Loader2 className="h-5 w-5 animate-spin text-brand-gold" />
      <div>
        <p className="font-bold uppercase tracking-[0.24em] text-brand-gold/90">Loading</p>
        <p className="mt-1 text-brand-grey">{label}</p>
      </div>
    </div>
  </div>
);

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationTimeoutRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [openingDocument, setOpeningDocument] = useState<'license_photo' | 'license_back_photo' | 'passport_or_uber_profile_screenshot' | null>(null);
  const [isCancelApplicationModalOpen, setIsCancelApplicationModalOpen] = useState(false);
  const [cancelApplicationReason, setCancelApplicationReason] = useState('');
  const [applicationApprovalForm, setApplicationApprovalForm] = useState({
    approved_vehicle: '',
    approved_bond: '',
    approved_weekly_price: '',
    rental_subscription_start_date: '',
  });

  // Agreement Management State
  const [isGeneratingAgreement, setIsGeneratingAgreement] = useState(false);
  const [selected_agreement_application_id, set_selected_agreement_application_id] = useState<string>('');
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
  const [tollNoticeInitialSearch, setTollNoticeInitialSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(OPERATIONAL_PAGE_SIZE);
  const [financialDateRange, setFinancialDateRange] = useState<DateRangeValue>(() =>
    getDateRangeForPreset('last7')
  );
  const [agreementModalMode, setAgreementModalMode] = useState<'draft' | 'saved'>('draft');
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const deferredInvoiceSearch = useDeferredValue(invoiceSearch.trim());

  useEffect(() => {
    if (location.pathname === '/admin/agreements') {
      setActiveTab('agreements');
      return;
    }

    if (location.pathname === '/admin/toll-notices') {
      setActiveTab('toll-notices');
    }
  }, [location.pathname]);

  const openTollNotices = (searchValue = '') => {
    setTollNoticeInitialSearch(searchValue);
    setActiveTab('toll-notices');
    navigate('/admin/toll-notices');
  };

  const handleAdminTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(
      tab === 'toll-notices'
        ? '/admin/toll-notices'
        : tab === 'agreements'
          ? '/admin/agreements'
          : '/admin/dashboard'
    );
  };
  const deferredApplicationSearch = useDeferredValue(applicationSearch.trim());
  const deferredRentalSearch = useDeferredValue(rentalSearch.trim());

  useEffect(() => {
    setCustomerPage(1);
  }, [deferredCustomerSearch]);

  useEffect(() => {
    setInvoicePage(1);
  }, [deferredInvoiceSearch, invoicePageSize]);

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
  const shouldLoadApplications =
    activeTab === 'dashboard' ||
    activeTab === 'applications' ||
    activeTab === 'agreements';
  const shouldLoadRentals = activeTab === 'rentals' || activeTab === 'toll-notices';
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
    queryKey: ['operational-invoices', deferredInvoiceSearch, invoicePage, invoicePageSize],
    queryFn: () =>
      api.fetchOperationalInvoices({
        page: invoicePage,
        pageSize: invoicePageSize,
        search: deferredInvoiceSearch,
      }),
    enabled: shouldLoadInvoices,
    placeholderData: (previousData) => previousData,
  });

  const weeklyFinancialsQuery = useQuery<api.WeeklyFinancials>({
    queryKey: ['weekly-financials', financialDateRange.startDate, financialDateRange.endDate],
    queryFn: () =>
      api.fetchWeeklyFinancials({
        endDate: financialDateRange.endDate,
        startDate: financialDateRange.startDate,
      }),
    enabled: shouldLoadWeeklyFinancials,
  });

  const savedAgreementsQuery = useQuery({
    queryKey: ['agreements'],
    queryFn: () => api.fetchSavedLeaseAgreements(),
    enabled: shouldLoadAgreements,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => api.updateApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showNotification('Application status updated', 'success');
    },
    onError: () => showNotification('Failed to update status', 'error'),
  });

  const cancelApplicationMutation = useMutation({
    mutationFn: ({ id, cancel_reason }: { id: string; cancel_reason?: string }) =>
      api.cancelApplication(id, { cancel_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      setSelectedApplication(null);
      setIsCancelApplicationModalOpen(false);
      setCancelApplicationReason('');
      showNotification('Application cancelled successfully', 'success');
    },
    onError: () => showNotification('Failed to cancel application', 'error'),
  });

  const saveAgreementMutation = useMutation({
    mutationFn: (payload: { application_id: string; content: string; vehicle_label?: string | null }) =>
      api.saveLeaseAgreement(payload),
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
        approved_vehicle: string;
        approved_bond: number;
        approved_weekly_price: number;
        rental_subscription_start_date?: string;
        send_payment_link?: boolean;
      };
    }) => api.approveApplicationForPayment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const generateCheckoutLinkMutation = useMutation({
    mutationFn: (payload: { application_id: string }) =>
      api.createVehicleCheckoutLink(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const retryPaymentReviewActivationMutation = useMutation({
    mutationFn: (id: string) => api.retryApplicationPaymentActivation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
    },
  });

  const cancelRentalSubscriptionMutation = useMutation({
    mutationFn: ({
      cancelAtPeriodEnd,
      confirm,
      reason,
      rentalId,
    }: {
      cancelAtPeriodEnd: boolean;
      confirm: 'CANCEL SUBSCRIPTION';
      reason?: string;
      rentalId: number;
    }) =>
      api.cancelRentalStripeSubscription(rentalId, {
        cancelAtPeriodEnd,
        confirm,
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      showNotification('Stripe subscription cancellation updated.', 'success');
    },
    onError: (error) =>
      showNotification(
        getApiErrorMessage(error, 'Failed to cancel Stripe subscription'),
        'error'
      ),
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

    if (!application_id || !selectedApplication) {
      showNotification('Please select an application', 'error');
      return;
    }

    if (selectedApplication.status !== 'Approved' && selectedApplication.status !== 'Paid') {
      showNotification('Approve the application quote before generating a rental agreement.', 'error');
      return;
    }

    const approvedWeeklyPrice = Number(selectedApplication.approved_weekly_price ?? 0);
    const approvedBond = Number(selectedApplication.approved_bond ?? 0);

    setIsGeneratingAgreement(true);
    try {
      const vehicleLabel =
        selectedApplication.approved_vehicle?.trim();

      if (!vehicleLabel || approvedWeeklyPrice <= 0) {
        showNotification('Approved vehicle and weekly price are required before agreement generation.', 'error');
        return;
      }

      const payload = {
        agreementDate: new Date().toLocaleDateString('en-AU'),
        renteeName: selectedApplication?.name,
        renteeDob: selectedApplication?.date_of_birth || undefined,
        renteeEmail: selectedApplication?.email,
        renteeContact: selectedApplication?.phone,
        renteeAddress: selectedApplication?.address,
        renteeLicenseNumber: selectedApplication?.license_number,
        renteeLicenseState: selectedApplication?.licence_state || undefined,
        vehicleMake: 'Not recorded',
        vehicleModel: vehicleLabel,
        vehicleYear: agreementForm.vehicleYear || 'Not recorded',
        vehicleVin: vehicleLabel,
        weeklyRent: `$${approvedWeeklyPrice.toFixed(2)}`,
        rentalStartDate: agreementForm.rentalStartDate || selectedApplication.intended_start_date,
        fees: [
          {
            code: 'weekly_rent',
            title: 'Weekly rent',
            amount: `$${approvedWeeklyPrice.toFixed(2)}`,
          },
          ...(approvedBond > 0
            ? [
                {
                  code: 'bond',
                  title: 'Bond',
                  amount: `$${approvedBond.toFixed(2)}`,
                },
              ]
            : []),
        ],
      };

      const res = await api.renderCarLeaseAgreement(payload);
      setAgreementContent(res.agreement);
      setAgreementModalMode('draft');
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
    const approvedVehicle = applicationApprovalForm.approved_vehicle.trim();
    const approvedBond = Number(applicationApprovalForm.approved_bond);
    const approvedWeeklyPrice = Number(applicationApprovalForm.approved_weekly_price);
    const rentalSubscriptionStartDate =
      applicationApprovalForm.rental_subscription_start_date.trim();

    if (!approvedVehicle || approvedBond < 0 || approvedWeeklyPrice <= 0) {
      showNotification('Enter the approved rental details, bond, and weekly payment amounts.', 'error');
      return;
    }

    try {
      const response = await approveApplicationPaymentMutation.mutateAsync({
        id: applicationId,
        payload: {
          approved_vehicle: approvedVehicle,
          approved_bond: approvedBond,
          approved_weekly_price: approvedWeeklyPrice,
          ...(rentalSubscriptionStartDate
            ? { rental_subscription_start_date: rentalSubscriptionStartDate }
            : {}),
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
              approved_vehicle: approvedVehicle,
              approved_bond: approvedBond,
              approved_weekly_price: approvedWeeklyPrice,
              ...(rentalSubscriptionStartDate
                ? { rental_subscription_start_date: rentalSubscriptionStartDate }
                : {}),
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
      showNotification('Payment finalization completed and the application is marked paid.', 'success');
      setSelectedApplication(null);
    } catch (error) {
      showNotification(
        getApiErrorMessage(error, 'Failed to retry payment recording'),
        'error'
      );
    }
  };

  const handleOpenApplicationDocument = async (
    document: 'license_photo' | 'license_back_photo' | 'passport_or_uber_profile_screenshot'
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
  const applications = applicationsQuery.data || [];
  const rentals = rentalsQuery.data || [];
  const customerDataset = customerDatasetQuery.data;
  const invoiceDataset = invoiceDatasetQuery.data;
  const weeklyFinancials = weeklyFinancialsQuery.data;
  const savedAgreements = savedAgreementsQuery.data || [];

  useEffect(() => {
    if (!selectedApplication) {
      return;
    }

    setApplicationApprovalForm({
      approved_vehicle: selectedApplication.approved_vehicle || '',
      approved_bond:
        selectedApplication.approved_bond != null ? String(selectedApplication.approved_bond) : '',
      approved_weekly_price:
        selectedApplication.approved_weekly_price != null
          ? String(selectedApplication.approved_weekly_price)
          : '',
      rental_subscription_start_date: selectedApplication.intended_start_date || '',
    });
  }, [selectedApplication]);

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
  const canGenerateLeaseAgreement =
    Boolean(selectedAgreementApplication) &&
    (selectedAgreementApplication?.status === 'Approved' ||
      selectedAgreementApplication?.status === 'Paid') &&
    Boolean(selectedAgreementApplication?.approved_vehicle?.trim()) &&
    Number(selectedAgreementApplication?.approved_weekly_price ?? 0) > 0;
  const canSaveLeaseAgreement =
    Boolean(selectedAgreementApplication) &&
    selectedAgreementApplication?.status === 'Paid';
  const canCopyVehicleCheckoutLink =
    Boolean(selectedAgreementApplication) &&
    selectedAgreementApplication?.status === 'Approved';
  const formatCurrency = (value?: number | string | null) => `$${Number(value ?? 0).toFixed(2)}`;
  const selectedApplicationLifecycle = selectedApplication
    ? [
        { label: 'Apply', active: true },
        {
          label: 'Approve',
          active: ['Approved', 'Paid', 'Payment Review'].includes(selectedApplication.status),
        },
        {
          label: 'Pay',
          active: ['Paid', 'Payment Review'].includes(selectedApplication.status),
        },
        {
          label: 'Prepare',
          active: selectedApplication.status === 'Paid',
        },
      ]
    : [];
  const selectedApplicationStartDate =
    selectedApplication?.rental_subscription_start_date ||
    selectedApplication?.intended_start_date ||
    'Not set';
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
      <div className="break-words bg-brand-navy/60 border border-white/10 rounded-2xl px-5 py-4 text-[11px] text-brand-grey font-light">
        Run <span className="font-mono text-white">npm run migrate:operational-history</span> with
        {' '}<span className="font-mono text-white">DATABASE_URL</span> or{' '}
        <span className="font-mono text-white">SUPABASE_DB_URL</span>. Legacy workbook imports now require{' '}
        <span className="font-mono text-white">ALLOW_LEGACY_IMPORT=true</span> and should not be used for production data.
      </div>
    </div>
  );
  const closeAgreementModal = () => {
    setIsAgreementModalOpen(false);
    setAgreementModalMode('draft');
  };

  const wrapTabPanel = (label: string, content: React.ReactNode) => (
    <Suspense fallback={renderTabLoadingPanel(label)}>
      {content}
    </Suspense>
  );

  return (
    <div className="min-h-screen bg-[#061425]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleAdminTabChange}
        handleLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(223,177,37,0.12),transparent_28%),linear-gradient(180deg,#0b1f36_0%,#061425_38%,#061425_100%)] px-4 pb-8 pt-0 sm:px-6 lg:ml-72 lg:min-h-screen lg:overflow-y-auto lg:p-12">
        <div className="sticky top-0 z-30 -mx-4 mb-6 flex items-center justify-between border-b border-white/10 bg-[#061425]/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:hidden">
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
            wrapTabPanel(
              'Loading dashboard overview',
              <OverviewTab
                stats={stats}
                applications={applications}
                setActiveTab={setActiveTab}
              />
            )
          )}

          {activeTab === 'applications' && (
            wrapTabPanel(
              'Loading applications',
              <ApplicationsTab
                applicationSearch={applicationSearch}
                setApplicationSearch={setApplicationSearch}
                filteredApplications={filteredApplications}
                setSelectedApplication={setSelectedApplication}
              />
            )
          )}

          {activeTab === 'rentals' && (
            wrapTabPanel(
              'Loading rentals',
              <RentalsTab
                rentalSearch={rentalSearch}
                setRentalSearch={setRentalSearch}
                filteredRentals={filteredRentals}
                onCancelSubscription={(payload) =>
                  cancelRentalSubscriptionMutation.mutateAsync(payload)
                }
                onCreateTollNotice={(rental) =>
                  openTollNotices(
                    String(rental.application_id || rental.applicant_name || rental.car_name || '')
                  )
                }
              />
            )
          )}

          {activeTab === 'financials' && (
            wrapTabPanel(
              'Loading financials',
              <FinancialsTab
                dateRange={financialDateRange}
                isLoadingWeeklyFinancials={isLoadingWeeklyFinancials}
                weeklyFinancials={weeklyFinancials}
                onDateRangeChange={setFinancialDateRange}
                onRefresh={() => weeklyFinancialsQuery.refetch()}
                formatCurrency={formatCurrency}
              />
            )
          )}

          {activeTab === 'customers' && (
            wrapTabPanel(
              'Loading customers',
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
            )
          )}

          {activeTab === 'invoices' && (
            wrapTabPanel(
              'Loading invoices',
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
                invoicePageSize={invoicePageSize}
                isFetching={invoiceDatasetQuery.isFetching}
                setInvoicePage={setInvoicePage}
                setInvoicePageSize={setInvoicePageSize}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                operationalHistoryMessage={operationalHistoryMessage}
              />
            )
          )}

          {activeTab === 'agreements' && (
            wrapTabPanel(
              'Loading agreements',
              <AgreementsTab
                approvedApplications={approvedApplications}
                selected_agreement_application_id={selected_agreement_application_id}
                set_selected_agreement_application_id={set_selected_agreement_application_id}
                selectedAgreementApplication={selectedAgreementApplication}
                isGeneratingAgreement={isGeneratingAgreement}
                canGenerateLeaseAgreement={canGenerateLeaseAgreement}
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
            )
          )}

          {activeTab === 'toll-notices' && (
            wrapTabPanel(
              'Loading toll notices',
              <TollStatDecTab initialSearch={tollNoticeInitialSearch} />
            )
          )}

          {activeTab === 'maintenance' && (
            wrapTabPanel('Loading maintenance', <MaintenanceTab />)
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
              className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-brand-navy shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-4 sm:p-8">
                <div>
                  <p className="text-[10px] text-brand-gold uppercase tracking-[0.24em] mb-2">Application command center</p>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Review Application</h3>
                  <p className="text-[10px] text-brand-grey uppercase tracking-widest mt-1">Driver profile, approval quote, payment link, and next operational action</p>
                </div>
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="text-brand-grey hover:text-white p-2 bg-white/5 rounded-full"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="max-h-[75vh] space-y-8 overflow-y-auto p-4 sm:p-8">
                <div className="grid gap-3 rounded-3xl border border-brand-gold/15 bg-brand-gold/5 p-4 sm:grid-cols-4">
                  {selectedApplicationLifecycle.map((item, index) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border px-4 py-3 ${
                        item.active
                          ? 'border-brand-gold/30 bg-brand-gold/15 text-white'
                          : 'border-white/10 bg-brand-navy/50 text-brand-grey'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em]">
                        {String(index + 1).padStart(2, '0')}
                      </p>
                      <p className="mt-1 text-sm font-bold">{item.label}</p>
                    </div>
                  ))}
                </div>

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
                        <p className="text-white font-bold">{selectedApplicationStartDate}</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                      Passport or Uber Profile Screenshot
                    </h4>
                    {selectedApplication.passport_or_uber_profile_screenshot ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenApplicationDocument(
                            'passport_or_uber_profile_screenshot',
                          )
                        }
                        disabled={openingDocument !== null}
                        className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-brand-gold text-brand-navy font-bold uppercase tracking-widest text-[10px] hover:bg-brand-gold-light transition-all disabled:opacity-50"
                      >
                        {openingDocument === 'passport_or_uber_profile_screenshot' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4" />
                        )}
                        Open Passport or Uber Screenshot
                      </button>
                    ) : (
                      <div className="px-6 py-4 border border-white/10 rounded-2xl text-brand-grey text-xs font-light">
                        No passport or Uber screenshot uploaded.
                      </div>
                    )}
                  </div>

                  <div className="bg-brand-navy/60 border border-brand-gold/15 rounded-3xl p-6 space-y-3">
                    <h4 className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
                      Rental Agreement Acceptance
                    </h4>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-brand-grey">
                          Accepted at
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {formatDate(selectedApplication.agreement_accepted_at)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-brand-grey">
                          Signature
                        </p>
                        <p className="mt-2 break-words text-sm text-white">
                          {selectedApplication.agreement_signature || 'Not recorded'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest text-brand-grey">
                          Template version
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {selectedApplication.agreement_template_version ?? 'Not recorded'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedApplication.status === 'Cancelled' && (
                  <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
                      Application cancelled
                    </p>
                    <p className="text-sm text-brand-grey leading-relaxed">
                      Cancelled at{' '}
                      <span className="text-white">
                        {formatDate(selectedApplication.cancelled_at)}
                      </span>
                    </p>
                    <p className="text-sm text-brand-grey leading-relaxed">
                      Reason:{' '}
                      <span className="text-white">
                        {selectedApplication.cancel_reason || 'No reason recorded'}
                      </span>
                    </p>
                  </div>
                )}

                {selectedApplication.status === 'Payment Review' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      Payment received, review pending
                    </p>
                    <p className="text-sm text-brand-grey font-light leading-relaxed">
                      Stripe reported a completed payment, but paid-state recording needs review.
                      Confirm the payment-link version and stored checkout session, then use Retry
                      Payment Finalization if the same session should be recorded automatically.
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

                {selectedApplication.status === 'Paid' && (
                  <div className="rounded-3xl border border-brand-gold/20 bg-brand-gold/10 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                      Paid application next step
                    </p>
                    <p className="mt-3 max-w-3xl text-sm font-light leading-7 text-brand-grey">
                      Payment has been recorded. Continue with agreement finalization and operational documents.
                      This screen does not activate a vehicle or create a rental automatically.
                    </p>
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
                          Confirm the approved rental details, set the bond and weekly payment, then email a fresh secure Stripe payment link.
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

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                          Rental / Handover Details
                        </label>
                        <input
                          type="text"
                          value={applicationApprovalForm.approved_vehicle}
                          onChange={(e) =>
                            setApplicationApprovalForm((current) => ({
                              ...current,
                              approved_vehicle: e.target.value,
                            }))
                          }
                          className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                          placeholder="Approved rental option and handover notes"
                        />
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">
                          Rental subscription start date
                        </label>
                        <input
                          type="date"
                          value={applicationApprovalForm.rental_subscription_start_date}
                          onChange={(e) =>
                            setApplicationApprovalForm((current) => ({
                              ...current,
                              rental_subscription_start_date: e.target.value,
                            }))
                          }
                          className="w-full bg-brand-navy border border-white/10 rounded-xl px-5 py-4 text-white focus:border-brand-gold outline-none transition-all font-light"
                        />
                      </div>
                    </div>

                    {applicationApprovalForm.approved_vehicle && (
                      <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-5 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                          Approved payment summary
                        </p>
                        <p className="text-sm text-brand-grey font-light leading-relaxed">
                          Details: <span className="text-white font-bold">{applicationApprovalForm.approved_vehicle}</span>
                          {' '}| Bond:{' '}
                          <span className="text-white font-bold">
                            ${Number(applicationApprovalForm.approved_bond || 0).toFixed(2)}
                          </span>
                          {' '}| Weekly payment:{' '}
                          <span className="text-white font-bold">
                            ${Number(applicationApprovalForm.approved_weekly_price || 0).toFixed(2)}
                          </span>
                          {applicationApprovalForm.rental_subscription_start_date && (
                            <>
                              {' '}| Subscription starts:{' '}
                              <span className="text-white font-bold">
                                {applicationApprovalForm.rental_subscription_start_date}
                              </span>
                            </>
                          )}
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
                  selectedApplication.status !== 'Payment Review' &&
                  selectedApplication.status !== 'Cancelled' && (
                  <button
                    onClick={() => {
                      setCancelApplicationReason('');
                      setIsCancelApplicationModalOpen(true);
                    }}
                    className="w-full border border-red-500/30 py-5 text-xs font-bold uppercase tracking-widest text-red-300 transition-all hover:bg-red-500/10 sm:flex-1"
                  >
                    Cancel rental application
                  </button>
                )}
                {selectedApplication.status !== 'Paid' &&
                  selectedApplication.status !== 'Payment Review' &&
                  selectedApplication.status !== 'Cancelled' && (
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
                  selectedApplication.status !== 'Payment Review' &&
                  selectedApplication.status !== 'Cancelled' && (
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
                {selectedApplication.status === 'Approved' && (
                  <button
                    onClick={() => {
                      set_selected_agreement_application_id(selectedApplication.id.toString());
                      setSelectedApplication(null);
                      handleAdminTabChange('agreements');
                    }}
                    className="flex w-full items-center justify-center gap-3 border border-brand-gold/40 bg-white/5 py-5 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-white/10 sm:flex-[2]"
                  >
                    <FileText className="w-4 h-4 text-brand-gold" /> Generate Agreement Draft
                  </button>
                )}
                {selectedApplication.status === 'Paid' && (
                  <>
                    <button
                      onClick={() => {
                        set_selected_agreement_application_id(selectedApplication.id.toString());
                        setSelectedApplication(null);
                        handleAdminTabChange('agreements');
                      }}
                      className="flex w-full items-center justify-center gap-3 bg-brand-gold py-5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light sm:flex-[2]"
                    >
                      <FileText className="w-4 h-4" /> Continue to Agreement
                    </button>
                    <button
                      onClick={() => {
                        openTollNotices(selectedApplication.id.toString());
                        setSelectedApplication(null);
                      }}
                      className="flex w-full items-center justify-center gap-3 border border-brand-gold/40 bg-white/5 py-5 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-white/10 sm:flex-[2]"
                    >
                      <FileText className="w-4 h-4 text-brand-gold" /> Create Toll Transfer Notice
                    </button>
                  </>
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
                    Retry Payment Finalization
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCancelApplicationModalOpen && selectedApplication && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/60 backdrop-blur-xl sm:items-center sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/10 bg-brand-navy shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-4 sm:p-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tighter text-white">
                    Cancel rental application
                  </h3>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-grey">
                    Soft cancel and clear application-specific Stripe resources
                  </p>
                </div>
                <button
                  onClick={() => setIsCancelApplicationModalOpen(false)}
                  className="rounded-full bg-white/5 p-2 text-brand-grey hover:text-white"
                >
                  <XCircle />
                </button>
              </div>

              <div className="space-y-4 p-4 sm:p-6">
                <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-7 text-red-50">
                  This will mark the application as cancelled, clear pending checkout state,
                  and expire only the Stripe resources linked to this application.
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-grey">
                    Cancellation reason
                  </label>
                  <textarea
                    value={cancelApplicationReason}
                    onChange={(event) => setCancelApplicationReason(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all placeholder:text-brand-grey/60 focus:border-brand-gold"
                    placeholder="Optional: add a short reason for the audit trail"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-white/5 p-4 sm:flex-row sm:p-6">
                <button
                  onClick={() => setIsCancelApplicationModalOpen(false)}
                  className="w-full rounded-full border border-white/10 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/5 sm:flex-1"
                >
                  Keep application
                </button>
                <button
                  onClick={() =>
                    cancelApplicationMutation.mutate({
                      id: selectedApplication.id,
                      cancel_reason: cancelApplicationReason.trim() || undefined,
                    })
                  }
                  disabled={cancelApplicationMutation.isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-full border border-red-500/30 bg-red-500/10 px-6 py-4 text-xs font-bold uppercase tracking-widest text-red-200 transition-all hover:bg-red-500/20 disabled:opacity-50 sm:flex-[2]"
                >
                  {cancelApplicationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  Cancel rental application
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
              {agreementModalMode === 'draft' && !canSaveLeaseAgreement && (
                <div className="border-t border-white/10 bg-amber-500/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-amber-100 sm:px-8">
                  Draft generated. Final save is available after the driver payment is completed.
                </div>
              )}
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
                      if (application_id && canSaveLeaseAgreement) {
                        saveAgreementMutation.mutate({
                          application_id,
                          content: agreementContent,
                          vehicle_label:
                            selectedAgreementApplication?.approved_vehicle ||
                            'Approved vehicle',
                        });
                      }
                    }}
                    disabled={saveAgreementMutation.isPending || !canSaveLeaseAgreement}
                    className="flex w-full items-center justify-center gap-3 bg-brand-gold py-5 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg transition-all hover:bg-brand-gold-light disabled:opacity-50 sm:flex-[2]"
                  >
                    {saveAgreementMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {canSaveLeaseAgreement ? 'Finalize & Save Agreement' : 'Save Unlocks After Payment'}
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
