var V=Object.defineProperty;var N=(e,t,n)=>t in e?V(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var a=(e,t,n)=>N(e,typeof t!="symbol"?t+"":t,n);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();const p=128,E=p*p,Y=(p-1)*(p-1),I={STRUCTURAL:0,SHEAR:1,BEND:2},y={DRAG:0,TEAR:1,FORCE:2},R=64,A=32,k=48,G=32,_=48,F=80,D=16;function m(e,t){return t*p+e}function O(){const e=new ArrayBuffer(E*R),t=new Float32Array(e),n=8/(p-1);for(let r=0;r<p;r++)for(let i=0;i<p;i++){const o=m(i,r)*(R/4),h=(i-p/2)*n,c=5,u=(r-p/2)*n;t[o+0]=h,t[o+1]=c,t[o+2]=u,t[o+4]=h,t[o+5]=c-.01,t[o+6]=u,t[o+8]=h,t[o+9]=c-.01,t[o+10]=u,t[o+11]=1,t[o+12]=1;const d=new Uint32Array(e,(o+13)*4,1);d[0]=0}return t}function z(){const e=[],t=[],n=[],r=8/(p-1);for(let c=0;c<p;c++)for(let u=0;u<p-1;u++){const d=m(u,c);e.push({a:d,b:m(u+1,c),restLength:r,compliance:1e-5,type:I.STRUCTURAL,broken:0,tension:0,breakThreshold:3})}for(let c=0;c<p-1;c++)for(let u=0;u<p;u++){const d=m(u,c);e.push({a:d,b:m(u,c+1),restLength:r,compliance:1e-5,type:I.STRUCTURAL,broken:0,tension:0,breakThreshold:3})}for(let c=0;c<p;c++)for(let u=0;u<p;u++){const d=m(u,c);u<p-1&&c<p-1&&(t.push({a:d,b:m(u+1,c+1),restLength:r*Math.SQRT2,compliance:1e-4,type:I.SHEAR,broken:0,tension:0,breakThreshold:4}),t.push({a:m(u+1,c),b:m(u,c+1),restLength:r*Math.SQRT2,compliance:1e-4,type:I.SHEAR,broken:0,tension:0,breakThreshold:4})),u<p-2&&n.push({a:d,b:m(u+2,c),restLength:r*2,compliance:.001,type:I.BEND,broken:0,tension:0,breakThreshold:5}),c<p-2&&n.push({a:d,b:m(u,c+2),restLength:r*2,compliance:.001,type:I.BEND,broken:0,tension:0,breakThreshold:5})}const i=[...e,...t,...n],s=e.length,o=new ArrayBuffer(i.length*A),h=new Float32Array(o);for(let c=0;c<i.length;c++){const u=i[c],d=c*(A/4),g=new Uint32Array(o,d*4,A/4);g[0]=u.a,g[1]=u.b,h[d+2]=u.restLength,h[d+3]=u.compliance,g[4]=u.type,g[5]=u.broken,h[d+6]=u.tension,h[d+7]=u.breakThreshold}return{data:h,count:i.length,structCount:s}}function q(e,t,n,r){const i=1/Math.tan(e/2),s=1/(n-r);return new Float32Array([i/t,0,0,0,0,i,0,0,0,0,(r+n)*s,-1,0,0,2*r*n*s,0])}function X(e,t,n){const[r,i,s]=e,[o,h,c]=t,[u,d,g]=n;let v=r-o,b=i-h,P=s-c,B=Math.hypot(v,b,P);v/=B,b/=B,P/=B;let w=d*P-g*b,S=g*v-u*P,x=u*b-d*v;B=Math.hypot(w,S,x),w/=B,S/=B,x/=B;const C=b*x-P*S,M=P*w-v*x,U=v*S-b*w;return new Float32Array([w,C,v,0,S,M,b,0,x,U,P,0,-(w*r+S*i+x*s),-(C*r+M*i+U*s),-(v*r+b*i+P*s),1])}function j(e,t){const n=new Float32Array(16);for(let r=0;r<4;r++)for(let i=0;i<4;i++){let s=0;for(let o=0;o<4;o++)s+=e[o*4+i]*t[r*4+o];n[r*4+i]=s}return n}function W(e,t,n,r,i,s=0){const o=e/n*2-1,h=-(t/r*2-1),c=s*2-1,u=new Float32Array([o,h,c,1]),d=new Float32Array(4);for(let v=0;v<4;v++){let b=0;for(let P=0;P<4;P++)b+=u[P]*i[v*4+P];d[v]=b}const g=d[3];return[d[0]/g,d[1]/g,d[2]/g]}function K(e){const t=new Float32Array(16);t[0]=e[5]*e[10]*e[15]-e[5]*e[11]*e[14]-e[9]*e[6]*e[15]+e[9]*e[7]*e[14]+e[13]*e[6]*e[11]-e[13]*e[7]*e[10],t[4]=-e[4]*e[10]*e[15]+e[4]*e[11]*e[14]+e[8]*e[6]*e[15]-e[8]*e[7]*e[14]-e[12]*e[6]*e[11]+e[12]*e[7]*e[10],t[8]=e[4]*e[9]*e[15]-e[4]*e[11]*e[13]-e[8]*e[5]*e[15]+e[8]*e[7]*e[13]+e[12]*e[5]*e[11]-e[12]*e[7]*e[9],t[12]=-e[4]*e[9]*e[14]+e[4]*e[10]*e[13]+e[8]*e[5]*e[14]-e[8]*e[6]*e[13]-e[12]*e[5]*e[10]+e[12]*e[6]*e[9],t[1]=-e[1]*e[10]*e[15]+e[1]*e[11]*e[14]+e[9]*e[2]*e[15]-e[9]*e[3]*e[14]-e[13]*e[2]*e[11]+e[13]*e[3]*e[10],t[5]=e[0]*e[10]*e[15]-e[0]*e[11]*e[14]-e[8]*e[2]*e[15]+e[8]*e[3]*e[14]+e[12]*e[2]*e[11]-e[12]*e[3]*e[10],t[9]=-e[0]*e[9]*e[15]+e[0]*e[11]*e[13]+e[8]*e[1]*e[15]-e[8]*e[3]*e[13]-e[12]*e[1]*e[11]+e[12]*e[3]*e[9],t[13]=e[0]*e[9]*e[14]-e[0]*e[10]*e[13]-e[8]*e[1]*e[14]+e[8]*e[2]*e[13]+e[12]*e[1]*e[10]-e[12]*e[2]*e[9],t[2]=e[1]*e[6]*e[15]-e[1]*e[7]*e[14]-e[5]*e[2]*e[15]+e[5]*e[3]*e[14]+e[13]*e[2]*e[7]-e[13]*e[3]*e[6],t[6]=-e[0]*e[6]*e[15]+e[0]*e[7]*e[14]+e[4]*e[2]*e[15]-e[4]*e[3]*e[14]-e[12]*e[2]*e[7]+e[12]*e[3]*e[6],t[10]=e[0]*e[5]*e[15]-e[0]*e[7]*e[13]-e[4]*e[1]*e[15]+e[4]*e[3]*e[13]+e[12]*e[1]*e[7]-e[12]*e[3]*e[5],t[14]=-e[0]*e[5]*e[14]+e[0]*e[6]*e[13]+e[4]*e[1]*e[14]-e[4]*e[2]*e[13]-e[12]*e[1]*e[6]+e[12]*e[2]*e[5],t[3]=-e[1]*e[6]*e[11]+e[1]*e[7]*e[10]+e[5]*e[2]*e[11]-e[5]*e[3]*e[10]-e[9]*e[2]*e[7]+e[9]*e[3]*e[6],t[7]=e[0]*e[6]*e[11]-e[0]*e[7]*e[10]-e[4]*e[2]*e[11]+e[4]*e[3]*e[10]+e[8]*e[2]*e[7]-e[8]*e[3]*e[6],t[11]=-e[0]*e[5]*e[11]+e[0]*e[7]*e[9]+e[4]*e[1]*e[11]-e[4]*e[3]*e[9]-e[8]*e[1]*e[7]+e[8]*e[3]*e[5],t[15]=e[0]*e[5]*e[10]-e[0]*e[6]*e[9]-e[4]*e[1]*e[10]+e[4]*e[2]*e[9]+e[8]*e[1]*e[6]-e[8]*e[2]*e[5];let n=e[0]*t[0]+e[1]*t[4]+e[2]*t[8]+e[3]*t[12];if(n===0)return t;n=1/n;for(let r=0;r<16;r++)t[r]*=n;return t}const Z=`struct Particle {
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
`,H=`struct Camera {
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
`;class Q{constructor(t,n){a(this,"canvas");a(this,"device");a(this,"context");a(this,"format");a(this,"particleBuffer");a(this,"springBuffer");a(this,"simParamsBuffer");a(this,"windParamsBuffer");a(this,"mouseBuffer");a(this,"cameraBuffer");a(this,"renderParamsBuffer");a(this,"computeBindGroup");a(this,"renderBindGroup");a(this,"computePipelineLayout");a(this,"renderPipelineLayout");a(this,"pipelinePredict");a(this,"pipelineSolve");a(this,"pipelineIntegrate");a(this,"pipelineTear");a(this,"pipelineTri");a(this,"pipelineWire");a(this,"springCount",0);a(this,"structSpringCount",0);a(this,"simParams",{structCompliance:1e-5,shearCompliance:1e-4,bendCompliance:.001,damping:.995,gravity:[0,-9.8,0],deltaTime:1/60,numParticles:E,numSprings:0,globalBreakThreshold:1,subSteps:8});a(this,"windParams",{strength:3,time:0,frequency:.5,direction:[1,0,.5]});a(this,"mouse",{mode:y.DRAG,active:0,particleIndex:0,radius:.3,worldPos:[0,0,0],force:[0,0,0]});a(this,"cameraPos",[0,2,12]);a(this,"cameraTarget",[0,0,0]);a(this,"viewProjMatrix");a(this,"viewProjInvMatrix");a(this,"pinnedCorners",!0);a(this,"showStress",!0);a(this,"showWireframe",!1);a(this,"maxTension",.5);a(this,"animationId",null);a(this,"lastTime",0);a(this,"frameCount",0);a(this,"fps",0);a(this,"fpsUpdateTime",0);a(this,"isDragging",!1);a(this,"draggedParticle",-1);a(this,"particleInitialPositions");a(this,"onFpsUpdate");this.canvas=t,this.onFpsUpdate=n,this.particleInitialPositions=new Float32Array(E*3);const r=8/(p-1);for(let i=0;i<p;i++)for(let s=0;s<p;s++){const o=m(s,i);this.particleInitialPositions[o*3]=(s-p/2)*r,this.particleInitialPositions[o*3+1]=5,this.particleInitialPositions[o*3+2]=(i-p/2)*r}}async init(){if(!navigator.gpu)throw new Error("WebGPU is not supported by your browser");const t=await navigator.gpu.requestAdapter();if(!t)throw new Error("Failed to get GPU adapter");this.device=await t.requestDevice(),this.context=this.canvas.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}),this.resize(),window.addEventListener("resize",()=>this.resize()),this.createBuffers(),this.createBindGroups(),this.createPipelines(),this.updateCamera(),document.getElementById("springs").textContent=this.springCount.toLocaleString()}resize(){const t=window.devicePixelRatio||1;this.canvas.width=window.innerWidth*t,this.canvas.height=window.innerHeight*t,this.updateCamera()}createBuffers(){const t=O(),{data:n,count:r,structCount:i}=z();this.springCount=r,this.structSpringCount=i,this.simParams.numSprings=r,this.particleBuffer=this.createBuffer(t.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,t),this.springBuffer=this.createBuffer(n.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,n),this.simParamsBuffer=this.createBuffer(k,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.windParamsBuffer=this.createBuffer(G,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.mouseBuffer=this.createBuffer(_,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.cameraBuffer=this.createBuffer(F,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.renderParamsBuffer=this.createBuffer(D,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.pinCorners()}createBuffer(t,n,r){const i=this.device.createBuffer({size:Math.max(t,16),usage:n,mappedAtCreation:!!r});return r&&(new Uint8Array(i.getMappedRange()).set(new Uint8Array(r.buffer,r.byteOffset,r.byteLength)),i.unmap()),i}createBindGroups(){const t=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});this.computeBindGroup=this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:this.particleBuffer}},{binding:1,resource:{buffer:this.springBuffer}},{binding:2,resource:{buffer:this.simParamsBuffer}},{binding:3,resource:{buffer:this.windParamsBuffer}},{binding:4,resource:{buffer:this.mouseBuffer}}]});const n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});this.renderBindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.cameraBuffer}},{binding:1,resource:{buffer:this.particleBuffer}},{binding:2,resource:{buffer:this.springBuffer}},{binding:3,resource:{buffer:this.renderParamsBuffer}}]}),this.computePipelineLayout=this.device.createPipelineLayout({bindGroupLayouts:[t]}),this.renderPipelineLayout=this.device.createPipelineLayout({bindGroupLayouts:[n]})}createPipelines(){const t=this.device.createShaderModule({code:Z});this.pipelinePredict=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"predictPositions"}}),this.pipelineSolve=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"solveConstraints"}}),this.pipelineIntegrate=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"integratePositions"}}),this.pipelineTear=this.device.createComputePipeline({layout:this.computePipelineLayout,compute:{module:t,entryPoint:"tearSprings"}});const n=this.device.createShaderModule({code:H}),r={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"}};this.pipelineTri=this.device.createRenderPipeline({layout:this.renderPipelineLayout,vertex:{module:n,entryPoint:"vs_tri_main",buffers:[]},fragment:{module:n,entryPoint:"fs_tri_main",targets:[{format:this.format,blend:r}]},primitive:{topology:"triangle-list",cullMode:"none"},multisample:{count:4}}),this.pipelineWire=this.device.createRenderPipeline({layout:this.renderPipelineLayout,vertex:{module:n,entryPoint:"vs_wire_main",buffers:[]},fragment:{module:n,entryPoint:"fs_wire_main",targets:[{format:this.format,blend:r}]},primitive:{topology:"triangle-strip",cullMode:"none"},multisample:{count:4}})}updateCamera(){const t=this.canvas.width/this.canvas.height,n=q(Math.PI/4,t,.1,100),r=X(this.cameraPos,this.cameraTarget,[0,1,0]);if(this.viewProjMatrix=j(n,r),this.viewProjInvMatrix=K(this.viewProjMatrix),!this.cameraBuffer)return;const i=new Float32Array(F/4);i.set(this.viewProjMatrix,0),i.set(this.cameraPos,16),this.device.queue.writeBuffer(this.cameraBuffer,0,i)}updateSimParams(){const t=new Float32Array(k/4);t[0]=this.simParams.structCompliance,t[1]=this.simParams.shearCompliance,t[2]=this.simParams.bendCompliance,t[3]=this.simParams.damping,t[4]=this.simParams.gravity[0],t[5]=this.simParams.gravity[1],t[6]=this.simParams.gravity[2],t[7]=this.simParams.deltaTime;const n=new Uint32Array(t.buffer);n[8]=this.simParams.numParticles,n[9]=this.simParams.numSprings,t[10]=this.simParams.globalBreakThreshold,n[11]=this.simParams.subSteps,this.device.queue.writeBuffer(this.simParamsBuffer,0,t)}updateWindParams(){const t=new Float32Array(G/4);t[0]=this.windParams.strength,t[1]=this.windParams.time,t[2]=this.windParams.frequency,t[4]=this.windParams.direction[0],t[5]=this.windParams.direction[1],t[6]=this.windParams.direction[2],this.device.queue.writeBuffer(this.windParamsBuffer,0,t)}updateMouseParams(){const t=new Float32Array(_/4),n=new Uint32Array(t.buffer);n[0]=this.mouse.mode,n[1]=this.mouse.active,n[2]=this.mouse.particleIndex,t[3]=this.mouse.radius,t[4]=this.mouse.worldPos[0],t[5]=this.mouse.worldPos[1],t[6]=this.mouse.worldPos[2],t[8]=this.mouse.force[0],t[9]=this.mouse.force[1],t[10]=this.mouse.force[2],this.device.queue.writeBuffer(this.mouseBuffer,0,t)}updateRenderParams(){const t=new Float32Array(D/4),n=new Uint32Array(t.buffer);n[0]=this.showStress?1:0,t[1]=this.maxTension,n[2]=p,n[3]=this.structSpringCount,this.device.queue.writeBuffer(this.renderParamsBuffer,0,t)}pinCorners(){const t=[m(0,0),m(p-1,0),m(0,p-1),m(p-1,p-1)],n=this.pinnedCorners?1:0,r=new Uint32Array(1);r[0]=n;for(const i of t){const s=i*R+52;this.device.queue.writeBuffer(this.particleBuffer,s,r)}}setStructCompliance(t){this.simParams.structCompliance=t}setShearCompliance(t){this.simParams.shearCompliance=t}setBendCompliance(t){this.simParams.bendCompliance=t}setDamping(t){this.simParams.damping=t}setWindStrength(t){this.windParams.strength=t}setTearRadius(t){this.mouse.radius=t*.1}setBreakThreshold(t){this.simParams.globalBreakThreshold=t}setSubSteps(t){this.simParams.subSteps=t}setMouseMode(t){this.mouse.mode=t,this.mouse.active=0,this.draggedParticle=-1,this.updateMouseParams()}togglePinnedCorners(){this.pinnedCorners=!this.pinnedCorners,this.pinCorners()}toggleStressView(){this.showStress=!this.showStress,this.updateRenderParams()}toggleWireframe(){this.showWireframe=!this.showWireframe}reset(){const t=O(),{data:n,structCount:r}=z();this.structSpringCount=r,this.device.queue.writeBuffer(this.particleBuffer,0,t),this.device.queue.writeBuffer(this.springBuffer,0,n),this.windParams.time=0,this.mouse.active=0,this.draggedParticle=-1,this.pinCorners(),this.updateMouseParams(),this.updateRenderParams()}handleMouseDown(t,n){const r=this.canvas.getBoundingClientRect(),i=(t-r.left)*(this.canvas.width/r.width),s=(n-r.top)*(this.canvas.height/r.height),o=W(i,s,this.canvas.width,this.canvas.height,this.viewProjInvMatrix,0);this.mouse.worldPos=o,this.mouse.mode===y.DRAG?(this.isDragging=!0,this.draggedParticle=this.findNearestParticle(o),this.mouse.particleIndex=this.draggedParticle,this.mouse.active=1):this.mouse.mode===y.FORCE?(this.mouse.active=1,this.mouse.force=[50,50,50]):this.mouse.mode===y.TEAR&&(this.mouse.active=1),this.updateMouseParams()}handleMouseMove(t,n){const r=this.canvas.getBoundingClientRect(),i=(t-r.left)*(this.canvas.width/r.width),s=(n-r.top)*(this.canvas.height/r.height),o=W(i,s,this.canvas.width,this.canvas.height,this.viewProjInvMatrix,0);this.mouse.worldPos=o,this.isDragging&&this.draggedParticle>=0?(this.mouse.active=1,this.updateMouseParams()):this.mouse.mode===y.TEAR&&this.mouse.active===1&&this.updateMouseParams()}handleMouseUp(){this.isDragging=!1,this.draggedParticle=-1,this.mouse.active=0,this.updateMouseParams()}handleWheel(t){if(this.mouse.mode===y.FORCE){const n=t>0?.9:1.1;this.mouse.force=this.mouse.force.map(r=>Math.max(10,Math.min(200,r*n)))}}findNearestParticle(t){let n=0,r=1/0;for(let i=0;i<E;i++){const s=this.particleInitialPositions[i*3],o=this.particleInitialPositions[i*3+1],h=this.particleInitialPositions[i*3+2],c=s-t[0],u=o-t[1],d=h-t[2],g=c*c+u*u+d*d;g<r&&(r=g,n=i)}return n}start(){this.updateSimParams(),this.updateRenderParams(),this.lastTime=performance.now(),this.animate()}stop(){this.animationId!==null&&(cancelAnimationFrame(this.animationId),this.animationId=null)}animate(){const t=performance.now(),n=Math.min((t-this.lastTime)/1e3,1/30);this.lastTime=t,this.frameCount++,t-this.fpsUpdateTime>=1e3&&(this.fps=Math.round(this.frameCount*1e3/(t-this.fpsUpdateTime)),this.frameCount=0,this.fpsUpdateTime=t,this.onFpsUpdate&&this.onFpsUpdate(this.fps)),this.windParams.time+=n,this.simParams.deltaTime=n,this.updateSimParams(),this.updateWindParams(),this.updateMouseParams(),this.compute(),this.render(),this.animationId=requestAnimationFrame(()=>this.animate())}compute(){const t=this.device.createCommandEncoder(),n=this.simParams.subSteps,r=this.simParams.deltaTime/n,i=this.simParams.deltaTime;this.simParams.deltaTime=r;for(let s=0;s<n;s++){const o=t.beginComputePass();o.setBindGroup(0,this.computeBindGroup),o.setPipeline(this.pipelinePredict),o.dispatchWorkgroups(Math.ceil(E/64));const h=4;for(let c=0;c<h;c++)o.setPipeline(this.pipelineSolve),o.dispatchWorkgroups(Math.ceil(this.springCount/64));o.setPipeline(this.pipelineIntegrate),o.dispatchWorkgroups(Math.ceil(E/64)),o.end()}if(this.simParams.deltaTime=i,this.mouse.mode===y.TEAR&&this.mouse.active===1){const s=t.beginComputePass();s.setBindGroup(0,this.computeBindGroup),s.setPipeline(this.pipelineTear),s.dispatchWorkgroups(Math.ceil(this.springCount/64)),s.end()}this.device.queue.submit([t.finish()])}render(){const t=this.context.getCurrentTexture().createView(),n=this.device.createTexture({size:[this.canvas.width,this.canvas.height],sampleCount:4,format:this.format,usage:GPUTextureUsage.RENDER_ATTACHMENT}),r=this.device.createCommandEncoder(),i=r.beginRenderPass({colorAttachments:[{view:n.createView(),resolveTarget:t,clearValue:{r:.04,g:.04,b:.06,a:1},loadOp:"clear",storeOp:"store"}]});i.setBindGroup(0,this.renderBindGroup),i.setPipeline(this.pipelineTri),i.draw(6,Y,0,0),this.showWireframe&&(i.setPipeline(this.pipelineWire),i.draw(4,this.springCount,0,0)),i.end(),this.device.queue.submit([r.finish()]),n.destroy()}getSpringCount(){return this.springCount}getParticleCount(){return E}}let f;const T=document.getElementById("canvas"),$=document.getElementById("fps"),J=document.getElementById("springs"),ee=document.getElementById("particles");async function te(){try{f=new Q(T,e=>{$.textContent=e.toString()}),await f.init(),J.textContent=f.getSpringCount().toLocaleString(),ee.textContent=f.getParticleCount().toLocaleString(),ne(),ie(),f.start()}catch(e){console.error("Failed to initialize WebGPU:",e),document.body.innerHTML=`
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #fff; flex-direction: column; padding: 20px;">
        <h2 style="color: #ff6b6b; margin-bottom: 16px;">WebGPU 不受支持</h2>
        <p style="text-align: center; max-width: 500px; line-height: 1.6; color: #aaa;">
          ${e instanceof Error?e.message:"无法初始化 WebGPU。"}<br><br>
          请使用支持 WebGPU 的浏览器（如 Chrome 113+ 或 Edge），
          并确保已启用 WebGPU 标志。
        </p>
      </div>
    `}}function ne(){const e=document.getElementById("structK"),t=document.getElementById("structK-val");e.addEventListener("input",()=>{const l=parseFloat(e.value);t.textContent=l.toExponential(1),f.setStructCompliance(l)});const n=document.getElementById("shearK"),r=document.getElementById("shearK-val");n.addEventListener("input",()=>{const l=parseFloat(n.value);r.textContent=l.toExponential(1),f.setShearCompliance(l)});const i=document.getElementById("bendK"),s=document.getElementById("bendK-val");i.addEventListener("input",()=>{const l=parseFloat(i.value);s.textContent=l.toExponential(1),f.setBendCompliance(l)});const o=document.getElementById("damping"),h=document.getElementById("damping-val");o.addEventListener("input",()=>{const l=parseFloat(o.value);h.textContent=l.toFixed(3),f.setDamping(l)});const c=document.getElementById("wind"),u=document.getElementById("wind-val");c.addEventListener("input",()=>{const l=parseFloat(c.value);u.textContent=l.toFixed(1),f.setWindStrength(l)});const d=document.getElementById("tearRadius"),g=document.getElementById("tearRadius-val");d.addEventListener("input",()=>{const l=parseInt(d.value);g.textContent=l.toString(),f.setTearRadius(l)});const v=document.getElementById("breakThreshold"),b=document.getElementById("breakThreshold-val");v.addEventListener("input",()=>{const l=parseFloat(v.value);b.textContent=l.toFixed(1),f.setBreakThreshold(l)});const P=document.getElementById("subSteps"),B=document.getElementById("subSteps-val");P.addEventListener("input",()=>{const l=parseInt(P.value);B.textContent=l.toString(),f.setSubSteps(l)});const w=document.getElementById("modeDrag"),S=document.getElementById("modeTear"),x=document.getElementById("modeForce"),C=(l,L)=>{f.setMouseMode(l),w.classList.toggle("active",L===w),S.classList.toggle("active",L===S),x.classList.toggle("active",L===x)};w.addEventListener("click",()=>C(y.DRAG,w)),S.addEventListener("click",()=>C(y.TEAR,S)),x.addEventListener("click",()=>C(y.FORCE,x)),document.getElementById("reset").addEventListener("click",()=>{f.reset()});const U=document.getElementById("pinToggle");U.addEventListener("click",()=>{f.togglePinnedCorners(),U.classList.toggle("active")}),document.addEventListener("keydown",l=>{l.key==="1"&&C(y.DRAG,w),l.key==="2"&&C(y.TEAR,S),l.key==="3"&&C(y.FORCE,x),(l.key==="r"||l.key==="R")&&f.reset(),(l.key==="w"||l.key==="W")&&f.toggleWireframe(),(l.key==="s"||l.key==="S")&&f.toggleStressView()})}function ie(){let e=!1;T.addEventListener("mousedown",t=>{t.button===0&&(e=!0,f.handleMouseDown(t.clientX,t.clientY))}),T.addEventListener("mousemove",t=>{e&&f.handleMouseMove(t.clientX,t.clientY)}),T.addEventListener("mouseup",()=>{e=!1,f.handleMouseUp()}),T.addEventListener("mouseleave",()=>{e&&(e=!1,f.handleMouseUp())}),T.addEventListener("wheel",t=>{t.preventDefault(),f.handleWheel(t.deltaY)},{passive:!1}),T.addEventListener("touchstart",t=>{t.preventDefault();const n=t.touches[0];e=!0,f.handleMouseDown(n.clientX,n.clientY)},{passive:!1}),T.addEventListener("touchmove",t=>{if(t.preventDefault(),e&&t.touches.length>0){const n=t.touches[0];f.handleMouseMove(n.clientX,n.clientY)}},{passive:!1}),T.addEventListener("touchend",()=>{e=!1,f.handleMouseUp()})}te();
