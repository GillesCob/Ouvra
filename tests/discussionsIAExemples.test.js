// Les phrases toutes faites doivent marcher sur les VRAIES donnees de demonstration de la messagerie : chacune est une commande valide et trouve
// au moins un resultat (pour une recherche par sujet ou un rapport : au moins un message candidat a envoyer a l'analyse).
import test from "node:test";
import assert from "node:assert/strict";
import { EXEMPLES_DISCUSSIONS, reconnaitreExemple } from "../src/discussionsIAExemples.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { REGISTRE, validerCommande, selectionner } from "../src/discussionsIAMoteur.js";
const PHRASE_RAPPORT_GENERAL = "Fais-moi un rapport sur les collisions avec les gaines";
import { chargerDemo } from "./aide/demoMessagerie.js";

const demo = await chargerDemo(new Date("2026-10-24T12:00:00"));
const index = indexer(demo.conversations, demo.personnes);
const valeurs = { personnes: index.personnes.map((p) => p.nom) };
const maintenant = new Date("2026-10-24T12:00:00").getTime();

test("exemples : 6 a 10 phrases, toutes distinctes", () => {
  assert.ok(EXEMPLES_DISCUSSIONS.length >= 6 && EXEMPLES_DISCUSSIONS.length <= 10);
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
  const e = EXEMPLES_DISCUSSIONS.find((x) => x.demande === "Montre-moi tous les échanges avec Sophie Lambert");
  const r = reconnaitreExemple("  montre-moi TOUS les echanges avec sophie lambert ! ");
  assert.equal(r.action, e.commande.action);
  assert.deepEqual(r.parametres, e.commande.parametres);
  assert.equal(r.relecture, e.relecture);
});

test("reconnaitreExemple : phrase differente, vide ou absente -> null", () => {
  for (const p of ["Montre-moi les échanges avec Karim", "", "   ", null, undefined]) assert.equal(reconnaitreExemple(p), null);
});

test("ordre de la demo (28/10) : le rapport general ouvre la liste, puis la recherche, puis le rapport specifique", () => {
  assert.equal(EXEMPLES_DISCUSSIONS[0].demande, PHRASE_RAPPORT_GENERAL);
  assert.equal(EXEMPLES_DISCUSSIONS[1].demande, "Sors-moi toutes les conversations qui parlent de gaines en R+2");
  assert.equal(EXEMPLES_DISCUSSIONS[2].demande, "Fais-moi un rapport sur la collision entre la gaine et la cloison");
  assert.equal(EXEMPLES_DISCUSSIONS[1].commande.action, "retrouver_echange");
});

test("rapport general (28/10) : sujet general, reconnu en local, retient les messages sur les gaines au R+2 de la demo", () => {
  const e = EXEMPLES_DISCUSSIONS[0];
  assert.equal(e.commande.action, "rapport");
  assert.equal(e.commande.parametres.sujet, "collisions avec les gaines");
  const r = reconnaitreExemple("fais-moi un rapport sur les collisions avec les gaines");
  assert.deepEqual(r.parametres, e.commande.parametres);
  assert.equal(r.relecture, "Faire un rapport sur les collisions avec les gaines.");
  const ancienne = reconnaitreExemple("Fais-moi un rapport sur les collisions avec les gaines au R+2");
  assert.deepEqual(ancienne.parametres, e.commande.parametres, "l'ancienne phrase avec « au R+2 » reste reconnue");
  assert.deepEqual(ancienne.demandeIA, r.demandeIA);
  const v = validerCommande(e.commande, valeurs);
  assert.equal(v.ok, true);
  const s = selectionner(v.commande, index, { maintenant });
  assert.ok(s.messages.length >= 10, "messages retenus : " + s.messages.length);
  const textes = s.messages.map((m) => m.texte).join("\n");
  assert.ok(textes.includes("la gaine rectangulaire, avec ses coudes et ses piquages"));
  assert.ok(s.messages.some((m) => m.convId === "sophie" && m.sujetId === "s1"), "le sujet s1 de la conversation avec Sophie est retenu");
});
