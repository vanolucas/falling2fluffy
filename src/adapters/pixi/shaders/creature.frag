#version 300 es
precision highp float;

// Procedural furry creature: layered fur strands, an animated mouth and two realistic eyes.
// Space: body radius 1, origin at body center, y up. Output is premultiplied alpha.

in vec2 vPos;
out vec4 finalColor;

uniform float uTime;
uniform float uMouthOpen;   // 0 closed .. 1 wide open
uniform float uBlink;       // 0 open .. 1 closed
uniform float uSquint;      // 0 neutral .. 1 happy squint
uniform vec2 uLook;         // gaze direction, length <= 1
uniform vec2 uSway;         // fur tip displacement from motion

const float TAU = 6.28318531;
const vec3 LIGHT = vec3(-0.43, 0.62, 0.66);
const vec3 HALF_VEC = vec3(-0.22, 0.32, 0.92);

// Fur rings: strands rooted on concentric rings, drawn outer (below) to inner (on top)
const int RINGS = 16;
const float RING_STEP = 0.066;
const float HAIR_LEN = 0.26;
const float STRAND_SPACING = 0.017;
const float LOCK_STRANDS = 9.0;

const vec2 EYE_POS = vec2(0.36, 0.5);
const float EYE_RADIUS = 0.175;
const float MOUTH_Y = -0.02;
const float LIP_WIDTH = 0.03;
const float IRIS = 0.66;

// ---------------------------------------------------------------- noise

float hash11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec4 over(vec4 top, vec4 bottom) { return top + bottom * (1.0 - top.a); }

// Spiky outline offset imitating hair tips overhanging a feature edge
float hairEdge(float angle, float cells, float amp, float seed) {
    float u = angle / TAU * cells;
    float h = hash11(mod(floor(u), cells) + seed);
    float spike = 1.0 - abs(fract(u) - 0.5) * 2.0;
    return amp * (0.35 + 0.65 * h) * sqrt(spike);
}

// ---------------------------------------------------------------- fur

vec4 fur(vec2 p, float px) {
    float r = length(p);
    vec2 dir = p / max(r, 1e-4);
    vec2 tangent = vec2(-dir.y, dir.x);
    float theta = atan(p.y, p.x);

    // Pseudo-3D sphere normal; strands stick out halfway between surface tangent and normal
    float rc = min(r, 0.995);
    vec3 n = vec3(dir * rc, sqrt(1.0 - rc * rc));
    vec3 T = normalize(vec3(dir * (n.z + rc), n.z - rc));
    float diffuse = clamp(dot(n, normalize(LIGHT)) * 0.55 + 0.55, 0.0, 1.0);
    float TdotH = dot(T, HALF_VEC);
    float kk = sqrt(max(0.0, 1.0 - TdotH * TdotH));
    float spec = pow(kk, 90.0) * 0.55 + pow(kk, 14.0) * 0.1;
    float rim = smoothstep(0.78, 1.25, r) * (0.45 + 0.55 * max(0.0, dot(dir, vec2(0.55, 0.83))));

    // Large color patches drifting between blue and violet
    float hueField = noise(p * 2.3 + 7.0) * 0.7 + noise(p * 6.0 - 3.0) * 0.3;
    vec2 curl = (vec2(noise(p * 2.6 + 3.1), noise(p * 2.6 + 11.7)) - 0.5) * 0.2;
    vec2 breeze = vec2(sin(uTime * 1.3 + p.y * 3.0), cos(uTime * 1.1 + p.x * 2.0)) * 0.012;
    vec2 bend = vec2(0.0, -0.07) + uSway + curl + breeze;

    vec3 blue = vec3(0.03, 0.09, 0.72);
    vec3 violet = vec3(0.24, 0.05, 0.66);
    vec3 lilac = vec3(0.52, 0.42, 1.0);

    // Dense undercoat so no gaps show between strands
    float under = smoothstep(0.97, 0.86, r + (noise(p * 22.0) - 0.5) * 0.1);
    vec3 underTone = mix(blue, violet, hueField) * 0.16 * diffuse;
    vec4 acc = vec4(underTone * under, under);

    for (int k = 0; k < RINGS; k++) {
        float fk = float(k);
        float r0 = 1.0 - fk * RING_STEP;
        float tNom = (r - r0) / HAIR_LEN;
        if (tNom < -0.3 || tNom > 1.4) continue;

        // Strands bend with curl, gravity and motion sway, mostly near the tips
        float tb = clamp(tNom, 0.0, 1.0);
        vec2 disp = bend * tb * tb;
        float along = r - r0 - dot(disp, dir);
        float dTheta = dot(disp, tangent) / max(r, 0.05);
        float strands = max(8.0, floor(TAU * max(r0, 0.02) / STRAND_SPACING));
        float across = (theta - dTheta) / TAU * strands + fk * 0.37;

        // Locks: groups of strands whose tips gather into pointed, wavy tufts
        float lockCount = max(1.0, floor(strands / LOCK_STRANDS));
        float lockSize = strands / lockCount;
        float lockCell = floor(across / lockSize);
        float lh = hash11(mod(lockCell, lockCount) * 3.71 + fk * 17.3);
        across += ((lh - 0.5) * 1.6 + sin(tb * 4.0 + lh * 6.28) * 0.3) * tb * lockSize * 0.5;
        lockCell = floor(across / lockSize);
        float lockCenter = (lockCell + 0.5) * lockSize;
        float pull = 0.7 * pow(clamp(tNom / (0.75 + 0.4 * lh), 0.0, 1.0), 1.6);
        float rel = (across - lockCenter) / (1.0 - pull);
        float lockPos = rel / (lockSize * 0.5);
        if (abs(lockPos) > 1.0) continue;
        across = lockCenter + rel;

        float id = mod(floor(across), strands);
        float h1 = hash11(id * 1.618 + fk * 131.7);
        float h2 = fract(h1 * 17.31 + 0.13);
        float h3 = fract(h1 * 47.77 + 0.71);

        float len = HAIR_LEN * (0.7 + 0.35 * h2) * (0.65 + 0.7 * lh) * (1.0 - 0.35 * lockPos * lockPos);
        float t = (along + h3 * RING_STEP * 1.3) / len;
        if (t < 0.0 || t > 1.0) continue;

        float f = fract(across) - 0.5 + (h1 - 0.5) * 0.3;
        float w = 0.36 * pow(1.0 - t, 0.5) + 0.04;
        float aa = strands / (TAU * max(r, 0.05)) * px / (1.0 - pull);
        float cov = clamp((w - abs(f)) / max(aa, 1e-3) + 0.5, 0.0, 1.0);
        cov = mix(cov, 2.0 * w, clamp(aa - 0.6, 0.0, 1.0));
        if (cov <= 0.0) continue;

        vec3 tone = mix(blue, violet, smoothstep(0.25, 0.75, hueField + (h1 - 0.5) * 0.3 + (lh - 0.5) * 0.4));
        tone = mix(tone, lilac, smoothstep(0.5, 1.0, t) * 0.3 * h3);
        float roundness = sqrt(max(0.0, 1.0 - (f / w) * (f / w)));
        float lockVolume = 0.55 + 0.45 * sqrt(1.0 - lockPos * lockPos);
        float rootShade = mix(0.12, 1.0, smoothstep(0.0, 0.75, t));
        float lit = diffuse * rootShade * lockVolume * (0.7 + 0.3 * roundness) * (0.8 + 0.4 * h2);

        vec3 col = tone * lit;
        col += vec3(0.7, 0.75, 1.0) * spec * t * (0.4 + h3) * roundness * lockVolume;
        col += vec3(0.45, 0.55, 1.0) * rim * t * 0.9;
        acc = over(vec4(col * cov, cov), acc);
    }
    return acc;
}

// ---------------------------------------------------------------- mouth

struct Mouth { vec2 q; float up; float low; float width; float d; };

Mouth mouthShape(vec2 p) {
    float open = uMouthOpen;
    Mouth m;
    m.width = 0.58 + 0.07 * open;
    m.up = 0.025 + 0.18 * open;
    m.low = 0.035 + 0.52 * open;
    m.q = p - vec2(0.0, MOUTH_Y);
    // Raised corners give a cheeky grin
    m.q.y -= 0.11 * (m.q.x * m.q.x) / (m.width * m.width);
    vec2 rad = vec2(m.width, m.q.y > 0.0 ? m.up : m.low);
    float k0 = length(m.q / rad);
    float k1 = length(m.q / (rad * rad));
    m.d = k0 * (k0 - 1.0) / k1;
    return m;
}

float upperEdgeY(Mouth m, float x) { return m.up * sqrt(max(0.0, 1.0 - (x * x) / (m.width * m.width))); }
float lowerEdgeY(Mouth m, float x) { return -m.low * sqrt(max(0.0, 1.0 - (x * x) / (m.width * m.width))); }

// Tooth hanging from (or standing on) a lip edge; returns coverage and shade
vec2 tooth(vec2 q, float x0, float edgeY, float len, float halfWidth, float dirY, float px) {
    float depth = (edgeY - q.y) * dirY;
    float t = depth / len;
    float wHalf = halfWidth * pow(max(0.0, 1.0 - t), 0.75);
    float cov = smoothstep(px, -px, abs(q.x - x0) - wHalf) * step(-0.02, depth) * step(t, 1.0);
    float shade = 0.72 + 0.28 * (1.0 - abs(q.x - x0) / max(wHalf, 1e-3)) - 0.25 * t;
    return vec2(cov, shade);
}

vec3 mouthInterior(Mouth m, float px) {
    vec2 q = m.q;
    float depth = clamp(-m.d / (0.5 * (m.up + m.low) + 1e-3), 0.0, 1.0);

    vec3 flesh = vec3(0.42, 0.035, 0.07);
    vec3 throat = vec3(0.035, 0.0, 0.01);
    vec3 col = mix(flesh, throat, smoothstep(0.05, 0.8, depth));

    // Palate ridges and shadow cast by the upper lip
    col *= 0.9 + 0.1 * sin(q.y * 140.0) * step(0.0, q.y);
    col *= mix(0.25, 1.0, smoothstep(0.0, 0.07, upperEdgeY(m, q.x) - q.y));

    // Tongue
    vec2 tq = q - vec2(0.0, -m.low * 0.82);
    vec2 tr = vec2(m.width * 0.62, m.low * 0.62 + 0.02);
    float td = length(tq / tr);
    float tongue = smoothstep(1.0, 1.0 - px * 2.0 / tr.y, td);
    if (tongue > 0.0) {
        vec3 tcol = vec3(0.85, 0.2, 0.28);
        tcol *= mix(1.0, 0.35, smoothstep(-0.3, 1.0, tq.y / tr.y)) * (1.0 - 0.45 * (tq.x * tq.x) / (tr.x * tr.x));
        tcol *= 1.0 - 0.35 * exp(-tq.x * tq.x / 0.0015) * smoothstep(0.9, -0.2, tq.y / tr.y);
        tcol *= 0.9 + 0.2 * noise(tq * 90.0);
        float gloss = smoothstep(0.35, 0.0, length((tq - vec2(-0.06, tr.y * 0.45)) / vec2(tr.x * 0.55, tr.y * 0.18)));
        tcol += vec3(1.0, 0.75, 0.8) * gloss * 0.35;
        col *= mix(1.0, 0.4, smoothstep(1.35, 1.0, td));
        col = mix(col, tcol, tongue);
    }

    // Wet inner lip rim
    float rim = smoothstep(-0.035, -0.005, m.d);
    col = mix(col, vec3(0.5, 0.12, 0.2), rim * 0.8);
    col += vec3(0.9, 0.6, 0.7) * smoothstep(-0.03, -0.012, m.d) * smoothstep(0.0, -0.008, m.d) * step(q.y, 0.0) * 0.25;

    // Small lower teeth
    for (int i = 0; i < 2; i++) {
        float x0 = (i == 0 ? -1.0 : 1.0) * m.width * 0.45;
        vec2 tt = tooth(q, x0, lowerEdgeY(m, x0), 0.07, 0.035, -1.0, px);
        col = mix(col, vec3(0.92, 0.88, 0.78) * tt.y, tt.x);
    }
    return col;
}

// Dark glossy lips framing the mouth
vec3 lips(Mouth m) {
    float s = clamp(m.d / LIP_WIDTH, 0.0, 1.0);
    float across = clamp(m.q.x / m.width, -1.0, 1.0);
    vec3 col = vec3(0.12, 0.04, 0.1) * mix(1.0, 0.35, s);
    float lower = step(m.q.y, 0.0);
    float gloss = exp(-pow((s - 0.35) / 0.18, 2.0)) * (1.0 - across * across);
    col += vec3(0.55, 0.4, 0.6) * gloss * mix(0.12, 0.4, lower);
    return col;
}

// Upper fangs, drawn over lips so they peek out when the mouth closes
vec4 fangs(Mouth m, float px) {
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 2; i++) {
        float x0 = (i == 0 ? -1.0 : 1.0) * m.width * 0.34;
        vec2 tt = tooth(m.q, x0, upperEdgeY(m, x0) + 0.01, 0.1 + 0.04 * uMouthOpen, 0.045, 1.0, px);
        vec3 col = vec3(0.96, 0.93, 0.84) * tt.y;
        col += vec3(0.25) * smoothstep(0.02, 0.0, abs(m.q.x - x0 + 0.012)) * tt.y;
        acc = over(vec4(col, 1.0) * tt.x, acc);
    }
    return acc;
}

// ---------------------------------------------------------------- eyes

struct Eye { vec2 q; float rr; float upperLid; float lowerLid; float mask; };

Eye eyeShape(vec2 p, float side, float px) {
    Eye e;
    e.q = (p - vec2(EYE_POS.x * side, EYE_POS.y)) / EYE_RADIUS;
    e.rr = length(e.q);
    float x2 = e.q.x * e.q.x;
    float lidOpen = 0.6 + 0.3 * max(uLook.y, 0.0);
    e.upperLid = mix(lidOpen, -0.6, uBlink) - mix(0.3, 0.1, uBlink) * x2 - 0.2 * uSquint;
    e.lowerLid = mix(-0.92, -0.25, uSquint) + 0.3 * x2;
    float edge = 1.0 - hairEdge(atan(e.q.y, e.q.x), 40.0, 0.12, side * 11.0);
    float aa = px / EYE_RADIUS;
    e.mask = smoothstep(aa, -aa, e.rr - edge)
           * smoothstep(aa, -aa, e.q.y - e.upperLid)
           * smoothstep(-aa, aa, e.q.y - e.lowerLid);
    return e;
}

vec3 eyeball(Eye e, float px) {
    vec2 q = e.q;
    vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));

    vec3 sclera = vec3(0.8, 0.74, 0.72) * (0.35 + 0.65 * n.z);
    float veins = smoothstep(0.035, 0.0, abs(noise(q * 5.0) - 0.5)) * smoothstep(0.45, 1.0, e.rr);
    sclera = mix(sclera, vec3(0.7, 0.2, 0.2), veins * 0.3);
    vec3 col = sclera;

    // Iris and pupil follow the gaze
    vec2 iq = q - uLook * 0.3;
    float ir = length(iq) / IRIS;
    vec2 idir = iq / max(length(iq), 1e-4);
    float fibers = noise(idir * 14.0 + ir * 1.7) * 0.6 + noise(idir * 38.0 + ir * 3.0) * 0.4;
    vec3 iris = mix(vec3(1.0, 0.68, 0.12), vec3(0.3, 0.42, 0.08), smoothstep(0.35, 0.95, ir));
    iris *= 0.55 + 0.75 * fibers;
    iris += vec3(0.35, 0.22, 0.02) * smoothstep(0.1, 0.0, abs(ir - 0.5));
    iris = mix(iris, vec3(0.04, 0.03, 0.01), smoothstep(0.78, 1.0, ir));
    float irisAa = px / (EYE_RADIUS * IRIS);
    col = mix(col, iris, smoothstep(1.0 + irisAa, 1.0 - irisAa, ir));

    float pupilR = 0.38 + 0.03 * sin(uTime * 0.7);
    col = mix(col, vec3(0.005, 0.004, 0.008), smoothstep(pupilR + irisAa * 1.5, pupilR - irisAa * 1.5, ir));

    // Shadow cast by the upper lid, dark lid margin and wet lower lid line
    col *= mix(0.15, 1.0, smoothstep(0.0, 0.5, e.upperLid - q.y));
    col *= mix(0.3, 1.0, smoothstep(0.0, 0.08, e.upperLid - q.y));
    col = mix(col, vec3(0.75, 0.5, 0.55), smoothstep(0.1, 0.0, q.y - e.lowerLid) * 0.5);

    // Wet cornea reflections
    float window = smoothstep(0.16, 0.1, length((q - vec2(-0.28, 0.2)) * vec2(1.0, 1.35)));
    float glint = smoothstep(0.07, 0.035, length(q - vec2(0.3, -0.28)));
    col += vec3(1.0) * window * 0.95 + vec3(0.9, 0.95, 1.0) * glint * 0.6;
    col += vec3(0.08, 0.1, 0.14) * smoothstep(0.1, 1.0, q.y);
    return col;
}

// ---------------------------------------------------------------- composition

void main() {
    vec2 p = vPos;
    float r = length(p);
    // Derivatives must be taken before any early return, or quads straddling the cutoff get garbage
    float px = max(fwidth(p.x), fwidth(p.y));
    if (r > 1.45) { finalColor = vec4(0.0); return; }

    Mouth m = mouthShape(p);
    float mAngle = atan(m.q.y / (m.q.y > 0.0 ? m.up : m.low), m.q.x / m.width);
    float lipMask = smoothstep(px, -px, m.d - LIP_WIDTH + hairEdge(mAngle, 70.0, 0.035, 5.0));
    float mouthMask = smoothstep(px, -px, m.d);

    Eye eyeL = eyeShape(p, -1.0, px);
    Eye eyeR = eyeShape(p, 1.0, px);

    vec4 col = vec4(0.0);
    if (lipMask < 1.0 && eyeL.mask < 1.0 && eyeR.mask < 1.0) {
        col = fur(p, px);
        // Fur darkens as it curls into the mouth and eye sockets
        float ao = mix(0.35, 1.0, smoothstep(0.0, 0.12, m.d));
        ao *= mix(0.3, 1.0, smoothstep(1.0, 1.35, eyeL.rr)) * mix(0.3, 1.0, smoothstep(1.0, 1.35, eyeR.rr));
        col.rgb *= ao;
    }
    if (lipMask > 0.0) col = mix(col, vec4(lips(m), 1.0), lipMask);
    if (mouthMask > 0.0) col = mix(col, vec4(mouthInterior(m, px), 1.0), mouthMask);
    col = over(fangs(m, px), col);
    if (eyeL.mask > 0.0) col = mix(col, vec4(eyeball(eyeL, px), 1.0), eyeL.mask);
    if (eyeR.mask > 0.0) col = mix(col, vec4(eyeball(eyeR, px), 1.0), eyeR.mask);

    // Linear to display gamma on straight color, then back to premultiplied
    vec3 straight = col.a > 0.0 ? col.rgb / col.a : vec3(0.0);
    finalColor = vec4(pow(straight, vec3(1.0 / 2.2)) * col.a, col.a);
}
