// Page Quantitatif sans defilement (28/10) : la page tient dans la fenetre, « Exporter » reste en bas, seuls le tableau et la liste de l'historique defilent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = "\n" + readFileSync(new URL("../src/quantitatif.css", import.meta.url), "utf8");
const regle = (selecteur) => {
  const debut = css.indexOf("\n" + selecteur + " {");
  assert.ok(debut > -1, selecteur);
  return css.slice(debut, css.indexOf("}", debut));
};

test("la vue Quantitatif ne defile pas, la page est une colonne qui tient dans la fenetre", () => {
  assert.match(regle("#view-quantitatif"), /overflow: hidden/);
  assert.doesNotMatch(regle("#view-quantitatif"), /overflow-y: auto/);
  assert.match(regle(".qt-page"), /display: flex; flex-direction: column/);
  assert.match(regle(".qt-page"), /min-height: 0/);
});

test("le tableau et la liste de l'historique defilent dans leur propre conteneur, sans hauteur fixe en vh", () => {
  assert.match(regle(".qt-tableau-enveloppe"), /overflow: auto/);
  assert.doesNotMatch(regle(".qt-tableau-enveloppe"), /max-height/);
  assert.match(regle(".qt-histo-liste"), /overflow-y: auto/);
  assert.doesNotMatch(regle(".qt-histo-liste"), /max-height/);
  assert.match(regle(".qt-resultat > .qt-tableau-enveloppe"), /min-height: 0/);
});

test("« Exporter » est un bloc fixe sous le tableau, jamais reduit", () => {
  assert.match(regle(".qt-resultat > *"), /flex: none/);
});
