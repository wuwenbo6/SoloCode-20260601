import { History } from '../models/History';
import type { PrintHistory } from '../../shared/types';

export const getAllHistory = async (page = 1, pageSize = 20) => {
  const skip = (page - 1) * pageSize;
  const [data, total] = await Promise.all([
    History.find().sort({ printedAt: -1 }).skip(skip).limit(pageSize).lean(),
    History.countDocuments()
  ]);
  return { data, total };
};

export const createHistory = async (historyData: Omit<PrintHistory, '_id'>) => {
  const history = new History(historyData);
  await history.save();
  return history.toObject();
};

export const getHistoryStats = async () => {
  const [total, success, failed, today] = await Promise.all([
    History.countDocuments(),
    History.countDocuments({ status: 'success' }),
    History.countDocuments({ status: 'failed' }),
    History.countDocuments({
      printedAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    })
  ]);
  return { total, success, failed, today };
};
