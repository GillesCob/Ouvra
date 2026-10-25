// La banque de vues contient maintenant les images des 15 collisions (modale des regles) ; Discussions ne doit distribuer que les 8 premieres,
// pour que les vues deja validees des echanges de demonstration ne changent pas.
import test from "node:test";
import assert from "node:assert/strict";

import { attribuerBanque, NOMBRE_VUES_MESSAGERIE } from "../src/messagerie/vuesMessagerie.js";

const banqueDe = (n) => Array.from({ length: n }, (_, i) => ({ id: "hosp-clash-" + (i + 1), version: "v", niveau: "N", modeles: "M" }));
const conversations = () => [{ principal: { messages: Array.from({ length: 30 }, (_, i) => ({ vue: { seed: i * 7919 + 3, niveau: "x", modeles: "y" } })) }, sujets: [] }];

test("banque de 15 vues : les messages recoivent les memes images qu'avec les 8 premieres", () => {
  assert.equal(NOMBRE_VUES_MESSAGERIE, 8);
  const a = conversations();
  const b = conversations();
  attribuerBanque(a, banqueDe(8));
  attribuerBanque(b, banqueDe(15));
  assert.deepEqual(b[0].principal.messages.map((m) => m.vue.banqueId), a[0].principal.messages.map((m) => m.vue.banqueId));
  assert.ok(b[0].principal.messages.every((m) => Number(m.vue.banqueId.split("-")[2]) <= 8));
});
