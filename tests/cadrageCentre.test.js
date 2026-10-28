import { test } from "node:test";
import assert from "node:assert/strict";
import { cadrerCentre, mesurerCadrage, coinsDeBoite } from "../src/cadrageCentre.js";

// Pose reelle de l'hopital (HOSPITAL_CAMERA_STATE) et boite proche de la sienne.
const HOPITAL = { eye: [-2.8, 213.7, -18.2], look: [16.4, 190.6, -48.7], up: [0.287, 0.842, -0.457] };
const BOITE = [-60, 170, -120, 90, 215, 40];
const TAILLES = [[979, 668], [1139, 848], [390, 792], [1920, 1000]];

for (const [largeur, hauteur] of TAILLES) {
  test("rectangle projete centre a moins de 0,5 px, " + largeur + "x" + hauteur, () => {
    const cadre = cadrerCentre({ aabb: BOITE, ...HOPITAL, largeur, hauteur });
    const m = mesurerCadrage({ aabb: BOITE, ...cadre, largeur, hauteur });
    assert.ok(Math.abs(m.ecartX) < 0.5, "ecart x " + m.ecartX);
    assert.ok(Math.abs(m.ecartY) < 0.5, "ecart y " + m.ecartY);
    assert.ok(m.profondeurMin > 0);
  });
  test("marges egales de chaque cote de l'axe le plus serre, rien rogne, " + largeur + "x" + hauteur, () => {
    const cadre = cadrerCentre({ aabb: BOITE, ...HOPITAL, largeur, hauteur });
    const m = mesurerCadrage({ aabb: BOITE, ...cadre, largeur, hauteur });
    assert.ok(Math.abs(m.margeGauche - m.margeDroite) < 1);
    assert.ok(Math.abs(m.margeHaut - m.margeBas) < 1);
    assert.ok(Math.min(m.margeGauche, m.margeHaut) > 0);
    assert.ok(Math.min(m.margeGauche, m.margeDroite, m.margeHaut, m.margeBas) < Math.min(largeur, hauteur) * 0.1);
  });
}

test("la direction de regard et le haut de la vue sont conserves", () => {
  const cadre = cadrerCentre({ aabb: BOITE, ...HOPITAL, largeur: 979, hauteur: 668 });
  const dir = (a, b) => { const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const n = Math.hypot(...v); return v.map((x) => x / n); };
  const avant = dir(HOPITAL.eye, HOPITAL.look), apres = dir(cadre.eye, cadre.look);
  avant.forEach((x, i) => assert.ok(Math.abs(x - apres[i]) < 1e-9));
  assert.deepEqual(cadre.up, HOPITAL.up);
});

test("une boite decentree et tres excentree par rapport a la vue est centree aussi", () => {
  const boite = [500, -20, 300, 560, 30, 380];
  const cadre = cadrerCentre({ aabb: boite, eye: [0, 0, 0], look: [0, 0, -10], up: [0, 1, 0], largeur: 1000, hauteur: 600 });
  const m = mesurerCadrage({ aabb: boite, ...cadre, largeur: 1000, hauteur: 600 });
  assert.ok(Math.abs(m.ecartX) < 0.5 && Math.abs(m.ecartY) < 0.5);
});

test("coinsDeBoite donne 8 coins distincts", () => {
  assert.equal(new Set(coinsDeBoite(BOITE).map(String)).size, 8);
});

// Retour 6 (28/10) : apres une commande IA du Viewer, le cadrage de la selection doit REMPLIR la zone 3D (le cadrage par defaut de xeokit, flyTo({ aabb }),
// n'en occupait que 60 a 66 % de la demi-largeur). Boite reelle du niveau 2 de l'hopital, mesuree dans le Viewer.
const NIVEAU_2 = [-12, 170, -140, 87, 172, -45];
for (const [largeur, hauteur] of [[390, 748], [360, 700], [979, 748]]) {
  test("la selection remplit la zone 3D (au moins 90 % de la demi-largeur ou demi-hauteur), " + largeur + "x" + hauteur, () => {
    const cadre = cadrerCentre({ aabb: NIVEAU_2, ...HOPITAL, largeur, hauteur });
    const m = mesurerCadrage({ aabb: NIVEAU_2, ...cadre, largeur, hauteur });
    const rempli = Math.max(1 - Math.min(m.margeGauche, m.margeDroite) / (largeur / 2), 1 - Math.min(m.margeHaut, m.margeBas) / (hauteur / 2));
    assert.ok(rempli >= 0.9, "part remplie " + rempli);
  });
}

// Silhouette reellement dessinee (28/10) : la boite englobante surestime le contour (96 % annonces pour 70,8 % de pixels occupes). Silhouette simulee : un nuage de points
// bien plus etroit que la boite ; la correction mesure / corrige doit converger vers 90 % de la dimension limitante, centre.
import { corrigerSurSilhouette, silhouetteDePoints } from "../src/cadrageCentre.js";
const NUAGE = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 4; j++) pts.push([-10 + i * 8, 172 + j * 6 + (i % 3) * 2, -150 + i * 11 - j * 6]); // bande oblique dans la boite
  return pts;
})();
for (const [largeur, hauteur] of [[390, 792], [360, 588], [1139, 848], [1940, 974]]) {
  test("correction sur la silhouette : 90 % de la dimension limitante, centree, " + largeur + "x" + hauteur, () => {
    let pose = cadrerCentre({ aabb: BOITE, ...HOPITAL, largeur, hauteur });
    for (let i = 0; i < 10; i++) {
      const silhouette = silhouetteDePoints({ points: NUAGE, ...pose, largeur, hauteur });
      pose = corrigerSurSilhouette({ ...pose, largeur, hauteur, silhouette, remplissage: 0.9 });
    }
    const s = silhouetteDePoints({ points: NUAGE, ...pose, largeur, hauteur });
    const demi = Math.max((s.xmax - s.xmin) / 2, (s.ymax - s.ymin) / 2);
    assert.ok(Math.abs(demi - 0.9) < 0.01, "demi-taille " + demi);
    assert.ok(Math.abs((s.xmin + s.xmax) / 2) < 0.01 && Math.abs((s.ymin + s.ymax) / 2) < 0.01, JSON.stringify(s));
    assert.ok(Math.min(s.xmin, s.ymin) >= -1 && Math.max(s.xmax, s.ymax) <= 1);
  });
}
