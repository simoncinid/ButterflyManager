import { create } from 'zustand';
import { api } from '../lib/api';

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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    set({ user: response.data.data.user, isAuthenticated: true });
  },

  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    set({ user: response.data.data.user, isAuthenticated: true });
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data.data.user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const response = await api.put('/auth/me', data);
    set({ user: response.data.data.user });
  },
}));

