import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const api = axios.create({ withCredentials: true });

export async function apiClient<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> {
  const response = await api.request<T>({ ...config, ...options });
  return response.data;
}

export type ErrorType<Error> = AxiosError<Error>;
