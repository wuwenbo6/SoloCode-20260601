import { Template } from '../models/Template';
import type { PrintTemplate, TemplateVariable } from '../../shared/types';

export const getAllTemplates = async (page = 1, pageSize = 20) => {
  const skip = (page - 1) * pageSize;
  const [data, total] = await Promise.all([
    Template.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Template.countDocuments()
  ]);
  return { data, total };
};

export const getTemplateById = async (id: string) => {
  return Template.findById(id).lean();
};

export const createTemplate = async (templateData: Omit<PrintTemplate, '_id' | 'createdAt' | 'updatedAt'>) => {
  const template = new Template(templateData);
  await template.save();
  return template.toObject();
};

export const updateTemplate = async (
  id: string,
  templateData: Partial<Omit<PrintTemplate, '_id' | 'createdAt' | 'updatedAt'>>
) => {
  return Template.findByIdAndUpdate(
    id,
    { $set: templateData },
    { new: true, runValidators: true }
  ).lean();
};

export const deleteTemplate = async (id: string) => {
  return Template.findByIdAndDelete(id).lean();
};

export const extractVariablesFromContent = (content: string): TemplateVariable[] => {
  const regex = /\{([^}]+)\}/g;
  const matches = content.match(regex) || [];
  const varNames = [...new Set(matches.map(m => m.slice(1, -1)))];
  
  return varNames.map(name => ({
    name,
    label: name,
    type: 'string' as const,
    required: true,
    defaultValue: ''
  }));
};
