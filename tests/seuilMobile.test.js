import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { REQUETE_MOBILE, estMobile } from "../src/seuilMobile.js";

test("seuilMobile : requete 768 px et estMobile selon matchMedia", () => {
  assert.equal(REQUETE_MOBILE, "(max-width: 768px)");
  globalThis.window = { matchMedia: (q) => ({ matches: q === REQUETE_MOBILE }) };
  assert.equal(estMobile(), true);
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  assert.equal(estMobile(), false);
});

test("seuilMobile : sans window ni matchMedia (test, rendu serveur), estMobile est faux sans erreur", () => {
  delete globalThis.window;
  assert.equal(estMobile(), false);
  globalThis.window = {};
  assert.equal(estMobile(), false);
});

test("seuilMobile : plus aucun matchMedia code en dur a 768 px dans les modules JS", () => {
  const racine = new URL("../src/", import.meta.url);
  const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(new URL(e.name + "/", dossier)) : /^[^ ]+\.js$/.test(e.name) ? [new URL(e.name, dossier)] : []);
  for (const f of fichiers(racine)) {
    if (f.pathname.endsWith("/seuilMobile.js")) continue;
    assert.doesNotMatch(readFileSync(f, "utf8"), /matchMedia\("\(max-width: 768px\)"\)|(?:MOBILE|MEDIA_MOBILE) = "\(max-width: 768px\)"/, f.pathname);
  }
});
