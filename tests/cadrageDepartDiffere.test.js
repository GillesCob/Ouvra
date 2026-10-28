import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cadrerCentre, mesurerCadrage } from "../src/cadrageCentre.js";

// Retour du 28/10 : « la maquette est toujours dezoomee ». Cause mesuree en WebKit (390 x 844) : quand l'application s'ouvre sur l'accueil (ou une autre page), le
// canvas du Viewer est masque (0 x 0) au chargement des maquettes ; la pose brute de l'hopital (reglee pour un ecran large) etait posee sans ajustement a la zone 3D
// et le restait au premier affichage du Viewer. Le correctif recentre la camera au premier affichage du canvas (src/main.js, recentrerDepartSiEnAttente).

const HOPITAL = { eye: [-2.8, 213.7, -18.2], look: [16.4, 190.6, -48.7], up: [0.287, 0.842, -0.457] };
const BOITE = [-12, 159, -163, 90, 204, 0]; // boite reelle des trois maquettes de l'hopital
const remplissage = (m, largeur, hauteur) => ({
  x: 1 - (m.margeGauche + m.margeDroite) / largeur,
  y: 1 - (m.margeHaut + m.margeBas) / hauteur
});

for (const [largeur, hauteur] of [[390, 792], [360, 640], [769, 700]]) {
  test("pose brute de l'hopital en portrait : la maquette n'est ni centree ni ajustee (bug reproduit), " + largeur + "x" + hauteur, () => {
    const brute = mesurerCadrage({ aabb: BOITE, ...HOPITAL, largeur, hauteur });
    const ajustee = mesurerCadrage({ aabb: BOITE, ...cadrerCentre({ aabb: BOITE, ...HOPITAL, largeur, hauteur }), largeur, hauteur });
    // La pose brute deborde d'un cote (marge negative) ou n'est pas centree ; la pose ajustee ne deborde pas et est centree.
    const debordeOuDecentree = Math.min(brute.margeGauche, brute.margeDroite) < 0 || Math.abs(brute.ecartX) > 0.05 * largeur;
    if (largeur < 769) assert.ok(debordeOuDecentree, "la pose brute devrait etre fausse en portrait : " + JSON.stringify(brute));
    assert.ok(Math.min(ajustee.margeGauche, ajustee.margeDroite, ajustee.margeHaut, ajustee.margeBas) >= 0);
    assert.ok(Math.abs(ajustee.ecartX) < 0.5);
  });
}

test("pose ajustee en portrait : la dimension limitante de la zone est occupee a au moins 70 %", () => {
  for (const [largeur, hauteur] of [[390, 792], [360, 640], [390, 664]]) {
    const m = mesurerCadrage({ aabb: BOITE, ...cadrerCentre({ aabb: BOITE, ...HOPITAL, largeur, hauteur }), largeur, hauteur });
    const r = remplissage(m, largeur, hauteur);
    assert.ok(Math.max(r.x, r.y) >= 0.7, "remplissage " + JSON.stringify(r));
  }
});

test("main.js : le cadrage de depart sans canvas mesurable est retenu puis refait au premier affichage du canvas", () => {
  const js = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(js, /poseDepartSansCanvas = canvasMesurable\(\) \? null : centree/); // retenue seulement quand le canvas n'a pas de taille
  assert.match(js, /new ResizeObserver\(recentrerDepartSiEnAttente\)\.observe\(viewer\.scene\.canvas\.canvas\)/); // reprise au premier affichage
  assert.match(js, /memePose\(\{ eye: cam\.eye, look: cam\.look, up: cam\.up \}, attendue\)\) viewer\.cameraFlight\.jumpTo\(vueDepartCentree\(\)\)/);
  assert.match(js, /else poseDepartSansCanvas = null; \/\/ la camera a ete deplacee/); // une camera deplacee entre-temps n'est jamais ecrasee
});
