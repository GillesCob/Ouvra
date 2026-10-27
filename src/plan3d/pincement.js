// 2D -> 3D (25/10) : zoom au pincement sur le plan (deux doigts). Module pur, sans DOM : le calcul de la nouvelle vue est testable.
// Regle : le point du plan qui etait sous le milieu des deux doigts au depart reste sous le milieu des deux doigts, et l'echelle suit le rapport des ecartements.
//
//   vueApresPincement({ vueDepart, rect, departA, departB, a, b, lMin, lMax }) -> { x, y, l, h }
//     vueDepart : { x, y, l, h } viewBox au debut du pincement (metres) ; rect : { left, top, width, height } du plan a l'ecran (pixels)
//     departA, departB : positions des doigts au debut (pixels ecran) ; a, b : positions actuelles ; lMin, lMax : bornes de la largeur visible (metres)

export function vueApresPincement({ vueDepart, rect, departA, departB, a, b, lMin = 1, lMax = Infinity }) {
  const ecartDepart = Math.hypot(departB.x - departA.x, departB.y - departA.y);
  const ecart = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(ecartDepart > 0) || !(ecart > 0) || !(rect.width > 0)) return { ...vueDepart };
  const l = Math.min(Math.max(vueDepart.l * (ecartDepart / ecart), lMin), Math.max(lMax, lMin));
  const kDepart = vueDepart.l / rect.width; // metres par pixel au depart (l'echelle est la meme sur les deux axes)
  const milieuDepart = { x: (departA.x + departB.x) / 2, y: (departA.y + departB.y) / 2 };
  const milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const monde = { x: vueDepart.x + (milieuDepart.x - rect.left) * kDepart, y: vueDepart.y + (milieuDepart.y - rect.top) * kDepart };
  const k = l / rect.width;
  return { x: monde.x - (milieu.x - rect.left) * k, y: monde.y - (milieu.y - rect.top) * k, l, h: l * (vueDepart.h / vueDepart.l) };
}
