// Tests de la saisie IA commune : logique d'ouverture et de bascule (src/iaSaisieLogique.js) et conformite statique de la modale (src/iaSaisie.js)
// avec le markup des autres IA d'Ouvra (classes regles-ia-* de src/reglesIA.css).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modeOuverture, modeApresBascule, annonceMode, aideVocal, suiteFinEcoute, AIDE_VOCAL, AIDE_ECOUTE } from "../src/iaSaisieLogique.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const js = lire("src/iaSaisie.js");

test("ouverture : dictee disponible = directement vocal, sans etape intermediaire", () => {
  assert.deepEqual(modeOuverture({ dicteeDisponible: true }), { mode: "vocal", raison: null });
});

test("ouverture : dictee indisponible = texte direct avec la raison (celle du navigateur, sinon un message par defaut)", () => {
  assert.deepEqual(modeOuverture({ dicteeDisponible: false, motifIndisponible: "Ce navigateur n'accepte pas la dictée vocale." }), { mode: "texte", raison: "Ce navigateur n'accepte pas la dictée vocale." });
  assert.match(modeOuverture({ dicteeDisponible: false }).raison, /dictée vocale n'est pas disponible/);
});

test("bascule : vocal vers texte, texte vers vocal seulement si la dictee existe", () => {
  assert.equal(modeApresBascule("vocal", { dicteeDisponible: true }), "texte");
  assert.equal(modeApresBascule("texte", { dicteeDisponible: true }), "vocal");
  assert.equal(modeApresBascule("texte", { dicteeDisponible: false }), "texte");
});

test("annonces et aide : un texte par mode, l'aide change pendant l'ecoute", () => {
  assert.match(annonceMode("vocal"), /Mode vocal/);
  assert.match(annonceMode("texte"), /Mode texte/);
  assert.equal(aideVocal(false), AIDE_VOCAL);
  assert.equal(aideVocal(true), AIDE_ECOUTE);
  assert.match(AIDE_VOCAL, /micro.*voix haute.*l'écrire/);
});

test("fin d'ecoute : second clic + phrase = envoi ; arret spontane avec phrase = texte ; rien reconnu = rien", () => {
  assert.equal(suiteFinEcoute({ termineParUtilisateur: true, phrase: "combien de portes" }), "envoyer");
  assert.equal(suiteFinEcoute({ termineParUtilisateur: false, phrase: "combien de portes" }), "texte");
  assert.equal(suiteFinEcoute({ termineParUtilisateur: true, phrase: "   " }), "rien");
  assert.equal(suiteFinEcoute({ termineParUtilisateur: false, phrase: null }), "rien");
});

test("modale : memes classes que les autres IA, toutes definies dans reglesIA.css ou iaSaisie.css", () => {
  const css = lire("src/reglesIA.css") + lire("src/iaSaisie.css");
  const classes = new Set([...js.matchAll(/["' ]regles-ia-[a-z-]+/g)].map((m) => m[0].trim().replace(/["']/g, "")));
  for (const c of ["regles-ia-fond", "regles-ia-carte", "regles-ia-vue-texte", "regles-ia-vue-vocal", "regles-ia-vue-chargement", "regles-ia-micro", "regles-ia-legende", "regles-ia-valider", "regles-ia-etat", "regles-ia-propositions", "regles-ia-exemple"]) assert.ok(classes.has(c), "classe attendue : " + c);
  for (const c of classes) assert.ok(css.includes("." + c), "classe sans regle : " + c);
});

test("modale : vocal d'abord, micro jamais lance tout seul, bascules, focus, annonce, echap, fermeture qui abandonne", () => {
  assert.match(js, /ouverture\.mode/);
  assert.match(js, /continu: true/);
  // toute mise en route de l'ecoute (basculer) est dans le clic du micro : jamais ailleurs
  const hors = js.replace(js.slice(js.indexOf('micro.addEventListener("click"'), js.indexOf("// Bascules")), "");
  assert.ok(!/dictee\.basculer\(\)/.test(hors));
  assert.match(js, /micro\.addEventListener\("click"/);
  assert.match(js, /Écrire ma demande/);
  assert.match(js, /Utiliser le micro/);
  assert.match(js, /setAttribute\("role", "dialog"\)/);
  assert.match(js, /aria-modal/);
  assert.match(js, /e\.key === "Escape"/);
  assert.match(js, /demandeEnCours \+= 1/); // fermer() invalide toute reponse en route
  assert.match(js, /annule: \(\) =>/);
  assert.match(js, /reformuler: \(phrase\) => ouvrir\(\{ phraseInitiale: phrase, modeInitial: "texte" \}\)/);
});
