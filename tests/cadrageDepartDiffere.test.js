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
  assert.match(js, /if \(!canvasPret\(\)\) \{ affinageEnAttente = \{ pose, recalculer \}; return pose; \}/); // retenue seulement quand le canvas n'est pas pret
  assert.match(js, /new ResizeObserver\(traiterAffinageEnAttente\)\.observe\(viewer\.scene\.canvas\.canvas\)/); // reprise au premier affichage
  assert.match(js, /viewer\.scene\.canvas\.on\("boundary", traiterAffinageEnAttente\)/); // et quand xeokit a pris la taille
  assert.match(js, /memePose\(\{ eye: cam\.eye, look: cam\.look, up: cam\.up \}, pose\)\) viewer\.cameraFlight\.jumpTo\(recalculer\(\)\)/); // une camera deplacee entre-temps n'est jamais ecrasee
  // Collision <-> Viewer : le cadrage global du batiment est ajuste a la zone 3D courante (plus la pose brute de l'hopital).
  assert.match(js, /const centree = boiteBatiment \? poseCentreeSurBoite\(base, boiteBatiment\) : base;/);
  assert.match(js, /if \(centree !== base\) return affinerSurSilhouette\(centree, cadrageBatimentDansZone\);/); // affine aussi quand seule la paire est visible (Collision)
  assert.match(js, /boiteBatiment = viewer\.scene\.visibleObjectIds\.length \? viewer\.scene\.getAABB/);
});

test("main.js : la position initiale et « Recentrer » sont affinees sur la silhouette reellement dessinee (90 % de la dimension limitante)", () => {
  const js = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(js, /const REMPLISSAGE_SILHOUETTE = 0\.9;/);
  assert.match(js, /return affinerSurSilhouette\(poseCentreeSurBoite\(pose, boite\), vueDepartCentree\);/);
  assert.match(js, /cam\.eye = avant\.eye; cam\.look = avant\.look; cam\.up = avant\.up;/); // la camera est toujours rendue apres les essais
});

test("main.js : « Recentrer » de la page Collision sans collision choisie reprend le cadrage global affine de l'arrivee (29/10, 47 % de largeur sur Architecture/CVC)", () => {
  const js = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(js, /nbVisiblesBatiment/);
  const m = js.match(/recenterBtn\.addEventListener\("click", \(\) => \{([\s\S]*?)\n\}\);/);
  assert.ok(m, "gestionnaire de Recentrer introuvable");
  const corps = m[1];
  const iCible = corps.indexOf("if (recenterTarget)");
  const iCollision = corps.indexOf("if (!collisionDetail.hidden) { viewer.cameraFlight.flyTo(cadrageBatimentDansZone()); return; }");
  const iViewer = corps.indexOf("recentrerSurMaquettes();");
  assert.ok(iCible >= 0 && iCollision > iCible && iViewer > iCollision, "ordre : collision choisie, puis page Collision, puis Viewer");
});

test("main.js : la commande IA du Viewer affine son cadrage sur la silhouette dessinee (maquette a 73 % de la largeur a 390 px sans cela, 29/10)", () => {
  const js = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const corps = js.slice(js.indexOf("function recentrerApresCommande"), js.indexOf("function restaurerCameraAvantCommande"));
  assert.match(corps, /poseIACadree\(boite\)/);
  assert.doesNotMatch(corps, /poseCentreeSurBoiteActuelle\(boite\) \?\? \{ aabb: boite \}/); // plus de cadrage sur la seule boite englobante
  const pose = js.slice(js.indexOf("function poseIACadree"), js.indexOf("// « Non » : la camera revient"));
  assert.match(pose, /affinerSurSilhouette\(pose, recalculer, remplissage, centreY\)/);
  assert.match(pose, /estMobile\(\) \? REMPLISSAGE_SILHOUETTE_IA_MOBILE : REMPLISSAGE_SILHOUETTE/);
});
