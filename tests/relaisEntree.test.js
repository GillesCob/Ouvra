// Tests de la validation d'entree du relais (relais/entree.js) : ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { validerEntree, PHRASE_MAX } from "../relais/entree.js";

const valeurs = () => ({
  typesIfc: ["IfcDuctSegment", "IfcWallStandardCase"],
  niveaux: ["Level 1", "Level 2"],
  maquettes: ["Architecture", "Mechanical (CVC)"],
  noms: ["Diffuser:Supply Diffuser"],
  priorite: ["urgente", "haute", "normale", "basse"],
  statut: ["nouveau", "confirme", "ecarte"]
});
const corps = (surcharge = {}) => ({ phrase: "Passe en urgent les gaines", valeurs: valeurs(), ...surcharge });

test("entree valide : phrase et valeurs conservees", () => {
  const r = validerEntree(corps());
  assert.equal(r.ok, true);
  assert.equal(r.phrase, "Passe en urgent les gaines");
  assert.deepEqual(r.valeurs.typesIfc, ["IfcDuctSegment", "IfcWallStandardCase"]);
});

test("entree absente ou qui n'est pas un objet", () => {
  for (const mauvais of [null, undefined, "texte", 12, []]) {
    const r = validerEntree(mauvais);
    assert.equal(r.ok, false);
    assert.equal(r.code, "entree_invalide");
  }
});

test("phrase vide, faite d'espaces ou absente", () => {
  for (const phrase of ["", "   ", "\n\t", undefined, null]) {
    const r = validerEntree(corps({ phrase }));
    assert.equal(r.ok, false);
    assert.equal(r.code, "entree_invalide");
  }
});

test("phrase qui n'est pas du texte", () => {
  for (const phrase of [42, ["a"], { a: 1 }, true]) assert.equal(validerEntree(corps({ phrase })).ok, false);
});

test("limite de longueur : 200 caracteres passent, 201 non", () => {
  assert.equal(PHRASE_MAX, 200);
  assert.equal(validerEntree(corps({ phrase: "a".repeat(200) })).ok, true);
  const r = validerEntree(corps({ phrase: "a".repeat(201) }));
  assert.equal(r.ok, false);
  assert.equal(r.code, "entree_invalide");
});

test("espaces de bord retires, espaces internes repetes reduits", () => {
  assert.equal(validerEntree(corps({ phrase: "  passe   en  urgent \n" })).phrase, "passe en urgent");
});

test("valeurs absentes ou mal formees", () => {
  assert.equal(validerEntree(corps({ valeurs: undefined })).ok, false);
  assert.equal(validerEntree(corps({ valeurs: "x" })).ok, false);
  const v = valeurs();
  v.typesIfc = "IfcWall";
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
});

test("liste trop longue ou element trop long ou element qui n'est pas du texte", () => {
  let v = valeurs();
  v.typesIfc = Array.from({ length: 41 }, (_, i) => "Ifc" + i);
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
  v = valeurs();
  v.noms = Array.from({ length: 16 }, (_, i) => "nom" + i);
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
  v = valeurs();
  v.niveaux = ["x".repeat(81)];
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
  v = valeurs();
  v.niveaux = [3];
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
});

test("valeurs d'action obligatoires (priorite et statut non vides)", () => {
  let v = valeurs();
  v.priorite = [];
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
  v = valeurs();
  delete v.statut;
  assert.equal(validerEntree(corps({ valeurs: v })).ok, false);
});

test("listes de criteres facultatives (maquette pas chargee) : vides acceptees", () => {
  const v = valeurs();
  v.noms = [];
  v.niveaux = [];
  assert.equal(validerEntree(corps({ valeurs: v })).ok, true);
});

test("doublons et chaines vides retires", () => {
  const v = valeurs();
  v.niveaux = ["Level 1", "Level 1", "", "  "];
  assert.deepEqual(validerEntree(corps({ valeurs: v })).valeurs.niveaux, ["Level 1"]);
});

test("aucun champ inconnu ne traverse (la geometrie ne passe jamais)", () => {
  const v = valeurs();
  v.geometrie = [[0, 0, 0]];
  const r = validerEntree(corps({ valeurs: v, points: [1, 2, 3] }));
  assert.equal(r.ok, true);
  assert.equal(r.valeurs.geometrie, undefined);
  assert.equal(r.points, undefined);
});
