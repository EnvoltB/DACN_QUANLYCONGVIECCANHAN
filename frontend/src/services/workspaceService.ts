import api from './api';

export interface WorkspaceItem {
  id: number;
  userId: number;
  name: string;
  iconName?: string;
  isDefault?: boolean;
}

export const workspaceService = {
  async getWorkspaces(): Promise<WorkspaceItem[]> {
    const res = await api.get<WorkspaceItem[]>('/workspaces');
    return res.data;
  },

  async createWorkspace(name: string): Promise<WorkspaceItem> {
    const res = await api.post<WorkspaceItem>('/workspaces', { name });
    return res.data;
  },

  async updateWorkspace(id: number, name: string): Promise<WorkspaceItem> {
    const res = await api.put<WorkspaceItem>(`/workspaces/${id}`, { name });
    return res.data;
  },

  async deleteWorkspace(id: number): Promise<void> {
    await api.delete(`/workspaces/${id}`);
  },
};
