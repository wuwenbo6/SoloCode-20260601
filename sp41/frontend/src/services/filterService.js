class KalmanFilter {
  constructor(processNoise = 0.01, measurementNoise = 1.0, estimationError = 1.0, initialValue = 70) {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
    this.estimationError = estimationError;
    this.currentEstimate = initialValue;
    this.errorCovariance = estimationError;
  }

  filter(measurement) {
    const kalmanGain = this.errorCovariance / (this.errorCovariance + this.measurementNoise);
    this.currentEstimate = this.currentEstimate + kalmanGain * (measurement - this.currentEstimate);
    this.errorCovariance = (1 - kalmanGain) * this.errorCovariance + this.processNoise;
    return this.currentEstimate;
  }

  reset(value = 70) {
    this.currentEstimate = value;
    this.errorCovariance = this.estimationError;
  }
}

class DataFilterService {
  constructor() {
    this.heartRateFilter = new KalmanFilter(0.1, 2.0, 1.0, 70);
    this.lastValidHeartRate = 70;
    this.heartRateHistory = [];
    this.maxHistoryLength = 10;
  }

  MIN_HEART_RATE = 30;
  MAX_HEART_RATE = 220;
  MAX_DELTA = 50;

  filterHeartRate(heartRate) {
    const rawValue = heartRate;

    if (!this.isValidHeartRate(rawValue)) {
      console.warn(`Invalid heart rate detected: ${rawValue}, filtering out`);
      return null;
    }

    if (this.isAbnormalJump(rawValue)) {
      console.warn(`Abnormal heart rate jump detected: ${this.lastValidHeartRate} -> ${rawValue}, filtering out`);
      return null;
    }

    const filteredValue = this.heartRateFilter.filter(rawValue);
    const roundedValue = Math.round(filteredValue);

    this.lastValidHeartRate = roundedValue;
    this.heartRateHistory.push(roundedValue);
    if (this.heartRateHistory.length > this.maxHistoryLength) {
      this.heartRateHistory.shift();
    }

    return roundedValue;
  }

  isValidHeartRate(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return false;
    }
    return value >= this.MIN_HEART_RATE && value <= this.MAX_HEART_RATE;
  }

  isAbnormalJump(newValue) {
    if (this.heartRateHistory.length < 2) {
      return false;
    }
    const delta = Math.abs(newValue - this.lastValidHeartRate);
    return delta > this.MAX_DELTA;
  }

  getMovingAverage(windowSize = 5) {
    if (this.heartRateHistory.length === 0) {
      return null;
    }
    const recentValues = this.heartRateHistory.slice(-windowSize);
    const sum = recentValues.reduce((a, b) => a + b, 0);
    return Math.round(sum / recentValues.length);
  }

  batchFilterHeartRates(heartRates) {
    const filtered = [];
    const anomalies = [];

    heartRates.forEach((hr, index) => {
      const result = this.filterHeartRate(hr.value);
      if (result !== null) {
        filtered.push({
          ...hr,
          rawValue: hr.value,
          filteredValue: result,
          filtered: false
        });
      } else {
        anomalies.push({
          ...hr,
          rawValue: hr.value,
          filtered: true,
          reason: hr.value < this.MIN_HEART_RATE || hr.value > this.MAX_HEART_RATE ? 'out_of_range' : 'abnormal_jump'
        });
      }
    });

    return {
      filtered,
      anomalies,
      stats: {
        total: heartRates.length,
        filteredCount: filtered.length,
        anomalyCount: anomalies.length,
        anomalyRate: heartRates.length > 0 
          ? Math.round((anomalies.length / heartRates.length) * 100)
          : 0
      }
    };
  }

  resetFilters() {
    this.heartRateFilter.reset(70);
    this.lastValidHeartRate = 70;
    this.heartRateHistory = [];
  }

  filterSteps(steps) {
    if (typeof steps !== 'number' || isNaN(steps) || steps < 0) {
      return null;
    }
    return Math.max(0, Math.round(steps));
  }

  filterSleepData(data) {
    const result = { ...data };

    if (data.heartRate !== undefined) {
      const filteredHR = this.filterHeartRate(data.heartRate);
      if (filteredHR !== null) {
        result.heartRate = filteredHR;
        result.heartRateRaw = data.heartRate;

      } else {
        result.heartRateFiltered = true;
      }
    }

    if (data.steps !== undefined) {
      const filteredSteps = this.filterSteps(data.steps);
      if (filteredSteps !== null) {
        result.steps = filteredSteps;
      }
    }

    return result;
  }
}

const filterService = new DataFilterService();
export default filterService;
