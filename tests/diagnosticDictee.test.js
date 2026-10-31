// Cablage du journal de diagnostic de la dictee (31/10) : lit le source de src/iaSaisie.js. Ecrit avant le code, puis verifie.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/iaSaisie.js", import.meta.url), "utf8");

test("la dictee de la modale IA recoit le journal de diagnostic", () => {
  assert.match(source, /diagnostic: diag\b/);
  assert.match(source, /window\.__diagVoix/);
});

test("le second appui, la fin d'ecoute et le filet sont journalises, jamais le texte dit", () => {
  assert.match(source, /diag\("second appui sur le micro"\)/);
  assert.match(source, /diag\("fin d'ecoute /);
  assert.match(source, /diag\("filet /);
  assert.ok(!/diag\([^)]*texteVocal/.test(source) && !/diag\([^)]*phrase[^.]/.test(source.replace(/phrase\.length/g, "")), "le texte dit ne doit pas partir au journal");
});
