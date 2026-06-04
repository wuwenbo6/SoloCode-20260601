struct Particle {
  position: vec2f,
  velocity: vec2f,
  color: vec3f,
  lodLevel: f32,
};

struct ForceFieldParams {
  gravityStrength: f32,
  gravityRadius: f32,
  repulsionStrength: f32,
  repulsionRadius: f32,
  vortexStrength: f32,
  vortexRadius: f32,
  mouseStrength: f32,
  mouseRadius: f32,
  damping: f32,
  bounceDamping: f32,
  centerX: f32,
  centerY: f32,
  mouseX: f32,
  mouseY: f32,
  mouseActive: f32,
  deltaTime: f32,
};

struct BoidsParams {
  separationStrength: f32,
  separationRadius: f32,
  alignmentStrength: f32,
  alignmentRadius: f32,
  cohesionStrength: f32,
  cohesionRadius: f32,
  boidsEnabled: f32,
  cellSize: f32,
};

@group(0) @binding(0) var<storage, read_write> particlesIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;
@group(0) @binding(2) var<uniform> params: ForceFieldParams;
@group(0) @binding(3) var<uniform> boidsParams: BoidsParams;

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

fn computeBoidsForce(index: u32, pos: vec2f, vel: vec2f) -> vec2f {
  if (boidsParams.boidsEnabled < 0.5) {
    return vec2f(0.0);
  }

  var separation = vec2f(0.0);
  var alignment = vec2f(0.0);
  var cohesion = vec2f(0.0);
  var separationCount = 0.0;
  var alignmentCount = 0.0;
  var cohesionCount = 0.0;

  let totalCount = arrayLength(&particlesIn);
  let searchRadius = max(max(boidsParams.separationRadius, boidsParams.alignmentRadius), boidsParams.cohesionRadius);
  let maxNeighbors = 64u;
  let stepSize = max(1u, totalCount / 2000u);

  var checked = 0u;
  var i = (index + stepSize) % totalCount;
  while (checked < maxNeighbors && i != index) {
    let other = particlesIn[i];
    let diff = other.position - pos;
    let dist = length(diff);

    if (dist > 0.0 && dist < searchRadius) {
      if (dist < boidsParams.separationRadius) {
        separation -= normalize(diff) * (1.0 - dist / boidsParams.separationRadius);
        separationCount += 1.0;
      }
      if (dist < boidsParams.alignmentRadius) {
        alignment += other.velocity;
        alignmentCount += 1.0;
      }
      if (dist < boidsParams.cohesionRadius) {
        cohesion += other.position;
        cohesionCount += 1.0;
      }
    }

    checked++;
    i = (i + stepSize) % totalCount;
  }

  var boidsForce = vec2f(0.0);

  if (separationCount > 0.0) {
    boidsForce += (separation / separationCount) * boidsParams.separationStrength;
  }
  if (alignmentCount > 0.0) {
    var avgVel = alignment / alignmentCount;
    boidsForce += (avgVel - vel) * boidsParams.alignmentStrength;
  }
  if (cohesionCount > 0.0) {
    var targetPos = cohesion / cohesionCount;
    var toCohesion = targetPos - pos;
    boidsForce += toCohesion * boidsParams.cohesionStrength * 0.01;
  }

  return boidsForce;
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let index = gid.x;
  let particleCount = arrayLength(&particlesIn);
  if (index >= particleCount) {
    return;
  }

  var p = particlesIn[index];
  var force = vec2f(0.0);
  var pos = p.position;
  var center = vec2f(params.centerX, params.centerY);

  let toCenter = center - pos;
  let distToCenter = length(toCenter);
  let dirToCenter = select(vec2f(0.0), normalize(toCenter), distToCenter > 0.0);

  if (distToCenter < params.gravityRadius) {
    let gravityFactor = 1.0 - (distToCenter / params.gravityRadius);
    force += dirToCenter * params.gravityStrength * gravityFactor;
  }

  if (distToCenter < params.repulsionRadius) {
    let repulsionFactor = 1.0 - (distToCenter / params.repulsionRadius);
    force -= dirToCenter * params.repulsionStrength * repulsionFactor;
  }

  if (distToCenter < params.vortexRadius) {
    let vortexFactor = 1.0 - (distToCenter / params.vortexRadius);
    let tangent = vec2f(-toCenter.y, toCenter.x);
    let tangentDir = select(vec2f(0.0), normalize(tangent), distToCenter > 0.0);
    force += tangentDir * params.vortexStrength * vortexFactor;
  }

  if (params.mouseActive > 0.5) {
    var mousePos = vec2f(params.mouseX, params.mouseY);
    var toMouse = mousePos - pos;
    var distToMouse = length(toMouse);
    
    if (distToMouse > 0.0 && distToMouse < params.mouseRadius) {
      let mouseFactor = 1.0 - (distToMouse / params.mouseRadius);
      force -= normalize(toMouse) * params.mouseStrength * mouseFactor * mouseFactor;
    }
  }

  force += computeBoidsForce(index, pos, p.velocity);

  p.velocity += force * params.deltaTime;

  let speed = length(p.velocity);
  let maxSpeed = 800.0;
  if (speed > maxSpeed) {
    p.velocity = normalize(p.velocity) * maxSpeed;
  }

  let speedFactor = clamp(speed / maxSpeed, 0.0, 1.0);
  let adaptiveDamping = mix(params.damping, 0.95, speedFactor * 0.5);
  p.velocity *= adaptiveDamping;

  p.position += p.velocity * params.deltaTime;

  let margin = 2.0;
  let width = params.centerX * 2.0;
  let height = params.centerY * 2.0;

  if (p.position.x < margin) {
    p.position.x = margin;
    p.velocity.x = abs(p.velocity.x) * params.bounceDamping;
  }
  if (p.position.x > width - margin) {
    p.position.x = width - margin;
    p.velocity.x = -abs(p.velocity.x) * params.bounceDamping;
  }
  if (p.position.y < margin) {
    p.position.y = margin;
    p.velocity.y = abs(p.velocity.y) * params.bounceDamping;
  }
  if (p.position.y > height - margin) {
    p.position.y = height - margin;
    p.velocity.y = -abs(p.velocity.y) * params.bounceDamping;
  }

  let currentSpeed = length(p.velocity);
  var color = vec3f(0.0);

  if (boidsParams.boidsEnabled > 0.5) {
    let dirHue = (atan2(p.velocity.y, p.velocity.x) + 3.14159) / 6.28318 * 360.0;
    color = hsv2rgb(dirHue, 0.8, 0.7 + speedFactor * 0.3);
  } else {
    let hue = (currentSpeed * 3.0 + (p.position.x + p.position.y) * 0.05) % 360.0;
    let saturation = 0.8;
    let value = min(0.4 + currentSpeed * 0.002, 1.0);
    color = hsv2rgb(hue, saturation, value);
  }
  p.color = color;

  let screenWidth = params.centerX * 2.0;
  let screenHeight = params.centerY * 2.0;
  let maxDist = max(screenWidth, screenHeight) * 0.5;
  let distFactor = clamp(distToCenter / maxDist, 0.0, 1.0);
  p.lodLevel = select(0.0, select(1.0, 2.0, distFactor > 0.66), distFactor > 0.33);

  particlesOut[index] = p;
}
