export interface Car {
  id: number;
  name: string;
  model_year: number;
  weekly_price: number;
  bond: number;
  status: 'Available' | 'Rented' | 'Maintenance';
  image: string;
}

export interface Application {
  approved_at?: string | null;
  approved_bond?: number | null;
  approved_weekly_price?: number | null;
  assigned_car_id?: number | null;
  id: string;
  name: string;
  phone: string;
  email: string;
  license_number: string;
  license_expiry: string;
  uber_status: 'Active' | 'Applying' | 'Not Yet Registered';
  experience: string;
  address: string;
  weekly_budget: string;
  intended_start_date: string;
  license_photo?: string;
  license_back_photo?: string;
  paid_at?: string | null;
  payment_link_sent_at?: string | null;
  payment_link_version?: number;
  pending_checkout_session_id?: string | null;
  status: 'Pending' | 'Paid' | 'Approved' | 'Rejected' | 'Payment Review';
  created_at: string;
}

export interface Rental {
  id: number;
  application_id: string;
  bond_paid?: number;
  car_id: number;
  applicant_name?: string;
  car_name?: string;
  start_date: string;
  weekly_price: number;
  status: 'Active' | 'Completed' | 'Cancelled' | 'Overdue';
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_applications: number;
  active_rentals: number;
  total_weekly_income: number;
}

export interface AdminDatasetResponse<T> {
  available: boolean;
  items: T[];
  message?: string;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface OperationalCustomer {
  id: number;
  external_id?: string | null;
  staff_number?: string | null;
  full_name: string;
  preferred_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  street?: string | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  invoice_count: number;
  total_billed: number;
  outstanding_balance: number;
  last_invoice_date?: string | null;
}

export interface OperationalInvoice {
  id: string;
  external_invoice_number: string;
  customer_id?: number | null;
  customer_name: string;
  car_registration?: string | null;
  invoice_date: string;
  due_label?: string | null;
  amount: number;
  balance: number;
  transaction_summary?: string | null;
  source: string;
  created_at: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  status: 'Open' | 'Paid';
}
