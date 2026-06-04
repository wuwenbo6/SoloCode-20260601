import { dataApi } from '../api';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncProgress = 0;
    this.totalPages = 0;
    this.currentPage = 0;
    this.retryCount = 3;
    this.retryDelay = 2000;
    this.pageSizeDays = 7;
  }

  async syncHistoricalData(deviceId, days = 30, onProgress = null, onComplete = null, onError = null) {
    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    this.isSyncing = true;
    this.syncProgress = 0;
    this.totalPages = Math.ceil(days / this.pageSizeDays);
    this.currentPage = 0;

    const allData = [];

    try {
      for (let page = 0; page < this.totalPages; page++) {
        this.currentPage = page;
        const startDay = page * this.pageSizeDays;
        const endDay = Math.min((page + 1) * this.pageSizeDays, days);
        const actualDays = endDay - startDay;

        if (onProgress) {
          onProgress({
            currentPage: page + 1,
            totalPages: this.totalPages,
            progress: Math.round(((page) / this.totalPages) * 100),
            status: `正在同步第 ${page + 1}/${this.totalPages} 页 (${actualDays}天数据)`
          });
        }

        const pageData = await this.syncPageWithRetry(deviceId, startDay, endDay, page);
        allData.push(...pageData);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.syncProgress = 100;
      this.isSyncing = false;

      if (onComplete) {
        onComplete({
          totalPages: this.totalPages,
          totalRecords: allData.length,
          data: allData
        });
      }

      return { success: true, totalRecords: allData.length, data: allData };
    } catch (error) {
      this.isSyncing = false;
      if (onError) {
        onError(error);
      }
      return { success: false, error: error.message };
    }
  }

  async syncPageWithRetry(deviceId, startDay, endDay, pageIndex) {
    let lastError = null;

    for (let retry = 0; retry < this.retryCount; retry++) {
      try {
        return await this.syncPage(deviceId, startDay, endDay);
      } catch (error) {
        lastError = error;
        console.warn(`Page ${pageIndex + 1} sync failed (retry ${retry + 1}/${this.retryCount}):`, error.message);
        
        if (retry < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retry + 1)));
        }
      }
    }

    throw new Error(`Page ${pageIndex + 1} sync failed after ${this.retryCount} retries: ${lastError?.message}`);
  }

  async syncPage(deviceId, startDay, endDay) {
    const pageData = [];
    const now = new Date();

    for (let dayOffset = startDay; dayOffset < endDay; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      date.setHours(0, 0, 0, 0);

      const dailyData = this.generateDailyHistoricalData(date);
      pageData.push(...dailyData);
    }

    const batchSize = 100;
    for (let i = 0; i < pageData.length; i += batchSize) {
      const batch = pageData.slice(i, i + batchSize);
      try {
        await dataApi.sendBatch(deviceId, batch);
      } catch (error) {
        console.error('Batch send failed:', error);
        throw error;
      }
    }

    return pageData;
  }

  generateDailyHistoricalData(date) {
    const data = [];
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const baseSteps = isWeekend ? 8000 : 5000;
    const dailySteps = baseSteps + Math.floor(Math.random() * 5000);

    data.push({
      type: 'steps',
      value: dailySteps,
      timestamp: date.toISOString()
    });

    for (let hour = 0; hour < 24; hour++) {
      const hourDate = new Date(date);
      hourDate.setHours(hour);

      let baseHeartRate = 70;
      if (hour >= 6 && hour < 9) baseHeartRate = 85;
      else if (hour >= 12 && hour < 14) baseHeartRate = 80;
      else if (hour >= 18 && hour < 21) baseHeartRate = 75;
      else if (hour >= 23 || hour < 6) baseHeartRate = 55;

      const heartRate = baseHeartRate + Math.floor(Math.random() * 20) - 10;

      data.push({
        type: 'heartRate',
        value: heartRate,
        timestamp: hourDate.toISOString()
      });
    }

    const sleepDate = new Date(date);
    sleepDate.setHours(22);

    data.push(
      { type: 'sleep', stage: 'light', duration: 2.5, timestamp: sleepDate.toISOString() },
      { type: 'sleep', stage: 'deep', duration: 3.5, timestamp: sleepDate.toISOString() },
      { type: 'sleep', stage: 'rem', duration: 1.5, timestamp: sleepDate.toISOString() },
      { type: 'sleep', stage: 'awake', duration: 0.5, timestamp: sleepDate.toISOString() }
    );

    return data;
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      progress: this.syncProgress,
      currentPage: this.currentPage,
      totalPages: this.totalPages
    };
  }

  cancelSync() {
    this.isSyncing = false;
  }
}

const syncService = new SyncService();
export default syncService;
