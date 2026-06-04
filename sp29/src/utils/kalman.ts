export class KalmanFilter1D {
  private processNoise: number;
  private measurementNoise: number;
  private estimatedValue: number;
  private estimationError: number;

  constructor(processNoise = 0.125, measurementNoise = 4.0, initialRSSI = -60) {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
    this.estimatedValue = initialRSSI;
    this.estimationError = 1;
  }

  update(measurement: number): number {
    const predictionError = this.estimationError + this.processNoise;
    const kalmanGain = predictionError / (predictionError + this.measurementNoise);
    this.estimatedValue = this.estimatedValue + kalmanGain * (measurement - this.estimatedValue);
    this.estimationError = (1 - kalmanGain) * predictionError;
    return this.estimatedValue;
  }

  getEstimated(): number {
    return this.estimatedValue;
  }

  reset(initialRSSI = -60): void {
    this.estimatedValue = initialRSSI;
    this.estimationError = 1;
  }
}
