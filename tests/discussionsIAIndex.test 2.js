// Tests de l'index des discussions (src/discussionsIAIndex.js) et des actions locales du moteur, sur un jeu a la main aux resultats previsibles.
import test from "node:test";
import assert from "node:assert/strict";
import { indexer, cleFil, cleMessage, lireCleMessage, filImplique } from "../src/discussionsIAIndex.js";
import { REGISTRE, validerCommande, selectionner, resultatLocal } from "../src/discussionsIAMoteur.js";
import { fixture, MAINTENANT } from "./aide/fixtureDiscussions.js";

const donnees = fixture();
const index = indexer(donnees.conversations, donnees.personnes);
const contexte = { maintenant: MAINTENANT };
const valeurs = { personnes: index.personnes.map((p) => p.nom) };
const lancer = (action, parametres) => {
  const v = validerCommande({ action, parametres }, valeurs);
  assert.equal(v.ok, true, v.erreur);
  return selectionner(v.commande, index, contexte);
};

test("index : fils, messages ecrits seulement (le journal est ignore), personnes sans l'utilisateur", () => {
  assert.equal(index.fils.length, 5); // 2 principaux + 3 sujets
  assert.equal(index.messages.length, 11); // 2 + 3 + 2 + 2 + 2 : la cloture du journal n'est pas comptee
  assert.deepEqual(index.personnes.map((p) => p.nom), ["Ana Roux", "Bob Lenoir"]);
  assert.equal(index.messages.some((m) => m.texte === ""), false);
});

test("index : cles de fil et de message, aller-retour", () => {
  assert.equal(cleFil("g", "s2"), "g/s2");
  assert.equal(cleFil("g", null), "g/");
  const mk = cleMessage(cleFil("g", "s2"), 1);
  assert.deepEqual(lireCleMessage(mk), { convId: "g", sujetId: "s2", position: 1 });
  assert.deepEqual(lireCleMessage("ana/#0"), { convId: "ana", sujetId: null, position: 0 });
  for (const mauvais of [null, "", "abc", "a/b#x", 12]) assert.equal(lireCleMessage(mauvais), null);
  assert.ok(index.parCle.get("g/s2#1"));
});

test("index : la position est celle du tableau du fil, journal compris", () => {
  // Le sujet clos a deux messages puis un evenement : positions 0 et 1.
  assert.ok(index.parCle.get("g/s3#1"));
  assert.equal(index.parCle.get("g/s3#2"), undefined);
});

test("index : filImplique (interlocuteur, tague, auteur, mention ; pas simple membre)", () => {
  const f = (cle) => index.filParCle.get(cle);
  assert.equal(filImplique(f("ana/"), "ana"), true);
  assert.equal(filImplique(f("ana/s1"), "bob"), false);
  assert.equal(filImplique(f("g/s2"), "ana"), true); // mentionnee
  assert.equal(filImplique(f("g/s3"), "ana"), false); // membre du groupe, mais ni taguee ni presente dans le sujet
});

test("echanges_avec : fils d'un 1 a 1 et sujets tagues, messages de la personne mis en evidence", () => {
  const s = lancer("echanges_avec", { personne: "Ana Roux" });
  const r = resultatLocal(s, index);
  const cles = r.fils.map((f) => f.cle).sort();
  assert.deepEqual(cles, ["ana/", "ana/s1", "g/", "g/s2"]); // ana ecrit dans le principal du groupe ; mentionnee dans s2
  const s1 = r.fils.find((f) => f.cle === "ana/s1");
  assert.equal(s1.total, 3); // tout le fil est un echange avec elle
  assert.deepEqual(s1.mis, ["ana/s1#1"]); // mais seul son message est mis en evidence
});

test("echanges_avec : filtre de periode", () => {
  const s = lancer("echanges_avec", { personne: "Ana Roux", periode: { type: "depuis", nombre: 4, unite: "jour" } });
  const r = resultatLocal(s, index);
  assert.deepEqual(r.fils.map((f) => f.cle).sort(), ["g/", "g/s2"]);
  assert.ok(s.messages.every((m) => m.quand >= MAINTENANT - 4 * 86400000));
});

test("echanges_avec : personne sans echange -> aucun message", () => {
  const s = lancer("echanges_avec", { personne: "Bob Lenoir", periode: { type: "avant", date: "2020-01-01" } });
  assert.equal(s.messages.length, 0);
});

test("etat_discussions : non lus, mis en evidence sur les derniers messages recus", () => {
  const s = lancer("etat_discussions", { nonLus: true });
  assert.equal(s.mis.size, 3); // 2 non lus dans le principal du groupe, 1 dans le sujet
  const r = resultatLocal(s, index);
  assert.deepEqual(r.fils.map((f) => f.cle).sort(), ["g/", "g/s2"]);
  assert.deepEqual(r.fils.find((f) => f.cle === "g/s2").mis, ["g/s2#1"]);
});

test("etat_discussions : statuts, urgent, personne ; le principal n'a pas de statut", () => {
  assert.deepEqual(resultatLocal(lancer("etat_discussions", { statuts: ["ouvert", "encours", "attente"] }), index).fils.map((f) => f.cle).sort(), ["ana/s1", "g/s2"]);
  assert.deepEqual(resultatLocal(lancer("etat_discussions", { statuts: ["clos"] }), index).fils.map((f) => f.cle), ["g/s3"]);
  assert.deepEqual(resultatLocal(lancer("etat_discussions", { urgent: true }), index).fils.map((f) => f.cle), ["g/s2"]);
  assert.deepEqual(resultatLocal(lancer("etat_discussions", { statuts: ["ouvert", "encours"], personne: "Bob Lenoir" }), index).fils.map((f) => f.cle), ["g/s2"]);
});

test("etat_discussions : aucun filtre = commande refusee", () => {
  const v = validerCommande({ action: "etat_discussions", parametres: {} }, valeurs);
  assert.equal(v.ok, false);
});

test("activite_periode : messages de la periode, option personne", () => {
  const s = lancer("activite_periode", { periode: { type: "depuis", nombre: 4, unite: "jour" } });
  assert.deepEqual(s.messages.map((m) => m.mk).sort(), ["g/#0", "g/#1", "g/s2#0", "g/s2#1"]);
  const p = lancer("activite_periode", { periode: { type: "depuis", nombre: 4, unite: "jour" }, personne: "Bob Lenoir" });
  assert.ok(p.messages.length > 0 && p.messages.every((m) => m.auteur === "bob" || index.filParCle.get(m.filCle).tagues.includes("bob") || index.filParCle.get(m.filCle).interlocuteur === "bob"));
});

test("validerCommande : action inconnue, personne inconnue, periode invalide, parametres absents", () => {
  const cas = [
    [{ action: "supprimer", parametres: {} }, /Action inconnue/],
    [{ action: "echanges_avec", parametres: { personne: "Zoé Inconnue" } }, /Personne inconnue/],
    [{ action: "echanges_avec", parametres: {} }, /personne est absente/],
    [{ action: "echanges_avec", parametres: { personne: "Ana Roux", periode: { type: "depuis", nombre: 0, unite: "jour" } } }, /nombre/],
    [{ action: "echanges_avec", parametres: { personne: "Ana Roux", periode: { type: "depuis_le", date: "2026-02-30" } } }, /Date invalide/],
    [{ action: "retrouver_echange", parametres: { sujet: "   " } }, /sujet est absent/],
    [{ action: "etat_discussions", parametres: { statuts: ["archive"] } }, /Statut inconnu/],
    [null, /absente/], ["x", /absente/], [[], /absente/]
  ];
  for (const [commande, motif] of cas) {
    const v = validerCommande(commande, valeurs);
    assert.equal(v.ok, false, JSON.stringify(commande));
    assert.match(v.erreur, motif);
  }
});

test("validerCommande : nom de personne insensible a la casse, remis tel qu'ecrit dans la messagerie ; mots bornes", () => {
  const v = validerCommande({ action: "retrouver_echange", parametres: { sujet: " grue ", mots: ["levage", "levage", " ", 3, "x".repeat(41), "a", "b", "c", "d", "e", "f"], personne: "ana roux" } }, valeurs);
  assert.equal(v.ok, true);
  assert.equal(v.commande.parametres.personne, "Ana Roux");
  assert.equal(v.commande.parametres.sujet, "grue");
  assert.ok(v.commande.parametres.mots.length <= 6 && !v.commande.parametres.mots.includes("x".repeat(41)));
});

test("registre : toutes les actions sont lisibles, une action ajoutee = un enregistrement", () => {
  assert.deepEqual(REGISTRE.noms(), ["echanges_avec", "retrouver_echange", "rapport", "etat_discussions", "activite_periode"]);
  assert.throws(() => REGISTRE.enregistrer({ nom: "rapport", parametres: [], sortie: "liste", selectionner() {} }), /déjà enregistrée/);
});
