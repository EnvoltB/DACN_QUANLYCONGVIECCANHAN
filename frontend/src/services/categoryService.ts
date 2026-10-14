import api from './api';
import { Category, CategoryType } from '../types';

interface DbCategory {
  id: number;
  name: string;
  colorCode: string;
  iconName: string;
  isDefault: boolean;
}

const typeMap: Record<string, { type: CategoryType; bgColor: string }> = {
  'Học tập': { type: 'STUDY', bgColor: '#EFF6FF' },
  'Công việc': { type: 'WORK', bgColor: '#F3E8FF' },
  'Sức khỏe': { type: 'HEALTH', bgColor: '#ECFDF5' },
  'Giải trí': { type: 'ENTERTAINMENT', bgColor: '#FFFBEB' },
};

export const categoryService = {
  async getCategories(workspaceId?: number): Promise<Category[]> {
    const params = workspaceId ? { workspaceId } : {};
    const response = await api.get<DbCategory[]>('/categories', { params });
    return response.data.map((cat) => {
      const mapped = typeMap[cat.name] || { type: 'WORK' as CategoryType, bgColor: '#F0EDFF' };
      return {
        id: cat.id,
        name: cat.name,
        type: mapped.type,
        colorCode: cat.colorCode || '#6C5CE7',
        bgColor: mapped.bgColor,
        iconName: cat.iconName || 'Circle',
      };
    });
  },

  async createCategory(data: { name: string; colorCode?: string; iconName?: string; workspaceId?: number }): Promise<Category> {
    const params = data.workspaceId ? { workspaceId: data.workspaceId } : {};
    const response = await api.post<DbCategory>('/categories', data, { params });
    const cat = response.data;
    const mapped = typeMap[cat.name] || { type: 'WORK' as CategoryType, bgColor: '#F0EDFF' };
    return {
      id: cat.id,
      name: cat.name,
      type: mapped.type,
      colorCode: cat.colorCode || '#6C5CE7',
      bgColor: mapped.bgColor,
      iconName: cat.iconName || 'Circle',
    };
  },

  async updateCategory(id: number, data: { name?: string; colorCode?: string; iconName?: string }): Promise<Category> {
    const response = await api.put<DbCategory>(`/categories/${id}`, data);
    const cat = response.data;
    const mapped = typeMap[cat.name] || { type: 'WORK' as CategoryType, bgColor: '#F0EDFF' };
    return {
      id: cat.id,
      name: cat.name,
      type: mapped.type,
      colorCode: cat.colorCode || '#6C5CE7',
      bgColor: mapped.bgColor,
      iconName: cat.iconName || 'Circle',
    };
  },

  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};
