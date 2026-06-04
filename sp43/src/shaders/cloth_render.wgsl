struct Camera {
    viewProj: mat4x4f,
    position: vec3f,
    _pad: f32,
};

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

struct RenderParams {
    showStress: u32,
    maxTension: f32,
    gridSize: u32,
    structSpringCount: u32,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;
@group(0) @binding(2) var<storage, read> springs: array<Spring>;
@group(0) @binding(3) var<uniform> renderParams: RenderParams;

fn tensionToColor(tension: f32, maxT: f32) -> vec3f {
    let t = clamp(tension / maxT, 0.0, 1.0);

    if (t < 0.25) {
        let local = t / 0.25;
        return vec3f(0.0, local * 0.5, 1.0);
    } else if (t < 0.5) {
        let local = (t - 0.25) / 0.25;
        return vec3f(0.0, 0.5 + local * 0.5, 1.0 - local);
    } else if (t < 0.75) {
        let local = (t - 0.5) / 0.25;
        return vec3f(local, 1.0, 0.0);
    } else {
        let local = (t - 0.75) / 0.25;
        return vec3f(1.0, 1.0 - local * 0.8, 0.0);
    }
}

fn hSpringIdx(x: u32, y: u32) -> u32 {
    return y * (renderParams.gridSize - 1u) + x;
}

fn vSpringIdx(x: u32, y: u32) -> u32 {
    let hCount = renderParams.gridSize * (renderParams.gridSize - 1u);
    return hCount + y * renderParams.gridSize + x;
}

fn isEdgeBroken(springIdx: u32) -> bool {
    if (springIdx >= renderParams.structSpringCount) { return true; }
    return springs[springIdx].broken == 1u;
}

fn getEdgeTension(springIdx: u32) -> f32 {
    if (springIdx >= renderParams.structSpringCount) { return 0.0; }
    return springs[springIdx].tension;
}

struct TriVSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) bary: vec3f,
    @location(2) normal: vec3f,
};

@vertex
fn vs_tri_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> TriVSOutput {
    var output: TriVSOutput;

    let gridSize = renderParams.gridSize;
    let cellX = ii % (gridSize - 1u);
    let cellY = ii / (gridSize - 1u);

    let i00 = cellY * gridSize + cellX;
    let i10 = cellY * gridSize + cellX + 1u;
    let i01 = (cellY + 1u) * gridSize + cellX;
    let i11 = (cellY + 1u) * gridSize + cellX + 1u;

    let topIdx = hSpringIdx(cellX, cellY);
    let bottomIdx = hSpringIdx(cellX, cellY + 1u);
    let leftIdx = vSpringIdx(cellX, cellY);
    let rightIdx = vSpringIdx(cellX + 1u, cellY);

    let topBroken = isEdgeBroken(topIdx);
    let bottomBroken = isEdgeBroken(bottomIdx);
    let leftBroken = isEdgeBroken(leftIdx);
    let rightBroken = isEdgeBroken(rightIdx);

    let hBroken = topBroken || bottomBroken;
    let vBroken = leftBroken || rightBroken;

    if (hBroken && vBroken) {
        output.position = vec4f(0.0, 0.0, -2.0, 1.0);
        output.color = vec4f(0.0);
        output.bary = vec3f(0.0);
        output.normal = vec3f(0.0, 1.0, 0.0);
        return output;
    }

    let p00 = particles[i00].position;
    let p10 = particles[i10].position;
    let p01 = particles[i01].position;
    let p11 = particles[i11].position;

    var triIdx = vi % 3u;
    var pa: vec3f;
    var pb: vec3f;
    var pc: vec3f;
    var bary: vec3f;

    if (hBroken) {
        if (triIdx == 0u) { pa = p00; pb = p10; pc = p01; bary = vec3f(1.0, 0.0, 0.0); }
        else if (triIdx == 1u) { pa = p00; pb = p10; pc = p01; bary = vec3f(0.0, 1.0, 0.0); }
        else { pa = p00; pb = p10; pc = p01; bary = vec3f(0.0, 0.0, 1.0); }
    } else if (vBroken) {
        if (triIdx == 0u) { pa = p00; pb = p10; pc = p11; bary = vec3f(1.0, 0.0, 0.0); }
        else if (triIdx == 1u) { pa = p00; pb = p10; pc = p11; bary = vec3f(0.0, 1.0, 0.0); }
        else { pa = p00; pb = p10; pc = p11; bary = vec3f(0.0, 0.0, 1.0); }
    } else {
        if (triIdx == 0u) { pa = p00; pb = p10; pc = p01; bary = vec3f(1.0, 0.0, 0.0); }
        else if (triIdx == 1u) { pa = p10; pb = p11; pc = p01; bary = vec3f(0.0, 1.0, 0.0); }
        else { pa = p00; pb = p10; pc = p01; bary = vec3f(0.0, 0.0, 1.0); }

        if (vi >= 3u) {
            triIdx = vi % 3u;
            if (triIdx == 0u) { pa = p10; pb = p11; pc = p01; bary = vec3f(1.0, 0.0, 0.0); }
            else if (triIdx == 1u) { pa = p10; pb = p11; pc = p01; bary = vec3f(0.0, 1.0, 0.0); }
            else { pa = p10; pb = p11; pc = p01; bary = vec3f(0.0, 0.0, 1.0); }
        }
    }

    let e1 = pb - pa;
    let e2 = pc - pa;
    var n = cross(e1, e2);
    let nLen = length(n);
    if (nLen > 0.0001) { n = n / nLen; }

    let t1 = getEdgeTension(topIdx);
    let t2 = getEdgeTension(leftIdx);
    let t3 = getEdgeTension(rightIdx);
    let t4 = getEdgeTension(bottomIdx);
    let avgTension = (t1 + t2 + t3 + t4) * 0.25;

    var baseColor: vec3f;
    if (renderParams.showStress == 1u) {
        baseColor = tensionToColor(avgTension, renderParams.maxTension);
    } else {
        baseColor = vec3f(0.25, 0.45, 0.75);
    }

    let worldPos = pa;
    let clipPos = camera.viewProj * vec4f(worldPos, 1.0);

    output.position = clipPos;
    output.color = vec4f(baseColor, 1.0);
    output.bary = bary;
    output.normal = n;

    return output;
}

@fragment
fn fs_tri_main(input: TriVSOutput) -> @location(0) vec4f {
    let lightDir = normalize(vec3f(0.5, 1.0, 0.3));
    let nDotL = max(dot(input.normal, lightDir), 0.0);
    let ambient = 0.3;
    let diffuse = nDotL * 0.7;
    let lighting = ambient + diffuse;

    let minBary = min(min(input.bary.x, input.bary.y), input.bary.z);
    let wireframe = 1.0 - smoothstep(0.0, 0.02, minBary);

    var color = input.color.rgb * lighting;
    color = mix(color, vec3f(0.1, 0.3, 0.5), wireframe * 0.4);

    return vec4f(color, 1.0);
}

struct WireVSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) uv: vec2f,
};

@vertex
fn vs_wire_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> WireVSOutput {
    var output: WireVSOutput;

    let spring = springs[ii];

    let isEnd = select(false, true, vi == 1u || vi == 2u);
    let particleIndex = select(spring.a, spring.b, vi == 1u || vi == 2u);
    let p = particles[particleIndex].position;

    var clipPos = camera.viewProj * vec4f(p, 1.0);

    let otherIndex = select(spring.b, spring.a, vi == 1u || vi == 2u);
    let otherP = particles[otherIndex].position;
    let otherClip = camera.viewProj * vec4f(otherP, 1.0);

    let dir2D = vec2f(
        clipPos.x / clipPos.w - otherClip.x / otherClip.w,
        clipPos.y / clipPos.w - otherClip.y / otherClip.w
    );
    let dirLen = length(dir2D);
    var perpendicular = vec2f(-dir2D.y, dir2D.x);
    if (dirLen > 0.0001) {
        perpendicular = perpendicular / dirLen;
    }

    let width = select(1.5, 0.5, spring.type > 0u) * 0.0015;

    var sign = 1.0;
    if (vi == 0u || vi == 3u) { sign = 1.0; }
    else { sign = -1.0; }

    var useClip = clipPos;
    if (vi >= 2u) { useClip = otherClip; }

    useClip.x += perpendicular.x * sign * width * useClip.w;
    useClip.y += perpendicular.y * sign * width * useClip.w;

    output.position = useClip;

    if (spring.broken == 1u) {
        output.color = vec4f(0.3, 0.1, 0.1, 0.15);
    } else if (renderParams.showStress == 1u) {
        let tc = tensionToColor(spring.tension, renderParams.maxTension);
        output.color = vec4f(tc, 0.9);
    } else {
        if (spring.type == 0u) { output.color = vec4f(0.2, 0.6, 1.0, 0.9); }
        else if (spring.type == 1u) { output.color = vec4f(0.4, 0.8, 0.4, 0.7); }
        else { output.color = vec4f(1.0, 0.5, 0.3, 0.6); }
    }

    let u = f32(vi >= 2u);
    let v = f32(vi == 0u || vi == 2u);
    output.uv = vec2f(u, v);

    return output;
}

@fragment
fn fs_wire_main(input: WireVSOutput) -> @location(0) vec4f {
    let edge = abs(input.uv.y - 0.5) * 2.0;
    let alpha = smoothstep(1.0, 0.7, edge);
    return vec4f(input.color.rgb, input.color.a * alpha);
}
