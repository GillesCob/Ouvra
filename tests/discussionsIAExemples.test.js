// Les phrases toutes faites doivent marcher sur les VRAIES donnees de demonstration de la messagerie : chacune est une commande valide et trouve
// au moins un resultat (pour une recherche par sujet ou un rapport : au moins un message candidat a envoyer a l'analyse).
import test from "node:test";
import assert from "node:assert/strict";
import { EXEMPLES_DISCUSSIONS, reconnaitreExemple } from "../src/discussionsIAExemples.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { REGISTRE, validerCommande, selectionner } from "../src/discussionsIAMoteur.js";
import { chargerDemo } from "./aide/demoMessagerie.js";

const demo = await chargerDemo(new Date("2026-10-24T12:00:00"));
const index = indexer(demo.conversations, demo.personnes);
const valeurs = { personnes: index.personnes.map((p) => p.nom) };
const maintenant = new Date("2026-10-24T12:00:00").getTime();

test("exemples : 6 a 8 phrases, toutes distinctes", () => {
  assert.ok(EXEMPLES_DISCUSSIONS.length >= 6 && EXEMPLES_DISCUSSIONS.length <= 8);
  assert.equal(new Set(EXEMPLES_DISCUSSIONS.map((e) => e.demande)).size, EXEMPLES_DISCUSSIONS.length);
});

test("exemples : chacun est une commande valide du registre sur les vraies personnes", () => {
  for (const e of EXEMPLES_DISCUSSIONS) {
    const v = validerCommande(e.commande, valeurs);
    assert.equal(v.ok, true, e.demande + " : " + v.erreur);
  }
});

test("exemples : chacun trouve au moins un resultat dans les donnees de demonstration", () => {
  for (const e of EXEMPLES_DISCUSSIONS) {
    const v = validerCommande(e.commande, valeurs);
    const s = selectionner(v.commande, index, { maintenant });
    assert.equal(s.erreur, undefined, e.demande);
    assert.ok(s.messages.length > 0, "aucun résultat pour : " + e.demande);
  }
});

test("exemples : les trois types demandes, plus un etat, sont representes", () => {
  const actions = new Set(EXEMPLES_DISCUSSIONS.map((e) => e.commande.action));
  for (const a of ["echanges_avec", "retrouver_echange", "rapport", "etat_discussions"]) assert.ok(actions.has(a), a);
  for (const a of actions) assert.ok(REGISTRE.obtenir(a), a);
});

test("exemples : les noms cites existent vraiment dans la messagerie", () => {
  const noms = new Set(valeurs.personnes);
  for (const e of EXEMPLES_DISCUSSIONS) if (e.commande.parametres.personne) assert.ok(noms.has(e.commande.parametres.personne), e.demande);
});

test("reconnaitreExemple : meme phrase a la casse, aux accents et a la ponctuation pres -> commande, sans IA", () => {
  const e = EXEMPLES_DISCUSSIONS[0];
  const r = reconnaitreExemple("  montre-moi TOUS les echanges avec sophie lambert ! ");
  assert.equal(r.action, e.commande.action);
  assert.deepEqual(r.parametres, e.commande.parametres);
  assert.equal(r.relecture, e.relecture);
});

test("reconnaitreExemple : phrase differente, vide ou absente -> null", () => {
  for (const p of ["Montre-moi les échanges avec Karim", "", "   ", null, undefined]) assert.equal(reconnaitreExemple(p), null);
});
