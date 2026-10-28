// Refus d'une demande IA (28/10) : « Critère introuvable. » est ajouté devant le message du relais UNE SEULE FOIS (le relais ou le modele peut deja l'ecrire :
// incoherence R-36 relevee par la recette du 27/10, le message apparaissait deux fois de suite dans la modale).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { messageRefus } from "../src/iaSaisieLogique.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("messageRefus : critere introuvable -> la formule est ajoutee devant le message", () => {
  assert.equal(messageRefus("critere_introuvable", "Aucun ascenseur dans les maquettes."), "Critère introuvable. Aucun ascenseur dans les maquettes.");
});

test("messageRefus : le message commence deja par la formule (casse, accents, ponctuation) -> jamais de doublon", () => {
  for (const deja of ["Critère introuvable. Aucun ascenseur.", "critere introuvable : aucun ascenseur.", "CRITÈRE INTROUVABLE, aucun ascenseur."]) {
    assert.equal(messageRefus("critere_introuvable", deja), deja);
  }
});

test("messageRefus : message vide -> la formule seule, sans espace en trop", () => {
  assert.equal(messageRefus("critere_introuvable", ""), "Critère introuvable.");
  assert.equal(messageRefus("critere_introuvable", undefined), "Critère introuvable.");
});

test("messageRefus : autre resultat (non comprise) -> le message tel quel", () => {
  assert.equal(messageRefus("non_comprise", "Je n'ai pas compris."), "Je n'ai pas compris.");
});

test("les trois entrees IA (Viewer, regles, Discussions) passent par messageRefus, plus de formule copiee", () => {
  for (const f of ["src/commandesIA.js", "src/reglesIA.js", "src/discussionsIAPipeline.js"]) {
    const code = lire(f);
    assert.ok(code.includes("messageRefus("), f);
    assert.equal(code.includes('"Critère introuvable. "'), false, f + " : formule recopiee");
  }
});
