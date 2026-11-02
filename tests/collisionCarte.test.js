// Lecture d'une collision pour sa carte (src/collisionCarte.js), partagee entre la liste de la page Collision et « Mon espace ».
import test from "node:test";
import assert from "node:assert/strict";
import { collisionTypeFr, decrireCarteCollision, LIBELLES_STATUT_COLLISION, LIBELLES_PRIORITE_COLLISION } from "../src/collisionCarte.js";

test("types en francais deduits du nom Revit, repli sur le premier segment", () => {
  assert.equal(collisionTypeFr("Basic Wall : Interior - 123mm Partition (#1)"), "Cloison");
  assert.equal(collisionTypeFr("Round Duct : Taps"), "Gaine");
  assert.equal(collisionTypeFr("Curtain Wall : Facade"), "Mur-rideau");
  assert.equal(collisionTypeFr("Truc : inconnu"), "Truc");
});

test("carte : titre, sous-titre avec identifiants et niveau en francais", () => {
  const c = decrireCarteCollision("Basic Wall : Interior - 123mm Partition (#753881) ↔ Rectangular Duct : Mitered Elbows / Taps (#967393) · Level 2");
  assert.equal(c.titre, "Cloison ↔ Gaine");
  assert.equal(c.sousTitre, "#753881 ↔ #967393 · Niveau 2");
  assert.deepEqual(c.ids, ["#753881", "#967393"]);
});

test("carte : sans deux identifiants, null ; sans niveau, pas de point median", () => {
  assert.equal(decrireCarteCollision("Mur ↔ Gaine"), null);
  assert.equal(decrireCarteCollision("Wall (#1) ↔ Duct (#2)").sousTitre, "#1 ↔ #2");
  assert.equal(decrireCarteCollision(""), null);
});

test("libelles de statut et de priorite", () => {
  assert.equal(LIBELLES_STATUT_COLLISION.confirme, "Confirmé");
  assert.equal(LIBELLES_PRIORITE_COLLISION.urgente, "Urgente");
});

test("htmlPrioriteCollision : libelle visible court, mot « Priorité » lu par les lecteurs d'écran, repli sur normale", async () => {
  const { htmlPrioriteCollision } = await import("../src/collisionCarte.js");
  assert.match(htmlPrioriteCollision("urgente"), /collision-prio-mot">Priorité <\/span>Urgente</);
  assert.match(htmlPrioriteCollision("inconnue"), /Normale</);
});
