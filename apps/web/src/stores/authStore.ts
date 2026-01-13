import { create } from 'zustand';
import { api, setTokens, clearTokens, getAccessToken } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isCheckingAuth: false,

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = response.data.data;
    // Save tokens to localStorage
    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
    }
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    const { user, accessToken, refreshToken } = response.data.data;
    // Save tokens to localStorage
    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
    }
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false, isCheckingAuth: false });
  },

  checkAuth: async () => {
    // Prevent multiple simultaneous calls
    if (get().isCheckingAuth) {
      return;
    }

    // If already loaded and authenticated, don't check again
    if (!get().isLoading && get().isAuthenticated) {
      return;
    }

    // Check if we have a token in localStorage
    const token = getAccessToken();
    if (!token) {
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false,
        isCheckingAuth: false 
      });
      return;
    }

    set({ isCheckingAuth: true });

    try {
      const response = await api.get('/auth/me');
      set({ 
        user: response.data.data.user, 
        isAuthenticated: true, 
        isLoading: false,
        isCheckingAuth: false 
      });
    } catch (error: any) {
      // If 401, clear tokens and set as not authenticated
      if (error.response?.status === 401) {
        clearTokens();
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false,
          isCheckingAuth: false 
        });
      } else {
        // For other errors, keep loading state but mark as not checking
        set({ 
          isLoading: false,
          isCheckingAuth: false 
        });
      }
    }
  },

  updateProfile: async (data) => {
    const response = await api.put('/auth/me', data);
    set({ user: response.data.data.user });
  },
}));

