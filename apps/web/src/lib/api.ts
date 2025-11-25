import axios from 'axios';

// Ensure baseURL always ends with /api
let baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
if (baseURL && !baseURL.endsWith('/api')) {
  baseURL = baseURL.endsWith('/') ? `${baseURL}api` : `${baseURL}/api`;
}

// Log API configuration (always, not just in dev)
console.log('🔗 API Base URL:', baseURL);

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh and error logging
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't log errors for refresh endpoint to avoid spam
    if (originalRequest?.url !== '/auth/refresh') {
      console.error('API Error:', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        status: error.response?.status,
        message: error.message,
        response: error.response?.data,
      });
    }

    // If error is 401 and we haven't tried to refresh yet
    // AND it's not already a refresh request
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest?.url !== '/auth/refresh'
    ) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        await api.post('/auth/refresh');
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        console.error('Token refresh failed, redirecting to login');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // If refresh endpoint returns 401, redirect to login immediately
    if (error.response?.status === 401 && originalRequest?.url === '/auth/refresh') {
      console.error('Refresh token invalid, redirecting to login');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// API Functions

// Projects
export const projectsApi = {
  getAll: (params?: { status?: string; billingMode?: string }) =>
    api.get('/projects', { params }),
  getOne: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  archive: (id: string) => api.post(`/projects/${id}/archive`),
  unarchive: (id: string) => api.post(`/projects/${id}/unarchive`),
  
  // Time entries
  getTimeEntries: (projectId: string) => api.get(`/projects/${projectId}/time-entries`),
  startTimer: (projectId: string) => api.post(`/projects/${projectId}/time-entries/start`),
  stopTimer: (projectId: string, timeEntryId: string, note?: string) =>
    api.post(`/projects/${projectId}/time-entries/${timeEntryId}/stop`, { note }),
  
  // Todos
  getTodos: (projectId: string, params?: { filter?: string; sortBy?: string }) =>
    api.get(`/projects/${projectId}/todos`, { params }),
  createTodo: (projectId: string, data: any) => api.post(`/projects/${projectId}/todos`, data),
  
  // Invoices & Payments
  getProjectInvoices: (projectId: string) => api.get(`/projects/${projectId}/invoices`),
  getProjectPayments: (projectId: string) => api.get(`/projects/${projectId}/payments`),
};

// Time entries
export const timeEntriesApi = {
  getActive: () => api.get('/time-entries/active'),
  update: (id: string, data: any) => api.put(`/time-entries/${id}`, data),
  delete: (id: string) => api.delete(`/time-entries/${id}`),
};

// Todos
export const todosApi = {
  update: (id: string, data: any) => api.put(`/todos/${id}`, data),
  delete: (id: string) => api.delete(`/todos/${id}`),
};

// Invoices
export const invoicesApi = {
  getAll: (params?: { status?: string; startDate?: string; endDate?: string }) =>
    api.get('/invoices', { params }),
  getOne: (id: string) => api.get(`/invoices/${id}`),
  create: (data: any) => api.post('/invoices', data),
  update: (id: string, data: any) => api.put(`/invoices/${id}`, data),
  delete: (id: string) => api.delete(`/invoices/${id}`),
};

// Payments
export const paymentsApi = {
  getAll: (params?: { startDate?: string; endDate?: string; projectId?: string }) =>
    api.get('/payments', { params }),
  getOne: (id: string) => api.get(`/payments/${id}`),
  create: (data: any) => api.post('/payments', data),
  update: (id: string, data: any) => api.put(`/payments/${id}`, data),
  delete: (id: string) => api.delete(`/payments/${id}`),
};

// Analytics
export const analyticsApi = {
  getEarnings: (params?: { groupBy?: string; months?: string }) =>
    api.get('/analytics/earnings', { params }),
  getEarningsByProject: (params?: { period?: string; months?: string }) =>
    api.get('/analytics/earnings/by-project', { params }),
  getTime: (params?: { groupBy?: string; period?: string; projectId?: string; months?: string }) =>
    api.get('/analytics/time', { params }),
  getDashboard: () => api.get('/analytics/dashboard'),
  getProjectAnalytics: (projectId: string) => api.get(`/analytics/project/${projectId}`),
};

