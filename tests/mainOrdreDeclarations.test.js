import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// activateView s'execute a l'initialisation de src/main.js. Toute variable `let` qu'elle atteint (directement ou par une fonction appelee) doit etre declaree
// AVANT elle, sinon la page plante au chargement (« Cannot access ... before initialization », zone morte temporelle), ce que ni `npm test` ni `npm run build` ne voient.
const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("idsColorieQuantitatif est declare avant activateView (retirerCouleurQuantitatif la lit a l'initialisation)", () => {
  const declaration = source.indexOf("\nlet idsColorieQuantitatif");
  const activateView = source.indexOf("\nfunction activateView(");
  assert.ok(declaration > -1 && activateView > -1);
  assert.ok(declaration < activateView, "let idsColorieQuantitatif doit preceder function activateView");
});
