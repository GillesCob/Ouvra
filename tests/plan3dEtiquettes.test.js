// 2D -> 3D (25/10) : placement des noms de pieces (src/plan3d/etiquettesPieces.js). Le texte doit tenir entierement dans la piece, quelle que soit sa forme.
import test from "node:test";
import assert from "node:assert/strict";
import { placerEtiquette, pointDansPolygone, mesurerApproximatif } from "../src/plan3d/etiquettesPieces.js";
import { surfaceAffichee } from "../src/plan3d/texteSol.js";

const K = 0.0114; // metres par pixel du plan de test
const poly = (pts) => pts.map(([x, y]) => ({ x: x * K, y: y * K }));
// Pieces relevees sur le plan de test (memes contours que le plan d'exemple).
const SDB = poly([[221, 172], [422, 172], [422, 290], [318, 290], [318, 485], [221, 485]]); // en L
const SALLE_EAU = poly([[322, 315], [420, 315], [420, 485], [322, 485]]);
const WC = poly([[815, 52], [912, 52], [912, 172], [815, 172]]);
const CHAMBRE = poly([[425, 172], [715, 172], [715, 485], [425, 485]]);
const SALON = poly([[912, 50], [1465, 50], [1465, 715], [1262, 715], [1262, 612], [1172, 612], [1172, 955], [860, 955], [860, 495], [797, 495], [797, 198], [912, 198]]);

// Rectangle occupe par le texte place (meme mesure que le placement, avec sa marge).
function rectangle(e) {
  const largeur = Math.max(...e.lignes.map((l) => mesurerApproximatif(l.texte, l.taille))) * 1.06;
  const haut = Math.min(...e.lignes.map((l) => l.y - l.taille * 0.6));
  const bas = Math.max(...e.lignes.map((l) => l.y + l.taille * 0.6));
  return { x0: e.x - largeur / 2, x1: e.x + largeur / 2, y0: e.y + haut, y1: e.y + bas };
}
function toutDedans(contour, e) {
  const r = rectangle(e);
  const xm = (r.x0 + r.x1) / 2, ym = (r.y0 + r.y1) / 2;
  return [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1], [xm, r.y0], [xm, r.y1], [r.x0, ym], [r.x1, ym], [xm, ym]].every(([x, y]) => pointDansPolygone({ x, y }, contour));
}

test("chaque piece du plan de test garde son nom et sa surface entierement dans son contour", () => {
  const cas = [[SDB, "Salle de bain", "5,5 m²"], [SALLE_EAU, "Salle d'eau", "2,2 m²"], [WC, "WC", "1,5 m²"], [CHAMBRE, "Chambre", "11,8 m²"], [SALON, "Salon/Salle à manger", "62,2 m²"]];
  for (const [contour, nom, surface] of cas) {
    const e = placerEtiquette(contour, { nom, surface });
    assert.equal(e.tient, true, nom);
    assert.ok(toutDedans(contour, e), `${nom} sort de sa piece`);
    assert.ok(e.lignes.length >= 2, `${nom} : nom et surface`);
  }
});

test("une piece etroite reduit le texte ou coupe le nom en deux lignes, jamais ne deborde", () => {
  const e = placerEtiquette(SALLE_EAU, { nom: "Salle d'eau", surface: "2,2 m²" });
  assert.ok(e.echelle < 1 || e.lignes.length === 3, "reduit ou sur deux lignes");
  assert.ok(toutDedans(SALLE_EAU, e));
  const petit = placerEtiquette(poly([[0, 0], [60, 0], [60, 60], [0, 60]]), { nom: "Buanderie du fond", surface: "0,5 m²" });
  assert.ok(petit.echelle < 0.7);
  assert.ok(toutDedans(poly([[0, 0], [60, 0], [60, 60], [0, 60]]), petit) || petit.tient === false);
});

test("une grande piece garde la taille normale, sur une ligne", () => {
  const e = placerEtiquette(CHAMBRE, { nom: "Chambre", surface: "11,8 m²" });
  assert.equal(e.echelle, 1);
  assert.equal(e.lignes.length, 2);
  assert.equal(e.lignes[0].texte, "CHAMBRE");
});

test("piece en L : le texte n'est pas pose au centre de gravite quand celui-ci tombe hors de la piece", () => {
  const L = poly([[0, 0], [300, 0], [300, 60], [60, 60], [60, 300], [0, 300]]);
  const e = placerEtiquette(L, { nom: "Couloir", surface: "3 m²" });
  assert.ok(pointDansPolygone({ x: e.x, y: e.y }, L));
  assert.ok(toutDedans(L, e));
});

test("entrees limites : sans nom, sans surface, contour trop court, contour plat", () => {
  assert.equal(placerEtiquette(CHAMBRE, { nom: "", surface: "" }).lignes.length, 0);
  assert.equal(placerEtiquette(CHAMBRE, { nom: "", surface: "3 m²" }).lignes.length, 1);
  assert.equal(placerEtiquette(CHAMBRE, { nom: "Chambre" }).lignes.length, 1);
  assert.deepEqual(placerEtiquette([{ x: 0, y: 0 }], { nom: "x" }).lignes, []);
  assert.deepEqual(placerEtiquette(null, { nom: "x" }).lignes, []);
  const plat = placerEtiquette([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], { nom: "Plat", surface: "0 m²" });
  assert.equal(plat.tient, false);
  assert.ok(Number.isFinite(plat.x) && Number.isFinite(plat.y));
});

test("pointDansPolygone : dedans, dehors, sur un coin concave", () => {
  const L = poly([[0, 0], [300, 0], [300, 60], [60, 60], [60, 300], [0, 300]]);
  assert.equal(pointDansPolygone({ x: 10 * K, y: 250 * K }, L), true);
  assert.equal(pointDansPolygone({ x: 200 * K, y: 200 * K }, L), false);
  assert.equal(pointDansPolygone({ x: -1, y: -1 }, L), false);
});

test("surfaceAffichee : la surface calculee, et l'ecart avec la surface du plan des qu'il depasse 1 %", () => {
  const carre = poly([[0, 0], [100, 0], [100, 100], [0, 100]]); // environ 1,30 m2
  const calc = 100 * K * 100 * K;
  assert.equal(surfaceAffichee({ contour: carre, surfacePlan: null }), `${(Math.round(calc * 10) / 10).toLocaleString("fr-FR")} m²`);
  assert.equal(surfaceAffichee({ contour: carre, surfacePlan: calc }), surfaceAffichee({ contour: carre }));
  assert.equal(surfaceAffichee({ contour: carre, surfacePlan: calc * 1.005 }), surfaceAffichee({ contour: carre }), "moins de 1 % : pas d'ecart affiche");
  assert.match(surfaceAffichee({ contour: carre, surfacePlan: calc * 1.2 }), /\(plan : .* m²\)$/);
  assert.equal(surfaceAffichee({ contour: carre, surfacePlan: 0 }), surfaceAffichee({ contour: carre }), "surface du plan nulle ignoree");
});
