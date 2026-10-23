// Tests du limiteur de requetes par visiteur (relais/limite.js) : ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { creerLimiteur } from "../relais/limite.js";

test("autorise jusqu'au maximum puis refuse", () => {
  let t = 1000;
  const l = creerLimiteur({ max: 3, fenetreMs: 60000, maintenant: () => t });
  assert.deepEqual([l.autoriser("ip1"), l.autoriser("ip1"), l.autoriser("ip1"), l.autoriser("ip1")], [true, true, true, false]);
});

test("la fenetre glisse : apres le delai, de nouveau autorise", () => {
  let t = 0;
  const l = creerLimiteur({ max: 1, fenetreMs: 1000, maintenant: () => t });
  assert.equal(l.autoriser("a"), true);
  assert.equal(l.autoriser("a"), false);
  t = 1001;
  assert.equal(l.autoriser("a"), true);
});

test("visiteurs independants", () => {
  const l = creerLimiteur({ max: 1, fenetreMs: 1000, maintenant: () => 0 });
  assert.equal(l.autoriser("a"), true);
  assert.equal(l.autoriser("b"), true);
  assert.equal(l.autoriser("a"), false);
});

test("un refus ne consomme pas de place (pas de prolongation par l'insistance)", () => {
  let t = 0;
  const l = creerLimiteur({ max: 1, fenetreMs: 1000, maintenant: () => t });
  l.autoriser("a");
  t = 500;
  assert.equal(l.autoriser("a"), false);
  t = 1001;
  assert.equal(l.autoriser("a"), true);
});

test("memoire bornee : au-dela du plafond de visiteurs, les plus anciens sont oublies", () => {
  let t = 0;
  const l = creerLimiteur({ max: 1, fenetreMs: 1000000, maintenant: () => t, visiteursMax: 3 });
  ["a", "b", "c", "d"].forEach((ip) => { t += 1; l.autoriser(ip); });
  assert.ok(l.taille() <= 3);
});

test("attente : 0 si une place est libre, sinon le temps avant la prochaine place", () => {
  let t = 0;
  const l = creerLimiteur({ max: 2, fenetreMs: 60000, maintenant: () => t });
  assert.equal(l.attente("a"), 0);
  l.autoriser("a");
  t = 10000;
  l.autoriser("a");
  assert.equal(l.attente("a"), 50000); // la plus ancienne requete (t = 0) sort de la fenetre a 60000
  t = 30000;
  assert.equal(l.attente("a"), 30000);
  t = 60001;
  assert.equal(l.attente("a"), 0);
  assert.equal(l.attente("inconnu"), 0);
});
