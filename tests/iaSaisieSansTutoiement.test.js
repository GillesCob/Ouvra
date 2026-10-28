// Les textes de la modale de saisie IA (et des messages qui s'y affichent) ne tutoient pas (28/10, Gilles) : forme impersonnelle ou neutre.
// Ecrit avant les corrections. Verifie les constantes exportees et les chaines des sources qui alimentent la modale.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AIDE_VOCAL, AIDE_ECOUTE, ANNONCE_VOCAL, ANNONCE_TEXTE, modeOuverture } from "../src/iaSaisieLogique.js";
import { messageErreurVoix, MESSAGE_RIEN_RECONNU, MESSAGE_PHRASE_VIDE, MESSAGE_CONTEXTE_NON_SECURISE } from "../src/reglesVoix.js";
import { MESSAGES } from "../relais/http.js";

const TUTOIEMENT = /\b(ta|tes|ton|tu|toi|appuie|écris|ecris|dis|redis|choisis|reformule|vérifie|réessaie|reessaie|essaie|précise|precise|parle|utilise|branche|tape|ouvre|attends|clique|cale|donne|sélectionne|trace|supprime|importe|autorise|ouvre)\b|\bt'|\bte\b/i;

test("constantes de la modale : aucune forme de tutoiement", () => {
  const textes = [AIDE_VOCAL, AIDE_ECOUTE, ANNONCE_VOCAL, ANNONCE_TEXTE, MESSAGE_RIEN_RECONNU, MESSAGE_PHRASE_VIDE, MESSAGE_CONTEXTE_NON_SECURISE,
    modeOuverture({ dicteeDisponible: false }).raison];
  for (const code of ["no-speech", "audio-capture", "language-not-supported", "inconnu", "service-not-allowed", "not-allowed"]) {
    for (const ios of [false, true]) textes.push(messageErreurVoix(code, { ios }));
  }
  textes.push(...Object.values(MESSAGES));
  for (const t of textes.filter(Boolean)) assert.doesNotMatch(t, TUTOIEMENT, t);
});

const FICHIERS = [
  "src/iaSaisie.js", "src/commandesIA.js", "src/reglesIA.js", "src/discussionsIA.js", "src/quantitatifPage.js", "src/plan3d/plan3dPage.js",
  "src/commandesIAClient.js", "src/reglesIAClient.js", "src/discussionsIAClient.js", "src/quantitatifIAClient.js", "src/plan3d/ia/planIAClient.js", "src/plan3d/ia/planIAFlux.js",
  "src/discussionsIAPipeline.js", "src/discussionsIAActions.js", "src/commandesViewer.js", "src/commandesPresentations.js", "relais/http.js"
];
// Phrases d'origine (2e personne) qui s'affichaient dans la modale : aucune ne doit rester dans les sources.
const INTERDITES = [
  "ta demande", "Réessaie ou", "Choisis une phrase", "Écris ce que", "Écris ta", "Utilise les outils", "Redis ta", "Précise", "Tu as envoyé", "Reformule la phrase", "Reformule-la", "Autorise-le", "Ouvre Ouvra", "appuie pour",
  "Ouvre d'abord"
];
test("sources de la modale : aucune phrase d'origine au tutoiement", () => {
  for (const f of FICHIERS) {
    const source = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    const code = source.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    for (const p of INTERDITES) {
      assert.ok(!new RegExp("(?<![\\p{L}])" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "iu").test(code), f + " contient encore : " + p);
    }
  }
});
