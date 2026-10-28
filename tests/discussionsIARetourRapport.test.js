// Retour au rapport (28/10) : depuis une source du rapport, la discussion s'ouvre au message cite ET un bandeau « ← Retour au rapport » rouvre le MEME rapport,
// sur le modele du bandeau « ← Retour a la conversation » (Viewer) : composant commun src/retourContexte.js, un seul bandeau de retour a la fois.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerCoeurRetour } from "../src/retourContexte.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("la vue du rapport donne le rapport courant au rappel de source (le retour rouvre le meme rapport)", () => {
  assert.ok(lire("src/discussionsIARapportVue.js").includes("surSource(mk, rapportCourant)"));
});

test("montage : un clic sur une source ouvre le message puis montre le bandeau « Retour au rapport » qui rouvre le rapport", () => {
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(montage.includes('id: "discussionsRapportBandeauRetour"'));
  assert.ok(montage.includes("messagerie.montrerMessageIA(mk)"));
  assert.ok(montage.includes('libelle: "Retour au rapport"'));
  assert.ok(montage.includes("rapportVue.ouvrir(rapport)"));
  assert.ok(montage.includes("effacerRetour"));
});

test("bandeau : un seul bandeau de retour a la fois (le plus recent gagne) et celui de l'IA « Est-ce bien votre demande ? » prend la place", () => {
  const montage = lire("src/discussionsIAMontage.js");
  for (const classe of ["msg-retour-actif", "regles-retour-actif", "quantitatif-retour-actif", "plan3d-retour-actif", "discussions-confirm-actif"]) assert.ok(montage.includes('"' + classe + '"'), classe);
});

test("main : quitter la page Discussions efface le bandeau de retour au rapport", () => {
  assert.ok(lire("src/main.js").includes('viewName !== "discussions"') && lire("src/main.js").includes("discussionsIA.effacerRetour()"));
});

test("css : le bandeau a le meme placement que les autres bandeaux de retour et la page Discussions descend d'autant", () => {
  const css = lire("src/discussionsIA.css");
  assert.match(css, /#discussionsRapportBandeauRetour \{[^}]*position: fixed; top: 52px;[^}]*height: 44px/);
  assert.match(css, /body\.disc-rapport-retour-actif #view-discussions \{[^}]*padding-top: 44px/);
});

test("coeur : « Retour au rapport » appelle le rappel une seule fois et disparait", () => {
  const coeur = creerCoeurRetour();
  let appels = 0;
  coeur.montrer({ libelle: "Retour au rapport", surRetour: () => { appels += 1; } });
  assert.equal(coeur.actif(), true);
  coeur.declencher();
  coeur.declencher();
  assert.equal(appels, 1);
  assert.equal(coeur.actif(), false);
});

test("panneau de gauche (28/10) : aucun bouton « Voir le rapport » ni action « rapport » ; le rapport s'ouvre seul a la fin de la demande", () => {
  const messagerie = lire("src/messagerie/messagerie.js");
  assert.ok(!messagerie.includes("Voir le rapport</button>") && !messagerie.includes('data-act="ia-rapport"') && !messagerie.includes('case "ia-rapport"'));
  const montage = lire("src/discussionsIAMontage.js");
  assert.ok(!montage.includes('nom === "rapport"'));
  assert.match(montage, /application\.type === "rapport"\) rapportVue\.ouvrir\(retour\.rapport\)/);
  assert.ok(montage.includes('libelle: "Retour au rapport"'));
});
