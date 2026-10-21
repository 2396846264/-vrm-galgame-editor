# OceanThreejs vendored subset

Source: https://github.com/achrefelouafi/OceanThreejs
Commit: da18e9254a83a6e990c0077b5d752026f3d5c480 (2026-10-21)
License: MIT, copyright 2026 mohamedachrefelouafi. Full license: licenses/OceanThreejs/LICENSE.txt.

Selected FFT, spectra, Gerstner, foam, material, shader and compute modules only.
Host changes: Three r180 compatibility; shared output/tone pipeline; avoid double
sRGB conversion; Hermitian h0 mirror and N-squared amplitude normalization; GPU resource
disposal. Host wrapper supplies bounded 128-squared/30 Hz simulation, nonuniform horizon
grid, asynchronous height cache, Gerstner fallback, and simple water presets.
No upstream demo UI, sand textures, HDRI downloads or network dependencies.
