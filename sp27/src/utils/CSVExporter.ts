import { Particle, PARTICLE_SIZE, CSVExportOptions } from '../types';

export class CSVExporter {
  static async exportParticles(
    device: GPUDevice,
    particleBuffer: GPUBuffer,
    particleCount: number,
    options: Partial<CSVExportOptions> = {}
  ): Promise<string> {
    const defaultOptions: CSVExportOptions = {
      includePosition: true,
      includeVelocity: true,
      includeColor: true,
      includeLodLevel: false,
      samplingRate: 1.0,
    };

    const opts = { ...defaultOptions, ...options };

    const readBuffer = device.createBuffer({
      size: particleCount * PARTICLE_SIZE,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      particleBuffer,
      0,
      readBuffer,
      0,
      particleCount * PARTICLE_SIZE
    );
    device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = readBuffer.getMappedRange();
    const floatData = new Float32Array(arrayBuffer);

    const headers: string[] = ['id'];
    if (opts.includePosition) headers.push('pos_x', 'pos_y');
    if (opts.includeVelocity) headers.push('vel_x', 'vel_y');
    if (opts.includeColor) headers.push('color_r', 'color_g', 'color_b');
    if (opts.includeLodLevel) headers.push('lod_level');

    const lines: string[] = [headers.join(',')];

    const step = Math.max(1, Math.floor(1 / opts.samplingRate));
    const floatsPerParticle = PARTICLE_SIZE / 4;

    for (let i = 0; i < particleCount; i += step) {
      const offset = i * floatsPerParticle;
      const fields: string[] = [i.toString()];

      if (opts.includePosition) {
        fields.push(
          floatData[offset].toFixed(4),
          floatData[offset + 1].toFixed(4)
        );
      }
      if (opts.includeVelocity) {
        fields.push(
          floatData[offset + 2].toFixed(4),
          floatData[offset + 3].toFixed(4)
        );
      }
      if (opts.includeColor) {
        fields.push(
          floatData[offset + 4].toFixed(4),
          floatData[offset + 5].toFixed(4),
          floatData[offset + 6].toFixed(4)
        );
      }
      if (opts.includeLodLevel) {
        fields.push(floatData[offset + 7].toFixed(0));
      }

      lines.push(fields.join(','));
    }

    readBuffer.unmap();
    readBuffer.destroy();

    return lines.join('\n');
  }

  static downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static exportStatistics(
    device: GPUDevice,
    particleBuffer: GPUBuffer,
    particleCount: number
  ): Promise<string> {
    return new Promise((resolve) => {
      const readBuffer = device.createBuffer({
        size: particleCount * PARTICLE_SIZE,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        particleBuffer,
        0,
        readBuffer,
        0,
        particleCount * PARTICLE_SIZE
      );
      device.queue.submit([commandEncoder.finish()]);

      readBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const arrayBuffer = readBuffer.getMappedRange();
        const floatData = new Float32Array(arrayBuffer);
        const floatsPerParticle = PARTICLE_SIZE / 4;

        let totalSpeed = 0;
        let maxSpeed = 0;
        let minSpeed = Infinity;
        let totalPosX = 0;
        let totalPosY = 0;
        let totalVelX = 0;
        let totalVelY = 0;

        for (let i = 0; i < particleCount; i++) {
          const offset = i * floatsPerParticle;
          const px = floatData[offset];
          const py = floatData[offset + 1];
          const vx = floatData[offset + 2];
          const vy = floatData[offset + 3];
          const speed = Math.sqrt(vx * vx + vy * vy);

          totalSpeed += speed;
          maxSpeed = Math.max(maxSpeed, speed);
          minSpeed = Math.min(minSpeed, speed);
          totalPosX += px;
          totalPosY += py;
          totalVelX += vx;
          totalVelY += vy;
        }

        const avgSpeed = totalSpeed / particleCount;
        const avgPosX = totalPosX / particleCount;
        const avgPosY = totalPosY / particleCount;
        const avgVelX = totalVelX / particleCount;
        const avgVelY = totalVelY / particleCount;

        let speedVariance = 0;
        for (let i = 0; i < particleCount; i++) {
          const offset = i * floatsPerParticle;
          const vx = floatData[offset + 2];
          const vy = floatData[offset + 3];
          const speed = Math.sqrt(vx * vx + vy * vy);
          speedVariance += Math.pow(speed - avgSpeed, 2);
        }
        const speedStdDev = Math.sqrt(speedVariance / particleCount);

        readBuffer.unmap();
        readBuffer.destroy();

        const lines = [
          'Particle System Statistics',
          '=========================',
          '',
          `Export Time,${new Date().toISOString()}`,
          `Particle Count,${particleCount}`,
          '',
          'Velocity Statistics',
          '-------------------',
          `Average Speed,${avgSpeed.toFixed(4)}`,
          `Max Speed,${maxSpeed.toFixed(4)}`,
          `Min Speed,${minSpeed.toFixed(4)}`,
          `Speed Std Dev,${speedStdDev.toFixed(4)}`,
          `Average Velocity X,${avgVelX.toFixed(4)}`,
          `Average Velocity Y,${avgVelY.toFixed(4)}`,
          '',
          'Position Statistics',
          '-------------------',
          `Average Position X,${avgPosX.toFixed(4)}`,
          `Average Position Y,${avgPosY.toFixed(4)}`,
          '',
          'Energy Metrics',
          '--------------',
          `Kinetic Energy (sum v²),${(totalSpeed * totalSpeed / 2).toFixed(4)}`,
          `Average Kinetic Energy,${(avgSpeed * avgSpeed / 2).toFixed(4)}`,
        ];

        resolve(lines.join('\n'));
      });
    });
  }

  static parseCSV(csvContent: string): Particle[] | null {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) return null;

      const headers = lines[0].split(',');
      const particles: Particle[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const particle: Particle = {
          position: [0, 0],
          velocity: [0, 0],
          color: [0, 0, 0],
          lodLevel: 0,
        };

        for (let j = 0; j < headers.length; j++) {
          const value = parseFloat(values[j]);
          switch (headers[j]) {
            case 'pos_x': particle.position[0] = value; break;
            case 'pos_y': particle.position[1] = value; break;
            case 'vel_x': particle.velocity[0] = value; break;
            case 'vel_y': particle.velocity[1] = value; break;
            case 'color_r': particle.color[0] = value; break;
            case 'color_g': particle.color[1] = value; break;
            case 'color_b': particle.color[2] = value; break;
            case 'lod_level': particle.lodLevel = value; break;
          }
        }

        particles.push(particle);
      }

      return particles;
    } catch {
      return null;
    }
  }
}
