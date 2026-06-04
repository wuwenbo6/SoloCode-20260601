import type { DrawOperation, Point, CorrectedShape } from "../../shared/types";

export function drawOperation(
  ctx: CanvasRenderingContext2D,
  op: DrawOperation,
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1
): void {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (op.type === "text") {
    drawText(ctx, op);
  } else if (op.corrected) {
    drawCorrectedShape(ctx, op.corrected, op.color, op.lineWidth);
  } else {
    switch (op.type) {
      case "pen":
        drawPen(ctx, op.points, op.color, op.lineWidth);
        break;
      case "eraser":
        drawEraser(ctx, op.points, op.lineWidth);
        break;
      case "rect":
        drawRect(ctx, op.points, op.color, op.lineWidth);
        break;
      case "circle":
        drawCircle(ctx, op.points, op.color, op.lineWidth);
        break;
      case "line":
        drawLine(ctx, op.points, op.color, op.lineWidth);
        break;
    }
  }

  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, op: DrawOperation): void {
  if (!op.text || !op.points[0]) return;
  ctx.font = `${op.text.fontSize}px ${op.text.fontFamily}`;
  ctx.fillStyle = op.color;
  ctx.textBaseline = "top";
  ctx.fillText(op.text.content, op.points[0].x, op.points[0].y);
}

function drawPen(ctx: CanvasRenderingContext2D, points: Point[], color: string, lineWidth: number): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const midX = (points[i - 1].x + points[i].x) / 2;
    const midY = (points[i - 1].y + points[i].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, midX, midY);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

function drawEraser(ctx: CanvasRenderingContext2D, points: Point[], lineWidth: number): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = "#f8f9fa";
  ctx.lineWidth = lineWidth * 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "destination-out";
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

function drawRect(ctx: CanvasRenderingContext2D, points: Point[], color: string, lineWidth: number): void {
  if (points.length < 2) return;
  const start = points[0];
  const end = points[points.length - 1];
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
}

function drawCircle(ctx: CanvasRenderingContext2D, points: Point[], color: string, lineWidth: number): void {
  if (points.length < 2) return;
  const start = points[0];
  const end = points[points.length - 1];
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, points: Point[], color: string, lineWidth: number): void {
  if (points.length < 2) return;
  const start = points[0];
  const end = points[points.length - 1];
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function drawCorrectedShape(ctx: CanvasRenderingContext2D, shape: CorrectedShape, color: string, lineWidth: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (shape.type) {
    case "circle":
      ctx.beginPath();
      ctx.arc(shape.center.x, shape.center.y, shape.radius || 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "rectangle":
      if (shape.vertices && shape.vertices.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
        for (let i = 1; i < shape.vertices.length; i++) {
          ctx.lineTo(shape.vertices[i].x, shape.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        const w = shape.width || 0;
        const h = shape.height || 0;
        ctx.strokeRect(shape.center.x - w / 2, shape.center.y - h / 2, w, h);
      }
      break;
    case "triangle":
      if (shape.vertices && shape.vertices.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
        for (let i = 1; i < shape.vertices.length; i++) {
          ctx.lineTo(shape.vertices[i].x, shape.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      break;
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  const gridSize = 30 * scale;
  const dotRadius = 1;
  ctx.fillStyle = "#d0d0d0";

  const startX = offsetX % gridSize;
  const startY = offsetY % gridSize;

  for (let x = startX; x < width; x += gridSize) {
    for (let y = startY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function redrawAll(
  ctx: CanvasRenderingContext2D,
  operations: DrawOperation[],
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, offsetX, offsetY, scale);
  operations.forEach((op) => drawOperation(ctx, op, offsetX, offsetY, scale));
}

export function exportToPNG(
  operations: DrawOperation[],
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(0, 0, width, height);
  operations.forEach((op) => drawOperation(ctx, op, 0, 0, 1));
  return canvas.toDataURL("image/png");
}

export function exportToSVG(
  operations: DrawOperation[],
  width: number,
  height: number
): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#f8f9fa"/>`;

  operations.forEach((op) => {
    if (op.type === "text" && op.text && op.points[0]) {
      svg += `<text x="${op.points[0].x}" y="${op.points[0].y + op.text.fontSize}" 
        font-family="${op.text.fontFamily}" 
        font-size="${op.text.fontSize}" 
        fill="${op.color}">${op.text.content}</text>`;
    } else if (op.type === "pen" && op.points.length >= 2) {
      let path = `M ${op.points[0].x} ${op.points[0].y}`;
      for (let i = 1; i < op.points.length; i++) {
        const midX = (op.points[i - 1].x + op.points[i].x) / 2;
        const midY = (op.points[i - 1].y + op.points[i].y) / 2;
        path += ` Q ${op.points[i - 1].x} ${op.points[i - 1].y} ${midX} ${midY}`;
      }
      path += ` L ${op.points[op.points.length - 1].x} ${op.points[op.points.length - 1].y}`;
      svg += `<path d="${path}" stroke="${op.color}" stroke-width="${op.lineWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (op.type === "rect" && op.points.length >= 2) {
      const start = op.points[0];
      const end = op.points[op.points.length - 1];
      svg += `<rect x="${start.x}" y="${start.y}" 
        width="${end.x - start.x}" height="${end.y - start.y}" 
        fill="none" stroke="${op.color}" stroke-width="${op.lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (op.type === "circle" && op.points.length >= 2) {
      const start = op.points[0];
      const end = op.points[op.points.length - 1];
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${op.color}" stroke-width="${op.lineWidth}"/>`;
    } else if (op.type === "line" && op.points.length >= 2) {
      const start = op.points[0];
      const end = op.points[op.points.length - 1];
      svg += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${op.color}" stroke-width="${op.lineWidth}" stroke-linecap="round"/>`;
    }
  });

  svg += "</svg>";
  return svg;
}
