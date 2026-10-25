// Tests du flux « appliquer puis confirmer ou annuler » (src/discussionsIAFlux.js) avec une FAUSSE messagerie.
import test from "node:test";
import assert from "node:assert/strict";
import { creerFlux, resumerResultat, MESSAGE_RAPPORT_VIDE } from "../src/discussionsIAFlux.js";

const retour = (nom, extra = {}) => ({
  ok: true, type: "liste", relecture: "Relecture " + nom, resultat: { fils: [{ cle: nom }], surlignes: ["a", "b"], termes: [] }, ...extra
});
const nouveau = () => {
  const journal = [];
  const messagerie = { appliquerFiltreIA: (f) => journal.push(["appliquer", f.relecture, f.type]), retirerFiltreIA: () => journal.push(["retirer"]) };
  return { flux: creerFlux({ messagerie }), journal };
};

test("proposer : applique tout de suite et rend la relecture et le compte rendu pour le bandeau", () => {
  const { flux, journal } = nouveau();
  const r = flux.proposer(retour("A"), "phrase A");
  assert.deepEqual(r, { ok: true, type: "liste", relecture: "Relecture A", resume: "1 discussion, 2 messages trouvés." });
  assert.deepEqual(journal, [["appliquer", "Relecture A", "liste"]]);
  assert.equal(flux.enAttente(), true);
});

test("proposer : echec ou absence de resultat -> rien n'est applique", () => {
  const { flux, journal } = nouveau();
  assert.deepEqual(flux.proposer({ ok: false, message: "Rien." }), { ok: false, message: "Rien." });
  assert.equal(flux.proposer(null).ok, false);
  assert.deepEqual(journal, []);
  assert.equal(flux.enAttente(), false);
});

test("« Oui » : le filtre reste, plus rien n'attend", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  assert.equal(flux.accepter(), true);
  assert.equal(flux.enAttente(), false);
  assert.equal(flux.accepter(), false);
  assert.equal(journal.length, 1);
});

test("« Non » sans demande acceptee avant : le filtre est retire et la phrase rendue", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  assert.deepEqual(flux.refuser(), { phrase: "pA" });
  assert.deepEqual(journal.at(-1), ["retirer"]);
  assert.equal(flux.refuser(), null);
});

test("« Non » apres une demande acceptee : la precedente est rappliquee, pas la liste complete", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  flux.accepter();
  flux.proposer(retour("B"), "pB");
  assert.deepEqual(flux.refuser(), { phrase: "pB" });
  assert.deepEqual(journal.at(-1), ["appliquer", "Relecture A", "liste"]);
});

test("« Tout reafficher » : retire le filtre et oublie le point de retour", () => {
  const { flux, journal } = nouveau();
  flux.proposer(retour("A"), "pA");
  flux.accepter();
  flux.toutReafficher();
  assert.deepEqual(journal.at(-1), ["retirer"]);
  flux.proposer(retour("B"), "pB");
  flux.refuser();
  assert.deepEqual(journal.at(-1), ["retirer"]); // plus de A a retrouver
});

test("resumerResultat : singulier, pluriel, repli, rapport et rapport vide", () => {
  assert.equal(resumerResultat(retour("A", { resultat: { fils: [{}, {}], surlignes: ["a"] } })), "2 discussions, 1 message trouvé.");
  assert.equal(resumerResultat(retour("A", { resultat: { fils: [{}], surlignes: [] } })), "1 discussion.");
  assert.match(resumerResultat(retour("A", { repli: "Sans l'IA." })), /Sans l'IA\.$/);
  assert.match(resumerResultat(retour("A", { type: "rapport", rapport: { vide: false } })), /Rapport prêt/);
  assert.equal(resumerResultat(retour("A", { type: "rapport", rapport: { vide: true } })), MESSAGE_RAPPORT_VIDE);
});
