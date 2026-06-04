var ne=Object.defineProperty;var ie=(e,t,n)=>t in e?ne(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var a=(e,t,n)=>ie(e,typeof t!="symbol"?t+"":t,n);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=n(i);fetch(i.href,r)}})();const d=128,w=d*d,W=(d-1)*(d-1),I={STRUCTURAL:0,SHEAR:1,BEND:2},y={DRAG:0,TEAR:1,FORCE:2},L=64,G=32,j=48,N=32,Y=48,q=80,X=16,O=16,U=8,$=16;function P(e,t){return t*d+e}function K(){const e=new ArrayBuffer(w*L),t=new Float32Array(e),n=8/(d-1);for(let s=0;s<d;s++)for(let i=0;i<d;i++){const o=P(i,s)*(L/4),h=(i-d/2)*n,l=5,u=(s-d/2)*n;t[o+0]=h,t[o+1]=l,t[o+2]=u,t[o+4]=h,t[o+5]=l-.01,t[o+6]=u,t[o+8]=h,t[o+9]=l-.01,t[o+10]=u,t[o+11]=1,t[o+12]=1;const f=new Uint32Array(e,(o+13)*4,1);f[0]=0}return t}function Z(){const e=[],t=[],n=[],s=8/(d-1);for(let l=0;l<d;l++)for(let u=0;u<d-1;u++){const f=P(u,l);e.push({a:f,b:P(u+1,l),restLength:s,compliance:1e-5,type:I.STRUCTURAL,broken:0,tension:0,breakThreshold:3})}for(let l=0;l<d-1;l++)for(let u=0;u<d;u++){const f=P(u,l);e.push({a:f,b:P(u,l+1),restLength:s,compliance:1e-5,type:I.STRUCTURAL,broken:0,tension:0,breakThreshold:3})}for(let l=0;l<d;l++)for(let u=0;u<d;u++){const f=P(u,l);u<d-1&&l<d-1&&(t.push({a:f,b:P(u+1,l+1),restLength:s*Math.SQRT2,compliance:1e-4,type:I.SHEAR,broken:0,tension:0,breakThreshold:4}),t.push({a:P(u+1,l),b:P(u,l+1),restLength:s*Math.SQRT2,compliance:1e-4,type:I.SHEAR,broken:0,tension:0,breakThreshold:4})),u<d-2&&n.push({a:f,b:P(u+2,l),restLength:s*2,compliance:.001,type:I.BEND,broken:0,tension:0,breakThreshold:5}),l<d-2&&n.push({a:f,b:P(u,l+2),restLength:s*2,compliance:.001,type:I.BEND,broken:0,tension:0,breakThreshold:5})}const i=[...e,...t,...n],r=e.length,o=new ArrayBuffer(i.length*G),h=new Float32Array(o);for(let l=0;l<i.length;l++){const u=i[l],f=l*(G/4),g=new Uint32Array(o,f*4,G/4);g[0]=u.a,g[1]=u.b,h[f+2]=u.restLength,h[f+3]=u.compliance,g[4]=u.type,g[5]=u.broken,h[f+6]=u.tension,h[f+7]=u.breakThreshold}return{data:h,count:i.length,structCount:r}}function se(e,t,n,s){const i=1/Math.tan(e/2),r=1/(n-s);return new Float32Array([i/t,0,0,0,0,i,0,0,0,0,(s+n)*r,-1,0,0,2*s*n*r,0])}function re(e,t,n){const[s,i,r]=e,[o,h,l]=t,[u,f,g]=n;let v=s-o,b=i-h,m=r-l,B=Math.hypot(v,b,m);v/=B,b/=B,m/=B;let S=f*m-g*b,x=g*v-u*m,C=u*b-f*v;B=Math.hypot(S,x,C),S/=B,x/=B,C/=B;const E=b*C-m*x,M=m*S-v*C,R=v*x-b*S;return new Float32Array([S,E,v,0,x,M,b,0,C,R,m,0,-(S*s+x*i+C*r),-(E*s+M*i+R*r),-(v*s+b*i+m*r),1])}function oe(e,t){const n=new Float32Array(16);for(let s=0;s<4;s++)for(let i=0;i<4;i++){let r=0;for(let o=0;o<4;o++)r+=e[o*4+i]*t[s*4+o];n[s*4+i]=r}return n}function H(e,t,n,s,i,r=0){const o=e/n*2-1,h=-(t/s*2-1),l=r*2-1,u=new Float32Array([o,h,l,1]),f=new Float32Array(4);for(let v=0;v<4;v++){let b=0;for(let m=0;m<4;m++)b+=u[m]*i[v*4+m];f[v]=b}const g=f[3];return[f[0]/g,f[1]/g,f[2]/g]}function ae(e){const t=new Float32Array(16);t[0]=e[5]*e[10]*e[15]-e[5]*e[11]*e[14]-e[9]*e[6]*e[15]+e[9]*e[7]*e[14]+e[13]*e[6]*e[11]-e[13]*e[7]*e[10],t[4]=-e[4]*e[10]*e[15]+e[4]*e[11]*e[14]+e[8]*e[6]*e[15]-e[8]*e[7]*e[14]-e[12]*e[6]*e[11]+e[12]*e[7]*e[10],t[8]=e[4]*e[9]*e[15]-e[4]*e[11]*e[13]-e[8]*e[5]*e[15]+e[8]*e[7]*e[13]+e[12]*e[5]*e[11]-e[12]*e[7]*e[9],t[12]=-e[4]*e[9]*e[14]+e[4]*e[10]*e[13]+e[8]*e[5]*e[14]-e[8]*e[6]*e[13]-e[12]*e[5]*e[10]+e[12]*e[6]*e[9],t[1]=-e[1]*e[10]*e[15]+e[1]*e[11]*e[14]+e[9]*e[2]*e[15]-e[9]*e[3]*e[14]-e[13]*e[2]*e[11]+e[13]*e[3]*e[10],t[5]=e[0]*e[10]*e[15]-e[0]*e[11]*e[14]-e[8]*e[2]*e[15]+e[8]*e[3]*e[14]+e[12]*e[2]*e[11]-e[12]*e[3]*e[10],t[9]=-e[0]*e[9]*e[15]+e[0]*e[11]*e[13]+e[8]*e[1]*e[15]-e[8]*e[3]*e[13]-e[12]*e[1]*e[11]+e[12]*e[3]*e[9],t[13]=e[0]*e[9]*e[14]-e[0]*e[10]*e[13]-e[8]*e[1]*e[14]+e[8]*e[2]*e[13]+e[12]*e[1]*e[10]-e[12]*e[2]*e[9],t[2]=e[1]*e[6]*e[15]-e[1]*e[7]*e[14]-e[5]*e[2]*e[15]+e[5]*e[3]*e[14]+e[13]*e[2]*e[7]-e[13]*e[3]*e[6],t[6]=-e[0]*e[6]*e[15]+e[0]*e[7]*e[14]+e[4]*e[2]*e[15]-e[4]*e[3]*e[14]-e[12]*e[2]*e[7]+e[12]*e[3]*e[6],t[10]=e[0]*e[5]*e[15]-e[0]*e[7]*e[13]-e[4]*e[1]*e[15]+e[4]*e[3]*e[13]+e[12]*e[1]*e[7]-e[12]*e[3]*e[5],t[14]=-e[0]*e[5]*e[14]+e[0]*e[6]*e[13]+e[4]*e[1]*e[14]-e[4]*e[2]*e[13]-e[12]*e[1]*e[6]+e[12]*e[2]*e[5],t[3]=-e[1]*e[6]*e[11]+e[1]*e[7]*e[10]+e[5]*e[2]*e[11]-e[5]*e[3]*e[10]-e[9]*e[2]*e[7]+e[9]*e[3]*e[6],t[7]=e[0]*e[6]*e[11]-e[0]*e[7]*e[10]-e[4]*e[2]*e[11]+e[4]*e[3]*e[10]+e[8]*e[2]*e[7]-e[8]*e[3]*e[6],t[11]=-e[0]*e[5]*e[11]+e[0]*e[7]*e[9]+e[4]*e[1]*e[11]-e[4]*e[3]*e[9]-e[8]*e[1]*e[7]+e[8]*e[3]*e[5],t[15]=e[0]*e[5]*e[10]-e[0]*e[6]*e[9]-e[4]*e[1]*e[10]+e[4]*e[2]*e[9]+e[8]*e[1]*e[6]-e[8]*e[2]*e[5];let n=e[0]*t[0]+e[1]*t[4]+e[2]*t[8]+e[3]*t[12];if(n===0)return t;n=1/n;for(let s=0;s<16;s++)t[s]*=n;return t}const le=`struct Particle {
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

struct SphereCollider {
    position: vec3f,
    radius: f32,
};

struct SelfCollisionParams {
    thickness: f32,
    stiffness: f32,
    enabled: u32,
    _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> springs: array<Spring>;
@group(0) @binding(2) var<uniform> simParams: SimParams;
@group(0) @binding(3) var<uniform> windParams: WindParams;
@group(0) @binding(4) var<uniform> mouse: MouseInteraction;
@group(0) @binding(5) var<uniform> spheres: array<SphereCollider, 8>;
@group(0) @binding(6) var<uniform> selfCollision: SelfCollisionParams;

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

    var newPos = p.predictPosition;

    for (var si = 0u; si < 8u; si++) {
        let sphere = spheres[si];
        if (sphere.radius > 0.0) {
            let delta = newPos - sphere.position;
            let dist = length(delta);
            let minDist = sphere.radius + 0.005;
            if (dist < minDist && dist > 0.0001) {
                let dir = delta / dist;
                newPos = sphere.position + dir * minDist;
            }
        }
    }

    if (newPos.y < -3.0) {
        p.prevPosition = vec3f(newPos.x, -3.0 + (newPos.y - p.position.y) * 0.3, newPos.z);
        p.position = vec3f(newPos.x, -3.0, newPos.z);
    } else {
        p.prevPosition = p.position;
        p.position = newPos;
    }
}

@compute @workgroup_size(64)
fn solveSelfCollision(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx >= simParams.numParticles) { return; }
    if (selfCollision.enabled == 0u) { return; }

    var pi = &particles[idx];
    if (pi.pinned == 1u) { return; }

    let thickness = selfCollision.thickness;
    let gridSize = 128u;

    let piX = idx % gridSize;
    let piY = idx / gridSize;

    let searchRadius = 2u;

    for (var dy = -i32(searchRadius); dy <= i32(searchRadius); dy++) {
        for (var dx = -i32(searchRadius); dx <= i32(searchRadius); dx++) {
            if (dx == 0 && dy == 0) { continue; }

            let nx = i32(piX) + dx;
            let ny = i32(piY) + dy;

            if (nx < 0 || nx >= i32(gridSize) || ny < 0 || ny >= i32(gridSize)) { continue; }

            let j = u32(ny) * gridSize + u32(nx);
            if (j >= simParams.numParticles) { continue; }

            var pj = particles[j];
            if (pj.pinned == 1u) { continue; }

            let delta = pi.predictPosition - pj.predictPosition;
            let dist = length(delta);

            if (dist < thickness && dist > 0.0001) {
                let penetration = thickness - dist;
                let dir = delta / dist;

                let push = dir * penetration * 0.5 * selfCollision.stiffness;
                pi.predictPosition += push * pi.invMass;
            }
        }
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
`,ue=`struct Camera {
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
`;class ce{constructor(t,n){a(this,"canvas");a(this,"device");a(this,"context");a(this,"format");a(this,"particleBuffer");a(this,"springBuffer");a(this,"simParamsBuffer");a(this,"windParamsBuffer");a(this,"mouseBuffer");a(this,"cameraBuffer");a(this,"renderParamsBuffer");a(this,"sphereBuffer");a(this,"selfCollisionBuffer");a(this,"readbackBuffer");a(this,"computeBindGroup");a(this,"renderBindGroup");a(this,"computePipelineLayout");a(this,"renderPipelineLayout");a(this,"pipelinePredict");a(this,"pipelineSolve");a(this,"pipelineIntegrate");a(this,"pipelineTear");a(this,"pipelineSelfCollision");a(this,"pipelineTri");a(this,"pipelineWire");a(this,"springCount",0);a(this,"structSpringCount",0);a(this,"simParams",{structCompliance:1e-5,shearCompliance:1e-4,bendCompliance:.001,damping:.995,gravity:[0,-9.8,0],deltaTime:1/60,numParticles:w,numSprings:0,globalBreakThreshold:1,subSteps:8});a(this,"windParams",{strength:3,time:0,frequency:.5,direction:[1,0,.5]});a(this,"mouse",{mode:y.DRAG,active:0,particleIndex:0,radius:.3,worldPos:[0,0,0],force:[0,0,0]});a(this,"cameraPos",[0,2,12]);a(this,"cameraTarget",[0,0,0]);a(this,"viewProjMatrix");a(this,"viewProjInvMatrix");a(this,"pinnedCorners",!0);a(this,"showStress",!0);a(this,"showWireframe",!1);a(this,"showSpheres",!0);a(this,"maxTension",.5);a(this,"spheres",[]);a(this,"selfCollisionParams",{thickness:.05,stiffness:.3,enabled:0});a(this,"exporting",!1);a(this,"exportFrame",!1);a(this,"exportFrameCount",0);a(this,"exportFrames",[]);a(this,"animationId",null);a(this,"lastTime",0);a(this,"frameCount",0);a(this,"fps",0);a(this,"fpsUpdateTime",0);a(this,"isDragging",!1);a(this,"draggedParticle",-1);a(this,"particleInitialPositions");a(this,"onFpsUpdate");this.canvas=t,this.onFpsUpdate=n,this.particleInitialPositions=new Float32Array(w*3);const s=8/(d-1);for(let i=0;i<d;i++)for(let r=0;r<d;r++){const o=P(r,i);this.particleInitialPositions[o*3]=(r-d/2)*s,this.particleInitialPositions[o*3+1]=5,this.particleInitialPositions[o*3+2]=(i-d/2)*s}this.spheres=[{position:[0,0,0],radius:1.5},{position:[2,-1,1],radius:0},{position:[-2,-.5,-1],radius:0}];for(let i=this.spheres.length;i<U;i++)this.spheres.push({position:[0,0,0],radius:0})}async init(){if(!navigator.gpu)throw new Error("WebGPU is not supported by your browser");const t=await navigator.gpu.requestAdapter();if(!t)throw new Error("Failed to get GPU adapter");this.device=await t.requestDevice(),this.context=this.canvas.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}),this.resize(),window.addEventListener("resize",()=>this.resize()),this.createBuffers(),this.createBindGroups(),this.createPipelines(),this.updateCamera(),document.getElementById("springs").textContent=this.springCount.toLocaleString()}resize(){const t=window.devicePixelRatio||1;this.canvas.width=window.innerWidth*t,this.canvas.height=window.innerHeight*t,this.updateCamera()}createBuffers(){const t=K(),{data:n,count:s,structCount:i}=Z();this.springCount=s,this.structSpringCount=i,this.simParams.numSprings=s,this.particleBuffer=this.createBuffer(t.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,t),this.springBuffer=this.createBuffer(n.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,n),this.simParamsBuffer=this.createBuffer(j,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.windParamsBuffer=this.createBuffer(N,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.mouseBuffer=this.createBuffer(Y,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.cameraBuffer=this.createBuffer(q,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.renderParamsBuffer=this.createBuffer(X,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sphereBuffer=this.createBuffer(O*U,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.selfCollisionBuffer=this.createBuffer($,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.readbackBuffer=this.createBuffer(w*L,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),this.pinCorners()}createBuffer(t,n,s){const i=this.device.createBuffer({size:Math.max(t,16),usage:n,mappedAtCreation:!!s});return s&&(new Uint8Array(i.getMappedRange()).set(new Uint8Array(s.buffer,s.byteOffset,s.byteLength)),i.unmap()),i}createBindGroups(){const t=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});this.computeBindGroup=this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:this.particleBuffer}},{binding:1,resource:{buffer:this.springBuffer}},{binding:2,resource:{buffer:this.simParamsBuffer}},{binding:3,resource:{buffer:this.windParamsBuffer}},{binding:4,resource:{buffer:this.mouseBuffer}},{binding:5,resource:{buffer:this.sphereBuffer}},{binding:6,resource:{buffer:this.selfCollisionBuffer}}]});const n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});this.renderBindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.cameraBuffer}},{binding:1,resource:{buffer:this.particleBuffer}},{binding:2,resource:{buffer:this.springBuffer}},{binding:3,resource:{buffer:this.renderParamsBuffer}}]}),this.computePipelineLayout=this.device.createPipelineLayout({bindGroupLayouts:[t]}),this.renderPipelineLayout=this.device.createPipelineLayout({bindGroupLayouts:[n]})}createPipelines(){const t=this.device.createShaderModule({code:le});this.pipelinePredict=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"predictPositions"}}),this.pipelineSolve=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"solveConstraints"}}),this.pipelineIntegrate=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"integratePositions"}}),this.pipelineTear=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"tearSprings"}}),this.pipelineSelfCollision=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"solveSelfCollision"}});const n=this.device.createShaderModule({code:ue}),s={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"}};this.pipelineTri=this.device.createRenderPipeline({layout:this.renderPipelineLayout,vertex:{module:n,entryPoint:"vs_tri_main",buffers:[]},fragment:{module:n,entryPoint:"fs_tri_main",targets:[{format:this.format,blend:s}]},primitive:{topology:"triangle-list",cullMode:"none"},multisample:{count:4}}),this.pipelineWire=this.device.createRenderPipeline({layout:this.renderPipelineLayout,vertex:{module:n,entryPoint:"vs_wire_main",buffers:[]},fragment:{module:n,entryPoint:"fs_wire_main",targets:[{format:this.format,blend:s}]},primitive:{topology:"triangle-strip",cullMode:"none"},multisample:{count:4}})}updateCamera(){const t=this.canvas.width/this.canvas.height,n=se(Math.PI/4,t,.1,100),s=re(this.cameraPos,this.cameraTarget,[0,1,0]);if(this.viewProjMatrix=oe(n,s),this.viewProjInvMatrix=ae(this.viewProjMatrix),!this.cameraBuffer)return;const i=new Float32Array(q/4);i.set(this.viewProjMatrix,0),i.set(this.cameraPos,16),this.device.queue.writeBuffer(this.cameraBuffer,0,i)}updateSimParams(){const t=new Float32Array(j/4);t[0]=this.simParams.structCompliance,t[1]=this.simParams.shearCompliance,t[2]=this.simParams.bendCompliance,t[3]=this.simParams.damping,t[4]=this.simParams.gravity[0],t[5]=this.simParams.gravity[1],t[6]=this.simParams.gravity[2],t[7]=this.simParams.deltaTime;const n=new Uint32Array(t.buffer);n[8]=this.simParams.numParticles,n[9]=this.simParams.numSprings,t[10]=this.simParams.globalBreakThreshold,n[11]=this.simParams.subSteps,this.device.queue.writeBuffer(this.simParamsBuffer,0,t)}updateWindParams(){const t=new Float32Array(N/4);t[0]=this.windParams.strength,t[1]=this.windParams.time,t[2]=this.windParams.frequency,t[4]=this.windParams.direction[0],t[5]=this.windParams.direction[1],t[6]=this.windParams.direction[2],this.device.queue.writeBuffer(this.windParamsBuffer,0,t)}updateMouseParams(){const t=new Float32Array(Y/4),n=new Uint32Array(t.buffer);n[0]=this.mouse.mode,n[1]=this.mouse.active,n[2]=this.mouse.particleIndex,t[3]=this.mouse.radius,t[4]=this.mouse.worldPos[0],t[5]=this.mouse.worldPos[1],t[6]=this.mouse.worldPos[2],t[8]=this.mouse.force[0],t[9]=this.mouse.force[1],t[10]=this.mouse.force[2],this.device.queue.writeBuffer(this.mouseBuffer,0,t)}updateRenderParams(){const t=new Float32Array(X/4),n=new Uint32Array(t.buffer);n[0]=this.showStress?1:0,t[1]=this.maxTension,n[2]=d,n[3]=this.structSpringCount,this.device.queue.writeBuffer(this.renderParamsBuffer,0,t)}updateSphereParams(){const t=new Float32Array(O/4*U);for(let n=0;n<U;n++){const s=this.spheres[n],i=n*(O/4);t[i+0]=s.position[0],t[i+1]=s.position[1],t[i+2]=s.position[2],t[i+3]=s.radius}this.device.queue.writeBuffer(this.sphereBuffer,0,t)}updateSelfCollisionParams(){const t=new Float32Array($/4),n=new Uint32Array(t.buffer);t[0]=this.selfCollisionParams.thickness,t[1]=this.selfCollisionParams.stiffness,n[2]=this.selfCollisionParams.enabled,this.device.queue.writeBuffer(this.selfCollisionBuffer,0,t)}pinCorners(){const t=[P(0,0),P(d-1,0),P(0,d-1),P(d-1,d-1)],n=this.pinnedCorners?1:0,s=new Uint32Array(1);s[0]=n;for(const i of t){const r=i*L+52;this.device.queue.writeBuffer(this.particleBuffer,r,s)}}setStructCompliance(t){this.simParams.structCompliance=t}setShearCompliance(t){this.simParams.shearCompliance=t}setBendCompliance(t){this.simParams.bendCompliance=t}setDamping(t){this.simParams.damping=t}setWindStrength(t){this.windParams.strength=t}setTearRadius(t){this.mouse.radius=t*.1}setBreakThreshold(t){this.simParams.globalBreakThreshold=t}setSubSteps(t){this.simParams.subSteps=t}setSpherePosition(t,n,s,i){t>=0&&t<U&&(this.spheres[t].position=[n,s,i])}setSphereRadius(t,n){t>=0&&t<U&&(this.spheres[t].radius=n)}setSelfCollisionThickness(t){this.selfCollisionParams.thickness=t}setSelfCollisionStiffness(t){this.selfCollisionParams.stiffness=t}toggleSelfCollision(){this.selfCollisionParams.enabled=this.selfCollisionParams.enabled?0:1}toggleSpheres(){this.showSpheres=!this.showSpheres}startExport(){this.exporting=!0,this.exportFrame=!0,this.exportFrameCount=0,this.exportFrames=[]}stopExport(){return this.exporting=!1,this.exportFrame=!1,this.exportFrames}isExporting(){return this.exporting}getExportFrameCount(){return this.exportFrameCount}setMouseMode(t){this.mouse.mode=t,this.mouse.active=0,this.draggedParticle=-1,this.updateMouseParams()}togglePinnedCorners(){this.pinnedCorners=!this.pinnedCorners,this.pinCorners()}toggleStressView(){this.showStress=!this.showStress,this.updateRenderParams()}toggleWireframe(){this.showWireframe=!this.showWireframe}reset(){const t=K(),{data:n,structCount:s}=Z();this.structSpringCount=s,this.device.queue.writeBuffer(this.particleBuffer,0,t),this.device.queue.writeBuffer(this.springBuffer,0,n),this.windParams.time=0,this.mouse.active=0,this.draggedParticle=-1,this.pinCorners(),this.updateMouseParams(),this.updateRenderParams(),this.updateSphereParams(),this.updateSelfCollisionParams()}handleMouseDown(t,n){const s=this.canvas.getBoundingClientRect(),i=(t-s.left)*(this.canvas.width/s.width),r=(n-s.top)*(this.canvas.height/s.height),o=H(i,r,this.canvas.width,this.canvas.height,this.viewProjInvMatrix,0);this.mouse.worldPos=o,this.mouse.mode===y.DRAG?(this.isDragging=!0,this.draggedParticle=this.findNearestParticle(o),this.mouse.particleIndex=this.draggedParticle,this.mouse.active=1):this.mouse.mode===y.FORCE?(this.mouse.active=1,this.mouse.force=[50,50,50]):this.mouse.mode===y.TEAR&&(this.mouse.active=1),this.updateMouseParams()}handleMouseMove(t,n){const s=this.canvas.getBoundingClientRect(),i=(t-s.left)*(this.canvas.width/s.width),r=(n-s.top)*(this.canvas.height/s.height),o=H(i,r,this.canvas.width,this.canvas.height,this.viewProjInvMatrix,0);this.mouse.worldPos=o,this.isDragging&&this.draggedParticle>=0?(this.mouse.active=1,this.updateMouseParams()):this.mouse.mode===y.TEAR&&this.mouse.active===1&&this.updateMouseParams()}handleMouseUp(){this.isDragging=!1,this.draggedParticle=-1,this.mouse.active=0,this.updateMouseParams()}handleWheel(t){if(this.mouse.mode===y.FORCE){const n=t>0?.9:1.1;this.mouse.force=this.mouse.force.map(s=>Math.max(10,Math.min(200,s*n)))}}findNearestParticle(t){let n=0,s=1/0;for(let i=0;i<w;i++){const r=this.particleInitialPositions[i*3],o=this.particleInitialPositions[i*3+1],h=this.particleInitialPositions[i*3+2],l=r-t[0],u=o-t[1],f=h-t[2],g=l*l+u*u+f*f;g<s&&(s=g,n=i)}return n}start(){this.updateSimParams(),this.updateRenderParams(),this.lastTime=performance.now(),this.animate()}stop(){this.animationId!==null&&(cancelAnimationFrame(this.animationId),this.animationId=null)}animate(){const t=performance.now(),n=Math.min((t-this.lastTime)/1e3,1/30);this.lastTime=t,this.frameCount++,t-this.fpsUpdateTime>=1e3&&(this.fps=Math.round(this.frameCount*1e3/(t-this.fpsUpdateTime)),this.frameCount=0,this.fpsUpdateTime=t,this.onFpsUpdate&&this.onFpsUpdate(this.fps)),this.windParams.time+=n,this.simParams.deltaTime=n,this.updateSimParams(),this.updateWindParams(),this.updateMouseParams(),this.compute(),this.render(),this.exporting&&this.exportFrame&&(this.exportFrame=!1,this.exportCurrentFrame().then(s=>{this.exportFrames.push(s),this.exportFrameCount++,this.exportFrame=!0})),this.animationId=requestAnimationFrame(()=>this.animate())}async exportCurrentFrame(){const t=this.device.createCommandEncoder();t.copyBufferToBuffer(this.particleBuffer,0,this.readbackBuffer,0,w*L),this.device.queue.submit([t.finish()]),await this.readbackBuffer.mapAsync(GPUMapMode.READ);const n=new Float32Array(this.readbackBuffer.getMappedRange());let s=`# Cloth frame ${this.exportFrameCount}
`;s+=`# ${w} vertices, ${2*W} faces

`;for(let i=0;i<w;i++){const r=i*(L/4),o=n[r+0],h=n[r+1],l=n[r+2];s+=`v ${o.toFixed(6)} ${h.toFixed(6)} ${l.toFixed(6)}
`}s+=`
`;for(let i=0;i<d-1;i++)for(let r=0;r<d-1;r++){const o=i*d+r+1,h=i*d+r+2,l=(i+1)*d+r+1,u=(i+1)*d+r+2;s+=`f ${o} ${h} ${u}
`,s+=`f ${o} ${u} ${l}
`}return this.readbackBuffer.unmap(),s}compute(){const t=this.device.createCommandEncoder(),n=this.simParams.subSteps,s=this.simParams.deltaTime/n,i=this.simParams.deltaTime;this.simParams.deltaTime=s,this.updateSphereParams(),this.updateSelfCollisionParams();for(let r=0;r<n;r++){const o=t.beginComputePass();o.setBindGroup(0,this.computeBindGroup),o.setPipeline(this.pipelinePredict),o.dispatchWorkgroups(Math.ceil(w/64));const h=4;for(let l=0;l<h;l++)o.setPipeline(this.pipelineSolve),o.dispatchWorkgroups(Math.ceil(this.springCount/64));this.selfCollisionParams.enabled&&(o.setPipeline(this.pipelineSelfCollision),o.dispatchWorkgroups(Math.ceil(w/64))),o.setPipeline(this.pipelineIntegrate),o.dispatchWorkgroups(Math.ceil(w/64)),o.end()}if(this.simParams.deltaTime=i,this.mouse.mode===y.TEAR&&this.mouse.active===1){const r=t.beginComputePass();r.setBindGroup(0,this.computeBindGroup),r.setPipeline(this.pipelineTear),r.dispatchWorkgroups(Math.ceil(this.springCount/64)),r.end()}this.device.queue.submit([t.finish()])}render(){const t=this.context.getCurrentTexture().createView(),n=this.device.createTexture({size:[this.canvas.width,this.canvas.height],sampleCount:4,format:this.format,usage:GPUTextureUsage.RENDER_ATTACHMENT}),s=this.device.createCommandEncoder(),i=s.beginRenderPass({colorAttachments:[{view:n.createView(),resolveTarget:t,clearValue:{r:.04,g:.04,b:.06,a:1},loadOp:"clear",storeOp:"store"}]});i.setBindGroup(0,this.renderBindGroup),i.setPipeline(this.pipelineTri),i.draw(6,W,0,0),this.showWireframe&&(i.setPipeline(this.pipelineWire),i.draw(4,this.springCount,0,0)),i.end(),this.device.queue.submit([s.finish()]),n.destroy()}getSpringCount(){return this.springCount}getParticleCount(){return w}}let p;const T=document.getElementById("canvas"),pe=document.getElementById("fps"),de=document.getElementById("springs"),fe=document.getElementById("particles");async function he(){try{p=new ce(T,e=>{pe.textContent=e.toString()}),await p.init(),de.textContent=p.getSpringCount().toLocaleString(),fe.textContent=p.getParticleCount().toLocaleString(),ge(),me(),p.start()}catch(e){console.error("Failed to initialize WebGPU:",e),document.body.innerHTML=`
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #fff; flex-direction: column; padding: 20px;">
        <h2 style="color: #ff6b6b; margin-bottom: 16px;">WebGPU 不受支持</h2>
        <p style="text-align: center; max-width: 500px; line-height: 1.6; color: #aaa;">
          ${e instanceof Error?e.message:"无法初始化 WebGPU。"}<br><br>
          请使用支持 WebGPU 的浏览器（如 Chrome 113+ 或 Edge），
          并确保已启用 WebGPU 标志。
        </p>
      </div>
    `}}function ge(){const e=document.getElementById("structK"),t=document.getElementById("structK-val");e.addEventListener("input",()=>{const c=parseFloat(e.value);t.textContent=c.toExponential(1),p.setStructCompliance(c)});const n=document.getElementById("shearK"),s=document.getElementById("shearK-val");n.addEventListener("input",()=>{const c=parseFloat(n.value);s.textContent=c.toExponential(1),p.setShearCompliance(c)});const i=document.getElementById("bendK"),r=document.getElementById("bendK-val");i.addEventListener("input",()=>{const c=parseFloat(i.value);r.textContent=c.toExponential(1),p.setBendCompliance(c)});const o=document.getElementById("damping"),h=document.getElementById("damping-val");o.addEventListener("input",()=>{const c=parseFloat(o.value);h.textContent=c.toFixed(3),p.setDamping(c)});const l=document.getElementById("wind"),u=document.getElementById("wind-val");l.addEventListener("input",()=>{const c=parseFloat(l.value);u.textContent=c.toFixed(1),p.setWindStrength(c)});const f=document.getElementById("tearRadius"),g=document.getElementById("tearRadius-val");f.addEventListener("input",()=>{const c=parseInt(f.value);g.textContent=c.toString(),p.setTearRadius(c)});const v=document.getElementById("breakThreshold"),b=document.getElementById("breakThreshold-val");v.addEventListener("input",()=>{const c=parseFloat(v.value);b.textContent=c.toFixed(1),p.setBreakThreshold(c)});const m=document.getElementById("subSteps"),B=document.getElementById("subSteps-val");m.addEventListener("input",()=>{const c=parseInt(m.value);B.textContent=c.toString(),p.setSubSteps(c)});const S=document.getElementById("modeDrag"),x=document.getElementById("modeTear"),C=document.getElementById("modeForce"),E=(c,_)=>{p.setMouseMode(c),S.classList.toggle("active",_===S),x.classList.toggle("active",_===x),C.classList.toggle("active",_===C)};S.addEventListener("click",()=>E(y.DRAG,S)),x.addEventListener("click",()=>E(y.TEAR,x)),C.addEventListener("click",()=>E(y.FORCE,C)),document.getElementById("reset").addEventListener("click",()=>{p.reset()});const R=document.getElementById("pinToggle");R.addEventListener("click",()=>{p.togglePinnedCorners(),R.classList.toggle("active")});const D=document.getElementById("sphereRadius"),J=document.getElementById("sphereRadius-val");D.addEventListener("input",()=>{const c=parseFloat(D.value);J.textContent=c.toFixed(1),p.setSphereRadius(0,c)});const F=document.getElementById("selfCollisionToggle");let A=!1;F.addEventListener("click",()=>{p.toggleSelfCollision(),A=!A,F.textContent=A?"自碰撞: 开":"自碰撞: 关",F.classList.toggle("active")});const z=document.getElementById("selfCollisionThickness"),Q=document.getElementById("selfCollisionThickness-val");z.addEventListener("input",()=>{const c=parseFloat(z.value);Q.textContent=c.toFixed(2),p.setSelfCollisionThickness(c)});const V=document.getElementById("selfCollisionStiffness"),ee=document.getElementById("selfCollisionStiffness-val");V.addEventListener("input",()=>{const c=parseFloat(V.value);ee.textContent=c.toFixed(1),p.setSelfCollisionStiffness(c)});const k=document.getElementById("exportBtn"),te=document.getElementById("exportFrameCount");k.addEventListener("click",()=>{if(!p.isExporting())p.startExport(),k.textContent="停止导出",k.classList.add("active");else{const c=p.stopExport();k.textContent="开始导出 OBJ",k.classList.remove("active"),ve(c)}}),setInterval(()=>{p&&p.isExporting()&&(te.textContent=p.getExportFrameCount().toString())},100),document.addEventListener("keydown",c=>{c.key==="1"&&E(y.DRAG,S),c.key==="2"&&E(y.TEAR,x),c.key==="3"&&E(y.FORCE,C),(c.key==="r"||c.key==="R")&&p.reset(),(c.key==="w"||c.key==="W")&&p.toggleWireframe(),(c.key==="s"||c.key==="S")&&p.toggleStressView()})}function ve(e){if(e.length===0)return;e.forEach((i,r)=>{`${r.toString().padStart(4,"0")}`});const t=new Blob([e.join(`

`)],{type:"text/plain"}),n=URL.createObjectURL(t),s=document.createElement("a");s.href=n,s.download=`cloth_frames_${e.length}.txt`,s.textContent="下载 OBJ 帧",s.style.display="none",document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(n),e.forEach((i,r)=>{const o=new Blob([i],{type:"text/plain"}),h=URL.createObjectURL(o),l=document.createElement("a");l.href=h,l.download=`cloth_${r.toString().padStart(4,"0")}.obj`,l.style.display="none",document.body.appendChild(l),setTimeout(()=>{l.click(),document.body.removeChild(l),URL.revokeObjectURL(h)},r*100)})}function me(){let e=!1;T.addEventListener("mousedown",t=>{t.button===0&&(e=!0,p.handleMouseDown(t.clientX,t.clientY))}),T.addEventListener("mousemove",t=>{e&&p.handleMouseMove(t.clientX,t.clientY)}),T.addEventListener("mouseup",()=>{e=!1,p.handleMouseUp()}),T.addEventListener("mouseleave",()=>{e&&(e=!1,p.handleMouseUp())}),T.addEventListener("wheel",t=>{t.preventDefault(),p.handleWheel(t.deltaY)},{passive:!1}),T.addEventListener("touchstart",t=>{t.preventDefault();const n=t.touches[0];e=!0,p.handleMouseDown(n.clientX,n.clientY)},{passive:!1}),T.addEventListener("touchmove",t=>{if(t.preventDefault(),e&&t.touches.length>0){const n=t.touches[0];p.handleMouseMove(n.clientX,n.clientY)}},{passive:!1}),T.addEventListener("touchend",()=>{e=!1,p.handleMouseUp()})}he();
