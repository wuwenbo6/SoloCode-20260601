struct Camera {
    position: vec3f,
    focal_length: f32,
    forward: vec3f,
    aspect: f32,
    right: vec3f,
    _pad0: f32,
    up: vec3f,
    _pad1: f32,
}

struct Material {
    albedo: vec3f,
    type: u32,
    roughness: f32,
    ior: f32,
    texture_scale: f32,
    has_texture: f32,
    _pad0: vec2f,
}

struct Triangle {
    v0: vec3f,
    mat_id: u32,
    v1: vec3f,
    _pad0: f32,
    v2: vec3f,
    _pad1: f32,
    uv0: vec2f,
    _pad2: vec2f,
    uv1: vec2f,
    _pad3: vec2f,
    uv2: vec2f,
    _pad4: vec2f,
}

struct BVHNode {
    aabb_min: vec3f,
    left_first: u32,
    aabb_max: vec3f,
    tri_count: u32,
}

struct Ray {
    origin: vec3f,
    _pad0: f32,
    direction: vec3f,
    _pad1: f32,
}

struct HitRecord {
    t: f32,
    point: vec3f,
    normal: vec3f,
    uv: vec2f,
    front_face: bool,
    material_id: u32,
    _pad0: vec2u,
}

struct ScatterResult {
    attenuation: vec3f,
    direction: vec3f,
    scattered: bool,
    _pad0: f32,
}

struct Params {
    frame: u32,
    max_bounces: u32,
    width: u32,
    height: u32,
    seed: u32,
    normal_offset: f32,
    tri_count: u32,
    node_count: u32,
    enable_ao: u32,
    ao_samples: u32,
    ao_radius: f32,
    enable_soft_shadows: u32,
    shadow_samples: u32,
    light_radius: f32,
    texture_width: u32,
    texture_height: u32,
}

@group(0) @binding(0) var<storage, read> camera: Camera;
@group(0) @binding(1) var<storage, read> materials: array<Material>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(3) var<storage, read_write> accumulator: array<vec4f>;
@group(0) @binding(4) var<uniform> params: Params;
@group(0) @binding(5) var<storage, read> bvh_nodes: array<BVHNode>;
@group(0) @binding(6) var<storage, read> tri_indices: array<u32>;
@group(0) @binding(7) var<storage, read> texture_data: array<vec4f>;

const NORMAL_OFFSET: f32 = 0.0002f;
const EPSILON: f32 = 1e-8f;

fn rand(seed: ptr<function, u32>) -> f32 {
    *seed = *seed * 747796405u + 2891336453u;
    let result = ((*seed >> ((*seed >> 28u) + 4u)) ^ *seed) * 277803737u;
    *seed = (result >> 22u) ^ result;
    return f32(*seed) / 4294967295.0f;
}

fn rand3(seed: ptr<function, u32>) -> vec3f {
    return vec3f(rand(seed), rand(seed), rand(seed));
}

fn random_in_unit_sphere(seed: ptr<function, u32>) -> vec3f {
    while (true) {
        let p = rand3(seed) * 2.0f - vec3f(1.0f);
        if (dot(p, p) < 1.0f) {
            return p;
        }
    }
}

fn random_unit_vector(seed: ptr<function, u32>) -> vec3f {
    return normalize(random_in_unit_sphere(seed));
}

fn random_on_hemisphere(normal: vec3f, seed: ptr<function, u32>) -> vec3f {
    let on_unit_sphere = random_unit_vector(seed);
    if (dot(on_unit_sphere, normal) > 0.0f) {
        return on_unit_sphere;
    } else {
        return -on_unit_sphere;
    }
}

fn random_in_unit_disk(seed: ptr<function, u32>) -> vec2f {
    while (true) {
        let p = vec2f(rand(seed), rand(seed)) * 2.0f - vec2f(1.0f);
        if (dot(p, p) < 1.0f) {
            return p;
        }
    }
}

fn reflectance(cosine: f32, ref_idx: f32) -> f32 {
    var r0 = (1.0f - ref_idx) / (1.0f + ref_idx);
    r0 = r0 * r0;
    return r0 + (1.0f - r0) * pow(1.0f - cosine, 5.0f);
}

fn near_zero(v: vec3f) -> bool {
    let s = 1e-8f;
    return (abs(v.x) < s) && (abs(v.y) < s) && (abs(v.z) < s);
}

fn sample_texture(uv: vec2f, scale: f32) -> vec3f {
    if (params.texture_width == 0u || params.texture_height == 0u) {
        return vec3f(1.0f);
    }

    var u = fract(uv.x * scale);
    var v = fract(uv.y * scale);

    if (u < 0.0f) { u = u + 1.0f; }
    if (v < 0.0f) { v = v + 1.0f; }

    let tex_x = u32(u * f32(params.texture_width));
    let tex_y = u32(v * f32(params.texture_height));
    let idx = tex_y * params.texture_width + tex_x;

    if (idx >= arrayLength(&texture_data)) {
        return vec3f(1.0f);
    }

    return texture_data[idx].rgb;
}

fn generate_ray(px: u32, py: u32, seed: ptr<function, u32>) -> Ray {
    let u = (f32(px) + rand(seed)) / f32(params.width);
    let v = (f32(py) + rand(seed)) / f32(params.height);

    let ndc_x = (u - 0.5f) * 2.0f;
    let ndc_y = (v - 0.5f) * 2.0f;

    let h = camera.aspect;
    let v_sensor = ndc_y / camera.focal_length;
    let h_sensor = ndc_x * h / camera.focal_length;

    let dir = normalize(camera.forward + camera.right * h_sensor + camera.up * v_sensor);

    return Ray(camera.position, 0.0f, dir, 0.0f);
}

fn intersect_aabb(ray: Ray, node: BVHNode, t_min: f32, t_max: f32) -> f32 {
    let inv_dir = vec3f(
        1.0f / select(ray.direction.x, 1e30f, abs(ray.direction.x) > EPSILON),
        1.0f / select(ray.direction.y, 1e30f, abs(ray.direction.y) > EPSILON),
        1.0f / select(ray.direction.z, 1e30f, abs(ray.direction.z) > EPSILON)
    );

    let t0 = (node.aabb_min - ray.origin) * inv_dir;
    let t1 = (node.aabb_max - ray.origin) * inv_dir;

    let t_smaller = min(t0, t1);
    let t_larger = max(t0, t1);

    var t_near = max(max(t_smaller.x, t_smaller.y), t_smaller.z);
    var t_far = min(min(t_larger.x, t_larger.y), t_larger.z);

    t_near = max(t_near, t_min);
    t_far = min(t_far, t_max);

    if (t_near > t_far || t_far < 0.0f) {
        return -1.0f;
    }
    return t_near;
}

fn intersect_triangle(ray: Ray, tri: Triangle, t_min: f32, t_max: f32) -> HitRecord {
    var hit: HitRecord;
    hit.t = -1.0f;

    let v0 = tri.v0;
    let v1 = tri.v1;
    let v2 = tri.v2;

    let edge1 = v1 - v0;
    let edge2 = v2 - v0;
    let h = cross(ray.direction, edge2);
    let a = dot(edge1, h);

    if (abs(a) < EPSILON) {
        return hit;
    }

    let f = 1.0f / a;
    let s = ray.origin - v0;
    let beta = f * dot(s, h);

    if (beta < -EPSILON || beta > 1.0f + EPSILON) {
        return hit;
    }

    let q = cross(s, edge1);
    let gamma = f * dot(ray.direction, q);

    if (gamma < -EPSILON || beta + gamma > 1.0f + EPSILON) {
        return hit;
    }

    let t = f * dot(edge2, q);

    if (t < t_min || t > t_max) {
        return hit;
    }

    hit.t = t;
    hit.point = ray.origin + ray.direction * t;

    let alpha = 1.0f - beta - gamma;
    hit.uv = alpha * tri.uv0 + beta * tri.uv1 + gamma * tri.uv2;

    let n = normalize(cross(edge1, edge2));
    hit.front_face = dot(ray.direction, n) < 0.0f;
    hit.normal = select(-n, n, hit.front_face);
    hit.material_id = tri.mat_id;

    return hit;
}

fn offset_origin(point: vec3f, normal: vec3f, direction: vec3f) -> vec3f {
    let offset = normal * NORMAL_OFFSET;
    if (dot(direction, normal) > 0.0f) {
        return point + offset;
    } else {
        return point - offset;
    }
}

fn scene_intersect(ray: Ray, t_min: f32, t_max: f32) -> HitRecord {
    var closest_hit: HitRecord;
    closest_hit.t = -1.0f;
    var closest_t = t_max;

    if (params.node_count == 0u) {
        for (var i: u32 = 0u; i < arrayLength(&triangles); i++) {
            let hit = intersect_triangle(ray, triangles[i], t_min, closest_t);
            if (hit.t > 0.0f) {
                closest_hit = hit;
                closest_t = hit.t;
            }
        }
        return closest_hit;
    }

    var stack: array<u32, 64>;
    var stack_top: u32 = 1u;
    stack[0] = 0u;

    while (stack_top > 0u) {
        stack_top -= 1u;
        let node_idx = stack[stack_top];

        let node = bvh_nodes[node_idx];

        if (intersect_aabb(ray, node, t_min, closest_t) < 0.0f) {
            continue;
        }

        if (node.tri_count > 0u) {
            let first = node.left_first;
            for (var i: u32 = 0u; i < node.tri_count; i++) {
                let tri_idx = tri_indices[first + i];
                let hit = intersect_triangle(ray, triangles[tri_idx], t_min, closest_t);
                if (hit.t > 0.0f) {
                    closest_hit = hit;
                    closest_t = hit.t;
                }
            }
            continue;
        }

        let left_child = node.left_first;
        let right_child = node.left_first + 1u;

        if (stack_top < 62u) {
            stack[stack_top] = left_child;
            stack_top += 1u;
            stack[stack_top] = right_child;
            stack_top += 1u;
        }
    }

    return closest_hit;
}

fn compute_ao(hit: HitRecord, seed: ptr<function, u32>) -> f32 {
    if (params.enable_ao == 0u || params.ao_samples == 0u) {
        return 1.0f;
    }

    var occluded: f32 = 0.0f;

    for (var i: u32 = 0u; i < params.ao_samples; i++) {
        var dir = random_on_hemisphere(hit.normal, seed);
        if (dot(dir, hit.normal) < 0.0f) {
            dir = -dir;
        }

        let origin = offset_origin(hit.point, hit.normal, dir);
        let ao_ray = Ray(origin, 0.0f, dir, 0.0f);
        let ao_hit = scene_intersect(ao_ray, 0.001f, params.ao_radius);

        if (ao_hit.t > 0.0f) {
            occluded += 1.0f;
        }
    }

    return 1.0f - occluded / f32(params.ao_samples);
}

fn find_light(): vec3f {
    var light_pos = vec3f(0.0f, 5.0f, 0.0f);
    var found = false;

    for (var i: u32 = 0u; i < arrayLength(&triangles); i++) {
        let tri = triangles[i];
        let mat = materials[tri.mat_id];
        if (all(mat.albedo > vec3f(10.0f))) {
            light_pos = (tri.v0 + tri.v1 + tri.v2) / 3.0f;
            found = true;
            break;
        }
    }

    return light_pos;
}

fn compute_soft_shadow(hit: HitRecord, light_pos: vec3f, seed: ptr<function, u32>) -> f32 {
    if (params.enable_soft_shadows == 0u || params.shadow_samples == 0u) {
        let to_light = light_pos - hit.point;
        let light_dist = length(to_light);
        let light_dir = to_light / light_dist;
        let origin = offset_origin(hit.point, hit.normal, light_dir);
        let shadow_ray = Ray(origin, 0.0f, light_dir, 0.0f);
        let shadow_hit = scene_intersect(shadow_ray, 0.001f, light_dist - 0.01f);
        return select(1.0f, 0.0f, shadow_hit.t > 0.0f);
    }

    var lit: f32 = 0.0f;

    for (var i: u32 = 0u; i < params.shadow_samples; i++) {
        let disk_offset = random_in_unit_disk(seed) * params.light_radius;

        let t = cross(abs(hit.normal.y) > 0.9f ? vec3f(1.0f, 0.0f, 0.0f) : vec3f(0.0f, 1.0f, 0.0f), hit.normal);
        let tangent1 = normalize(t);
        let tangent2 = cross(hit.normal, tangent1);

        let light_center = light_pos;
        let offset = tangent1 * disk_offset.x + tangent2 * disk_offset.y;
        let sample_light = light_center + offset;

        let to_light = sample_light - hit.point;
        let light_dist = length(to_light);
        let light_dir = to_light / light_dist;

        let origin = offset_origin(hit.point, hit.normal, light_dir);
        let shadow_ray = Ray(origin, 0.0f, light_dir, 0.0f);
        let shadow_hit = scene_intersect(shadow_ray, 0.001f, light_dist - 0.01f);

        if (shadow_hit.t < 0.0f) {
            let dist_factor = 1.0f / (1.0f + light_dist * light_dist * 0.1f);
            lit += dist_factor;
        }
    }

    return lit / f32(params.shadow_samples);
}

fn scatter(
    ray: Ray,
    hit: HitRecord,
    seed: ptr<function, u32>
) -> ScatterResult {
    let mat = materials[hit.material_id];
    var result: ScatterResult;

    var base_color = mat.albedo;
    if (mat.has_texture > 0.5f) {
        let tex_color = sample_texture(hit.uv, mat.texture_scale);
        base_color = base_color * tex_color;
    }

    result.attenuation = base_color;
    result.scattered = true;
    result._pad0 = 0.0f;

    if (mat.type == 0u) {
        var scatter_dir = hit.normal + random_unit_vector(seed);
        if (near_zero(scatter_dir)) {
            scatter_dir = hit.normal;
        }
        result.direction = normalize(scatter_dir);
    } else if (mat.type == 1u) {
        let reflected = reflect(ray.direction, hit.normal);
        let fuzz = min(mat.roughness, 1.0f);
        var scatter_dir = reflected + random_in_unit_sphere(seed) * fuzz;
        if (near_zero(scatter_dir)) {
            result.scattered = false;
        } else {
            result.direction = normalize(scatter_dir);
            if (dot(result.direction, hit.normal) < 0.0f) {
                result.scattered = false;
            }
        }
    } else {
        let refraction_ratio = select(1.0f / mat.ior, mat.ior, hit.front_face);
        let unit_dir = normalize(ray.direction);
        let cos_theta = min(dot(-unit_dir, hit.normal), 1.0f);
        let sin_theta = sqrt(1.0f - cos_theta * cos_theta);

        let cannot_refract = refraction_ratio * sin_theta > 1.0f;
        var direction: vec3f;

        if (cannot_refract || reflectance(cos_theta, refraction_ratio) > rand(seed)) {
            direction = reflect(unit_dir, hit.normal);
        } else {
            let r_out_perp = (unit_dir + hit.normal * cos_theta) * refraction_ratio;
            let r_out_parallel = hit.normal * (-sqrt(abs(1.0f - dot(r_out_perp, r_out_perp))));
            direction = r_out_perp + r_out_parallel;
        }

        result.direction = normalize(direction);
    }

    return result;
}

fn ray_color(ray: Ray, seed: ptr<function, u32>) -> vec3f {
    var current_ray = ray;
    var color = vec3f(1.0f);

    let light_pos = find_light();

    for (var bounce: u32 = 0u; bounce < params.max_bounces; bounce++) {
        let hit = scene_intersect(current_ray, 0.001f, 10000.0f);

        if (hit.t < 0.0f) {
            let unit_dir = normalize(current_ray.direction);
            let t = 0.5f * (unit_dir.y + 1.0f);
            let sky_color = mix(vec3f(1.0f, 1.0f, 1.0f), vec3f(0.5f, 0.7f, 1.0f), t);
            return color * sky_color;
        }

        let mat = materials[hit.material_id];

        if (all(mat.albedo > vec3f(10.0f))) {
            return color * mat.albedo;
        }

        if (bounce == 0u) {
            let ao_factor = compute_ao(hit, seed);
            let shadow_factor = compute_soft_shadow(hit, light_pos, seed);
            color = color * (0.1f + 0.9f * ao_factor * shadow_factor);
        }

        let scatter_result = scatter(current_ray, hit, seed);
        if (!scatter_result.scattered) {
            return vec3f(0.0f);
        }

        color = color * scatter_result.attenuation;

        let new_origin = offset_origin(hit.point, hit.normal, scatter_result.direction);
        current_ray = Ray(new_origin, 0.0f, scatter_result.direction, 0.0f);
    }

    return vec3f(0.0f);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let px = global_id.x;
    let py = global_id.y;

    if (px >= params.width || py >= params.height) {
        return;
    }

    let idx = py * params.width + px;

    var seed = params.seed + px * 1973u + py * 9277u + params.frame * 2654435761u;

    let ray = generate_ray(px, params.height - py - 1u, &seed);
    let color = ray_color(ray, &seed);

    let frame = f32(params.frame);
    let new_color = (accumulator[idx].rgb * frame + color) / (frame + 1.0f);

    accumulator[idx] = vec4f(new_color, 1.0f);
}
