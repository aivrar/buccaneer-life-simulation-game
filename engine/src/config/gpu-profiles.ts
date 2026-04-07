import type { GpuProfile } from '../runtime/types.js';

// Profiles assume a 7B Q4_K_M model (~4.2 GB weights).
// KV cache per slot ≈ (ctx_size * bytes_per_token).
// With flash-attn + q8_0 KV, ~45 MB per slot at 1024 ctx for a 7B model.
// With TurboQuant q4_0 KV, ~23 MB per slot — roughly doubles slot count.

export const GPU_PROFILES: Record<string, GpuProfile> = {
  // === Current (q8_0 KV) ===

  '8gb-conservative': {
    name: '8 GB (Conservative)',
    vramGb: 8,
    parallel: 16,
    ctxSize: 1024,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
    flashAttn: true,
    description: 'GTX 1070/1080, RTX 2060/3050. ~16 concurrent agents.',
  },

  '12gb-standard': {
    name: '12 GB (Standard)',
    vramGb: 12,
    parallel: 40,
    ctxSize: 1024,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
    flashAttn: true,
    description: 'RTX 3060, RTX 4060. ~40 concurrent agents.',
  },

  '16gb-standard': {
    name: '16 GB (Standard)',
    vramGb: 16,
    parallel: 56,
    ctxSize: 1024,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
    flashAttn: true,
    description: 'RTX 4060 Ti 16GB, RTX 5060. ~56 concurrent agents.',
  },

  '24gb-aggressive': {
    name: '24 GB (Aggressive)',
    vramGb: 24,
    parallel: 88,
    ctxSize: 1024,
    cacheTypeK: 'q8_0',
    cacheTypeV: 'q8_0',
    flashAttn: true,
    description: 'RTX 3090, RTX 4090. ~88 concurrent agents.',
  },

  // === TurboQuant (q4_0 KV) — future profiles ===

  '8gb-turboquant': {
    name: '8 GB (TurboQuant)',
    vramGb: 8,
    parallel: 32,
    ctxSize: 1024,
    cacheTypeK: 'q4_0',
    cacheTypeV: 'q4_0',
    flashAttn: true,
    description: 'TurboQuant KV. ~32 concurrent agents on 8 GB.',
  },

  '12gb-turboquant': {
    name: '12 GB (TurboQuant)',
    vramGb: 12,
    parallel: 80,
    ctxSize: 1024,
    cacheTypeK: 'q4_0',
    cacheTypeV: 'q4_0',
    flashAttn: true,
    description: 'TurboQuant KV. ~80 concurrent agents on 12 GB.',
  },

  '24gb-turboquant': {
    name: '24 GB (TurboQuant)',
    vramGb: 24,
    parallel: 176,
    ctxSize: 1024,
    cacheTypeK: 'q4_0',
    cacheTypeV: 'q4_0',
    flashAttn: true,
    description: 'TurboQuant KV. ~176 concurrent agents on 24 GB.',
  },
};

/** Pick best profile for detected VRAM. */
export function autoSelectProfile(vramGb: number, turboquant = false): GpuProfile {
  const suffix = turboquant ? '-turboquant' : '';
  if (vramGb >= 24) return GPU_PROFILES[`24gb${suffix || '-aggressive'}`]!;
  if (vramGb >= 16) return GPU_PROFILES['16gb-standard']!; // no TQ 16gb profile yet
  if (vramGb >= 12) return GPU_PROFILES[`12gb${suffix || '-standard'}`]!;
  return GPU_PROFILES[`8gb${suffix || '-conservative'}`]!;
}
