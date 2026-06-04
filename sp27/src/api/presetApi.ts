import { Preset, PresetParams } from '../types';

const API_BASE = '/api';

export const presetApi = {
  async getAllPresets(): Promise<Preset[]> {
    const response = await fetch(`${API_BASE}/presets`);
    if (!response.ok) {
      throw new Error('Failed to fetch presets');
    }
    return response.json();
  },

  async getPreset(id: string): Promise<Preset> {
    const response = await fetch(`${API_BASE}/presets/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch preset');
    }
    return response.json();
  },

  async createPreset(name: string, params: PresetParams): Promise<Preset> {
    const response = await fetch(`${API_BASE}/presets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, params }),
    });
    if (!response.ok) {
      throw new Error('Failed to create preset');
    }
    return response.json();
  },

  async updatePreset(id: string, params: Partial<PresetParams>): Promise<Preset> {
    const response = await fetch(`${API_BASE}/presets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });
    if (!response.ok) {
      throw new Error('Failed to update preset');
    }
    return response.json();
  },

  async deletePreset(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/presets/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete preset');
    }
    return response.json();
  },
};
