// Cadrage centre de la maquette (28/10) : garde l'orientation de la vue (direction de regard et haut) et calcule la cible (look) et la distance
// pour que le rectangle englobant des 8 coins de la boite, PROJETES par la perspective, soit exactement au centre de la zone 3D
// avec la meme marge de chaque cote. Regarder le centre 3D de la boite ne suffit pas : en perspective et en vue oblique, son centre projete est decale.
// Fonction pure (aucune dependance a xeokit), meme projection que xeokit (Perspective.js : fovAxis "min" en portrait, fov plafonne a 120).

const MARGE_DEFAUT = 0.04; // part de la demi-zone laissee libre de chaque cote (4 %)

const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fois = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vect = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norme = (a) => Math.hypot(a[0], a[1], a[2]);
const unite = (a) => fois(a, 1 / norme(a));

export function coinsDeBoite(aabb) {
  const coins = [];
  for (const x of [aabb[0], aabb[3]]) for (const y of [aabb[1], aabb[4]]) for (const z of [aabb[2], aabb[5]]) coins.push([x, y, z]);
  return coins;
}

// Demi-tangentes de champ (x, y) comme xeokit : fov vertical, ramene sur l'axe « min »/« max »/« x » selon le ratio, plafonne a 120 degres.
function tangentes(fovDeg, fovAxis, largeur, hauteur) {
  const aspect = largeur / hauteur;
  let fov = fovDeg;
  if (fovAxis === "x" || (fovAxis === "min" && aspect < 1) || (fovAxis === "max" && aspect > 1)) fov = fov / aspect;
  fov = Math.min(fov, 120);
  const ty = Math.tan((fov * Math.PI) / 360);
  return { tx: ty * aspect, ty };
}

// Rectangle englobant des coins projetes, en coordonnees normalisees (-1 a 1 sur chaque axe de la zone) ; profondeur minimale pour detecter un coin derriere la camera.
function rectangleProjete(coins, eye, d, r, u, t) {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, zmin = Infinity;
  for (const p of coins) {
    const rel = moins(p, eye);
    const z = scal(rel, d);
    zmin = Math.min(zmin, z);
    if (z <= 1e-6) continue;
    const nx = scal(rel, r) / (z * t.tx);
    const ny = scal(rel, u) / (z * t.ty);
    xmin = Math.min(xmin, nx); xmax = Math.max(xmax, nx); ymin = Math.min(ymin, ny); ymax = Math.max(ymax, ny);
  }
  return { xmin, xmax, ymin, ymax, zmin };
}

// Ecart (en pixels de la zone) entre le centre du rectangle englobant projete et le centre de la zone, et marges libres de chaque cote.
export function mesurerCadrage({ aabb, eye, look, up, fov = 60, fovAxis = "min", largeur, hauteur }) {
  const d = unite(moins(look, eye));
  const r = unite(vect(d, up));
  const u = vect(r, d);
  const rect = rectangleProjete(coinsDeBoite(aabb), eye, d, r, u, tangentes(fov, fovAxis, largeur, hauteur));
  return {
    ecartX: ((rect.xmin + rect.xmax) / 2) * (largeur / 2),
    ecartY: -((rect.ymin + rect.ymax) / 2) * (hauteur / 2),
    margeGauche: (rect.xmin + 1) * (largeur / 2), margeDroite: (1 - rect.xmax) * (largeur / 2),
    margeHaut: (1 - rect.ymax) * (hauteur / 2), margeBas: (rect.ymin + 1) * (hauteur / 2),
    profondeurMin: rect.zmin
  };
}

// Resout 3 inconnues (decalage de la cible selon r et u, logarithme de la distance) pour annuler 3 ecarts : centre x, centre y, demi-taille - (1 - marge).
// Newton avec jacobienne par differences finies : la projection n'est pas lineaire, un simple decalage proportionnel ne converge pas.
function resoudre3(f, x) {
  for (let i = 0; i < 60; i++) {
    const f0 = f(x);
    if (Math.abs(f0[0]) + Math.abs(f0[1]) + Math.abs(f0[2]) < 1e-10) break;
    const J = [0, 1, 2].map((j) => {
      const h = 1e-6 * Math.max(1, Math.abs(x[j]));
      const y = x.slice(); y[j] += h;
      return f(y).map((v, k) => (v - f0[k]) / h);
    });
    // J[j][k] = d f_k / d x_j ; systeme A dx = -f0 avec A[k][j]
    const A = [0, 1, 2].map((k) => [J[0][k], J[1][k], J[2][k]]);
    const dx = resoudreLineaire(A, f0.map((v) => -v));
    if (!dx) break;
    // Pas amorti : on ne l'accepte que s'il reduit l'ecart (et garde tous les coins devant la camera).
    const total = (v) => Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]);
    let k = 1, y = x;
    for (let e = 0; e < 30; e++, k /= 2) {
      y = x.map((v, j) => v + k * dx[j]);
      const f1 = f(y);
      if (f1[2] < 5 && total(f1) < total(f0)) break;
    }
    x = y;
  }
  return x;
}

function resoudreLineaire(A, b) {
  const M = A.map((l, i) => l.concat(b[i]));
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let l = c + 1; l < 3; l++) if (Math.abs(M[l][c]) > Math.abs(M[p][c])) p = l;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let l = 0; l < 3; l++) {
      if (l === c) continue;
      const k = M[l][c] / M[c][c];
      for (let m = c; m < 4; m++) M[l][m] -= k * M[c][m];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

// Renvoie { eye, look, up } : meme direction de regard et meme haut que la vue donnee, cible deplacee et distance ajustee.
export function cadrerCentre({ aabb, eye, look, up, fov = 60, fovAxis = "min", largeur, hauteur, marge = MARGE_DEFAUT }) {
  const d = unite(moins(look, eye));
  const r = unite(vect(d, up));
  const u = vect(r, d);
  const t = tangentes(fov, fovAxis, largeur, hauteur);
  const coins = coinsDeBoite(aabb);
  const diagonale = norme(moins([aabb[3], aabb[4], aabb[5]], [aabb[0], aabb[1], aabb[2]])) || 1;
  const centre = [(aabb[0] + aabb[3]) / 2, (aabb[1] + aabb[4]) / 2, (aabb[2] + aabb[5]) / 2];
  const poser = ([a, b, ld]) => {
    const cible = plus(centre, plus(fois(r, a), fois(u, b)));
    return { cible, distance: Math.exp(ld) };
  };
  const ecarts = (x) => {
    const { cible, distance } = poser(x);
    const rect = rectangleProjete(coins, moins(cible, fois(d, distance)), d, r, u, t);
    if (rect.zmin <= 1e-6) return [0, 0, 10]; // un coin derriere la camera : la solution est plus loin
    const demi = Math.max((rect.xmax - rect.xmin) / 2, (rect.ymax - rect.ymin) / 2);
    return [(rect.xmin + rect.xmax) / 2, (rect.ymin + rect.ymax) / 2, demi - (1 - marge)];
  };
  const x = resoudre3(ecarts, [0, 0, Math.log(diagonale * 4)]);
  const { cible, distance } = poser(x);
  return { eye: moins(cible, fois(d, distance)), look: cible, up: up.slice() };
}

// Silhouette reellement dessinee (28/10, « la maquette est toujours dezoomee ») : la boite englobante ne suit pas le contour du batiment (96 % de la largeur annonces
// par la boite pour 70,8 % de pixels reellement occupes, mesure en WebKit a 390 px). A partir du rectangle des pixels non vides (coordonnees normalisees -1 a 1 sur chaque
// axe de la zone, y vers le haut), renvoie la pose qui le centre et lui fait occuper `remplissage` (0 a 1) de la dimension limitante. Une passe ne suffit pas (la perspective
// n'est pas lineaire) : l'appelant mesure, corrige, remesure.
export function corrigerSurSilhouette({ eye, look, up, fov = 60, fovAxis = "min", largeur, hauteur, silhouette, remplissage = 0.9, centreY = 0 }) {
  const d = unite(moins(look, eye));
  const r = unite(vect(d, up));
  const u = vect(r, d);
  const t = tangentes(fov, fovAxis, largeur, hauteur);
  const distance = norme(moins(look, eye));
  const cx = (silhouette.xmin + silhouette.xmax) / 2;
  const cy = (silhouette.ymin + silhouette.ymax) / 2 - centreY; // centreY : centre vise (normalise, y vers le haut), 0 = centre de la zone
  const demi = Math.max((silhouette.xmax - silhouette.xmin) / 2, (silhouette.ymax - silhouette.ymin) / 2);
  const cible = plus(look, plus(fois(r, cx * t.tx * distance), fois(u, cy * t.ty * distance)));
  return { eye: moins(cible, fois(d, distance * demi / remplissage)), look: cible, up: up.slice() };
}

// Rectangle (normalise) des points projetes avec la camera donnee : sert aux tests (silhouette simulee) ; meme projection que mesurerCadrage.
export function silhouetteDePoints({ points, eye, look, up, fov = 60, fovAxis = "min", largeur, hauteur }) {
  const d = unite(moins(look, eye));
  const r = unite(vect(d, up));
  const u = vect(r, d);
  const { xmin, xmax, ymin, ymax } = rectangleProjete(points, eye, d, r, u, tangentes(fov, fovAxis, largeur, hauteur));
  return { xmin, xmax, ymin, ymax };
}
