import axios from 'axios';
import {
  Car,
  Application,
  Rental,
  DashboardStats,
  AdminDatasetResponse,
  OperationalCustomer,
  OperationalInvoice,
} from '../types';
import type { PublicRentalPlan } from './rentalPlans';
import type { InquiryValues } from '../../shared/inquiry';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true, // Necessary for HTTP-only cookies
});

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAdminScreen = currentPath.startsWith('/admin');

    if (error.response?.status === 401 && isAdminScreen && !currentPath.includes('/admin/login')) {
      window.location.replace('/admin/login');
    }
    // 403 = wrong account, not unauthenticated — don't redirect silently.
    // Let the calling code handle it and show a user-facing message.
    return Promise.reject(error);
  }
);

export const logoutAdmin = async (): Promise<{ message: string }> => {
  const { data } = await api.post('/auth/logout');
  return data;
};

export interface AdminSessionResponse {
  user: {
    username: string;
  };
}

export const verifyAdminSession = async (): Promise<AdminSessionResponse> => {
  const { data } = await api.get('/auth/verify');
  return data;
};

export const fetchCars = async (options: { includeArchived?: boolean } = {}): Promise<Car[]> => {
  const endpoint = options.includeArchived ? '/cars/admin/all' : '/cars';
  const { data } = await api.get(endpoint);
  return data;
};

export const fetchCar = async (id: string): Promise<Car> => {
  const { data } = await api.get(`/cars/${id}`);
  return data;
};

export const createCar = async (carData: Partial<Car>): Promise<{ id: string }> => {
  const { data } = await api.post('/cars', carData);
  return data;
};

export const updateCar = async (id: number, carData: Partial<Car>): Promise<{ success: boolean }> => {
  const { data } = await api.put(`/cars/${id}`, carData);
  return data;
};

export const deleteCar = async (id: number): Promise<{ success: boolean }> => {
  const { data } = await api.delete(`/cars/${id}`);
  return data;
};

export const removeVehicleImageUpload = async (
  imageUrl: string
): Promise<{ success: boolean }> => {
  const { data } = await api.delete('/cars/image', {
    data: { imageUrl },
  });
  return data;
};

export const archiveCar = async (
  id: number,
  archived: boolean
): Promise<{ success: boolean }> => {
  const { data } = await api.patch(`/cars/${id}/archive`, { archived });
  return data;
};

export const fetchApplications = async (): Promise<Application[]> => {
  const { data } = await api.get('/applications');
  return data;
};

export const updateApplicationStatus = async (id: string, status: string): Promise<{ success: boolean }> => {
  const { data } = await api.put(`/applications/${id}/status`, { status });
  return data;
};

export const fetchStats = async (): Promise<DashboardStats> => {
  const { data } = await api.get('/financials/stats');
  return data;
};

export const fetchRentals = async (): Promise<Rental[]> => {
  const { data } = await api.get('/rentals');
  return data;
};

export interface AdminDatasetRequest {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const fetchOperationalCustomers = async (
  params: AdminDatasetRequest = {}
): Promise<
  AdminDatasetResponse<OperationalCustomer>
> => {
  const { data } = await api.get('/customers', { params });
  return data;
};

export const fetchOperationalInvoices = async (
  params: AdminDatasetRequest = {}
): Promise<
  AdminDatasetResponse<OperationalInvoice>
> => {
  const { data } = await api.get('/invoices', { params });
  return data;
};

export const fetchRentalPlans = async (): Promise<PublicRentalPlan[]> => {
  const { data } = await api.get('/stripe/rental-plans');
  return data;
};

export interface ApplicationSubmissionResponse {
  application_id: string;
  checkout_token?: string;
  checkout_token_expires_at?: string;
  checkout_url?: string;
  lease_agreement_saved?: boolean;
  success: boolean;
}

export interface HostedCheckoutSessionResponse {
  checkout_url: string | null;
  session_id: string;
}

export interface CheckoutSessionStatusResponse {
  application_status: 'Pending' | 'Paid' | 'Approved' | 'Rejected' | 'Payment Review';
  checkout_kind: 'application' | 'vehicle' | null;
  id: string;
  internal_status: 'complete' | 'manual_review' | 'pending' | 'open';
  payment_status: string | null;
  rental_status: 'Active' | 'Completed' | 'Cancelled' | 'Overdue' | null;
  status: string | null;
}

export interface VehicleCheckoutLinkResponse {
  checkout_token: string;
  checkout_token_expires_at: string;
  checkout_url: string;
}

export interface ApplicationApprovalResponse extends VehicleCheckoutLinkResponse {
  email_delivered: boolean;
  email_reason: string | null;
  success: boolean;
}

export interface ApplicationActivationRetryResponse {
  status: 'Paid';
  success: boolean;
}

export interface ApprovedPaymentContextResponse {
  applicant_name: string;
  application_id: string;
  approved_vehicle: string;
  billing: {
    bond: number;
    currency: string;
    initialRental: number;
    recurringAmount: number;
    recurringInterval: 'week' | 'month';
    recurringIntervalCount: number;
    recurringLabel: string;
    setupFees: number;
    upfrontDue: number;
  };
  vehicle_image: string;
}

export const fetchApplicationDocumentUrl = async (
  applicationId: string,
  document: 'license_photo' | 'license_back_photo'
): Promise<{ url: string }> => {
  const { data } = await api.get(`/applications/${applicationId}/documents/${document}`);
  return data;
};

export const submitApplication = async (payload: FormData): Promise<ApplicationSubmissionResponse> => {
  const { data } = await api.post('/applications', payload);
  return data;
};

export const submitInquiry = async (
  payload: InquiryValues
): Promise<{ success: boolean }> => {
  const { data } = await api.post('/inquiries', payload);
  return data;
};

export const createVehicleCheckoutSession = async (payload: {
  application_id: string;
  checkout_token: string;
}): Promise<HostedCheckoutSessionResponse> => {
  const { data } = await api.post('/stripe/vehicle-checkout-session', payload);
  return data;
};

export const fetchApprovedPaymentContext = async (options: {
  application_id: string;
  checkout_token: string;
}): Promise<ApprovedPaymentContextResponse> => {
  const { checkout_token, ...params } = options;
  const { data } = await api.get('/stripe/payment-context', {
    params,
    headers: {
      'X-Checkout-Token': checkout_token,
    },
  });
  return data;
};

export const fetchCheckoutSessionStatus = async (
  sessionId: string,
  options: {
    application_id: string;
    checkout_token: string;
  }
): Promise<CheckoutSessionStatusResponse> => {
  const { checkout_token, ...params } = options;
  const { data } = await api.get(`/stripe/checkout-sessions/${sessionId}`, {
    params,
    headers: {
      'X-Checkout-Token': checkout_token,
    },
  });
  return data;
};

export interface StripeLeaseSettings {
  currency: string;
  recurring_interval: 'week';
  minimum_rental_weeks: number;
  insurance_coverage_region: string;
  fees: {
    account_management_weekly: number;
    new_account_setup: number;
    direct_debit_account_setup: number;
  };
}

export interface LeaseFeePayload {
  code: string;
  title: string;
  amount: string;
}

export interface LeaseAgreementPayload {
  agreementDate?: string;
  registeredOwnerName?: string;
  registeredOwnerAddress?: string;
  registeredOwnerContact?: string;
  registeredOwnerEmail?: string;
  renteeName?: string;
  renteeDob?: string;
  renteeLicenseNumber?: string;
  renteeLicenseState?: string;
  renteeAddress?: string;
  renteeContact?: string;
  renteeEmail?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleVin?: string;
  kmAllowance?: string;
  weeklyRent?: string;
  fuelPolicy?: string;
  insuranceCoverage?: string;
  rentalStartDate?: string;
  rentalEndDate?: string;
  minimumRentalPeriod?: string;
  returnPolicy?: string;
  fees?: LeaseFeePayload[];
}

export const createVehicleCheckoutLink = async (payload: {
  application_id: string;
}): Promise<VehicleCheckoutLinkResponse> => {
  const { data } = await api.post('/stripe/vehicle-checkout-link', payload);
  return data;
};

export const approveApplicationForPayment = async (
  id: string,
  payload: {
    approved_vehicle: string;
    approved_bond: number;
    approved_weekly_price: number;
    send_payment_link?: boolean;
  }
): Promise<ApplicationApprovalResponse> => {
  const { data } = await api.post(`/applications/${id}/approve-payment`, payload);
  return data;
};

export const retryApplicationPaymentActivation = async (
  id: string
): Promise<ApplicationActivationRetryResponse> => {
  const { data } = await api.post(`/applications/${id}/retry-payment-activation`);
  return data;
};

export const fetchCarLeaseTemplate = async (): Promise<string> => {
  const { data } = await api.get('/agreements/car-lease/template', {
    responseType: 'text',
  });
  return data;
};

export const renderCarLeaseAgreement = async (
  payload: LeaseAgreementPayload
): Promise<{ agreement: string }> => {
  const { data } = await api.post('/agreements/car-lease/render', payload);
  return data;
};

export const fetchStripeLeaseSettings = async (): Promise<StripeLeaseSettings> => {
  const { data } = await api.get('/stripe/lease-settings');
  return data;
};

export interface SavedLeaseAgreement {
  id: number;
  application_id: string;
  car_id: number;
  content: string;
  status: string;
  created_at: string;
  applicant_name?: string;
  car_name?: string;
}

export const saveLeaseAgreement = async (payload: {
  application_id: string;
  car_id: number;
  content: string;
  status?: string;
}): Promise<{ id: string }> => {
  const { data } = await api.post('/agreements', payload);
  return data;
};

export const fetchSavedLeaseAgreements = async (): Promise<SavedLeaseAgreement[]> => {
  const { data } = await api.get('/agreements');
  return data;
};

export const deleteSavedLeaseAgreement = async (id: number): Promise<{ success: boolean }> => {
  const { data } = await api.delete(`/agreements/${id}`);
  return data;
};

export interface WeeklyFinancials {
  projected_gross_weekly: number;
  projected_net_weekly: number;
  estimated_platform_fees: number;
  actual_payouts_weekly: number;
  recent_payouts: Array<{
    id: string;
    amount: number;
    arrival_date: string;
    status: string;
  }>;
}

export const fetchWeeklyFinancials = async (): Promise<WeeklyFinancials> => {
  const { data } = await api.get('/financials/weekly');
  return data;
};

export default api;
