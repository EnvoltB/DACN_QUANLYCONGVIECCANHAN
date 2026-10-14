import api from './api';

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  role: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', payload);
    const data = response.data;
    localStorage.setItem('smarttask_current_user', JSON.stringify(data));
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', payload);
    const data = response.data;
    localStorage.setItem('smarttask_current_user', JSON.stringify(data));
    return data;
  },

  logout(): void {
    localStorage.removeItem('smarttask_current_user');
  },

  getCurrentUser(): AuthResponse | null {
    const saved = localStorage.getItem('smarttask_current_user');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  },
};
