// Rapport de l'historique au centre (laptop, 30/10) : il occupe toute la largeur de la zone centrale, sans le plafond de 760 px de la modale.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/discussionsIA.css", import.meta.url), "utf8");
const regle = (selecteur) => {
  const debut = css.indexOf(selecteur + " {");
  assert.ok(debut >= 0, "regle absente : " + selecteur);
  return css.slice(debut, css.indexOf("}", debut));
};

test("modale : la carte du rapport garde son plafond de 760 px (inchange)", () => {
  assert.match(regle(".regles-ia-carte.disc-rapport-carte"), /width: min\(760px, 100%\)/);
});

test("centre : la carte du rapport prend 100 % de la zone centrale, plus de plafond", () => {
  const r = regle(".disc-rapport-fond-centre .regles-ia-carte.disc-rapport-carte");
  assert.match(r, /width: 100%/);
  assert.doesNotMatch(r, /max-width/);
});

test("centre : le fond s'etire (plus de centrage horizontal) et les lignes de texte restent plafonnees", () => {
  assert.match(regle(".regles-ia-fond.disc-rapport-fond.disc-rapport-fond-centre"), /justify-content: stretch/);
  assert.match(regle(".disc-rapport-fond-centre :is(.disc-rapport-phrase, .disc-rapport-extrait, .disc-rapport-rien)"), /max-width: \d+ch/);
});
