struct Particle {
  position: vec2f,
  velocity: vec2f,
  color: vec3f,
  lodLevel: f32,
};

struct RenderParams {
  particleSize: f32,
  width: f32,
  height: f32,
  colorMode: f32,
  baseColorR: f32,
  baseColorG: f32,
  baseColorB: f32,
  time: f32,
  lodBias: f32,
  renderMask: f32,
  viewMode: f32,
  viewAngle: f32,
  viewZoom: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: RenderParams;

struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec3f,
  @location(2) speed: f32,
  @location(3) visible: f32,
  @location(4) viewportIndex: f32,
};

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
  var c = v * s;
  var x = c * (1.0 - abs(((h / 60.0) % 2.0) - 1.0));
  var m = v - c;
  var rgb = vec3f(0.0);
  if (h < 60.0) { rgb = vec3f(c, x, 0.0); }
  else if (h < 120.0) { rgb = vec3f(x, c, 0.0); }
  else if (h < 180.0) { rgb = vec3f(0.0, c, x); }
  else if (h < 240.0) { rgb = vec3f(0.0, x, c); }
  else if (h < 300.0) { rgb = vec3f(x, 0.0, c); }
  else { rgb = vec3f(c, 0.0, x); }
  return rgb + vec3f(m);
}

fn projectPosition(pos: vec2f, vel: vec2f, viewMode: f32, viewAngle: f32, viewZoom: f32) -> vec2f {
  var result = pos;
  let center = vec2f(params.width * 0.5, params.height * 0.5);

  if (viewMode < 0.5) {
    result = pos;
  } else if (viewMode < 1.5) {
    let speed = length(vel);
    let yOffset = speed * 0.5;
    result = vec2f(pos.x, pos.y - yOffset * 0.3);
  } else if (viewMode < 2.5) {
    let angleRad = viewAngle * 3.14159 / 180.0;
    let cosA = cos(angleRad);
    let sinA = sin(angleRad);
    let toCenter = pos - center;
    var rotated = vec2f(
      toCenter.x * cosA - toCenter.y * sinA * 0.3,
      toCenter.x * sinA * 0.3 + toCenter.y * cosA
    );
    let speed = length(vel);
    rotated.y -= speed * 0.2;
    result = rotated + center;
  }

  let zoomed = (result - center) * viewZoom + center;
  return zoomed;
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.visible = 0.0;
  output.viewportIndex = 0.0;
  output.position = vec4f(0.0, 0.0, -2.0, 1.0);

  var renderParticle = true;
  var p = particles[input.instanceIndex];
  
  if (params.lodBias < 0.5) {
    if (p.lodLevel > 0.5) {
      var skipInterval = select(2, 4, p.lodLevel > 1.5);
      if (input.instanceIndex % u32(skipInterval) != 0) {
        renderParticle = false;
      }
    }
  }
  
  var maskCheck = select(0.0, 1.0, params.renderMask < 0.5);
  renderParticle = renderParticle && maskCheck > 0.5;
  
  if (!renderParticle) {
    return output;
  }

  output.visible = 1.0;
  
  let quadPositions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0,  1.0),
  );
  
  let quadUVs = array<vec2f, 6>(
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 1.0),
  );
  
  let vertexPos = quadPositions[input.vertexIndex];
  output.uv = quadUVs[input.vertexIndex];
  
  let speed = length(p.velocity);
  var sizeMultiplier = 1.0 + min(speed * 0.01, 1.5);
  var lodSizeFactor = select(1.0, select(0.8, 0.6, p.lodLevel > 1.5), p.lodLevel > 0.5);
  let size = params.particleSize * sizeMultiplier * lodSizeFactor;
  
  var projectedPos = projectPosition(p.position, p.velocity, params.viewMode, params.viewAngle, params.viewZoom);
  
  var ndcX = (projectedPos.x / params.width) * 2.0 - 1.0;
  var ndcY = 1.0 - (projectedPos.y / params.height) * 2.0;
  
  var particleNdc = vec2f(ndcX, ndcY);
  var vertexNdcOffset = vec2f(
    vertexPos.x * size / params.width * 2.0,
    vertexPos.y * size / params.height * -2.0
  );
  
  output.position = vec4f(particleNdc + vertexNdcOffset, 0.0, 1.0);
  output.speed = speed;
  
  var colorMode = i32(params.colorMode);
  if (colorMode == 0) {
    output.color = p.color;
  } else if (colorMode == 1) {
    let hue = ((p.position.x / params.width) * 180.0 + (p.position.y / params.height) * 180.0) % 360.0;
    output.color = hsv2rgb(hue, 0.8, 0.9);
  } else if (colorMode == 2) {
    let hue = (params.time * 30.0 + f32(input.instanceIndex) * 0.5) % 360.0;
    output.color = hsv2rgb(hue, 0.9, 1.0);
  } else if (colorMode == 3) {
    output.color = vec3f(params.baseColorR, params.baseColorG, params.baseColorB);
  } else {
    let dirHue = (atan2(p.velocity.y, p.velocity.x) + 3.14159) / 6.28318 * 360.0;
    output.color = hsv2rgb(dirHue, 0.8, 0.7 + min(speed / 800.0, 0.5));
  }
  
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  if (input.visible < 0.5) {
    discard;
  }
  
  let center = vec2f(0.5, 0.5);
  let dist = distance(input.uv, center);
  
  if (dist > 0.5) {
    discard;
  }
  
  let alpha = 1.0 - smoothstep(0.2, 0.5, dist);
  let brightness = 1.0 + min(input.speed * 0.03, 1.5);
  
  return vec4f(input.color * brightness, alpha);
}
