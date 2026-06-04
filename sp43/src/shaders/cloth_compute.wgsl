struct Particle {
    position: vec3f,
    prevPosition: vec3f,
    predictPosition: vec3f,
    mass: f32,
    invMass: f32,
    pinned: u32,
    _pad0: u32,
    _pad1: u32,
};

struct Spring {
    a: u32,
    b: u32,
    restLength: f32,
    compliance: f32,
    type: u32,
    broken: u32,
    tension: f32,
    breakThreshold: f32,
};

struct SimParams {
    structCompliance: f32,
    shearCompliance: f32,
    bendCompliance: f32,
    damping: f32,
    gravity: vec3f,
    deltaTime: f32,
    numParticles: u32,
    numSprings: u32,
    globalBreakThreshold: f32,
    subSteps: u32,
};

struct WindParams {
    strength: f32,
    time: f32,
    frequency: f32,
    _pad0: f32,
    direction: vec3f,
    _pad1: u32,
};

struct MouseInteraction {
    mode: u32,
    active: u32,
    particleIndex: u32,
    radius: f32,
    worldPos: vec3f,
    force: vec3f,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> springs: array<Spring>;
@group(0) @binding(2) var<uniform> simParams: SimParams;
@group(0) @binding(3) var<uniform> windParams: WindParams;
@group(0) @binding(4) var<uniform> mouse: MouseInteraction;

fn getCompliance(type: u32) -> f32 {
    if (type == 0u) { return simParams.structCompliance; }
    if (type == 1u) { return simParams.shearCompliance; }
    return simParams.bendCompliance;
}

@compute @workgroup_size(64)
fn predictPositions(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx >= simParams.numParticles) { return; }

    var p = &particles[idx];

    if (p.pinned == 1u) {
        p.predictPosition = p.position;
        return;
    }

    let dt = simParams.deltaTime;
    let vel = p.position - p.prevPosition;
    let dampedVel = vel * simParams.damping;

    var extForce = simParams.gravity * p.mass;

    let windAngle = windParams.time * windParams.frequency;
    var windDir = vec3f(
        cos(windAngle) * windParams.direction.x + sin(windAngle * 1.3) * windParams.direction.z,
        sin(windAngle * 0.7) * 0.3 + windParams.direction.y,
        sin(windAngle) * windParams.direction.z + cos(windAngle * 1.1) * windParams.direction.x
    );
    let windLen = length(windDir);
    if (windLen > 0.001) {
        windDir = windDir / windLen;
    }
    let posScale = sin(p.position.x * 0.5 + windParams.time * 2.0) *
                   cos(p.position.y * 0.3 + windParams.time * 1.5);
    extForce += windDir * windParams.strength * (0.8 + posScale * 0.4);

    if (mouse.active == 1u && mouse.mode == 2u) {
        let delta = p.position - mouse.worldPos;
        let dist = length(delta);
        if (dist < mouse.radius && dist > 0.001) {
            let falloff = 1.0 - (dist / mouse.radius);
            let dir = delta / dist;
            extForce += dir * length(mouse.force) * falloff * falloff;
        }
    }

    if (mouse.active == 1u && mouse.mode == 0u && idx == mouse.particleIndex) {
        let delta = mouse.worldPos - p.position;
        extForce += delta * 500.0;
    }

    p.predictPosition = p.position + dampedVel + extForce * p.invMass * dt * dt;
}

@compute @workgroup_size(64)
fn solveConstraints(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx >= simParams.numSprings) { return; }

    var spring = &springs[idx];

    if (spring.broken == 1u) {
        spring.tension = 0.0;
        return;
    }

    let pA = particles[spring.a];
    let pB = particles[spring.b];

    let delta = pB.predictPosition - pA.predictPosition;
    let dist = length(delta);

    if (dist < 0.0001) {
        spring.tension = 0.0;
        return;
    }

    let alpha = spring.compliance * getCompliance(spring.type) /
                (simParams.deltaTime * simParams.deltaTime);

    let C = dist - spring.restLength;

    spring.tension = abs(C / spring.restLength);

    if (spring.tension > spring.breakThreshold * simParams.globalBreakThreshold) {
        spring.broken = 1u;
        spring.tension = 0.0;
        return;
    }

    let wA = pA.invMass;
    let wB = pB.invMass;
    let wSum = wA + wB + alpha;

    if (wSum < 0.00001) { return; }

    let lambda = -C / wSum;

    let correction = (delta / dist) * lambda;

    if (pA.pinned == 0u) {
        particles[spring.a].predictPosition -= correction * wA;
    }
    if (pB.pinned == 0u) {
        particles[spring.b].predictPosition += correction * wB;
    }
}

@compute @workgroup_size(64)
fn integratePositions(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx >= simParams.numParticles) { return; }

    var p = &particles[idx];

    if (p.pinned == 1u) {
        p.prevPosition = p.position;
        return;
    }

    let newPos = p.predictPosition;

    if (newPos.y < -3.0) {
        p.prevPosition = vec3f(newPos.x, -3.0 + (newPos.y - p.position.y) * 0.3, newPos.z);
        p.position = vec3f(newPos.x, -3.0, newPos.z);
    } else {
        p.prevPosition = p.position;
        p.position = newPos;
    }
}

@compute @workgroup_size(64)
fn tearSprings(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx >= simParams.numSprings) { return; }

    if (mouse.active == 0u || mouse.mode != 1u) { return; }

    var spring = &springs[idx];
    if (spring.broken == 1u) { return; }

    let pA = particles[spring.a].position;
    let pB = particles[spring.b].position;
    let midPoint = (pA + pB) * 0.5;

    let dist = length(midPoint - mouse.worldPos);
    if (dist < mouse.radius) {
        spring.broken = 1u;
        spring.tension = 0.0;
    }
}
