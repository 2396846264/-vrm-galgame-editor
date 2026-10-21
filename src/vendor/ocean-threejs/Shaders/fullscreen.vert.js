/**
 * fullscreen.vert.js
 * -----------------------------------------------------------------------------
 * Trivial pass-through vertex shader for full-screen compute passes.
 * GLSL3 (WebGL2). `vUv` covers [0,1]^2 across the screen quad.
 * -----------------------------------------------------------------------------
 */
export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
