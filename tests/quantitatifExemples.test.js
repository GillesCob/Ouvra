// Tests des phrases toutes faites du quantitatif (src/quantitatifExemples.js) sur les VRAIES metadonnees de l'hopital :
// chaque exemple doit etre valide pour les valeurs reellement presentes et prendre en compte au moins un element.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { EXEMPLES_QUANTITATIF, reconnaitreExemple } from "../src/quantitatifExemples.js";
import { elementsDepuisJson, valeursPourQuantitatif } from "../src/quantitatifDonnees.js";
import { validerRequete, calculer, libelleRequete } from "../src/quantitatif.js";

const TIRET_QUADRATIN = String.fromCharCode(0x2014); // le caractere lui-meme est interdit dans le depot, y compris dans les tests
const lire = (chemin) => JSON.parse(readFileSync(new URL("../public/models/hospital/" + chemin, import.meta.url), "utf8"));
const MAQUETTES = [
  ["legere/architectural.json", "hosp-arch", "Architecture"], ["legere/mechanical.json", "hosp-mep", "Mechanical (CVC)"], ["structure.json", "hosp-struct", "Structure"],
  ["electrical.json", "hosp-elec", "Électricité"], ["fireAlarms.json", "hosp-alarm", "Alarme incendie"], ["plumbing.json", "hosp-plomb", "Plomberie"], ["sprinklers.json", "hosp-spr", "Sprinklers"]
];
const ELEMENTS = MAQUETTES.flatMap(([fichier, id, label]) => elementsDepuisJson(lire(fichier), { id, label }));

test("6 a 8 exemples, phrases distinctes, sans tiret quadratin", () => {
  assert.ok(EXEMPLES_QUANTITATIF.length >= 6 && EXEMPLES_QUANTITATIF.length <= 8);
  assert.equal(new Set(EXEMPLES_QUANTITATIF.map((e) => e.demande)).size, EXEMPLES_QUANTITATIF.length);
  assert.ok(EXEMPLES_QUANTITATIF.every((e) => !e.demande.includes(TIRET_QUADRATIN)));
});

for (const exemple of EXEMPLES_QUANTITATIF) {
  test("exemple « " + exemple.demande + " » : requete valide pour la maquette reelle et au moins un element", () => {
    const valeurs = { ...valeursPourQuantitatif(ELEMENTS, exemple.demande), mesures: ["nombre", "longueur_estimee", "surface_estimee", "volume_estime"] };
    const verdict = validerRequete(exemple.requete, valeurs);
    assert.equal(verdict.ok, true, verdict.erreur);
    // Compte les elements retenus (la mesure estimee demande la geometrie, absente des JSON : on verifie alors la selection par un comptage).
    const comptage = calculer(ELEMENTS, { ...exemple.requete, mesure: "nombre" });
    assert.ok(comptage.totaux.valeur > 0, "aucun element pour " + exemple.demande);
    assert.ok(comptage.lignes.length > 0);
    assert.ok(libelleRequete(exemple.requete).endsWith("."));
  });
}

test("exemples « nombre » : resultat exact attendu sur la maquette reelle", () => {
  const portes = calculer(ELEMENTS, EXEMPLES_QUANTITATIF[0].requete);
  assert.equal(portes.totaux.valeur, 56);
});

test("reconnaitreExemple : phrase identique sans accents, casse ni ponctuation ; copie independante ; sinon null", () => {
  const r = reconnaitreExemple("  COMBIEN de PORTES au niveau 2");
  assert.equal(r.mesure, "nombre");
  r.filtres.typesIfc.push("X");
  assert.deepEqual(reconnaitreExemple("combien de portes au niveau 2 ?").filtres.typesIfc, ["IfcDoor"]);
  assert.equal(reconnaitreExemple("liste des vannes de la maquette mecanique").mesure, "nombre");
  assert.equal(reconnaitreExemple("combien de portes au niveau 3"), null);
  assert.equal(reconnaitreExemple(""), null);
  assert.equal(reconnaitreExemple(null), null);
});

test("aucun fichier du quantitatif ne contient de tiret quadratin", () => {
  const racine = new URL("../", import.meta.url);
  const fichiers = [
    ...readdirSync(new URL("src/", racine)).filter((f) => /^quantitatif/.test(f)).map((f) => "src/" + f),
    ...readdirSync(new URL("relais/", racine)).filter((f) => /Quantitatif/.test(f)).map((f) => "relais/" + f),
    "api/quantitatif.js"
  ];
  assert.ok(fichiers.length >= 8);
  for (const f of fichiers) assert.ok(!readFileSync(new URL(f, racine), "utf8").includes(TIRET_QUADRATIN), f);
});
