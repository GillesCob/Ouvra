// Retours de recette mobile du 28/10 sur Discussions (M1 a M3, M6 a M8, M22, M23, M25 a M28) : verifications sur le code source (la mise en page est mesuree en navigateur).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const js = lire("src/messagerie/messagerie.js");
const css = lire("src/messagerie/messagerie.css");
const rapportCss = lire("src/discussionsIA.css");
const rapportVue = lire("src/discussionsIARapportVue.js");

test("M3 : le bouton « Fermer » du rapport a un texte blanc", () => {
  assert.match(rapportCss, /\.disc-rapport-fermer\s*\{[^}]*color:\s*#fff/);
});

test("M1/M2 : sur mobile le rapport est une page pleine ecran, barre de boutons collee en bas", () => {
  const mobile = rapportCss.slice(rapportCss.indexOf("@media (max-width: 768px) {\n  /* Mobile (28/10"));
  assert.match(mobile, /\.disc-rapport-carte\s*\{[^}]*width:\s*100%;\s*height:\s*100%/);
  assert.match(mobile, /\.disc-rapport-pied\s*\{[^}]*position:\s*sticky;\s*bottom:\s*0/);
});

test("M1 : intervenants et sources en menus deroulants sur mobile, un seul name pour toute la page", () => {
  assert.match(rapportVue, /NOM_DEPLIANTS_PAGE = "ouvra-depliants"/);
  assert.match(rapportVue, /el\.name = NOM_DEPLIANTS_PAGE/);
  assert.match(rapportVue, /construireBloc\("intervenants", "Intervenants", true/);
  assert.match(rapportVue, /construireBloc\("sources", "Sources", true/);
});

test("M6/M27 : sur mobile, tout dialogue de la messagerie est une page pleine ecran", () => {
  const mobile = css.slice(css.indexOf("/* Dialogues (28/10, Gilles)"));
  assert.match(mobile, /\.msg-dialogue\s*\{[^}]*position:\s*fixed;\s*inset:\s*0/);
  assert.match(mobile, /\.msg-carte\.msg-carte-sujet\s*\{[^}]*height:\s*100dvh/);
});

test("M7/M8 puis retour du 29/10 : le type en boutons, puis la conversation et le sujet en menus deroulants, rien de preselectionne", () => {
  assert.match(js, /id="msgChoixConv" data-act="choisir-conv"/);
  assert.match(js, /id="msgAjSujet" data-act="choisir-sujet-ajout"/);
  assert.match(js, /PLACEHOLDER_CONVERSATION = "Choisir une conversation"/);
  assert.match(js, /data-act="type-conv"/);
  assert.match(js, /const idDefaut = choixConversation \? ""/);
  assert.match(js, /racine\.addEventListener\("change", surChangement\)/);
});

test("retours du 29/10 : le dialogue entre en fondu (meme duree que la liste), le message occupe l'espace libre", () => {
  assert.match(css, /\.msg-dialogue:not\(\[hidden\]\)\s*\{\s*animation:\s*msg-dialogue-entree 0\.3s ease-in-out/);
  assert.match(css, /\.msg-zone \.msg-corps > \.msg-champ-grand\s*\{\s*flex:\s*1 0 auto/);
});

test("M22 : le sujet ou ajouter la vue est un choix visible (principal et sujets non clos)", () => {
  assert.match(js, /data-act="choisir-sujet-ajout"/);
  assert.match(js, /c\.sujets\.filter\(\(s\) => s\.statut !== "clos"\)/);
});

test("M23 : un appui hors de la barre de recherche et de la loupe la ferme", () => {
  assert.match(js, /if \(!e\.target\.closest\("#msgBarreRecherche, \[data-act='recherche-conv'\]"\)\) fermerRecherche\(\)/);
});

test("M28 : sujet clos, ni champ ni bouton d'envoi, un bouton « Rouvrir la conversation »", () => {
  assert.match(js, /id="msgRouvrirConv" data-act="rouvrir" hidden>Rouvrir la conversation/);
  assert.match(js, /\[saisie, envoyer, boutonVue\]\.forEach\(\(el\) => \{ el\.hidden = clos; \}\)/);
});

test("M25/M26 : l'historique des syntheses est dans le panneau IA, une carte cliquable par synthese", () => {
  const ia = lire("src/discussionsIA.js");
  assert.match(ia, /msg-ia-histo-carte/);
  assert.match(ia, /carte\.addEventListener\("click", \(\) => historique\.ouvrir\(entree\)\)/);
  assert.match(lire("src/discussionsIAMontage.js"), /ajouterSynthese\(retour\.rapport\)/);
});

import { ajustementOuverture } from "../src/discussionsIARapportDefilement.js";

test("rapport mobile : le titre du menu ouvert reste en place, le contenu deplie est amene en vue sans cacher le titre", () => {
  const zone = { zoneHaut: 0, zoneBas: 700 };
  // Un menu au-dessus s'est replie : le titre est monte de 120 px, on le remet ou il etait.
  assert.equal(ajustementOuverture({ hautAvant: 300, haut: 180, bas: 400, ...zone }), -120);
  // Contenu qui depasse de 100 px sous la zone visible : defilement de 100 px, titre encore visible.
  assert.equal(ajustementOuverture({ hautAvant: 400, haut: 400, bas: 800, ...zone }), 100);
  // Contenu tres long : le titre ne passe jamais au-dessus de la zone (marge de 8 px).
  assert.equal(ajustementOuverture({ hautAvant: 200, haut: 200, bas: 2000, ...zone }), 192);
  assert.equal(ajustementOuverture({ hautAvant: NaN, haut: 1, bas: 2, ...zone }), 0);
});

test("rapport mobile : arriere-plan fige (classe sur le corps, glissements annules hors de la zone defilante)", () => {
  assert.match(rapportCss, /body\.disc-rapport-ouvert\s*\{[^}]*overflow:\s*hidden/);
  assert.match(rapportVue, /verrou\.verrouiller\(\)/);
  assert.match(rapportVue, /verrou\.deverrouiller\(\)/);
});
