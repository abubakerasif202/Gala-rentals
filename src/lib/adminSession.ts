import axios from 'axios';

export type AdminSessionFailureState = 'unauthorized' | 'forbidden' | 'error';

export const classifyAdminSessionFailure = (
  error: unknown
): AdminSessionFailureState => {
  if (!axios.isAxiosError(error)) {
    return 'error';
  }

  if (error.response?.status === 401) {
    return 'unauthorized';
  }

  if (error.response?.status === 403) {
    return 'forbidden';
  }

  return 'error';
};
