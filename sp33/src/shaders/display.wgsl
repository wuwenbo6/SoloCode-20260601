struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    
    let positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0)
    );

    let uvs = array<vec2f, 6>(
        vec2f(0.0, 0.0),
        vec2f(1.0, 0.0),
        vec2f(0.0, 1.0),
        vec2f(0.0, 1.0),
        vec2f(1.0, 0.0),
        vec2f(1.0, 1.0)
    );

    out.position = vec4f(positions[vertex_index], 0.0, 1.0);
    out.uv = uvs[vertex_index];
    return out;
}

@group(0) @binding(0) var<storage, read> accumulator: array<vec4f>;
@group(0) @binding(1) var<uniform> params: Params;

struct Params {
    width: u32,
    height: u32,
    frame: u32,
    _pad: u32,
}

fn aces_filmic(x: vec3f) -> vec3f {
    let a = 2.51f;
    let b = 0.03f;
    let c = 2.43f;
    let d = 0.59f;
    let e = 0.14f;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0f), vec3f(1.0f));
}

fn linear_to_srgb(x: vec3f) -> vec3f {
    return select(
        1.055f * pow(x, vec3f(1.0f / 2.4f)) - 0.055f,
        12.92f * x,
        x <= vec3f(0.0031308f)
    );
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let px = u32(uv.x * f32(params.width));
    let py = u32(uv.y * f32(params.height));
    let idx = py * params.width + px;
    
    let color = accumulator[idx].rgb;
    
    var corrected = aces_filmic(color);
    corrected = linear_to_srgb(corrected);
    
    return vec4f(corrected, 1.0f);
}
