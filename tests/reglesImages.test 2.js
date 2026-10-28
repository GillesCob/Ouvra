// Images des collisions dans la modale « Regle a valider » (src/reglesImages.js) : l'image d'une collision vient de la banque de vues deja
// generee (public/images/vues/index.json), jamais rendue a l'ouverture de la modale. Sans image : null (la ligne garde un espace vide).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { urlVueCollision, collisionsSansVue } from "../src/reglesImages.js";

const banque = [{ id: "hosp-clash-1", version: "ab1", niveau: "Niveau 1" }, { id: "hosp-clash-2", version: "ab1" }];

test("collision de la banque : adresse du JPEG avec l'empreinte de version", () => {
  assert.equal(urlVueCollision(banque, "hosp-clash-1", "/"), "/images/vues/hosp-clash-1.jpg?v=ab1");
  assert.equal(urlVueCollision(banque, "hosp-clash-2", "/ouvra/"), "/ouvra/images/vues/hosp-clash-2.jpg?v=ab1");
});

test("collision absente de la banque, banque vide ou invalide : null, sans exception", () => {
  assert.equal(urlVueCollision(banque, "hosp-clash-9", "/"), null);
  assert.equal(urlVueCollision([], "hosp-clash-1", "/"), null);
  assert.equal(urlVueCollision(null, "hosp-clash-1", "/"), null);
  assert.equal(urlVueCollision(banque, undefined, "/"), null);
  assert.equal(urlVueCollision([null, {}, { id: 3 }], "3", "/"), null);
});

test("version absente : adresse sans parametre", () => {
  assert.equal(urlVueCollision([{ id: "x" }], "x", "/"), "/images/vues/x.jpg");
});

test("identifiant hostile : jamais une adresse hors du dossier des vues", () => {
  const b = [{ id: "../secret", version: "1" }];
  assert.equal(urlVueCollision(b, "../secret", "/"), null);
});

test("collisionsSansVue : les collisions de la liste sans image dans la banque", () => {
  assert.deepEqual(collisionsSansVue(banque, [{ id: "hosp-clash-1" }, { id: "hosp-clash-3" }]).map((c) => c.id), ["hosp-clash-3"]);
});

test("banque reelle du depot : les 8 premieres collisions ont une image (les 7 autres restent a generer)", () => {
  const index = JSON.parse(readFileSync(new URL("../public/images/vues/index.json", import.meta.url), "utf8"));
  const sources = readFileSync(new URL("../src/clashesHospital.js", import.meta.url), "utf8");
  const ids = Array.from(sources.matchAll(/id: "(hosp-clash-\d+)"/g)).map((m) => m[1]);
  assert.ok(ids.length >= 8);
  const manquantes = collisionsSansVue(index.map((v) => ({ ...v, version: "t" })), ids.slice(0, 8).map((id) => ({ id })));
  assert.deepEqual(manquantes.map((c) => c.id), []);
});
