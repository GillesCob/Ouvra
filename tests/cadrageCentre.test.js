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
