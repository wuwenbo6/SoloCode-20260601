import type { EncodingConfig, StreamStats } from './types';

export interface BandwidthEstimatorOptions {
  onConfigChange: (config: Partial<EncodingConfig>) => void;
  minBitrate?: number;
  maxBitrate?: number;
  minFramerate?: number;
  maxFramerate?: number;
}

class PIDController {
  private kp: number;
  private ki: number;
  private kd: number;
  private setpoint: number;
  private integral: number = 0;
  private prevError: number = 0;
  private outputMin: number;
  private outputMax: number;
  private integralMax: number;
  private firstUpdate: boolean = true;
  private lastUpdateTime: number = 0;

  constructor(
    kp: number,
    ki: number,
    kd: number,
    setpoint: number,
    outputMin: number,
    outputMax: number,
    integralMax: number
  ) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.setpoint = setpoint;
    this.outputMin = outputMin;
    this.outputMax = outputMax;
    this.integralMax = integralMax;
  }

  update(measured: number, dt: number): number {
    if (this.firstUpdate) {
      this.firstUpdate = false;
      this.prevError = this.setpoint - measured;
      this.lastUpdateTime = Date.now();
      return 0;
    }

    const now = Date.now();
    const actualDt = Math.max(dt, (now - this.lastUpdateTime) / 1000);
    this.lastUpdateTime = now;

    const error = this.setpoint - measured;

    this.integral += error * actualDt;
    this.integral = Math.max(-this.integralMax, Math.min(this.integralMax, this.integral));

    const derivative = (error - this.prevError) / actualDt;
    this.prevError = error;

    let output = this.kp * error + this.ki * this.integral + this.kd * derivative;

    output = Math.max(this.outputMin, Math.min(this.outputMax, output));

    return output;
  }

  reset(): void {
    this.integral = 0;
    this.prevError = 0;
    this.firstUpdate = true;
    this.lastUpdateTime = Date.now();
  }

  setSetpoint(setpoint: number): void {
    this.setpoint = setpoint;
    this.reset();
  }

  setTunings(kp: number, ki: number, kd: number): void {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
  }
}

export class BandwidthEstimator {
  private options: BandwidthEstimatorOptions;
  private currentBitrate: number;
  private currentFramerate: number;
  private minBitrate: number;
  private maxBitrate: number;
  private minFramerate: number;
  private maxFramerate: number;

  private rttPid: PIDController;
  private lossPid: PIDController;
  private utilizationPid: PIDController;

  private rttHistory: number[] = [];
  private lossRateHistory: number[] = [];
  private bitrateHistory: number[] = [];
  private estimatedBandwidth: number = 0;

  private lastUpdateTime: number = 0;
  private lastConfigChangeTime: number = 0;
  private readonly MIN_CONFIG_CHANGE_INTERVAL = 2000;
  private readonly HISTORY_SIZE = 30;
  private readonly SMOOTHING_FACTOR = 0.3;

  private targetBitrate: number;
  private smoothedBitrate: number;
  private smoothedFramerate: number;

  private readonly RTT_SETPOINT = 150;
  private readonly LOSS_SETPOINT = 1;
  private readonly UTILIZATION_SETPOINT = 0.85;

  constructor(initialConfig: EncodingConfig, options: BandwidthEstimatorOptions) {
    this.options = options;
    this.currentBitrate = initialConfig.bitrate;
    this.currentFramerate = initialConfig.framerate;
    this.minBitrate = options.minBitrate ?? 100000;
    this.maxBitrate = options.maxBitrate ?? 8000000;
    this.minFramerate = options.minFramerate ?? 10;
    this.maxFramerate = options.maxFramerate ?? 60;
    this.estimatedBandwidth = initialConfig.bitrate * 1.2;
    this.targetBitrate = initialConfig.bitrate;
    this.smoothedBitrate = initialConfig.bitrate;
    this.smoothedFramerate = initialConfig.framerate;

    this.rttPid = new PIDController(
      -5000,
      -1000,
      -2000,
      this.RTT_SETPOINT,
      -1000000,
      1000000,
      500000
    );

    this.lossPid = new PIDController(
      -50000,
      -10000,
      -20000,
      this.LOSS_SETPOINT,
      -2000000,
      2000000,
      1000000
    );

    this.utilizationPid = new PIDController(
      1000000,
      100000,
      500000,
      this.UTILIZATION_SETPOINT,
      -2000000,
      2000000,
      1000000
    );
  }

  updateStats(stats: StreamStats): void {
    const now = Date.now();
    const dt = this.lastUpdateTime === 0 ? 0.5 : (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    this.rttHistory.push(stats.rtt);
    this.lossRateHistory.push(stats.lossRate);
    this.bitrateHistory.push(stats.bitrate);

    if (this.rttHistory.length > this.HISTORY_SIZE) {
      this.rttHistory.shift();
      this.lossRateHistory.shift();
      this.bitrateHistory.shift();
    }

    this.estimateBandwidth(stats, dt);
    this.adjustEncodingParams(stats, dt);
  }

  private estimateBandwidth(stats: StreamStats, _dt: number): void {
    const avgRTT = this.smooth(this.rttHistory);
    const avgLoss = this.smooth(this.lossRateHistory);
    const avgBitrate = this.smooth(this.bitrateHistory);

    let bandwidthEstimate = avgBitrate * 1.1;

    const rttFactor = avgRTT < 100 ? 1.2 : avgRTT < 200 ? 1.0 : avgRTT < 300 ? 0.8 : 0.6;
    const lossFactor = avgLoss < 1 ? 1.2 : avgLoss < 3 ? 1.0 : avgLoss < 5 ? 0.8 : 0.5;

    bandwidthEstimate *= rttFactor * lossFactor;

    if (stats.estimatedBandwidth > 0) {
      bandwidthEstimate = (bandwidthEstimate * 0.6 + stats.estimatedBandwidth * 0.4);
    }

    this.estimatedBandwidth = Math.max(
      this.minBitrate,
      Math.min(this.maxBitrate, bandwidthEstimate)
    );
  }

  private adjustEncodingParams(_stats: StreamStats, dt: number): void {
    const now = Date.now();

    if (now - this.lastConfigChangeTime < this.MIN_CONFIG_CHANGE_INTERVAL) {
      return;
    }

    const avgRTT = this.smooth(this.rttHistory);
    const avgLoss = this.smooth(this.lossRateHistory);
    const avgBitrate = this.smooth(this.bitrateHistory);

    if (avgRTT === 0) return;

    const rttCorrection = this.rttPid.update(avgRTT, dt);
    const lossCorrection = this.lossPid.update(avgLoss, dt);

    const utilization = this.estimatedBandwidth > 0
      ? Math.min(1, avgBitrate / this.estimatedBandwidth)
      : 0.5;
    const utilizationCorrection = this.utilizationPid.update(utilization, dt);

    const totalCorrection = rttCorrection + lossCorrection + utilizationCorrection;

    const maxStep = this.currentBitrate * 0.15;
    const clampedCorrection = Math.max(-maxStep, Math.min(maxStep, totalCorrection));

    this.targetBitrate = this.currentBitrate + clampedCorrection;
    this.targetBitrate = Math.max(this.minBitrate, Math.min(this.maxBitrate, this.targetBitrate));

    this.targetBitrate = Math.min(this.targetBitrate, this.estimatedBandwidth * 0.9);

    this.smoothedBitrate = this.exponentialSmooth(
      this.smoothedBitrate,
      this.targetBitrate,
      this.SMOOTHING_FACTOR
    );

    let targetFramerate = this.currentFramerate;
    const networkQuality = this.calculateNetworkQuality(avgRTT, avgLoss);

    if (networkQuality < 0.3) {
      targetFramerate = Math.max(this.minFramerate, this.maxFramerate * 0.4);
    } else if (networkQuality < 0.5) {
      targetFramerate = Math.max(this.minFramerate, this.maxFramerate * 0.6);
    } else if (networkQuality < 0.7) {
      targetFramerate = Math.max(this.minFramerate, this.maxFramerate * 0.8);
    } else {
      targetFramerate = this.maxFramerate;
    }

    this.smoothedFramerate = this.exponentialSmooth(
      this.smoothedFramerate,
      targetFramerate,
      this.SMOOTHING_FACTOR
    );

    const newBitrate = Math.round(this.smoothedBitrate);
    const newFramerate = Math.round(this.smoothedFramerate);

    const bitrateChanged = Math.abs(newBitrate - this.currentBitrate) / this.currentBitrate > 0.08;
    const framerateChanged = Math.abs(newFramerate - this.currentFramerate) > 2;

    if (bitrateChanged || framerateChanged) {
      const oldBitrate = this.currentBitrate;
      const oldFramerate = this.currentFramerate;

      this.currentBitrate = newBitrate;
      this.currentFramerate = newFramerate;
      this.lastConfigChangeTime = now;

      console.log('[BWE] PID Adjustment:', {
        bitrate: `${Math.round(oldBitrate / 1000)} → ${Math.round(newBitrate / 1000)} kbps`,
        framerate: `${Math.round(oldFramerate)} → ${Math.round(newFramerate)} fps`,
        rtt: `${Math.round(avgRTT)} ms`,
        loss: `${avgLoss.toFixed(2)}%`,
        quality: `${(networkQuality * 100).toFixed(0)}%`,
        estBw: `${Math.round(this.estimatedBandwidth / 1000)} kbps`,
        utilization: `${(utilization * 100).toFixed(0)}%`,
        corrections: {
          rtt: `${Math.round(rttCorrection / 1000)} kbps`,
          loss: `${Math.round(lossCorrection / 1000)} kbps`,
          util: `${Math.round(utilizationCorrection / 1000)} kbps`,
        },
      });

      const updateConfig: Partial<EncodingConfig> = {};
      if (bitrateChanged) updateConfig.bitrate = newBitrate;
      if (framerateChanged) updateConfig.framerate = newFramerate;

      this.options.onConfigChange(updateConfig);
    }
  }

  private calculateNetworkQuality(rtt: number, loss: number): number {
    let rttScore = 1.0;
    if (rtt > 50) {
      rttScore = Math.max(0, 1 - (rtt - 50) / 450);
    }

    let lossScore = 1.0;
    if (loss > 0.5) {
      lossScore = Math.max(0, 1 - (loss - 0.5) / 9.5);
    }

    return rttScore * 0.6 + lossScore * 0.4;
  }

  private smooth(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const trimStart = Math.floor(sorted.length * 0.1);
    const trimEnd = sorted.length - trimStart;
    const trimmed = sorted.slice(trimStart, trimEnd);
    return trimmed.reduce((sum, val) => sum + val, 0) / trimmed.length;
  }

  private exponentialSmooth(current: number, target: number, alpha: number): number {
    return alpha * target + (1 - alpha) * current;
  }

  getEstimatedBandwidth(): number {
    return this.estimatedBandwidth;
  }

  getCurrentBitrate(): number {
    return this.currentBitrate;
  }

  getCurrentFramerate(): number {
    return this.currentFramerate;
  }

  reset(): void {
    this.rttHistory = [];
    this.lossRateHistory = [];
    this.bitrateHistory = [];
    this.rttPid.reset();
    this.lossPid.reset();
    this.utilizationPid.reset();
    this.lastUpdateTime = 0;
    this.lastConfigChangeTime = 0;
  }

  setBitrateLimits(min: number, max: number): void {
    this.minBitrate = min;
    this.maxBitrate = max;
  }

  setFramerateLimits(min: number, max: number): void {
    this.minFramerate = min;
    this.maxFramerate = max;
  }
}
