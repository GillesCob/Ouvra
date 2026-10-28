// Un seul clic sur « IA » ouvre directement la saisie (vocal d'abord) pour le Viewer et les collisions : plus de choix « Texte / Vocal » intermediaire.
// La logique d'ouverture (mode initial selon la dictee, bascule, phrase conservee) est celle de src/iaSaisieLogique.js ; ici on verifie le CABLAGE.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { modeOuverture, modeApresBascule } from "../src/iaSaisieLogique.js";

const lire = (chemin) => fs.readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const sansCommentaires = (texte) => texte.replace(/\/\/.*$/gm, "");

for (const fichier of ["src/commandesIA.js", "src/reglesIA.js"]) {
  test(fichier + " : ouvre la saisie commune directement, sans menu de choix", () => {
    const js = sansCommentaires(lire(fichier));
    assert.match(js, /creerIASaisie\(/);
    assert.match(js, /saisie\.ouvrir\(\)/);
    assert.equal(/choixTexte|choixVocal|IAChoix|ouvrirChoix|fermerChoix|creerDictee|motifSansAPI/.test(js), false, "plus de choix ni de dictee propre");
    assert.match(js, /retourFocus: bouton/, "le focus revient au bouton IA a la fermeture");
    assert.match(js, /annule\(\)/, "une reponse arrivee apres la fermeture n'applique rien");
  });
}

test("« Non » rouvre la saisie en mode texte avec la phrase (reformuler)", () => {
  assert.match(sansCommentaires(lire("src/commandesIA.js")), /reformuler: saisie\.reformuler/);
  assert.match(sansCommentaires(lire("src/reglesIA.js")), /reformuler: saisie\.reformuler/);
  assert.match(lire("src/iaSaisie.js"), /reformuler: \(phrase\) => ouvrir\(\{ phraseInitiale: phrase, modeInitial: "texte" \}\)/);
});

test("le Viewer n'a plus de menu de choix dans le DOM ni dans le CSS", () => {
  assert.equal(/commandesIAChoix|commandesIANoteVocal/.test(lire("index.html") + lire("src/commandesIA.css") + sansCommentaires(lire("src/main.js"))), false);
});

test("mode initial : vocal si la dictee existe, sinon texte avec la raison ; bascules", () => {
  assert.deepEqual(modeOuverture({ dicteeDisponible: true }), { mode: "vocal", raison: null });
  const sans = modeOuverture({ dicteeDisponible: false, motifIndisponible: "Micro refusé." });
  assert.deepEqual(sans, { mode: "texte", raison: "Micro refusé." });
  assert.equal(modeApresBascule("vocal", { dicteeDisponible: true }), "texte");
  assert.equal(modeApresBascule("texte", { dicteeDisponible: true }), "vocal");
  assert.equal(modeApresBascule("texte", { dicteeDisponible: false }), "texte", "sans dictee, on reste en texte");
});

test("choisir une phrase toute faite lance la demande tout de suite (plus de remplissage a valider)", () => {
  const js = sansCommentaires(lire("src/iaSaisie.js"));
  const bloc = js.slice(js.indexOf("exemples.forEach"), js.indexOf("propositions.append"));
  assert.match(bloc, /envoyer\(nettoyerPhrase\(champ\.value\)\)/);
  assert.equal(/focusVue\("texte"\)/.test(bloc), false, "le champ n'est plus rempli puis laisse a valider");
});
