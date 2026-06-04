interface BeaconReading {
  uuid: string;
  rssi: number;
  x: number;
  y: number;
  txPower: number;
  pathLossExp: number;
}

interface Position {
  x: number;
  y: number;
  accuracy: number;
}

function rssiToDistance(rssi: number, txPower: number, pathLossExp: number): number {
  if (rssi >= 0) return 0.1;
  const ratio = (txPower - rssi) / (10 * pathLossExp);
  return Math.pow(10, ratio);
}

export function trilaterate(readings: BeaconReading[]): Position | null {
  if (readings.length < 1) return null;
  return weightedCentroid(readings);
}

function weightedCentroid(readings: BeaconReading[]): Position | null {
  if (readings.length === 0) return null;

  const weightedPoints: Array<{ x: number; y: number; weight: number }> = readings.map(r => {
    const distance = rssiToDistance(r.rssi, r.txPower, r.pathLossExp);
    const weight = 1 / Math.max(distance * distance, 0.01);
    return { x: r.x, y: r.y, weight };
  });

  const totalWeight = weightedPoints.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return null;

  const x = weightedPoints.reduce((sum, p) => sum + p.x * p.weight, 0) / totalWeight;
  const y = weightedPoints.reduce((sum, p) => sum + p.y * p.weight, 0) / totalWeight;

  const avgDist = readings.reduce((sum, r) => {
    return sum + rssiToDistance(r.rssi, r.txPower, r.pathLossExp);
  }, 0) / readings.length;

  const spread = weightedPoints.reduce((sum, p) => {
    return sum + p.weight * ((p.x - x) ** 2 + (p.y - y) ** 2);
  }, 0) / totalWeight;

  const accuracy = Math.max(1, Math.sqrt(spread) * 0.5 + avgDist * 0.15);

  return { x, y, accuracy };
}

export function trilaterateClassic(readings: BeaconReading[]): Position | null {
  if (readings.length < 3) return null;

  const sorted = [...readings].sort((a, b) => b.rssi - a.rssi);
  const top3 = sorted.slice(0, 3);

  const [p1, p2, p3] = top3;
  const d1 = rssiToDistance(p1.rssi, p1.txPower, p1.pathLossExp);
  const d2 = rssiToDistance(p2.rssi, p2.txPower, p2.pathLossExp);
  const d3 = rssiToDistance(p3.rssi, p3.txPower, p3.pathLossExp);

  const A = 2 * (p2.x - p1.x);
  const B = 2 * (p2.y - p1.y);
  const C = d1 * d1 - d2 * d2 - p1.x * p1.x + p2.x * p2.x - p1.y * p1.y + p2.y * p2.y;
  const D = 2 * (p3.x - p1.x);
  const E = 2 * (p3.y - p1.y);
  const F = d1 * d1 - d3 * d3 - p1.x * p1.x + p3.x * p3.x - p1.y * p1.y + p3.y * p3.y;

  const denom = A * E - B * D;
  if (Math.abs(denom) < 1e-10) return null;

  const x = (C * E - F * B) / denom;
  const y = (A * F - D * C) / denom;

  const avgDist = (d1 + d2 + d3) / 3;
  const accuracy = Math.max(1, avgDist * 0.3);

  return { x, y, accuracy };
}

export type { BeaconReading, Position };
