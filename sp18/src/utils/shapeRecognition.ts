import * as tf from "@tensorflow/tfjs";
import type { Point, CorrectedShape } from "../../shared/types";

let shapeClassifier: tf.LayersModel | null = null;
let classifierLoaded = false;
let classifierLoading = false;

async function buildAndTrainShapeClassifier(): Promise<tf.LayersModel> {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [12], units: 64, activation: "relu" }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 32, activation: "relu" }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 4, activation: "softmax" }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  const trainingData: number[][] = [];
  const trainingLabels: number[][] = [];

  for (let i = 0; i < 200; i++) {
    trainingData.push(generateCircleFeatures());
    trainingLabels.push([1, 0, 0, 0]);
  }

  for (let i = 0; i < 200; i++) {
    trainingData.push(generateEllipseFeatures());
    trainingLabels.push([0, 1, 0, 0]);
  }

  for (let i = 0; i < 200; i++) {
    trainingData.push(generateRectangleFeatures());
    trainingLabels.push([0, 0, 1, 0]);
  }

  for (let i = 0; i < 200; i++) {
    trainingData.push(generateTriangleFeatures());
    trainingLabels.push([0, 0, 0, 1]);
  }

  const xs = tf.tensor2d(trainingData);
  const ys = tf.tensor2d(trainingLabels);

  await model.fit(xs, ys, {
    epochs: 80,
    batchSize: 32,
    validationSplit: 0.2,
    shuffle: true,
    verbose: 0,
  });

  xs.dispose();
  ys.dispose();

  return model;
}

function generateCircleFeatures(): number[] {
  const r = 30 + Math.random() * 70;
  const noise = 2 + Math.random() * 12;
  const points = generateCirclePoints(r, noise);
  return extractFeatures(points);
}

function generateEllipseFeatures(): number[] {
  const rx = 30 + Math.random() * 50;
  const ry = rx * (0.3 + Math.random() * 0.4);
  const angle = Math.random() * Math.PI;
  const noise = 2 + Math.random() * 8;
  const points = generateEllipsePoints(rx, ry, angle, noise);
  return extractFeatures(points);
}

function generateRectangleFeatures(): number[] {
  const w = 40 + Math.random() * 80;
  const h = 30 + Math.random() * 70;
  const noise = 2 + Math.random() * 10;
  const points = generateRectanglePoints(w, h, noise);
  return extractFeatures(points);
}

function generateTriangleFeatures(): number[] {
  const size = 50 + Math.random() * 60;
  const noise = 2 + Math.random() * 12;
  const points = generateTrianglePoints(size, noise);
  return extractFeatures(points);
}

function generateCirclePoints(r: number, noise: number): Point[] {
  const pts: Point[] = [];
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const nr = r + (Math.random() - 0.5) * noise;
    pts.push({
      x: nr * Math.cos(t) + r + noise,
      y: nr * Math.sin(t) + r + noise,
    });
  }
  return pts;
}

function generateEllipsePoints(rx: number, ry: number, angle: number, noise: number): Point[] {
  const pts: Point[] = [];
  const steps = 24;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    let x = rx * Math.cos(t) + (Math.random() - 0.5) * noise;
    let y = ry * Math.sin(t) + (Math.random() - 0.5) * noise;
    pts.push({
      x: x * cosA - y * sinA + rx + noise,
      y: x * sinA + y * cosA + ry + noise,
    });
  }
  return pts;
}

function generateRectanglePoints(w: number, h: number, noise: number): Point[] {
  const pts: Point[] = [];
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    pts.push({ x: (i / steps) * w + (Math.random() - 0.5) * noise, y: (Math.random() - 0.5) * noise });
  }
  for (let i = 0; i < steps; i++) {
    pts.push({ x: w + (Math.random() - 0.5) * noise, y: (i / steps) * h + (Math.random() - 0.5) * noise });
  }
  for (let i = 0; i < steps; i++) {
    pts.push({ x: w - (i / steps) * w + (Math.random() - 0.5) * noise, y: h + (Math.random() - 0.5) * noise });
  }
  for (let i = 0; i < steps; i++) {
    pts.push({ x: (Math.random() - 0.5) * noise, y: h - (i / steps) * h + (Math.random() - 0.5) * noise });
  }
  return pts;
}

function generateTrianglePoints(size: number, noise: number): Point[] {
  const pts: Point[] = [];
  const vertices = [
    { x: size / 2, y: 0 },
    { x: size, y: size * 0.866 },
    { x: 0, y: size * 0.866 },
  ];
  const steps = 5;
  for (let v = 0; v < 3; v++) {
    const start = vertices[v];
    const end = vertices[(v + 1) % 3];
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      pts.push({
        x: start.x + t * (end.x - start.x) + (Math.random() - 0.5) * noise,
        y: start.y + t * (end.y - start.y) + (Math.random() - 0.5) * noise,
      });
    }
  }
  return pts;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i - 1], points[i]);
  }
  return len;
}

function isClosedPath(points: Point[], threshold: number): boolean {
  if (points.length < 3) return false;
  return distance(points[0], points[points.length - 1]) < threshold;
}

export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [start, end];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(point, lineStart);
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return distance(point, { x: projX, y: projY });
}

function leastSquaresCircleFit(points: Point[]): { center: Point; radius: number; residual: number } {
  const n = points.length;
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumX3 = 0, sumY3 = 0, sumXY = 0, sumX1Y2 = 0, sumX2Y1 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
    sumX3 += p.x * p.x * p.x;
    sumY3 += p.y * p.y * p.y;
    sumXY += p.x * p.y;
    sumX1Y2 += p.x * p.y * p.y;
    sumX2Y1 += p.x * p.x * p.y;
  }

  const A = 2 * (sumX * sumX - n * sumX2);
  const B = 2 * (sumX * sumY - n * sumXY);
  const C = 2 * (sumY * sumY - n * sumY2);
  const D = sumX * sumY2 - sumX * sumX2 + n * sumX3 + n * sumX1Y2;
  const E = sumY * sumX2 - sumY * sumY2 + n * sumY3 + n * sumX2Y1;

  const det = A * C - B * B;
  if (Math.abs(det) < 1e-12) {
    const c = centroid(points);
    const r = points.reduce((s, p) => s + distance(p, c), 0) / n;
    return { center: c, radius: r, residual: Number.MAX_VALUE };
  }

  const cx = (C * D - B * E) / det;
  const cy = (A * E - B * D) / det;

  let totalResidual = 0;
  let totalRadius = 0;
  for (const p of points) {
    const r = distance(p, { x: cx, y: cy });
    totalRadius += r;
    totalResidual += r;
  }
  const avgR = totalRadius / n;

  let variance = 0;
  for (const p of points) {
    const r = distance(p, { x: cx, y: cy });
    variance += (r - avgR) ** 2;
  }

  return {
    center: { x: cx, y: cy },
    radius: avgR,
    residual: Math.sqrt(variance / n) / (avgR + 1e-9),
  };
}

function extractFeatures(points: Point[]): number[] {
  const n = points.length;
  const c = centroid(points);

  const totalLen = pathLength(points);
  const closedTol = totalLen * 0.1;
  const closedness = 1 - Math.min(1, distance(points[0], points[n - 1]) / (closedTol + 1e-9));

  const epsilon = totalLen * 0.035;
  const simplified = rdpSimplify(points, epsilon);
  const simplicity = 1 - Math.min(1, simplified.length / n);

  const circleFit = leastSquaresCircleFit(points);
  const circleQuality = Math.max(0, 1 - circleFit.residual * 3);

  const dists = points.map((p) => distance(p, c));
  const avgDist = dists.reduce((a, b) => a + b, 0) / n;
  const minDist = Math.min(...dists);
  const maxDist = Math.max(...dists);
  const aspectRatio = avgDist > 0 ? minDist / (maxDist + 1e-9) : 0;

  const variance = dists.reduce((s, d) => s + (d - avgDist) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = avgDist > 0 ? stdDev / avgDist : 0;
  const radiusConsistency = Math.max(0, 1 - cv);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const bboxAspect = Math.min(w, h) / (Math.max(w, h) + 1e-9);

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;
  const perimeter = totalLen;
  const compactness = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;

  let curvatureVariance = 0;
  if (n >= 5) {
    const curvatures: number[] = [];
    for (let i = 2; i < n - 2; i++) {
      const p1 = points[i - 2];
      const p2 = points[i];
      const p3 = points[i + 2];
      const k = estimateCurvature(p1, p2, p3);
      curvatures.push(k);
    }
    if (curvatures.length > 0) {
      const avgK = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
      curvatureVariance =
        curvatures.reduce((s, k) => s + (k - avgK) ** 2, 0) / curvatures.length;
    }
  }
  const normalizedCurvatureVar = curvatureVariance / (1 + curvatureVariance);

  let cornerCount = 0;
  if (simplified.length >= 3) {
    for (let i = 0; i < simplified.length - 2; i++) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const c = simplified[i + 2];
      const ang = angleBetween(a, b, c);
      if (Math.abs(ang - Math.PI / 2) < Math.PI / 3) cornerCount++;
    }
  }
  const cornerDensity = Math.min(1, cornerCount / 4);

  return [
    closedness,
    simplicity,
    circleQuality,
    aspectRatio,
    radiusConsistency,
    bboxAspect,
    compactness,
    normalizedCurvatureVar,
    cornerDensity,
    simplified.length / Math.max(n, 1),
    circleFit.residual,
    cv,
  ];
}

function estimateCurvature(p1: Point, p2: Point, p3: Point): number {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p3.x - p2.x;
  const dy2 = p3.y - p2.y;
  const cross = dx1 * dy2 - dy1 * dx2;
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (len1 < 1e-9 || len2 < 1e-9) return 0;
  return Math.abs(cross) / (len1 * len2);
}

function angleBetween(a: Point, b: Point, c: Point): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const cross = ab.x * cb.y - ab.y * cb.x;
  return Math.abs(Math.atan2(cross, dot));
}

async function ensureClassifier(): Promise<tf.LayersModel | null> {
  if (classifierLoaded && shapeClassifier) return shapeClassifier;
  if (classifierLoading) return null;
  classifierLoading = true;
  try {
    shapeClassifier = await buildAndTrainShapeClassifier();
    classifierLoaded = true;
    return shapeClassifier;
  } catch (e) {
    console.warn("Shape classifier training failed:", e);
    return null;
  } finally {
    classifierLoading = false;
  }
}

type ShapeClass = "circle" | "ellipse" | "rectangle" | "triangle";

async function predictShapeClass(points: Point[]): Promise<{ class: ShapeClass; confidence: number } | null> {
  const features = extractFeatures(points);
  const classifier = await ensureClassifier();
  if (!classifier) {
    const circleFit = leastSquaresCircleFit(points);
    const totalLen = pathLength(points);
    const epsilon = totalLen * 0.035;
    const simplified = rdpSimplify(points, epsilon);

    if (circleFit.residual < 0.12 && simplified.length >= 5) {
      return { class: "circle", confidence: 1 - circleFit.residual };
    }
    if (simplified.length === 4 || simplified.length === 5) {
      return { class: "rectangle", confidence: 0.7 };
    }
    if (simplified.length === 3 || simplified.length === 4) {
      return { class: "triangle", confidence: 0.6 };
    }
    return null;
  }

  const xs = tf.tensor2d([features]);
  const prediction = classifier.predict(xs) as tf.Tensor;
  const probs = (await prediction.data()) as Float32Array;
  xs.dispose();
  prediction.dispose();

  const maxIdx = probs.indexOf(Math.max(...probs));
  const classes: ShapeClass[] = ["circle", "ellipse", "rectangle", "triangle"];
  const confidence = probs[maxIdx];

  return { class: classes[maxIdx], confidence };
}

export async function recognizeShape(
  rawPoints: Point[],
  autoCorrect: boolean = true
): Promise<CorrectedShape | null> {
  if (!autoCorrect || rawPoints.length < 8) return null;

  const totalLen = pathLength(rawPoints);
  const closeThreshold = totalLen * 0.15;

  if (!isClosedPath(rawPoints, closeThreshold)) return null;

  const result = await predictShapeClass(rawPoints);
  if (!result || result.confidence < 0.6) return null;

  const circleFit = leastSquaresCircleFit(rawPoints);

  if (result.class === "circle" && result.confidence > 0.75) {
    return {
      type: "circle",
      center: circleFit.center,
      radius: circleFit.radius,
    };
  }

  if (result.class === "ellipse" && result.confidence > 0.7) {
    const c = centroid(rawPoints);
    const xs = rawPoints.map((p) => p.x);
    const ys = rawPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      type: "circle",
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      radius: Math.max(maxX - minX, maxY - minY) / 2,
    };
  }

  if (result.class === "rectangle" && result.confidence > 0.65) {
    const c = centroid(rawPoints);
    const xs = rawPoints.map((p) => p.x);
    const ys = rawPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      type: "rectangle",
      center: c,
      width: maxX - minX,
      height: maxY - minY,
      vertices: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
  }

  if (result.class === "triangle" && result.confidence > 0.6) {
    const c = centroid(rawPoints);
    const simplified = rdpSimplify(rawPoints, totalLen * 0.05);
    if (simplified.length >= 3) {
      return { type: "triangle", center: c, vertices: simplified.slice(0, 3) };
    }
    const size = Math.max(...rawPoints.map((p) => distance(p, c))) * 1.5;
    return {
      type: "triangle",
      center: c,
      vertices: [
        { x: c.x, y: c.y - size * 0.577 },
        { x: c.x + size / 2, y: c.y + size * 0.289 },
        { x: c.x - size / 2, y: c.y + size * 0.289 },
      ],
    };
  }

  return null;
}

export function recognizeShapeSync(
  rawPoints: Point[],
  autoCorrect: boolean = true
): CorrectedShape | null {
  if (!autoCorrect || rawPoints.length < 8) return null;

  const totalLen = pathLength(rawPoints);
  const closeThreshold = totalLen * 0.15;

  if (!isClosedPath(rawPoints, closeThreshold)) return null;

  const circleFit = leastSquaresCircleFit(rawPoints);
  const epsilon = totalLen * 0.035;
  const simplified = rdpSimplify(rawPoints, epsilon);

  if (circleFit.residual < 0.12 && simplified.length >= 5) {
    return {
      type: "circle",
      center: circleFit.center,
      radius: circleFit.radius,
    };
  }

  if ((simplified.length === 4 || simplified.length === 5) && circleFit.residual >= 0.15) {
    const pts = simplified.length === 5 ? simplified.slice(0, 4) : simplified;
    const angles = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      angles.push(angleBetween(prev, curr, next));
    }
    const isRect = angles.every((a) => Math.abs(a - Math.PI / 2) < Math.PI / 3.5);
    if (isRect) {
      const c = centroid(pts);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        type: "rectangle",
        center: c,
        width: maxX - minX,
        height: maxY - minY,
        vertices: [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ],
      };
    }
  }

  if (simplified.length === 3 || (simplified.length === 4 && circleFit.residual >= 0.2)) {
    const pts = simplified.length === 4 ? simplified.slice(0, 3) : simplified;
    const c = centroid(pts);
    const sides = [];
    for (let i = 0; i < pts.length; i++) {
      sides.push(distance(pts[i], pts[(i + 1) % pts.length]));
    }
    const avgSide = sides.reduce((a, b) => a + b, 0) / sides.length;
    const isTriangle = sides.every((s) => Math.abs(s - avgSide) / avgSide < 0.6);
    if (isTriangle) {
      return { type: "triangle", center: c, vertices: pts };
    }
  }

  return null;
}
