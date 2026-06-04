const ACTIVITY_TYPES = {
  WALKING: 'walking',
  RUNNING: 'running',
  CYCLING: 'cycling',
  SWIMMING: 'swimming',
  RESTING: 'resting',
  UNKNOWN: 'unknown'
};

const ACTIVITY_LABELS_CN = {
  walking: '步行',
  running: '跑步',
  cycling: '骑行',
  swimming: '游泳',
  resting: '静止',
  unknown: '未知'
};

class ActivityRecognitionService {
  constructor() {
    this.activityHistory = [];
    this.maxHistoryLength = 50;
    this.currentActivity = ACTIVITY_TYPES.RESTING;
    this.activityConfidence = 0.0;
    this.activityStartTime = Date.now();
    this.lastSteps = 0;
    this.lastHeartRate = 70;
    this.lastAccelerometer = null;
    this.sampleCount = 0;
  }

  recognizeActivity(data) {
    const {
      accelerometer,
      heartRate,
      steps,
      stepsDelta,
      timestamp = Date.now()
    } = data;

    const features = this.extractFeatures({
      accelerometer,
      heartRate,
      steps,
      stepsDelta,
      timestamp
    });

    const result = this.classifyActivity(features);

    this.activityHistory.push({
      ...result,
      features,
      timestamp
    });

    if (this.activityHistory.length > this.maxHistoryLength) {
      this.activityHistory.shift();
    }

    if (result.activityType !== this.currentActivity && result.confidence > 0.6) {
      const previousActivity = this.currentActivity;
      const duration = (timestamp - this.activityStartTime) / 1000;

      this.currentActivity = result.activityType;
      this.activityConfidence = result.confidence;
      this.activityStartTime = timestamp;

      result.activityChange = {
        from: previousActivity,
        to: result.activityType,
        duration
      };
    } else {
      this.activityConfidence = Math.max(
        this.activityConfidence * 0.7,
        result.confidence * 0.3
      );
      result.confidence = this.activityConfidence;
    }

    this.sampleCount++;
    this.lastSteps = steps || this.lastSteps;
    this.lastHeartRate = heartRate || this.lastHeartRate;
    if (accelerometer) {
      this.lastAccelerometer = accelerometer;
    }

    return {
      ...result,
      activityLabel: ACTIVITY_LABELS_CN[result.activityType],
      currentDuration: (timestamp - this.activityStartTime) / 1000
    };
  }

  extractFeatures(data) {
    const { accelerometer, heartRate, steps, stepsDelta, timestamp } = data;

    let currentSteps = steps;
    let currentStepsDelta = stepsDelta;

    if (currentStepsDelta === undefined && currentSteps !== undefined) {
      currentStepsDelta = currentSteps - this.lastSteps;
    } else if (currentSteps === undefined && currentStepsDelta !== undefined) {
      currentSteps = this.lastSteps + currentStepsDelta;
    } else if (currentSteps === undefined && currentStepsDelta === undefined) {
      currentSteps = this.lastSteps;
      currentStepsDelta = 0;
    }

    const features = {
      timestamp,
      heartRate: heartRate || this.lastHeartRate,
      steps: currentSteps,
      stepsDelta: currentStepsDelta,
      isFirstSample: this.sampleCount === 0
    };

    if (accelerometer) {
      const magnitude = Math.sqrt(
        accelerometer.x ** 2 +
        accelerometer.y ** 2 +
        accelerometer.z ** 2
      );

      let deltaMagnitude = 0;
      let deltaX = 0, deltaY = 0, deltaZ = 0;

      if (this.lastAccelerometer !== null && this.sampleCount > 0) {
        deltaX = accelerometer.x - this.lastAccelerometer.x;
        deltaY = accelerometer.y - this.lastAccelerometer.y;
        deltaZ = accelerometer.z - this.lastAccelerometer.z;
        deltaMagnitude = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
      }

      features.accelerometer = {
        x: accelerometer.x,
        y: accelerometer.y,
        z: accelerometer.z,
        magnitude,
        deltaX,
        deltaY,
        deltaZ,
        deltaMagnitude
      };

      features.variance = this.calculateVariance();
      features.peakFrequency = this.detectPeakFrequency(accelerometer);
    } else {
      features.accelerometer = null;
      features.variance = 0;
      features.peakFrequency = 0;
    }

    return features;
  }

  calculateVariance() {
    if (this.activityHistory.length < 2) return 0;

    const recentMagnitudes = this.activityHistory
      .slice(-10)
      .map(h => h.features.accelerometer?.magnitude || 1)
      .filter(m => m !== undefined);

    if (recentMagnitudes.length < 2) return 0;

    const mean = recentMagnitudes.reduce((a, b) => a + b, 0) / recentMagnitudes.length;
    const variance = recentMagnitudes.reduce((sum, val) => sum + (val - mean) ** 2, 0) / recentMagnitudes.length;

    return variance;
  }

  detectPeakFrequency(accelerometer) {
    if (!accelerometer) return 0;

    const magnitude = Math.sqrt(
      accelerometer.x ** 2 +
      accelerometer.y ** 2 +
      accelerometer.z ** 2
    );

    if (magnitude < 1.2) return 0;

    const recent = this.activityHistory.slice(-20);
    let peaks = 0;
    for (let i = 1; i < recent.length - 1; i++) {
      const prevMag = recent[i - 1].features.accelerometer?.magnitude || 0;
      const currMag = recent[i].features.accelerometer?.magnitude || 0;
      const nextMag = recent[i + 1].features.accelerometer?.magnitude || 0;

      if (currMag > prevMag && currMag > nextMag && currMag > 1.5) {
        peaks++;
      }
    }

    return peaks / 20;
  }

  classifyActivity(features) {
    const scores = {
      [ACTIVITY_TYPES.RESTING]: 0,
      [ACTIVITY_TYPES.WALKING]: 0,
      [ACTIVITY_TYPES.RUNNING]: 0,
      [ACTIVITY_TYPES.CYCLING]: 0,
      [ACTIVITY_TYPES.SWIMMING]: 0
    };

    if (features.heartRate < 60) {
      scores[ACTIVITY_TYPES.RESTING] += 30;
    } else if (features.heartRate < 90) {
      scores[ACTIVITY_TYPES.WALKING] += 20;
      scores[ACTIVITY_TYPES.CYCLING] += 15;
    } else if (features.heartRate < 120) {
      scores[ACTIVITY_TYPES.WALKING] += 25;
      scores[ACTIVITY_TYPES.RUNNING] += 20;
      scores[ACTIVITY_TYPES.CYCLING] += 20;
    } else if (features.heartRate < 150) {
      scores[ACTIVITY_TYPES.RUNNING] += 40;
      scores[ACTIVITY_TYPES.SWIMMING] += 30;
      scores[ACTIVITY_TYPES.CYCLING] += 20;
    } else if (features.heartRate < 170) {
      scores[ACTIVITY_TYPES.RUNNING] += 55;
      scores[ACTIVITY_TYPES.SWIMMING] += 40;
      scores[ACTIVITY_TYPES.CYCLING] += 25;
    } else {
      scores[ACTIVITY_TYPES.RUNNING] += 60;
      scores[ACTIVITY_TYPES.SWIMMING] += 45;
    }

    if (features.stepsDelta > 30) {
      scores[ACTIVITY_TYPES.RUNNING] += 45;
      scores[ACTIVITY_TYPES.CYCLING] -= 15;
      scores[ACTIVITY_TYPES.SWIMMING] -= 10;
    } else if (features.stepsDelta > 15) {
      scores[ACTIVITY_TYPES.WALKING] += 40;
      scores[ACTIVITY_TYPES.RUNNING] += 15;
      scores[ACTIVITY_TYPES.CYCLING] -= 10;
      scores[ACTIVITY_TYPES.SWIMMING] -= 5;
    } else if (features.stepsDelta > 5) {
      scores[ACTIVITY_TYPES.WALKING] += 25;
    } else if (features.stepsDelta === 0) {
      scores[ACTIVITY_TYPES.RESTING] += 25;
      scores[ACTIVITY_TYPES.CYCLING] += 30;
      scores[ACTIVITY_TYPES.SWIMMING] += 25;
      scores[ACTIVITY_TYPES.RUNNING] -= 20;
      scores[ACTIVITY_TYPES.WALKING] -= 15;
    }

    if (features.accelerometer) {
      const { magnitude, deltaMagnitude } = features.accelerometer;
      const { variance, peakFrequency } = features;

      const hasVariance = variance > 0;
      const highVariance = variance > 0.1;
      const mediumVariance = variance > 0.05 && variance < 0.3;
      const highDelta = deltaMagnitude > 0.5;
      const veryHighDelta = deltaMagnitude > 1.5;

      if (magnitude < 1.05 && deltaMagnitude < 0.1) {
        scores[ACTIVITY_TYPES.RESTING] += 40;
      } else if (magnitude > 1.1 && magnitude < 1.5 && deltaMagnitude < 0.3) {
        scores[ACTIVITY_TYPES.WALKING] += 30;
      } else if (magnitude > 1.5 && (highVariance || veryHighDelta)) {
        scores[ACTIVITY_TYPES.RUNNING] += 40;
        if (magnitude > 3.0) {
          scores[ACTIVITY_TYPES.RUNNING] += 15;
        }
      } else if (magnitude > 1.2 && magnitude < 2.0 && (mediumVariance || highDelta)) {
        scores[ACTIVITY_TYPES.CYCLING] += 40;
        scores[ACTIVITY_TYPES.SWIMMING] -= 15;
      }

      if (veryHighDelta && magnitude > 2.0) {
        scores[ACTIVITY_TYPES.RUNNING] += 20;
        scores[ACTIVITY_TYPES.SWIMMING] += 15;
        scores[ACTIVITY_TYPES.CYCLING] -= 10;
      }

      if (magnitude > 2.0 && features.stepsDelta === 0) {
        scores[ACTIVITY_TYPES.SWIMMING] += 30;
        scores[ACTIVITY_TYPES.CYCLING] -= 20;
      }

      if (magnitude > 1.0 && magnitude < 2.0 && features.stepsDelta === 0) {
        scores[ACTIVITY_TYPES.CYCLING] += 25;
        scores[ACTIVITY_TYPES.SWIMMING] -= 10;
      }

      if (peakFrequency > 2.5) {
        scores[ACTIVITY_TYPES.RUNNING] += 30;
      } else if (peakFrequency > 1.5) {
        scores[ACTIVITY_TYPES.WALKING] += 25;
      } else if (peakFrequency > 0.8 && peakFrequency < 1.5) {
        scores[ACTIVITY_TYPES.SWIMMING] += 20;
        scores[ACTIVITY_TYPES.CYCLING] += 15;
      }

      if (features.accelerometer.z < -0.5 && deltaMagnitude > 0.3) {
        scores[ACTIVITY_TYPES.SWIMMING] += 40;
        scores[ACTIVITY_TYPES.CYCLING] -= 15;
      }
    }

    const recentBias = this.getRecentActivityBias();
    Object.keys(scores).forEach(activity => {
      scores[activity] += recentBias[activity] || 0;
    });

    let maxScore = -Infinity;
    let bestActivity = ACTIVITY_TYPES.UNKNOWN;

    Object.entries(scores).forEach(([activity, score]) => {
      if (score > maxScore) {
        maxScore = score;
        bestActivity = activity;
      }
    });

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(0.95, maxScore / totalScore + 0.1) : 0.3;

    return {
      activityType: bestActivity,
      confidence,
      scores
    };
  }

  getRecentActivityBias() {
    const bias = {};
    const recent = this.activityHistory.slice(-5);

    recent.forEach(h => {
      const activity = h.activityType;
      bias[activity] = (bias[activity] || 0) + 8;
    });

    if (this.currentActivity && Date.now() - this.activityStartTime < 60000) {
      bias[this.currentActivity] = (bias[this.currentActivity] || 0) + 15;
    }

    return bias;
  }

  getCurrentActivity() {
    return {
      activityType: this.currentActivity,
      activityLabel: ACTIVITY_LABELS_CN[this.currentActivity],
      confidence: this.activityConfidence,
      duration: (Date.now() - this.activityStartTime) / 1000,
      startTime: this.activityStartTime
    };
  }

  getActivityStats() {
    const stats = {};
    let lastActivity = null;
    let lastTime = null;

    this.activityHistory.forEach(entry => {
      if (!stats[entry.activityType]) {
        stats[entry.activityType] = {
          count: 0,
          totalDuration: 0,
          avgConfidence: 0
        };
      }

      stats[entry.activityType].count++;
      stats[entry.activityType].avgConfidence += entry.confidence;

      if (lastActivity && lastTime) {
        stats[lastActivity].totalDuration += (entry.timestamp - lastTime) / 1000;
      }

      lastActivity = entry.activityType;
      lastTime = entry.timestamp;
    });

    Object.keys(stats).forEach(key => {
      const s = stats[key];
      s.avgConfidence = s.count > 0 ? s.avgConfidence / s.count : 0;
    });

    return stats;
  }

  reset() {
    this.activityHistory = [];
    this.currentActivity = ACTIVITY_TYPES.RESTING;
    this.activityConfidence = 0.0;
    this.activityStartTime = Date.now();
    this.lastSteps = 0;
    this.lastHeartRate = 70;
    this.lastAccelerometer = null;
    this.sampleCount = 0;
  }
}

const activityRecognitionService = new ActivityRecognitionService();

module.exports = {
  activityRecognitionService,
  ACTIVITY_TYPES,
  ACTIVITY_LABELS_CN
};
