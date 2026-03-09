import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from './AdminDashboard';

const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function AdminDashboardRoute() {
  return (
    <QueryClientProvider client={adminQueryClient}>
      <AdminDashboard />
    </QueryClientProvider>
  );
}
