import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// GTA San Andreas-style color grading + film grain + vignette
// All in one pass for performance

export const GTAShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    // Color grading
    warmth: { value: 0.2 },          // Orange/warm push
    contrast: { value: 1.08 },
    saturation: { value: 1.15 },
    brightness: { value: 1.2 },
    // Film grain
    grainIntensity: { value: 0.06 },
    // Vignette
    vignetteIntensity: { value: 0.25 },
    vignetteRadius: { value: 0.9 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float warmth;
    uniform float contrast;
    uniform float saturation;
    uniform float brightness;
    uniform float grainIntensity;
    uniform float vignetteIntensity;
    uniform float vignetteRadius;
    
    varying vec2 vUv;

    // Pseudo-random for film grain
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // RGB to HSL
    vec3 rgb2hsl(vec3 c) {
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float l = (maxC + minC) / 2.0;
      float s = 0.0;
      float h = 0.0;
      if (maxC != minC) {
        float d = maxC - minC;
        s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
        if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
        else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
        else h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
      }
      return vec3(h, s, l);
    }

    float hue2rgb(float p, float q, float t) {
      if (t < 0.0) t += 1.0;
      if (t > 1.0) t -= 1.0;
      if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
      if (t < 1.0/2.0) return q;
      if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
      return p;
    }

    vec3 hsl2rgb(vec3 hsl) {
      float h = hsl.x, s = hsl.y, l = hsl.z;
      if (s == 0.0) return vec3(l);
      float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
      float p = 2.0 * l - q;
      return vec3(
        hue2rgb(p, q, h + 1.0/3.0),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1.0/3.0)
      );
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      // --- Brightness ---
      color *= brightness;

      // --- Contrast ---
      color = (color - 0.5) * contrast + 0.5;

      // --- Warm color push (GTA SA orange tint) ---
      color.r += warmth * 0.12;
      color.g += warmth * 0.05;
      color.b -= warmth * 0.08;

      // Slight teal in shadows, orange in highlights (cinematic split toning)
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(-0.02, 0.02, 0.05); // cool teal shadows
      vec3 highlightTint = vec3(0.06, 0.03, -0.03); // warm highlights
      color += mix(shadowTint, highlightTint, smoothstep(0.0, 1.0, lum)) * warmth;

      // --- Saturation ---
      vec3 hsl = rgb2hsl(color);
      hsl.y *= saturation;
      color = hsl2rgb(hsl);

      // --- Film grain ---
      float grain = rand(vUv * time) * 2.0 - 1.0;
      color += grain * grainIntensity;

      // --- Vignette ---
      float dist = distance(vUv, vec2(0.5));
      float vig = smoothstep(vignetteRadius, vignetteRadius - 0.45, dist);
      color *= mix(1.0 - vignetteIntensity, 1.0, vig);

      // Clamp
      color = clamp(color, 0.0, 1.0);

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export function createGTAPass() {
  return new ShaderPass(GTAShader);
}
