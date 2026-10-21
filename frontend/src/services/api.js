import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AI_BASE_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8000';

export const api = axios.create({ baseURL: API_BASE_URL });
export const aiApi = axios.create({ baseURL: AI_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart_retail_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Centralize "session expired" handling: if the token is invalid/expired,
// clear it and send the user back to a login screen instead of a silent failure.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('smart_retail_token');
      localStorage.removeItem('smart_retail_user');
    }
    return Promise.reject(err);
  }
);

export function getErrorMessage(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.';
}

export { API_BASE_URL, AI_BASE_URL };
