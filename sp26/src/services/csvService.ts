import { api } from '@/lib/axios';
import type { CreateAssetRequest, Asset, ApiResponse } from '../../shared/types';

export const csvService = {
  async exportAssets(status?: string, category?: string) {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (category) params.category = category;
    
    const response = await api.get('/csv/export', {
      params,
      responseType: 'blob',
    });
    
    const blob = new Blob([response as unknown as BlobPart], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `assets_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async importAssets(data: Omit<CreateAssetRequest, 'uid'>[]): Promise<{
    total: number;
    success: number;
    failed: number;
    successItems: string[];
    failedItems: Array<{ row: number; error: string; data: unknown }>;
  }> {
    const { data: result } = await api.post<{
      success: boolean;
      data: {
        total: number;
        success: number;
        failed: number;
        successItems: string[];
        failedItems: Array<{ row: number; error: string; data: unknown }>;
      };
    }>('/csv/import', { data });
    return result.data;
  },

  parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    
    return lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index]?.trim() || '';
      });
      return obj;
    });
  },

  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result;
  },

  mapToAssetData(rows: Record<string, string>[]): Omit<CreateAssetRequest, 'uid'>[] {
    const statusMap: Record<string, string> = {
      '在用': 'in_use',
      '闲置': 'idle',
      '维修中': 'maintenance',
      '报废': 'scrapped',
    };

    return rows.map(row => ({
      uid: row['UID'] || row['uid'] || '',
      name: row['资产名称'] || row['name'] || '',
      category: row['分类'] || row['category'] || '',
      location: row['位置'] || row['location'] || '',
      status: (statusMap[row['状态'] || row['status']] || row['状态'] || row['status'] || 'idle') as any,
      description: row['描述'] || row['description'] || undefined,
      imageUrl: row['图片URL'] || row['imageUrl'] || undefined,
      purchaseDate: row['采购日期'] || row['purchaseDate'] || undefined,
      purchasePrice: row['采购价格'] || row['purchasePrice'] 
        ? Number(row['采购价格'] || row['purchasePrice']) 
        : undefined,
    }));
  },

  generateTemplate(): string {
    const headers = [
      'UID',
      '资产名称',
      '分类',
      '位置',
      '状态',
      '描述',
      '图片URL',
      '采购日期',
      '采购价格',
    ];
    
    const exampleRow = [
      'E00401000000000000000001',
      'MacBook Pro 16寸',
      '电子设备',
      '办公室A-301',
      '在用',
      '研发部使用',
      '',
      '2024-01-15',
      '19999',
    ];

    return [
      headers.join(','),
      exampleRow.map(cell => `"${cell}"`).join(','),
    ].join('\n');
  },

  downloadTemplate() {
    const template = this.generateTemplate();
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'assets_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default csvService;
