// Rapport modele de la demo (28/10) : un rapport au format fixe, construit sur les VRAIS messages de demonstration, affiche sans appel a l'IA.
// Les dates des messages de demonstration sont relatives au jour d'ouverture : le modele doit se construire (et se verifier) a chaque ouverture.
import test from "node:test";
import assert from "node:assert/strict";
import { indexer } from "../src/discussionsIAIndex.js";
import { construireRapportModele, construireRapportModeleCoupeFeu, PHRASE_MODELE } from "../src/discussionsIARapportModele.js";
import { EXEMPLES_DISCUSSIONS } from "../src/discussionsIAExemples.js";
import { rapportEnTexte } from "../src/discussionsIARapportFormat.js";
import { chargerDemo } from "./aide/demoMessagerie.js";

async function modeleAu(jour) {
  const maintenant = new Date(jour);
  const demo = await chargerDemo(maintenant);
  return construireRapportModele(indexer(demo.conversations, demo.personnes), { maintenant: maintenant.getTime() });
}

test("modele : la phrase du modele est une phrase toute faite de Discussions (le rapport de la demo)", () => {
  assert.ok(EXEMPLES_DISCUSSIONS.some((e) => e.demande === PHRASE_MODELE && e.commande.action === "rapport"));
});

test("modele : format fixe complet, decision prise et chaque bloc confirme par les messages", async () => {
  const r = await modeleAu("2026-10-28T09:00:00");
  assert.equal(r.ok, true);
  const rapport = r.rapport;
  assert.equal(rapport.modele, true);
  assert.equal(rapport.vide, false);
  assert.match(rapport.titre, /gaine rectangulaire et la cloison/);
  assert.equal(rapport.contexte.confirme, true);
  assert.match(rapport.contexte.texte, /123 mm/);
  assert.deepEqual(rapport.intervenants, ["Sophie Lambert", "Vous"]);
  assert.equal(rapport.desaccords.length, 1);
  assert.equal(rapport.desaccords[0].confirme, true);
  assert.equal(rapport.decision.statut, "prise");
  assert.equal(rapport.decision.confirme, true);
  assert.match(rapport.decision.texte, /Ne pas trancher sans métré/);
  assert.equal(rapport.chronologie.length, 7);
});

test("modele : meme rapport quel que soit le jour d'ouverture (dates relatives, sources retrouvees par leur texte)", async () => {
  const a = await modeleAu("2026-10-28T09:00:00");
  const b = await modeleAu("2026-11-03T09:00:00");
  assert.equal(b.ok, true);
  assert.equal(b.rapport.chronologie.length, 7);
  assert.equal(b.rapport.decision.confirme, true);
  assert.equal(b.rapport.contexte.texte, a.rapport.contexte.texte);
});

test("modele : la version texte (bouton Copier) reste lisible et ne contient aucun tiret quadratin", async () => {
  const r = await modeleAu("2026-10-28T09:00:00");
  const texte = rapportEnTexte(r.rapport);
  assert.match(texte, /DÉCISION FINALE/);
  assert.equal(texte.includes(String.fromCharCode(0x2014)), false);
});

test("modele : sans les messages de demonstration (index vide), pas de rapport invente", () => {
  const r = construireRapportModele(indexer([], []), { maintenant: Date.now() });
  assert.equal(r.ok, false);
});

test("second modele (coupe-feu R+2) : se construit, decision prise, sources retrouvees sur les vrais messages", async () => {
  const maintenant = new Date("2026-10-28T09:00:00");
  const demo = await chargerDemo(maintenant);
  const r = construireRapportModeleCoupeFeu(indexer(demo.conversations, demo.personnes), { maintenant: maintenant.getTime() });
  assert.equal(r.ok, true, r.erreur);
  assert.equal(r.rapport.modele, true);
  assert.equal(r.rapport.contexte.confirme, true);
  assert.equal(r.rapport.decision.confirme, true);
  assert.deepEqual(r.rapport.intervenants, ["Claire Martin", "Vous"]);
});

test("second modele : index vide, pas de rapport invente", () => {
  assert.equal(construireRapportModeleCoupeFeu(indexer([], []), { maintenant: Date.now() }).ok, false);
});
