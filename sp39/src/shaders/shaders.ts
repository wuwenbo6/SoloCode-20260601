export const LBM_D2Q9_SHADER = `
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

// Workgroup size for shared memory optimization
const WORKGROUP_SIZE: u32 = 16u;
const TILE_SIZE: u32 = 16u;

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

// Shared memory tile for cache optimization
var<workgroup> tile_f: array<f32, (16u + 2u) * (16u + 2u) * 9u>;
var<workgroup> tile_obstacle: array<u32, (16u + 2u) * (16u + 2u)>;

fn getIndex(x: u32, y: u32) -> u32 {
  return y * uniforms.gridSize + x;
}

fn getFIndex(x: u32, y: u32, k: u32) -> u32 {
  return (y * uniforms.gridSize + x) * 9u + k;
}

fn getTileIndex(tx: u32, ty: u32) -> u32 {
  return ty * (TILE_SIZE + 2u) + tx;
}

fn getTileFIndex(tx: u32, ty: u32, k: u32) -> u32 {
  return (ty * (TILE_SIZE + 2u) + tx) * 9u + k;
}

fn clampVelocity(u: vec2f) -> vec2f {
  let speed = length(u);
  let maxSpeed = 0.15;
  if (speed > maxSpeed) {
    return u * (maxSpeed / speed);
  }
  return u;
}

fn clampDensity(rho: f32) -> f32 {
  return clamp(rho, 0.1, 3.0);
}

fn equilibrium(rho: f32, u: vec2f, k: u32) -> f32 {
  let ek = vec2f(f32(e[k].x), f32(e[k].y));
  let wk = w[k];
  
  let uDotU = dot(u, u);
  let ekDotU = dot(ek, u);
  
  return wk * rho * (1.0 + 3.0 * ekDotU + 4.5 * ekDotU * ekDotU - 1.5 * uDotU);
}

fn computeMacroFromTile(tx: u32, ty: u32) -> vec3f {
  var rho: f32 = 0.0;
  var u: vec2f = vec2f(0.0, 0.0);
  
  for (var k: u32 = 0u; k < 9u; k++) {
    let fVal = tile_f[getTileFIndex(tx, ty, k)];
    rho += fVal;
    u += vec2f(f32(e[k].x), f32(e[k].y)) * fVal;
  }
  
  rho = clampDensity(rho);
  
  if (rho > 0.001) {
    u = u / rho;
    u = clampVelocity(u);
  } else {
    u = vec2f(0.0, 0.0);
  }
  
  return vec3f(rho, u.x, u.y);
}

fn loadTile(@builtin(workgroup_id) wg_id: vec3u, @builtin(global_invocation_id) global_id: vec3u) {
  let baseX = wg_id.x * TILE_SIZE;
  let baseY = wg_id.y * TILE_SIZE;
  
  let local_id = global_id.x & (TILE_SIZE - 1u);
  let tid = local_id;
  
  for (var i: u32 = tid; i < (TILE_SIZE + 2u) * (TILE_SIZE + 2u); i += TILE_SIZE * TILE_SIZE) {
    let tx = i % (TILE_SIZE + 2u);
    let ty = i / (TILE_SIZE + 2u);
    
    let gx = (baseX + tx - 1u + uniforms.gridSize) % uniforms.gridSize;
    let gy = (baseY + ty - 1u + uniforms.gridSize) % uniforms.gridSize;
    
    let gIdx = getIndex(gx, gy);
    tile_obstacle[getTileIndex(tx, ty)] = obstacles[gIdx];
    
    for (var k: u32 = 0u; k < 9u; k++) {
      tile_f[getTileFIndex(tx, ty, k)] = f0[getFIndex(gx, gy, k)];
    }
  }
  
  workgroupBarrier();
}

@compute @workgroup_size(16, 16)
fn collisionMacro(@builtin(global_invocation_id) global_id: vec3u,
                  @builtin(workgroup_id) wg_id: vec3u,
                  @builtin(local_invocation_id) local_id: vec3u) {
  let x = global_id.x;
  let y = global_id.y;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return;
  }
  
  loadTile(wg_id, global_id);
  workgroupBarrier();
  
  let tx = (x & (TILE_SIZE - 1u)) + 1u;
  let ty = (y & (TILE_SIZE - 1u)) + 1u;
  
  let idx = getIndex(x, y);
  
  if (tile_obstacle[getTileIndex(tx, ty)] == 1u) {
    macro[idx] = vec3f(0.0, 0.0, 0.0);
    for (var k: u32 = 0u; k < 9u; k++) {
      f1[getFIndex(x, y, k)] = 0.0;
    }
    return;
  }
  
  let m = computeMacroFromTile(tx, ty);
  let rho = m.x;
  let u = vec2f(m.y, m.z);
  
  var uAvg: vec2f = vec2f(0.0, 0.0);
  var count: f32 = 0.0;
  
  for (var dy: i32 = -1; dy <= 1; dy++) {
    for (var dx: i32 = -1; dx <= 1; dx++) {
      let ntx = u32(i32(tx) + dx);
      let nty = u32(i32(ty) + dy);
      
      if (tile_obstacle[getTileIndex(ntx, nty)] == 0u) {
        let nm = computeMacroFromTile(ntx, nty);
        uAvg += vec2f(nm.y, nm.z);
        count += 1.0;
      }
    }
  }
  
  if (count > 0.0) {
    uAvg = uAvg / count;
  }
  
  let artificialViscosity = 0.02;
  let uSmoothed = mix(u, uAvg, artificialViscosity);
  let uFinal = clampVelocity(uSmoothed);
  
  macro[idx] = vec3f(rho, uFinal.x, uFinal.y);
  
  for (var k: u32 = 0u; k < 9u; k++) {
    let feq = equilibrium(rho, uFinal, k);
    let fVal = tile_f[getTileFIndex(tx, ty, k)];
    
    var force: f32 = 0.0;
    if (rho > 0.001) {
      let ek = vec2f(f32(e[k].x), f32(e[k].y));
      let S = 3.0 * w[k];
      let uNeumann = uFinal;
      force = S * (1.0 - 0.5 * uniforms.omega) * dot(ek, uNeumann - u) * rho;
    }
    
    f1[getFIndex(x, y, k)] = fVal + uniforms.omega * (feq - fVal) + force;
  }
}

@compute @workgroup_size(16, 16)
fn stream(@builtin(global_invocation_id) id: vec3u) {
  let x = id.x;
  let y = id.y;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return;
  }
  
  let idx = getIndex(x, y);
  let isObstacle = obstacles[idx] == 1u;
  
  for (var k: u32 = 0u; k < 9u; k++) {
    let dstIdx = getFIndex(x, y, k);
    
    if (isObstacle) {
      let oppK = opposite[k];
      let ex = e[oppK].x;
      let ey = e[oppK].y;
      
      let nx = (x + u32(ex) + uniforms.gridSize) % uniforms.gridSize;
      let ny = (y + u32(ey) + uniforms.gridSize) % uniforms.gridSize;
      
      let neighborObs = obstacles[getIndex(nx, ny)];
      
      if (neighborObs == 0u) {
        let fNeighbor = f1[getFIndex(nx, ny, k)];
        let fLocal = f1[getFIndex(x, y, oppK)];
        
        let interpolated = 0.5 * (fNeighbor + fLocal);
        f0[dstIdx] = interpolated;
      } else {
        f0[dstIdx] = f1[getFIndex(x, y, oppK)];
      }
    } else {
      let nx = (x + u32(e[k].x) + uniforms.gridSize) % uniforms.gridSize;
      let ny = (y + u32(e[k].y) + uniforms.gridSize) % uniforms.gridSize;
      
      let srcIdx = getFIndex(nx, ny, k);
      var fVal = f1[srcIdx];
      
      if (obstacles[getIndex(nx, ny)] == 1u) {
        let oppK = opposite[k];
        fVal = f1[getFIndex(x, y, oppK)];
      }
      
      f0[dstIdx] = fVal;
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

@compute @workgroup_size(16, 16)
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
      
      let falloff = 1.0 - smoothstep(0.0, inject.radius, dist);
      
      var rho = m.x + inject.density * falloff;
      var ux = m.y + inject.velocityX * falloff;
      var uy = m.z + inject.velocityY * falloff;
      
      rho = clampDensity(rho);
      let u = clampVelocity(vec2f(ux, uy));
      ux = u.x;
      uy = u.y;
      
      macro[idx] = vec3f(rho, ux, uy);
      
      for (var k: u32 = 0u; k < 9u; k++) {
        let fIdx = getFIndex(x, y, k);
        var feq = equilibrium(rho, vec2f(ux, uy), k);
        feq = max(feq, 0.0);
        f0[fIdx] = feq;
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

@compute @workgroup_size(16, 16)
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
`;

export const RENDER_SHADER = `
struct Uniforms {
  gridSize: u32,
  displayMode: u32,
  velocityScale: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> macro: array<vec3f>;
@group(0) @binding(2) var<storage, read> obstacles: array<u32>;

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
  let c = v * s;
  let x = c * (1.0 - abs(((h / 60.0) % 2.0) - 1.0));
  let m = v - c;
  
  var rgb: vec3f;
  if (h < 60.0) {
    rgb = vec3f(c, x, 0.0);
  } else if (h < 120.0) {
    rgb = vec3f(x, c, 0.0);
  } else if (h < 180.0) {
    rgb = vec3f(0.0, c, x);
  } else if (h < 240.0) {
    rgb = vec3f(0.0, x, c);
  } else if (h < 300.0) {
    rgb = vec3f(x, 0.0, c);
  } else {
    rgb = vec3f(c, 0.0, x);
  }
  
  return rgb + vec3f(m, m, m);
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, 1.0)
  );
  return vec4f(pos[vertex_index], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let x = u32(fragCoord.x);
  let y = u32(uniforms.gridSize - 1u - u32(fragCoord.y));
  let idx = y * uniforms.gridSize + x;
  
  if (x >= uniforms.gridSize || y >= uniforms.gridSize) {
    return vec4f(0.02, 0.05, 0.08, 1.0);
  }
  
  if (obstacles[idx] == 1u) {
    return vec4f(0.15, 0.15, 0.2, 1.0);
  }
  
  let m = macro[idx];
  let rho = clamp(m.x, 0.1, 3.0);
  let ux = m.y;
  let uy = m.z;
  
  if (uniforms.displayMode == 0u) {
    let speed = sqrt(ux * ux + uy * uy);
    let angle = atan2(uy, ux);
    let hue = (angle + 3.14159265359) / (2.0 * 3.14159265359) * 360.0;
    let saturation = min(speed * uniforms.velocityScale, 1.0);
    let value = min(rho, 1.5);
    
    let color = hsv2rgb(hue, saturation, value * 0.7 + 0.3);
    return vec4f(color, 1.0);
  } else if (uniforms.displayMode == 1u) {
    let d = clamp(rho - 1.0, 0.0, 1.0);
    let color = hsv2rgb(200.0, 0.8, d * 0.8 + 0.2);
    return vec4f(color, 1.0);
  } else {
    let speed = sqrt(ux * ux + uy * uy);
    let angle = atan2(uy, ux);
    let hue = (angle + 3.14159265359) / (2.0 * 3.14159265359) * 360.0;
    let saturation = min(speed * uniforms.velocityScale * 0.5, 1.0);
    let value = min(rho, 1.5);
    
    var color = hsv2rgb(hue, saturation, value * 0.6 + 0.4);
    color = mix(color, vec3f(1.0), min(speed * uniforms.velocityScale * 0.3, 0.5));
    return vec4f(color, 1.0);
  }
}
`;
