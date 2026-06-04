import { PARTICLE_SIZE } from '../types';

export class ParticleInitializer {
  static generateRandomParticles(count: number, width: number, height: number): Float32Array {
    const data = new Float32Array(count * (PARTICLE_SIZE / 4));
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < count; i++) {
      const offset = i * (PARTICLE_SIZE / 4);

      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(width, height) * 0.35;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const speed = 30 + Math.random() * 50;
      const vx = Math.cos(angle + Math.PI / 2) * speed;
      const vy = Math.sin(angle + Math.PI / 2) * speed;

      const hue = (i / count) * 360;
      const color = this.hslToRgb(hue, 0.8, 0.6);

      const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const maxDist = Math.max(width, height) * 0.5;
      const distFactor = Math.min(distToCenter / maxDist, 1);
      const lodLevel = distFactor > 0.66 ? 2 : distFactor > 0.33 ? 1 : 0;

      data[offset] = x;
      data[offset + 1] = y;
      data[offset + 2] = vx;
      data[offset + 3] = vy;
      data[offset + 4] = color[0];
      data[offset + 5] = color[1];
      data[offset + 6] = color[2];
      data[offset + 7] = lodLevel;
    }

    return data;
  }

  static generateGridParticles(count: number, width: number, height: number): Float32Array {
    const data = new Float32Array(count * (PARTICLE_SIZE / 4));
    const cols = Math.ceil(Math.sqrt(count * (width / height)));
    const rows = Math.ceil(count / cols);
    const spacingX = width / (cols + 1);
    const spacingY = height / (rows + 1);
    const centerX = width / 2;
    const centerY = height / 2;

    let idx = 0;
    for (let row = 0; row < rows && idx < count; row++) {
      for (let col = 0; col < cols && idx < count; col++) {
        const offset = idx * (PARTICLE_SIZE / 4);
        const x = spacingX * (col + 1);
        const y = spacingY * (row + 1);

        const dx = x - width / 2;
        const dy = y - height / 2;
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        const speed = 20 + Math.random() * 30;

        const hue = (idx / count) * 360;
        const color = this.hslToRgb(hue, 0.8, 0.6);

        const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDist = Math.max(width, height) * 0.5;
        const distFactor = Math.min(distToCenter / maxDist, 1);
        const lodLevel = distFactor > 0.66 ? 2 : distFactor > 0.33 ? 1 : 0;

        data[offset] = x;
        data[offset + 1] = y;
        data[offset + 2] = Math.cos(angle) * speed;
        data[offset + 3] = Math.sin(angle) * speed;
        data[offset + 4] = color[0];
        data[offset + 5] = color[1];
        data[offset + 6] = color[2];
        data[offset + 7] = lodLevel;

        idx++;
      }
    }

    return data;
  }

  static generateExplosionParticles(count: number, width: number, height: number): Float32Array {
    const data = new Float32Array(count * (PARTICLE_SIZE / 4));
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < count; i++) {
      const offset = i * (PARTICLE_SIZE / 4);
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      const hue = (angle / (Math.PI * 2)) * 360;
      const color = this.hslToRgb(hue, 1, 0.6);

      data[offset] = centerX + (Math.random() - 0.5) * 20;
      data[offset + 1] = centerY + (Math.random() - 0.5) * 20;
      data[offset + 2] = Math.cos(angle) * speed;
      data[offset + 3] = Math.sin(angle) * speed;
      data[offset + 4] = color[0];
      data[offset + 5] = color[1];
      data[offset + 6] = color[2];
      data[offset + 7] = 0;
    }

    return data;
  }

  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [r + m, g + m, b + m];
  }
}
