import test from "node:test";
import assert from "node:assert/strict";
import { positionner } from "../src/messagerie/menuChoix.js";

const champ = (top, bottom) => ({ left: 16, top, bottom, width: 300 });

test("menu de choix : largeur et abscisse du champ, ouverture vers le bas quand la place suffit", () => {
  const p = positionner(champ(100, 144), 200, 700);
  assert.deepEqual(p, { left: 16, width: 300, top: 150, maxHeight: 542 });
});

test("menu de choix : vers le haut quand le bas manque et que le haut a plus de place", () => {
  const p = positionner(champ(500, 544), 200, 640);
  assert.equal(p.top, 500 - 6 - 200);
  assert.equal(p.width, 300);
});

test("menu de choix : liste trop haute des deux cotes, plafonnee a la place libre, jamais hors de l'ecran", () => {
  const p = positionner(champ(300, 344), 900, 700);
  assert.equal(p.maxHeight, 342); // bas : 700 - 344 - 14 = 342 ; haut : 300 - 14 = 286
  assert.ok(p.top >= 8 && p.top + p.maxHeight <= 700);
  const bas = positionner(champ(40, 84), 900, 200);
  assert.ok(bas.maxHeight >= 88 && bas.top >= 8);
});
