import type { PrintTemplate, PrintHistory } from '../shared/types';

const now = new Date().toISOString();

export const mockTemplates: PrintTemplate[] = [
  {
    _id: 'mock-1',
    name: '标准收据',
    description: '通用收银收据模板',
    width: 58,
    content: `{店名}
{地址}
{电话}
----------------
商品名称      金额
{商品列表}
----------------
合计: {合计金额}
实收: {实收金额}
找零: {找零金额}
----------------
谢谢惠顾，欢迎再次光临！
{日期时间}`,
    variables: [
      { name: '店名', label: '店铺名称', type: 'string', required: true },
      { name: '地址', label: '店铺地址', type: 'string', required: false },
      { name: '电话', label: '联系电话', type: 'string', required: false },
      { name: '商品列表', label: '商品明细', type: 'string', required: true },
      { name: '合计金额', label: '合计金额', type: 'number', required: true },
      { name: '实收金额', label: '实收金额', type: 'number', required: true },
      { name: '找零金额', label: '找零金额', type: 'number', required: true },
      { name: '日期时间', label: '打印时间', type: 'date', required: true }
    ],
    createdAt: now,
    updatedAt: now
  },
  {
    _id: 'mock-2',
    name: '餐饮小票',
    description: '餐厅订单打印模板',
    width: 58,
    content: `{店名}
{桌号} {人数}人
{下单时间}
----------------
{菜品列表}
----------------
小计: {小计金额}
服务费: {服务费}
合计: {合计金额}
----------------
{备注}
请妥善保管好您的随身物品`,
    variables: [
      { name: '店名', label: '店铺名称', type: 'string', required: true },
      { name: '桌号', label: '桌号', type: 'string', required: true },
      { name: '人数', label: '用餐人数', type: 'number', required: true },
      { name: '下单时间', label: '下单时间', type: 'date', required: true },
      { name: '菜品列表', label: '菜品明细', type: 'string', required: true },
      { name: '小计金额', label: '小计金额', type: 'number', required: true },
      { name: '服务费', label: '服务费', type: 'number', required: false, defaultValue: '0' },
      { name: '合计金额', label: '合计金额', type: 'number', required: true },
      { name: '备注', label: '备注', type: 'string', required: false }
    ],
    createdAt: now,
    updatedAt: now
  },
  {
    _id: 'mock-3',
    name: '外卖订单',
    description: '外卖配送小票模板',
    width: 58,
    content: `{店名}
==== 外卖订单 ====
订单号: {订单号}
{下单时间}
----------------
配送地址: {配送地址}
联系人: {联系人}
电话: {联系电话}
----------------
{商品列表}
----------------
商品: {商品金额}
配送费: {配送费}
合计: {合计金额}
----------------
{备注}`,
    variables: [
      { name: '店名', label: '店铺名称', type: 'string', required: true },
      { name: '订单号', label: '订单号', type: 'string', required: true },
      { name: '下单时间', label: '下单时间', type: 'date', required: true },
      { name: '配送地址', label: '配送地址', type: 'string', required: true },
      { name: '联系人', label: '联系人', type: 'string', required: true },
      { name: '联系电话', label: '联系电话', type: 'string', required: true },
      { name: '商品列表', label: '商品明细', type: 'string', required: true },
      { name: '商品金额', label: '商品金额', type: 'number', required: true },
      { name: '配送费', label: '配送费', type: 'number', required: true },
      { name: '合计金额', label: '合计金额', type: 'number', required: true },
      { name: '备注', label: '备注', type: 'string', required: false }
    ],
    createdAt: now,
    updatedAt: now
  }
];

let templates = [...mockTemplates];
let history: PrintHistory[] = [
  {
    _id: 'h-1',
    templateId: 'mock-1',
    templateName: '标准收据',
    data: { 店名: '测试商店', 合计金额: 100 },
    status: 'success',
    printerName: 'EPSON TM-T88V',
    printedAt: now,
    errorMessage: ''
  }
];
let nextId = 4;
let nextHistoryId = 2;

export const memoryStore = {
  getTemplates: () => templates,
  getTemplateById: (id: string) => templates.find(t => t._id === id),
  createTemplate: (data: Omit<PrintTemplate, '_id' | 'createdAt' | 'updatedAt'>) => {
    const newTemplate: PrintTemplate = {
      ...data,
      _id: `mock-${nextId++}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    templates.push(newTemplate);
    return newTemplate;
  },
  updateTemplate: (id: string, data: Partial<PrintTemplate>) => {
    const index = templates.findIndex(t => t._id === id);
    if (index === -1) return null;
    templates[index] = {
      ...templates[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    return templates[index];
  },
  deleteTemplate: (id: string) => {
    const index = templates.findIndex(t => t._id === id);
    if (index === -1) return null;
    const deleted = templates[index];
    templates.splice(index, 1);
    return deleted;
  },
  getHistory: () => history,
  createHistory: (data: Omit<PrintHistory, '_id'>) => {
    const newHistory: PrintHistory = {
      ...data,
      _id: `h-${nextHistoryId++}`
    };
    history.unshift(newHistory);
    return newHistory;
  },
  getStats: () => {
    const today = new Date().toDateString();
    const todayCount = history.filter(h => new Date(h.printedAt).toDateString() === today).length;
    const successCount = history.filter(h => h.status === 'success').length;
    const failedCount = history.filter(h => h.status === 'failed').length;
    return {
      total: history.length,
      today: todayCount,
      success: successCount,
      failed: failedCount
    };
  }
};
