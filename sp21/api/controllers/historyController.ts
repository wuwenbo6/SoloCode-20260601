import { Request, Response } from 'express';
import { getAllHistory, createHistory, getHistoryStats } from '../services/historyService';
import { checkDBConnection } from '../config/database';
import { memoryStore } from '../memoryStore';
import type { ApiResponse } from '../../shared/types';

export const getHistory = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    if (!checkDBConnection()) {
      const history = memoryStore.getHistory();
      return res.json({
        success: true,
        message: '获取打印历史成功 (演示模式)',
        data: history,
        total: history.length
      });
    }

    const result = await getAllHistory(page, pageSize);
    res.json({
      success: true,
      message: '获取打印历史成功',
      data: result.data,
      total: result.total
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取打印历史失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const create = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { templateId, templateName, data, status, errorMessage, printerName } = req.body;
    
    if (!templateId || !templateName || !data || !printerName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    const historyData = {
      templateId,
      templateName,
      data,
      status: status || 'success',
      errorMessage: errorMessage || '',
      printerName,
      printedAt: new Date().toISOString()
    };

    if (!checkDBConnection()) {
      const history = memoryStore.createHistory(historyData);
      return res.status(201).json({
        success: true,
        message: '记录打印历史成功 (演示模式)',
        data: history
      });
    }

    const history = await createHistory(historyData);

    res.status(201).json({
      success: true,
      message: '记录打印历史成功',
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '记录打印历史失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getStats = async (_req: Request, res: Response<ApiResponse<any>>) => {
  try {
    if (!checkDBConnection()) {
      const stats = memoryStore.getStats();
      return res.json({
        success: true,
        message: '获取统计数据成功 (演示模式)',
        data: stats
      });
    }

    const stats = await getHistoryStats();
    res.json({
      success: true,
      message: '获取统计数据成功',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};
