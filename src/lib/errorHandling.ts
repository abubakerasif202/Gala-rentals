import axios from 'axios';

type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
  step?: unknown;
};

export const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as ApiErrorPayload | undefined;
    const responseError = responseData?.error;
    const responseMessage = responseData?.message;
    const responseStep = responseData?.step;

    if (typeof responseError === 'string' && responseError.trim()) {
      if (typeof responseStep === 'string' && responseStep.trim() && typeof responseMessage === 'string' && responseMessage.trim()) {
        return `${responseError}: ${responseMessage}`;
      }
      return responseError;
    }

    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
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
