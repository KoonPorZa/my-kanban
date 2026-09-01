import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

import { redirectExpiredSession } from './session-expiry';

const api = axios.create({ withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    redirectExpiredSession(error.response?.status, error.config?.url);
    return Promise.reject(error);
  }
);

export async function apiClient<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> {
  const response = await api.request<T>({ ...config, ...options });
  return response.data;
}

export type ErrorType<Error> = AxiosError<Error>;
