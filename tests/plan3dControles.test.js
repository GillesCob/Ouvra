// Controles de collision d'un plan 2D -> 3D (25/10).
import test from "node:test";
import assert from "node:assert/strict";
import { controlerPlan } from "../src/plan3d/controles.js";

// Un couloir : mur porteur M1 de 4 m (y = 0), deux murs perpendiculaires de 0,2 m d'epaisseur aux bouts, une piece de chaque cote.
function base(extra = {}) {
  return {
    unite: "m", fond: null, niveau: { nom: "RDC", hauteur: 2.5, epaisseurDalle: 0.2 },
    noeuds: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 4, y: 0 }, { id: "A2", x: 0, y: 3 }, { id: "B2", x: 4, y: 3 }, { id: "A3", x: 0, y: -3 }, { id: "B3", x: 4, y: -3 }],
    murs: [
      { id: "M1", a: "A", b: "B", epaisseur: 0.1, type: "interieur" },
      { id: "M2", a: "A", b: "A2", epaisseur: 0.2, type: "interieur" },
      { id: "M3", a: "B", b: "B2", epaisseur: 0.2, type: "interieur" },
      { id: "M4", a: "A", b: "A3", epaisseur: 0.2, type: "interieur" },
      { id: "M5", a: "B", b: "B3", epaisseur: 0.2, type: "interieur" }
    ],
    ouvertures: [], pieces: [], ...extra
  };
}
const regles = (m) => controlerPlan(m).map((r) => `${r.gravite}:${r.regle}`);
const ouv = (id, decalage, largeur, genre = "porte", mur = "M1") => ({ id, mur, genre, decalage, largeur, hauteur: 2.1, allege: 0 });

test("controlerPlan : un plan sain ne remonte rien", () => {
  assert.deepEqual(controlerPlan(base({ ouvertures: [ouv("O1", 1.5, 0.9)] })), []);
});

test("controlerPlan : une porte qui prend tout le mur entre deux murs perpendiculaires est une erreur", () => {
  const r = controlerPlan(base({ ouvertures: [ouv("O1", 0, 4)] }));
  assert.equal(r.filter((x) => x.gravite === "erreur" && x.regle === "ouverture-bout").length, 2);
  assert.match(r[0].texte, /O1/);
});

test("controlerPlan : une porte qui entre de quelques cm dans l'epaisseur d'un mur perpendiculaire est une erreur", () => {
  const r = controlerPlan(base({ ouvertures: [ouv("O1", 0.05, 0.9)] })); // il faut au moins 0,10 m (demi-epaisseur de M2)
  assert.ok(regles({ ...base({ ouvertures: [ouv("O1", 0.05, 0.9)] }) }).includes("erreur:ouverture-bout"));
  assert.match(r.find((x) => x.regle === "ouverture-bout").texte, /5 cm/);
});

test("controlerPlan : une ouverture collee (moins de 3 cm de mur plein) est une alerte, pas une erreur", () => {
  assert.deepEqual(regles(base({ ouvertures: [ouv("O1", 0.11, 0.9)] })), ["alerte:ouverture-bout"]);
});

test("controlerPlan : deux ouvertures qui se chevauchent", () => {
  assert.ok(regles(base({ ouvertures: [ouv("O1", 1, 1), ouv("O2", 1.5, 1)] })).includes("erreur:ouvertures-recouvrement"));
  assert.ok(regles(base({ ouvertures: [ouv("O1", 1, 1), ouv("O2", 2.02, 1)] })).includes("alerte:ouvertures-recouvrement"));
});

test("controlerPlan : porte battante de plus de 1,40 m et fenetre qui depasse la hauteur du niveau", () => {
  assert.ok(regles(base({ ouvertures: [ouv("O1", 1, 1.6)] })).includes("alerte:dimensions"));
  assert.deepEqual(regles(base({ ouvertures: [ouv("O1", 1, 1.6, "coulissante")] })), []);
  const f = { ...ouv("O1", 1, 1), genre: "fenetre", allege: 1.9, hauteur: 1.2 };
  assert.ok(regles(base({ ouvertures: [f] })).includes("alerte:dimensions"));
});

test("controlerPlan : le battement heurte un mur des deux cotes = erreur, d'un seul cote = alerte", () => {
  // M6 : mur parallele a 0,5 m de chaque cote du porteur, la porte de 0,9 m ne peut s'ouvrir d'aucun cote
  const m = base({ ouvertures: [ouv("O1", 1.5, 0.9)] });
  m.noeuds.push({ id: "P", x: 1, y: 0.5 }, { id: "Q", x: 3.5, y: 0.5 }, { id: "R", x: 1, y: -0.5 }, { id: "S", x: 3.5, y: -0.5 });
  m.murs.push({ id: "M6", a: "P", b: "Q", epaisseur: 0.1, type: "interieur" });
  assert.ok(regles(m).includes("alerte:battement") || regles(m).includes("erreur:battement"));
  assert.ok(!regles(m).includes("erreur:battement"));
  m.murs.push({ id: "M7", a: "R", b: "S", epaisseur: 0.1, type: "interieur" });
  assert.ok(regles(m).includes("erreur:battement"));
});

test("controlerPlan : murs croises sans noeud commun, noeud dans l'epaisseur d'un mur", () => {
  const m = base();
  m.noeuds.push({ id: "X", x: 2, y: -1 }, { id: "Y", x: 2, y: 1 });
  m.murs.push({ id: "M6", a: "X", b: "Y", epaisseur: 0.1, type: "interieur" });
  assert.ok(regles(m).includes("erreur:murs-croises"));
  const t = base();
  t.noeuds.push({ id: "Z", x: 2, y: 0.02 });
  t.murs.push({ id: "M6", a: "Z", b: "A2", epaisseur: 0.1, type: "interieur" });
  assert.ok(regles(t).includes("alerte:mur-non-raccorde"));
});

test("controlerPlan : pieces qui se recouvrent, cloison dans une piece", () => {
  const carre = (x, y, c) => [{ x, y }, { x: x + c, y }, { x: x + c, y: y + c }, { x, y: y + c }];
  const m = base({ pieces: [{ id: "P1", nom: "A", contour: carre(0, 0, 2) }, { id: "P2", nom: "B", contour: carre(1, 1, 2) }] });
  assert.ok(regles(m).includes("erreur:pieces-recouvrement"));
  const dedans = base({ pieces: [{ id: "P1", nom: "Grande", contour: carre(-1, -1.5, 3) }] });
  dedans.noeuds.push({ id: "K1", x: 0.5, y: -1 }, { id: "K2", x: 0.5, y: 1 });
  dedans.murs.push({ id: "M6", a: "K1", b: "K2", epaisseur: 0.1, type: "interieur" });
  assert.ok(regles(dedans).includes("alerte:mur-dans-piece"));
  // deux pieces voisines qui se touchent sans se recouvrir
  assert.ok(!regles(base({ pieces: [{ id: "P1", nom: "A", contour: carre(0, 0, 2) }, { id: "P2", nom: "B", contour: carre(2, 0, 2) }] })).includes("erreur:pieces-recouvrement"));
});

test("controlerPlan : les erreurs passent avant les alertes", () => {
  const r = controlerPlan(base({ ouvertures: [ouv("O1", 0.11, 0.9), ouv("O2", 2, 4, "porte")] }));
  const i = r.findIndex((x) => x.gravite === "alerte");
  assert.ok(i === -1 || r.slice(i).every((x) => x.gravite === "alerte"));
});

test("controlerPlan : une ouverture qui ne donne dans aucune piece est signalee, une ouverture qui donne dans une piece non", () => {
  const carre = (x, y, c) => [{ x, y }, { x: x + c, y }, { x: x + c, y: y + c }, { x, y: y + c }];
  const loin = base({ ouvertures: [ouv("O1", 1.5, 0.9)], pieces: [{ id: "P1", nom: "A", contour: carre(0.2, 1.5, 2) }] }); // la piece commence a 1,5 m du mur
  assert.ok(regles(loin).includes("alerte:ouverture-orpheline"));
  const proche = base({ ouvertures: [ouv("O1", 1.5, 0.9)], pieces: [{ id: "P1", nom: "A", contour: carre(0.2, 0.1, 2) }] });
  assert.ok(!regles(proche).includes("alerte:ouverture-orpheline"));
  assert.ok(!regles(base({ ouvertures: [ouv("O1", 1.5, 0.9)] })).includes("alerte:ouverture-orpheline"), "sans piece, la regle ne s'applique pas");
});
