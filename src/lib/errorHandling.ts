import axios from 'axios';

type ApiErrorPayload = {
  error?: unknown;
};

export const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const responseError = (error.response?.data as ApiErrorPayload | undefined)?.error;

    if (typeof responseError === 'string' && responseError.trim()) {
      return responseError;
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};
