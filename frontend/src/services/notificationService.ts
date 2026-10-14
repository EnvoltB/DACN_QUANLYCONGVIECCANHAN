import api from './api';

export interface NotificationItem {
  id: number;
  userId: number;
  taskId?: number;
  type: 'reminder' | 'ai' | 'alert' | 'success';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  time?: string;
}

export const notificationService = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    const res = await api.get('/notifications');
    return res.data;
  },

  evaluateNotifications: async (): Promise<NotificationItem[]> => {
    const res = await api.post('/notifications/evaluate');
    return res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await api.get('/notifications/unread-count');
    return res.data?.unreadCount ?? 0;
  },

  markAsRead: async (id: number): Promise<NotificationItem> => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async (): Promise<{ success: boolean; message: string }> => {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },

  deleteNotification: async (id: number): Promise<{ success: boolean }> => {
    const res = await api.delete(`/notifications/${id}`);
    return res.data;
  },

  clearAll: async (): Promise<{ success: boolean }> => {
    const res = await api.delete('/notifications/clear-all');
    return res.data;
  },

  createNotification: async (data: {
    title: string;
    message: string;
    type?: string;
    taskId?: number;
  }): Promise<NotificationItem> => {
    const res = await api.post('/notifications', data);
    return res.data;
  },
};
