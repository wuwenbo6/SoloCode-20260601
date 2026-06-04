import { Request, Response } from 'express';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  extractVariablesFromContent
} from '../services/templateService';
import { checkDBConnection } from '../config/database';
import { memoryStore } from '../memoryStore';
import type { ApiResponse } from '../../shared/types';

export const getTemplates = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    if (!checkDBConnection()) {
      const templates = memoryStore.getTemplates();
      return res.json({
        success: true,
        message: '获取模板列表成功 (演示模式)',
        data: templates,
        total: templates.length
      });
    }

    const result = await getAllTemplates(page, pageSize);
    res.json({
      success: true,
      message: '获取模板列表成功',
      data: result.data,
      total: result.total
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取模板列表失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getTemplate = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    
    if (!checkDBConnection()) {
      const template = memoryStore.getTemplateById(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在'
        });
      }
      return res.json({
        success: true,
        message: '获取模板成功 (演示模式)',
        data: template
      });
    }

    const template = await getTemplateById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }
    res.json({
      success: true,
      message: '获取模板成功',
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取模板失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const create = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { name, description, content, variables, width } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: '模板名称和内容不能为空'
      });
    }

    const extractedVars = variables && variables.length > 0 
      ? variables 
      : extractVariablesFromContent(content);

    if (!checkDBConnection()) {
      const template = memoryStore.createTemplate({
        name,
        description: description || '',
        content,
        variables: extractedVars,
        width: width || 58
      });
      return res.status(201).json({
        success: true,
        message: '创建模板成功 (演示模式)',
        data: template
      });
    }

    const template = await createTemplate({
      name,
      description: description || '',
      content,
      variables: extractedVars,
      width: width || 58
    });

    res.status(201).json({
      success: true,
      message: '创建模板成功',
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建模板失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const update = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    const { name, description, content, variables, width } = req.body;

    let extractedVars = variables;
    if (content && (!variables || variables.length === 0)) {
      extractedVars = extractVariablesFromContent(content);
    }

    if (!checkDBConnection()) {
      const existing = memoryStore.getTemplateById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: '模板不存在'
        });
      }
      const template = memoryStore.updateTemplate(id, {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(content && { content }),
        ...(extractedVars && { variables: extractedVars }),
        ...(width && { width })
      });
      return res.json({
        success: true,
        message: '更新模板成功 (演示模式)',
        data: template
      });
    }

    const existing = await getTemplateById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    const template = await updateTemplate(id, {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(content && { content }),
      ...(extractedVars && { variables: extractedVars }),
      ...(width && { width })
    });

    res.json({
      success: true,
      message: '更新模板成功',
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新模板失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const remove = async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    
    if (!checkDBConnection()) {
      const template = memoryStore.deleteTemplate(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在'
        });
      }
      return res.json({
        success: true,
        message: '删除模板成功 (演示模式)'
      });
    }

    const template = await deleteTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }
    res.json({
      success: true,
      message: '删除模板成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除模板失败',
      data: error instanceof Error ? error.message : '未知错误'
    });
  }
};
