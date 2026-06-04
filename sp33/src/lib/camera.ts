import { vec3, degreesToRadians } from './math.js';
import type { Vec3 } from './math.js';
import type { CameraState } from '../../shared/types.js';

export interface OrbitCameraOptions {
  target: Vec3;
  distance: number;
  minDistance: number;
  maxDistance: number;
  azimuth: number;
  polar: number;
  minPolar: number;
  maxPolar: number;
  fov: number;
}

export class OrbitCamera {
  target: Vec3;
  distance: number;
  minDistance: number;
  maxDistance: number;
  azimuth: number;
  polar: number;
  minPolar: number;
  maxPolar: number;
  fov: number;

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private onChangeCallback: (() => void) | null = null;

  constructor(options: Partial<OrbitCameraOptions> = {}) {
    this.target = options.target || [0, 0, 0];
    this.distance = options.distance || 5;
    this.minDistance = options.minDistance || 1;
    this.maxDistance = options.maxDistance || 20;
    this.azimuth = options.azimuth || 0;
    this.polar = options.polar || Math.PI / 4;
    this.minPolar = options.minPolar || 0.1;
    this.maxPolar = options.maxPolar || Math.PI - 0.1;
    this.fov = options.fov || 45;
  }

  getPosition(): Vec3 {
    const x =
      this.distance *
      Math.sin(this.polar) *
      Math.cos(this.azimuth + Math.PI / 2);
    const y = this.distance * Math.cos(this.polar);
    const z =
      this.distance *
      Math.sin(this.polar) *
      Math.sin(this.azimuth + Math.PI / 2);

    return [this.target[0] + x, this.target[1] + y, this.target[2] + z];
  }

  getForward(): Vec3 {
    return vec3.normalize(vec3.sub(this.target, this.getPosition()));
  }

  getRight(): Vec3 {
    const forward = this.getForward();
    const up: Vec3 = [0, 1, 0];
    return vec3.normalize(vec3.cross(forward, up));
  }

  getUp(): Vec3 {
    const forward = this.getForward();
    const right = this.getRight();
    return vec3.normalize(vec3.cross(right, forward));
  }

  getState(aspect: number): CameraState {
    return {
      position: this.getPosition(),
      target: [...this.target],
      fov: this.fov,
      aspect,
    };
  }

  getGPUData(aspect: number): Float32Array {
    const data = new Float32Array(16);
    const pos = this.getPosition();
    const forward = this.getForward();
    const right = this.getRight();
    const up = this.getUp();

    const fovRad = degreesToRadians(this.fov);
    const focalLength = 1 / Math.tan(fovRad / 2);

    data[0] = pos[0];
    data[1] = pos[1];
    data[2] = pos[2];
    data[3] = 0;

    data[4] = forward[0];
    data[5] = forward[1];
    data[6] = forward[2];
    data[7] = focalLength;

    data[8] = right[0];
    data[9] = right[1];
    data[10] = right[2];
    data[11] = aspect;

    data[12] = up[0];
    data[13] = up[1];
    data[14] = up[2];
    data[15] = 0;

    return data;
  }

  rotate(deltaAzimuth: number, deltaPolar: number): void {
    this.azimuth += deltaAzimuth;
    this.polar = Math.max(
      this.minPolar,
      Math.min(this.maxPolar, this.polar + deltaPolar)
    );
    this.onChangeCallback?.();
  }

  zoom(delta: number): void {
    this.distance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.distance + delta)
    );
    this.onChangeCallback?.();
  }

  pan(deltaX: number, deltaY: number): void {
    const right = vec3.mul(this.getRight(), deltaX * this.distance * 0.001);
    const up = vec3.mul(this.getUp(), -deltaY * this.distance * 0.001);
    this.target = vec3.add(this.target, vec3.add(right, up));
    this.onChangeCallback?.();
  }

  attachToElement(element: HTMLElement): () => void {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        element.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;

      if (e.shiftKey) {
        this.pan(deltaX, deltaY);
      } else {
        this.rotate(deltaX * 0.005, deltaY * 0.005);
      }

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    const handleMouseUp = () => {
      this.isDragging = false;
      element.style.cursor = 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoom(e.deltaY * 0.01);
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    element.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('contextmenu', handleContextMenu);

    element.style.cursor = 'grab';

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }

  onChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  reset(): void {
    this.azimuth = 0;
    this.polar = Math.PI / 4;
    this.distance = 5;
    this.target = [0, 0, 0];
    this.onChangeCallback?.();
  }
}
