// Render Shader for LBM D2Q9

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
  
  if (obstacles[idx] == 1u) {
    return vec4f(0.15, 0.15, 0.2, 1.0);
  }
  
  let m = macro[idx];
  let rho = m.x;
  let ux = m.y;
  let uy = m.z;
  
  if (uniforms.displayMode == 0u) {
    let speed = sqrt(ux * ux + uy * uy);
    let angle = atan2(uy, ux);
    let hue = (angle + 3.14159) / (2.0 * 3.14159) * 360.0;
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
    let hue = (angle + 3.14159) / (2.0 * 3.14159) * 360.0;
    let saturation = min(speed * uniforms.velocityScale * 0.5, 1.0);
    let value = min(rho, 1.5);
    
    var color = hsv2rgb(hue, saturation, value * 0.6 + 0.4);
    color = mix(color, vec3f(1.0), min(speed * uniforms.velocityScale * 0.3, 0.5));
    return vec4f(color, 1.0);
  }
}
