// Historique des syntheses de conversation (28/10) : demonstration a la premiere utilisation, ajout, tri, bornes, stockage absent ou corrompu.
import test from "node:test";
import assert from "node:assert/strict";
import { listerSyntheses, ajouterSynthese, ajouterRecherche, dateSynthese, titreCarte, CLE_SYNTHESES, SYNTHESES_MAX } from "../src/discussionsIAHistorique.js";

const stockageMemoire = (initial = {}) => {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
};
const MAINTENANT = new Date("2026-10-28T12:00:00").getTime();
const rapport = (titre) => ({ titre, date: MAINTENANT, vide: false, contexte: { texte: "x", confirme: true, sources: [] } });

test("premiere utilisation : deux syntheses de demonstration, la plus recente d'abord, enregistrees", () => {
  const s = stockageMemoire();
  const l = listerSyntheses({ stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, 2);
  assert.ok(l[0].creeLe > l[1].creeLe);
  assert.ok(l.every((e) => e.demo && e.nom));
  assert.equal(JSON.parse(s.getItem(CLE_SYNTHESES)).length, 2);
});

test("les syntheses de demonstration ne reviennent pas une fois la cle ecrite", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  assert.deepEqual(listerSyntheses({ stockage: s, maintenant: MAINTENANT }), []);
});

test("ajout : le nouveau rapport est en tete, avec son nom et sa date, et survit a une relecture", () => {
  const s = stockageMemoire();
  const l = ajouterSynthese(rapport("Accès grue"), { stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, 3);
  assert.equal(l[0].nom, "Accès grue");
  assert.equal(dateSynthese(l[0]), "28/10/2026");
  assert.equal(listerSyntheses({ stockage: s, maintenant: MAINTENANT + 1000 })[0].nom, "Accès grue");
});

test("rapport vide, modele ou absent : rien n'est ajoute", () => {
  const s = stockageMemoire();
  const avant = listerSyntheses({ stockage: s, maintenant: MAINTENANT }).length;
  for (const r of [null, { ...rapport("v"), vide: true }, { ...rapport("m"), modele: true }]) {
    assert.equal(ajouterSynthese(r, { stockage: s, maintenant: MAINTENANT }).length, avant);
  }
});

test("borne : au-dela du maximum, les plus anciennes sont retirees", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  for (let i = 0; i < SYNTHESES_MAX + 5; i++) ajouterSynthese(rapport("R" + i), { stockage: s, maintenant: MAINTENANT + i * 1000 });
  const l = listerSyntheses({ stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, SYNTHESES_MAX);
  assert.equal(l[0].nom, "R" + (SYNTHESES_MAX + 4));
});

test("stockage absent, plein ou JSON corrompu : aucune exception", () => {
  assert.equal(listerSyntheses({ stockage: null, maintenant: MAINTENANT }).length, 2);
  const plein = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.equal(ajouterSynthese(rapport("A"), { stockage: plein, maintenant: MAINTENANT })[0].nom, "A");
  assert.deepEqual(listerSyntheses({ stockage: stockageMemoire({ [CLE_SYNTHESES]: "{pas du json" }), maintenant: MAINTENANT }), []);
  assert.deepEqual(listerSyntheses({ stockage: stockageMemoire({ [CLE_SYNTHESES]: JSON.stringify([{ id: 3 }, null, { id: "a", nom: "n", creeLe: 1 }]) }), maintenant: MAINTENANT }), []);
});

const recherche = (relecture, fils = [{ cle: "c1", convId: "c1", mis: ["m1"] }]) => ({ relecture, resultat: { fils, surlignes: ["m1"], termes: ["grue"], messages: 1 } });

test("recherche validee : une entree en tete avec le titre de la demande, la date, et le resultat stocke (jamais de rappel IA)", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  const l = ajouterRecherche(recherche("Retrouver l'échange sur l'accès de la grue"), { stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, 1);
  assert.equal(l[0].nom, "Retrouver l'échange sur l'accès de la grue");
  assert.equal(dateSynthese(l[0]), "28/10/2026");
  assert.equal(l[0].recherche.resultat.fils[0].cle, "c1");
  assert.equal(listerSyntheses({ stockage: s, maintenant: MAINTENANT })[0].recherche.relecture, "Retrouver l'échange sur l'accès de la grue");
});

test("recherche : une entree de rapport existante reste, la recherche passe devant", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  ajouterSynthese(rapport("Réservations"), { stockage: s, maintenant: MAINTENANT });
  const l = ajouterRecherche(recherche("Grue"), { stockage: s, maintenant: MAINTENANT + 1000 });
  assert.deepEqual(l.map((e) => e.nom), ["Grue", "Réservations"]);
  assert.ok(l[1].rapport && !l[1].recherche);
});

test("recherche repetee : pas de doublon, la date est mise a jour et le resultat remplace", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  ajouterRecherche(recherche("Grue"), { stockage: s, maintenant: MAINTENANT });
  const l = ajouterRecherche(recherche("  grue "), { stockage: s, maintenant: MAINTENANT + 5000 });
  assert.equal(l.length, 1);
  assert.equal(l[0].creeLe, MAINTENANT + 5000);
});

test("recherche sans titre ou sans resultat : rien n'est ajoute", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  assert.equal(ajouterRecherche({ relecture: "", resultat: { fils: [] } }, { stockage: s, maintenant: MAINTENANT }).length, 0);
  assert.equal(ajouterRecherche(null, { stockage: s, maintenant: MAINTENANT }).length, 0);
});

test("recherche : le plafond existant s'applique", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  for (let i = 0; i < SYNTHESES_MAX + 3; i++) ajouterRecherche(recherche("Q" + i), { stockage: s, maintenant: MAINTENANT + i * 1000 });
  assert.equal(listerSyntheses({ stockage: s, maintenant: MAINTENANT }).length, SYNTHESES_MAX);
});

test("montage : seule la validation « Oui » ajoute une recherche, l'ouverture d'une carte la rejoue sans appel IA", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  assert.equal((src.match(/ajouterRecherche\(/g) || []).length, 1);
  const surOui = src.slice(src.indexOf("surOui:"), src.indexOf("surNon:"));
  assert.match(surOui, /ajouterRecherche\(/);
  const ouvrir = src.slice(src.indexOf("function ouvrirSynthese"), src.indexOf("function ouvrirSaisie"));
  assert.match(ouvrir, /entree\.recherche/);
  assert.match(ouvrir, /flux\.rouvrir/);
  assert.doesNotMatch(ouvrir, /traiter|pipeline|demander/);
});

// 30/10 : label « Rapport » / « Échanges » sur chaque entree et destination d'ouverture (rapport au centre sur laptop, modale sur mobile).
test("type d'entree : rapport stocke ou demo = rapport, recherche = echanges, entree vide ou inconnue = aucun", async () => {
  const { typeEntree, libelleTypeEntree } = await import("../src/discussionsIAHistorique.js");
  assert.equal(typeEntree({ id: "a", nom: "X", creeLe: 1, rapport: { titre: "X" } }), "rapport");
  assert.equal(typeEntree({ id: "b", nom: "X", creeLe: 1, demo: "collision" }), "rapport");
  assert.equal(typeEntree({ id: "c", nom: "X", creeLe: 1, recherche: { relecture: "X", resultat: { fils: [] } } }), "echanges");
  assert.equal(typeEntree({}), null);
  assert.equal(typeEntree(null), null);
  assert.equal(libelleTypeEntree({ rapport: {} }), "Rapport");
  assert.equal(libelleTypeEntree({ recherche: {} }), "Échanges");
  assert.equal(libelleTypeEntree(undefined), "");
});

test("destination d'ouverture : recherche = liste filtree ; rapport = zone centrale sur laptop, modale sur mobile ; entree vide = rien", async () => {
  const { destinationOuverture } = await import("../src/discussionsIAHistorique.js");
  const rapport = { rapport: { titre: "R" } };
  assert.equal(destinationOuverture({ recherche: {} }, { mobile: false }), "recherche");
  assert.equal(destinationOuverture({ recherche: {} }, { mobile: true }), "recherche");
  assert.equal(destinationOuverture(rapport, { mobile: false }), "centre");
  assert.equal(destinationOuverture(rapport, { mobile: true }), "modale");
  assert.equal(destinationOuverture({ demo: "collision" }, { mobile: false }), "centre");
  assert.equal(destinationOuverture({}, { mobile: false }), null);
  assert.equal(destinationOuverture(null, { mobile: true }), null);
});

test("renommage : « Recherches IA précédentes » partout, plus aucune « Synthèses précédentes » dans l'interface", async () => {
  const { readFileSync } = await import("node:fs");
  const lire = (c) => readFileSync(new URL("../" + c, import.meta.url), "utf8");
  assert.ok(lire("src/discussionsIA.js").includes('"Recherches IA précédentes"'));
  for (const f of ["src/discussionsIA.js", "src/discussionsIAMontage.js", "src/discussionsIA.css"]) assert.doesNotMatch(lire(f), /Synth[èe]ses pr[ée]c[ée]dentes/, f);
});

test("historique : chaque carte porte un label de type (Rapport / Échanges) place avec la date", async () => {
  const { readFileSync } = await import("node:fs");
  const lire = (c) => readFileSync(new URL("../" + c, import.meta.url), "utf8");
  const ia = lire("src/discussionsIA.js");
  assert.match(ia, /msg-ia-histo-type/);
  assert.match(ia, /libelleTypeEntree\(entree\)/);
  assert.match(lire("src/discussionsIA.css"), /\.msg-ia-histo-type \{[^}]*border: 1px solid var\(--border\)[^}]*font-size: 11\.5px/);
});

test("montage : un rapport de l'historique s'affiche au centre sur laptop (sans modale), la modale reste sur mobile ; le bandeau Retour existant ramene a la liste", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  const ouvrir = src.slice(src.indexOf("function ouvrirSynthese"), src.indexOf("function ouvrirSaisie"));
  assert.match(ouvrir, /destinationOuverture\(entree/);
  assert.match(ouvrir, /montrerRapportAuCentre/);
  assert.match(ouvrir, /rapportVue\.ouvrir\(/);
  const centre = src.slice(src.indexOf("function montrerRapportAuCentre"), src.indexOf("function ouvrirSynthese"));
  assert.match(centre, /rapportVue\.ouvrirAuCentre\(/);
  assert.doesNotMatch(centre, /retourRapport\.montrer\(/); // 31/10 : plus de bandeau « Retour aux discussions » sur laptop
  const vue = readFileSync(new URL("../src/discussionsIARapportVue.js", import.meta.url), "utf8");
  assert.match(vue, /ouvrirAuCentre/);
  assert.doesNotMatch(vue, /console\.log/);
});

test("rapport au centre : la zone est preparee avant la mise en pause de la question, la liste ne la recouvre pas, le retour respecte le mobile", async () => {
  const { readFileSync } = await import("node:fs");
  const montage = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  const centre = montage.slice(montage.indexOf("function montrerRapportAuCentre"), montage.indexOf("function ouvrirSynthese"));
  assert.match(montage, /derniereOuvertureAuCentre\(\) && !window\.matchMedia\(REQUETE_MOBILE\)\.matches/);
  const mess = readFileSync(new URL("../src/messagerie/messagerie.js", import.meta.url), "utf8");
  assert.match(mess, /etat\.convId \|\| rapportAuCentre\(\)\) return;/);
});

// 30/10, bug « liste d'echanges vide apres un rapport » : la zone centrale ne doit jamais dependre d'un drapeau qui survit a la fermeture du rapport.
test("liste d'echanges au centre : l'etat « un rapport occupe le centre » est lu dans le DOM (plus de drapeau perime apres la fermeture du rapport)", async () => {
  const { readFileSync } = await import("node:fs");
  const mess = readFileSync(new URL("../src/messagerie/messagerie.js", import.meta.url), "utf8");
  assert.doesNotMatch(mess, /let rapportAuCentre\b/);
  assert.doesNotMatch(mess, /rapportAuCentre = (true|false)/);
  assert.match(mess, /const rapportAuCentre = \(\) => !!\$\("msgVolet"\)\.querySelector\("\.disc-rapport-fond-centre"\)/);
  assert.match(mess, /etat\.convId \|\| rapportAuCentre\(\)\) return;/);
});

test("laptop : plus de bandeau « Retour aux discussions » sur un rapport au centre (la sortie : autre carte, onglet, liste) ; le bandeau « Retour au rapport » des sources reste", async () => {
  const { readFileSync } = await import("node:fs");
  const montage = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  const centre = montage.slice(montage.indexOf("function montrerRapportAuCentre"), montage.indexOf("function ouvrirSynthese"));
  assert.doesNotMatch(centre, /Retour aux discussions/);
  assert.doesNotMatch(centre, /retourRapport\.montrer\(/);
  assert.match(centre, /retourRapport\.effacer\(\)/);
  assert.match(montage, /libelle: "Retour au rapport"/);
});

test("« Oui » : la carte ajoutee est selectionnee et le resultat de la derniere demande s'affiche (rapport au centre sur laptop, liste d'echanges sinon)", async () => {
  const { readFileSync } = await import("node:fs");
  const montage = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  const oui = montage.slice(montage.indexOf("surOui:"), montage.indexOf("surNon:"));
  assert.match(oui, /ia\.selectionner\(/);
  assert.match(oui, /montrerRapportAuCentre\(retour\.rapport\)/);
  assert.match(oui, /montrerListeAuCentre\(\)/);
  const ia = readFileSync(new URL("../src/discussionsIA.js", import.meta.url), "utf8");
  assert.match(ia, /selectionner/);
  assert.match(ia, /aria-current/);
  const css = readFileSync(new URL("../src/discussionsIA.css", import.meta.url), "utf8");
  assert.match(css, /\.msg-ia-histo-item:focus-within,\n\.msg-ia-histo-item\[data-selectionnee\] \{ border-color: var\(--accent\); \}/);
});

test("« Non » sur laptop : la zone centrale se redessine apres la fermeture d'un rapport pose au centre (pas de zone vide)", async () => {
  const { readFileSync } = await import("node:fs");
  const montage = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  const non = montage.slice(montage.indexOf("surNon: () =>"), montage.indexOf("const pipeline"));
  assert.ok(non.indexOf("flux.refuser()") < non.indexOf("messagerie.fermerConversationIA()"));
});

test("titre de carte : le point final de la relecture est retire, le reste du texte est intact", () => {
  assert.equal(titreCarte("Retrouver l'échange sur l'accès de la grue."), "Retrouver l'échange sur l'accès de la grue");
  assert.equal(titreCarte("Afficher les échanges avec Sophie Lambert. "), "Afficher les échanges avec Sophie Lambert");
  assert.equal(titreCarte("Accès grue"), "Accès grue");
  assert.equal(titreCarte("Cloison coupe-feu du local technique R+2, 1h ou 2h"), "Cloison coupe-feu du local technique R+2, 1h ou 2h");
});

test("titre de carte : le point final de la relecture est retire, le reste du texte est intact", () => {
  assert.equal(titreCarte("Retrouver l'échange sur l'accès de la grue."), "Retrouver l'échange sur l'accès de la grue");
  assert.equal(titreCarte("Afficher les échanges avec Sophie Lambert. "), "Afficher les échanges avec Sophie Lambert");
  assert.equal(titreCarte("Accès grue"), "Accès grue");
  assert.equal(titreCarte("Cloison coupe-feu du local technique R+2, 1h ou 2h"), "Cloison coupe-feu du local technique R+2, 1h ou 2h");
});
