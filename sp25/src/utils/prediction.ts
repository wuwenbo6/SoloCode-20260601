export interface PredictionPoint {
  timestamp: number
  value: number
  lowerBound: number
  upperBound: number
}

export interface LinearRegressionResult {
  slope: number
  intercept: number
  r2: number
  predictions: PredictionPoint[]
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function standardDeviation(values: number[], meanVal: number): number {
  const squaredDiffs = values.map(v => Math.pow(v - meanVal, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

export function linearRegression(
  xValues: number[],
  yValues: number[],
  predictAhead: number = 10,
  confidenceLevel: number = 0.95
): LinearRegressionResult | null {
  const n = xValues.length
  if (n < 5) {
    return null
  }

  const xMean = mean(xValues)
  const yMean = mean(yValues)

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean
    const yDiff = yValues[i] - yMean
    numerator += xDiff * yDiff
    denominator += xDiff * xDiff
  }

  if (denominator === 0) {
    return null
  }

  const slope = numerator / denominator
  const intercept = yMean - slope * xMean

  let ssTotal = 0
  let ssResidual = 0
  for (let i = 0; i < n; i++) {
    const predicted = slope * xValues[i] + intercept
    ssTotal += Math.pow(yValues[i] - yMean, 2)
    ssResidual += Math.pow(yValues[i] - predicted, 2)
  }

  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal

  const stdError = Math.sqrt(ssResidual / Math.max(n - 2, 1))
  const zScore = confidenceLevel === 0.95 ? 1.96 : 1.645
  const margin = zScore * stdError

  const predictions: PredictionPoint[] = []
  const lastX = xValues[xValues.length - 1]
  const xInterval = n > 1 ? (xValues[1] - xValues[0]) : 100

  for (let i = 1; i <= predictAhead; i++) {
    const x = lastX + xInterval * i
    const predicted = slope * x + intercept
    predictions.push({
      timestamp: x,
      value: predicted,
      lowerBound: predicted - margin,
      upperBound: predicted + margin,
    })
  }

  return {
    slope,
    intercept,
    r2,
    predictions,
  }
}

export function predictSensorMetric(
  timeSeries: { timestamp: number; value: number }[],
  predictAhead: number = 10
): PredictionPoint[] {
  if (timeSeries.length < 10) {
    return []
  }

  const recentData = timeSeries.slice(-100)
  const xValues = recentData.map(d => d.timestamp)
  const yValues = recentData.map(d => d.value)

  const result = linearRegression(xValues, yValues, predictAhead)
  return result?.predictions || []
}
