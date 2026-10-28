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
  assert.match(js, /htmlChoix\("msgChoixConv", "choisir-conv"/);
  assert.match(js, /htmlChoix\("msgAjSujet", "choisir-sujet-ajout"/);
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
  assert.match(js, /"choisir-sujet-ajout"/);
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

import { defilementVersTitre } from "../src/discussionsIARapportDefilement.js";

test("rapport : le titre du menu ouvert monte en haut de la zone visible, avec rembourrage si le rapport est trop court", () => {
  // Titre a 400 px, zone a 0, defilement 100, max 500 : on defile de 392 (marge 8 px), pas de rembourrage.
  assert.deepEqual(defilementVersTitre({ haut: 400, zoneHaut: 0, scrollTop: 100, scrollMax: 500 }), { top: 492, rembourrage: 0 });
  // Fin de rapport : le defilement maximal ne suffit pas, le rembourrage comble l'ecart.
  assert.deepEqual(defilementVersTitre({ haut: 400, zoneHaut: 0, scrollTop: 100, scrollMax: 300 }), { top: 492, rembourrage: 192 });
  // Titre deja plus haut que la cible : defilement vers le haut, jamais negatif.
  assert.deepEqual(defilementVersTitre({ haut: 10, zoneHaut: 60, scrollTop: 30, scrollMax: 500 }), { top: 0, rembourrage: 0 });
  assert.deepEqual(defilementVersTitre({ haut: NaN, zoneHaut: 0, scrollTop: 0, scrollMax: 0 }), { top: 0, rembourrage: 0 });
});

test("rapport mobile : arriere-plan fige (classe sur le corps, glissements annules hors de la zone defilante)", () => {
  assert.match(rapportCss, /body\.disc-rapport-ouvert\s*\{[^}]*overflow:\s*hidden/);
  assert.match(rapportVue, /verrou\.verrouiller\(\)/);
  assert.match(rapportVue, /verrou\.deverrouiller\(\)/);
});

test("M17 : en mode resultat le panneau IA cede la place a la liste, et « Oui » rouvre le rapport propose s'il a ete ferme", () => {
  assert.match(lire("src/discussionsIA.css"), /max-width: 768px\) \{ \.msg-lateral\.msg-ia-resultat \.msg-ia-panneau\s*\{\s*display:\s*none/);
  const montage = lire("src/discussionsIAMontage.js");
  assert.match(montage, /rapportEnAttente && !rapportVue\.ouvert\(\) && window\.matchMedia\(REQUETE_MOBILE\)\.matches\) rapportVue\.ouvrir\(rapportEnAttente\)/);
});

test("M20/M21 : menus du dialogue = <select> toujours rendu, habille par habillerSelect (menu commun sur mobile), premier message sur 2 lignes qui grandit", () => {
  assert.match(js, /function htmlChoix[^]*?return '<select id="'/); // un seul <select>, laptop inchange
  assert.match(js, /habillerSelect\(sel, menuChoix, \{ titre: sel\.dataset\.titre \}\)/);
  assert.doesNotMatch(js, /data-act="menu-choix"|etatChoix/); // plus de doublon fait a la main
  assert.match(js, /<textarea id="msgNsMessage" rows="2">/);
  assert.match(css, /#msgNsMessage\s*\{[^}]*max-height:\s*40vh/);
});
