// Comparaison de deux versions d'une maquette par GUID (src/comparaisonVersions.js) : regles d'abord, validation humaine pour tout ce qui n'est pas identique.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comparerVersions, TOLERANCES } from "../src/comparaisonVersions.js";
import { elementsDepuisJson } from "../src/quantitatifDonnees.js";

// boite : [xmin, ymin, zmin, xmax, ymax, zmax] en metres.
const el = (id, extra = {}) => ({ id, nom: "Mur:Generique 200:" + id, famille: "Mur:Generique 200", typeIfc: "IfcWall", niveau: "Level 1", boite: [0, 0, 0, 4, 0.2, 3], ...extra });
const decale = (boite, dx) => [boite[0] + dx, boite[1], boite[2], boite[3] + dx, boite[4], boite[5]];

test("versions identiques : tout est inchange, rien a valider", () => {
  const v = [el("A"), el("B", { boite: [10, 0, 0, 14, 0.2, 3] })];
  const r = comparerVersions(v, v.map((e) => ({ ...e })));
  assert.equal(r.inchanges.length, 2);
  assert.equal(r.propositions.length, 0);
  assert.equal(r.ajoutes.length, 0);
  assert.deepEqual(r.resume, { inchanges: 2, modifies: 0, disparus: 0, remplaces: 0, deplaces: 0, ambigus: 0, ajoutes: 0 });
});

test("un element supprime sans equivalent : disparu, a valider", () => {
  const r = comparerVersions([el("A"), el("B", { boite: [10, 0, 0, 14, 0.2, 3] })], [el("A")]);
  assert.equal(r.propositions.length, 1);
  assert.deepEqual({ sorte: r.propositions[0].sorte, ancien: r.propositions[0].ancien.id, nouveaux: r.propositions[0].nouveaux }, { sorte: "disparu", ancien: "B", nouveaux: [] });
  assert.equal(r.propositions[0].validation, "à valider");
});

test("GUID change mais meme classe, niveau, position et dimensions : remplace par regle", () => {
  const r = comparerVersions([el("A"), el("B")], [el("A"), el("B2", { boite: el("B").boite })].map((e) => e));
  // B et A ont la meme boite : cas ambigu volontaire, couvert plus bas. Ici A garde son GUID, B devient B2.
  assert.equal(r.inchanges.length, 1);
  assert.equal(r.propositions.length, 1);
  assert.equal(r.propositions[0].sorte, "remplace");
  assert.deepEqual(r.propositions[0].nouveaux.map((n) => n.id), ["B2"]);
  assert.ok(r.propositions[0].raisons.includes("position"));
  assert.ok(r.propositions[0].raisons.includes("dimensions"));
});

test("remplacement a la meme position avec un autre GUID, dans une maquette plus grande (cas de la demo)", () => {
  const ancien = [el("A"), el("B", { boite: [10, 0, 0, 14, 0.2, 3] }), el("C", { boite: [20, 0, 0, 24, 0.2, 3] })];
  const nouveau = [el("A"), el("B-bis", { boite: [10, 0, 0, 14, 0.2, 3] }), el("D", { boite: [30, 0, 0, 34, 0.2, 3], niveau: "Level 2" })];
  const r = comparerVersions(ancien, nouveau);
  const parSorte = Object.fromEntries(r.propositions.map((p) => [p.ancien.id, p.sorte]));
  assert.deepEqual(parSorte, { B: "remplace", C: "disparu" });
  assert.deepEqual(r.ajoutes.map((e) => e.id), ["D"]);
});

test("meme famille et memes dimensions mais position differente : deplace (unique candidat)", () => {
  const r = comparerVersions([el("A")], [el("A2", { boite: decale(el("A").boite, 2) })]);
  assert.equal(r.propositions[0].sorte, "deplace");
  assert.equal(r.propositions[0].nouveaux[0].id, "A2");
  assert.ok(Math.abs(r.propositions[0].distance - 2) < 1e-9);
});

test("meme GUID mais position ou dimensions changees : modifie, a valider", () => {
  const r = comparerVersions([el("A")], [el("A", { boite: decale(el("A").boite, 0.5) })]);
  assert.equal(r.inchanges.length, 0);
  assert.equal(r.modifies.length, 1);
  assert.equal(r.modifies[0].id, "A");
  assert.deepEqual(r.modifies[0].changements, ["position"]);
  const r2 = comparerVersions([el("A")], [el("A", { boite: [0, 0, 0, 4, 0.3, 3] })]);
  assert.deepEqual(r2.modifies[0].changements, ["dimensions"]);
});

test("tolerance : un ecart sous le seuil de position n'est pas un changement", () => {
  const r = comparerVersions([el("A")], [el("A", { boite: decale(el("A").boite, TOLERANCES.position / 2) })]);
  assert.equal(r.inchanges.length, 1);
});

test("plusieurs candidats equivalents : ambigu, jamais choisi au hasard", () => {
  const b = [0, 0, 0, 4, 0.2, 3];
  const r = comparerVersions([el("A", { boite: b })], [el("N1", { boite: b }), el("N2", { boite: b })]);
  assert.equal(r.propositions.length, 1);
  assert.equal(r.propositions[0].sorte, "ambigu");
  assert.deepEqual(r.propositions[0].nouveaux.map((n) => n.id).sort(), ["N1", "N2"]);
});

test("deux disparus pour un seul nouveau : ni l'un ni l'autre n'est declare remplace", () => {
  const b = [0, 0, 0, 4, 0.2, 3];
  const r = comparerVersions([el("A", { boite: b }), el("B", { boite: b })], [el("N", { boite: b })]);
  assert.deepEqual(r.propositions.map((p) => p.sorte), ["ambigu", "ambigu"]);
});

test("classe ou niveau different : jamais un candidat", () => {
  const r = comparerVersions([el("A")], [el("N", { typeIfc: "IfcSlab" }), el("M", { niveau: "Level 2" })]);
  assert.equal(r.propositions[0].sorte, "disparu");
  assert.equal(r.ajoutes.length, 2);
});

test("meme position, dimensions differentes (famille differente) : ambigu avec le candidat, pour l'IA ou l'humain", () => {
  const r = comparerVersions([el("A")], [el("N", { famille: "Mur:Generique 300", nom: "Mur:Generique 300:9", boite: [0, 0, 0, 4, 0.3, 3] })]);
  assert.equal(r.propositions[0].sorte, "ambigu");
  assert.deepEqual(r.propositions[0].nouveaux.map((n) => n.id), ["N"]);
});

test("sans geometrie (metadonnees seules) : jamais de remplacement automatique, candidats par classe, niveau et famille", () => {
  const sans = (id) => el(id, { boite: null });
  const r = comparerVersions([sans("A")], [sans("N")]);
  assert.equal(r.propositions[0].sorte, "ambigu");
  assert.deepEqual(r.propositions[0].raisons, ["classe", "niveau", "famille"]);
  assert.equal(r.geometrie, false);
});

test("boite fournie par une fonction (xeokit : calculee a la demande)", () => {
  const v1 = [el("A", { boite: () => [0, 0, 0, 4, 0.2, 3] })];
  const v2 = [el("B", { boite: () => [0, 0, 0, 4, 0.2, 3] })];
  assert.equal(comparerVersions(v1, v2).propositions[0].sorte, "remplace");
});

test("boite invalide (NaN, longueur fausse) : traitee comme absente, sans exception", () => {
  const r = comparerVersions([el("A", { boite: [0, 0, NaN, 1, 1, 1] })], [el("B", { boite: [1, 2] })]);
  assert.equal(r.propositions[0].sorte, "ambigu");
});

test("objets spatiaux (projet, niveau, espace) ignores ; entrees vides ou mal formees sans exception", () => {
  const r = comparerVersions([{ id: "L1", typeIfc: "IfcBuildingStorey", nom: "Level 1" }, el("A")], [el("A")]);
  assert.equal(r.inchanges.length, 1);
  assert.deepEqual(comparerVersions(null, undefined).resume.inchanges, 0);
  assert.deepEqual(comparerVersions([null, {}, { id: undefined }], []).propositions, []);
});

test("GUID en double dans une version : le premier est garde, aucune exception", () => {
  const r = comparerVersions([el("A"), el("A")], [el("A")]);
  assert.equal(r.inchanges.length, 1);
});

test("donnees reelles de l'hopital : un element retire et un autre rebaptise a un nouveau GUID", () => {
  const json = JSON.parse(readFileSync(new URL("../public/models/hospital/legere/architectural.json", import.meta.url), "utf8"));
  const v1 = elementsDepuisJson(json, { id: "hosp-arch", label: "Architecture" });
  const portes = v1.filter((e) => e.typeIfc === "IfcDoor");
  const retire = portes[0];
  const rebaptise = portes[1];
  const v2 = v1.filter((e) => e.id !== retire.id).map((e) => (e.id === rebaptise.id ? { ...e, id: "NOUVEAU-GUID" } : e));
  const r = comparerVersions(v1, v2);
  const parAncien = new Map(r.propositions.map((p) => [p.ancien.id, p]));
  assert.equal(parAncien.get(retire.id).sorte === "disparu" || parAncien.get(retire.id).sorte === "ambigu", true);
  assert.ok(parAncien.has(rebaptise.id));
  assert.ok(parAncien.get(rebaptise.id).nouveaux.some((n) => n.id === "NOUVEAU-GUID"));
  assert.equal(r.resume.inchanges, v1.filter((e) => e.typeIfc !== "IfcProject" && e.typeIfc !== "IfcSite" && e.typeIfc !== "IfcBuilding" && e.typeIfc !== "IfcBuildingStorey" && e.typeIfc !== "IfcSpace").length - 2);
});
