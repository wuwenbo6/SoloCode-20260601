// LBM D2Q9 Compute Shader

// D2Q9 velocity directions
const e: array<vec2i, 9> = array<vec2i, 9>(
  vec2i(0, 0),
  vec2i(1, 0),
  vec2i(0, 1),
  vec2i(-1, 0),
  vec2i(0, -1),
  vec2i(1, 1),
  vec2i(-1, 1),
  vec2i(-1, -1),
  vec2i(1, -1)
);

// D2Q9 weights
const w: array<f32, 9> = array<f32, 9>(
  4.0 / 9.0,
  1.0 / 9.0,
  1.0 / 9.0,
  1.0 / 9.0,
  1.0 / 9.0,
  1.0 / 36.0,
  1.0 / 36.0,
  1.0 / 36.0,
  1.0 / 36.0
);

// Opposite directions for bounce-back
const opposite: array<u32, 9> = array<u32, 9>(0, 3, 4, 1, 2, 7, 8, 5, 6);

struct Uniforms {
  gridSize: u32,
  tau: f32,
  omega: f32,
  time: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> f0: array<f32>;
@group(0) @binding(2) var<storage, read_write> f1: array<f32>;
@group(0) @binding(3) var<storage, read_write> macro: array<vec3f>;
@group(0) @binding(4) var<storage, read_write> obstacles: array<u32>;

fn getIndex(x: u32, y: u32) -> u32 {
  return y * uniforms.gridSize + x;
}

fn getFIndex(x: u32, y: u32, k: u32) -> u32 {
  return (y * uniforms.gridSize + x) * 9u + k;
}

fn equilibrium(rho: f32, u: vec2f, k: u32) -> f32 {
  let ek = vec2f(f32(e[k].x), f32(e[k].y));
  let wk = w[k];
  
  let uDotU = dot(u, u);
  let ekDotU = dot(ek, u);
  
  return wk * rho * (1.0 + 3.0 * ekDotU + 4.5 * ekDotU * ekDotU - 1.5 * uDotU);
}

@compute @workgroup_size(8, 8)
fn collisionMacro(@builtin(global_invocation_id) id: vec3u) {
  let x = id.x;
  let y = id.y;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return;
  }
  
  let idx = getIndex(x, y);
  
  if (obstacles[idx] == 1u) {
    return;
  }
  
  var rho: f32 = 0.0;
  var u: vec2f = vec2f(0.0, 0.0);
  
  for (var k: u32 = 0u; k < 9u; k++) {
    let fVal = f0[getFIndex(x, y, k)];
    rho += fVal;
    u += vec2f(f32(e[k].x), f32(e[k].y)) * fVal;
  }
  
  u = u / rho;
  macro[idx] = vec3f(rho, u.x, u.y);
  
  for (var k: u32 = 0u; k < 9u; k++) {
    let feq = equilibrium(rho, u, k);
    let fIdx = getFIndex(x, y, k);
    f1[fIdx] = f0[fIdx] + uniforms.omega * (feq - f0[fIdx]);
  }
}

@compute @workgroup_size(8, 8)
fn stream(@builtin(global_invocation_id) id: vec3u) {
  let x = id.x;
  let y = id.y;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return;
  }
  
  let idx = getIndex(x, y);
  
  for (var k: u32 = 0u; k < 9u; k++) {
    let nx = (x + u32(e[k].x) + uniforms.gridSize) % uniforms.gridSize;
    let ny = (y + u32(e[k].y) + uniforms.gridSize) % uniforms.gridSize;
    
    let srcIdx = getFIndex(nx, ny, k);
    let dstIdx = getFIndex(x, y, k);
    
    if (obstacles[idx] == 1u) {
      f0[dstIdx] = f1[getFIndex(x, y, opposite[k])];
    } else {
      f0[dstIdx] = f1[srcIdx];
    }
  }
}

struct InjectionParams {
  x: f32,
  y: f32,
  radius: f32,
  density: f32,
  velocityX: f32,
  velocityY: f32,
};

@group(1) @binding(0) var<uniform> inject: InjectionParams;

@compute @workgroup_size(8, 8)
fn injectFluid(@builtin(global_invocation_id) id: vec3u) {
  let x = id.x;
  let y = id.y;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return;
  }
  
  let dx = f32(x) - inject.x;
  let dy = f32(y) - inject.y;
  let dist = sqrt(dx * dx + dy * dy);
  
  if (dist < inject.radius) {
    let idx = getIndex(x, y);
    if (obstacles[idx] == 0u) {
      let m = macro[idx];
      let rho = m.x + inject.density * (1.0 - dist / inject.radius);
      let ux = m.y + inject.velocityX * (1.0 - dist / inject.radius);
      let uy = m.z + inject.velocityY * (1.0 - dist / inject.radius);
      
      macro[idx] = vec3f(rho, ux, uy);
      
      for (var k: u32 = 0u; k < 9u; k++) {
        let fIdx = getFIndex(x, y, k);
        f0[fIdx] = equilibrium(rho, vec2f(ux, uy), k);
      }
    }
  }
}

struct ObstacleParams {
  centerX: f32,
  centerY: f32,
  size: f32,
  shape: u32,
  add: u32,
};

@group(2) @binding(0) var<uniform> obstacle: ObstacleParams;

@compute @workgroup_size(8, 8)
fn updateObstacles(@builtin(global_invocation_id) id: vec3u) {
  let x = id.x;
  let y = id.y;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return;
  }
  
  let idx = getIndex(x, y);
  var isObstacle = false;
  
  if (obstacle.shape == 0u) {
    let dx = f32(x) - obstacle.centerX;
    let dy = f32(y) - obstacle.centerY;
    isObstacle = (dx * dx + dy * dy) < obstacle.size * obstacle.size;
  } else {
    let halfSize = obstacle.size * 0.5;
    isObstacle = (f32(x) >= obstacle.centerX - halfSize && f32(x) <= obstacle.centerX + halfSize &&
                  f32(y) >= obstacle.centerY - halfSize && f32(y) <= obstacle.centerY + halfSize);
  }
  
  if (isObstacle) {
    if (obstacle.add == 1u) {
      obstacles[idx] = 1u;
      for (var k: u32 = 0u; k < 9u; k++) {
        f0[getFIndex(x, y, k)] = 0.0;
      }
      macro[idx] = vec3f(0.0, 0.0, 0.0);
    } else {
      obstacles[idx] = 0u;
      macro[idx] = vec3f(1.0, 0.0, 0.0);
      for (var k: u32 = 0u; k < 9u; k++) {
        f0[getFIndex(x, y, k)] = equilibrium(1.0, vec2f(0.0, 0.0), k);
      }
    }
  }
}
