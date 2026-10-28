// Viewer par commande (24/10) : calculs de boites englobantes (AABB), purs. Une boite est [xmin, ymin, zmin, xmax, ymax, zmax], en metres.

export const estAabb = (a) => Array.isArray(a) && a.length === 6 && a.every(Number.isFinite) && a[0] <= a[3] && a[1] <= a[4] && a[2] <= a[5];

export function unionAabb(boites) {
  const valides = boites.filter(estAabb);
  if (!valides.length) return null;
  return valides.reduce((u, b) => [
    Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.min(u[2], b[2]), Math.max(u[3], b[3]), Math.max(u[4], b[4]), Math.max(u[5], b[5])
  ]);
}

export const elargirAabb = (a, marge) => [a[0] - marge, a[1] - marge, a[2] - marge, a[3] + marge, a[4] + marge, a[5] + marge];

export const centreAabb = (a) => [(a[0] + a[3]) / 2, (a[1] + a[4]) / 2, (a[2] + a[5]) / 2];

export const pointDansAabb = (p, a) => p[0] >= a[0] && p[0] <= a[3] && p[1] >= a[1] && p[1] <= a[4] && p[2] >= a[2] && p[2] <= a[5];

export const aabbSeCoupent = (a, b) => a[0] <= b[3] && a[3] >= b[0] && a[1] <= b[4] && a[4] >= b[1] && a[2] <= b[5] && a[5] >= b[2];

// Plus courte distance entre deux boites (0 si elles se touchent ou se recouvrent).
export function distanceEntreAabb(a, b) {
  const dx = Math.max(0, a[0] - b[3], b[0] - a[3]);
  const dy = Math.max(0, a[1] - b[4], b[1] - a[4]);
  const dz = Math.max(0, a[2] - b[5], b[2] - a[5]);
  return Math.hypot(dx, dy, dz);
}
