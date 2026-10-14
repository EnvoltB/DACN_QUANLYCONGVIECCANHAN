import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept to add JWT token & User Email if stored
api.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem('smarttask_current_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
      if (user.email) {
        config.headers['X-User-Email'] = user.email;
      }
    } catch (e) {
      // ignore
    }
  }
  return config;
});

export default api;
