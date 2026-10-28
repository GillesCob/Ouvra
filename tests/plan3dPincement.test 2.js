// Zoom au pincement du plan 2D -> 3D (25/10).
import test from "node:test";
import assert from "node:assert/strict";
import { vueApresPincement } from "../src/plan3d/pincement.js";

const rect = { left: 0, top: 0, width: 400, height: 300 };
const vueDepart = { x: 0, y: 0, l: 40, h: 30 }; // 10 cm par pixel
const proche = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("pincement : deux doigts qui s'ecartent du double divisent la largeur visible par deux, le milieu reste sous les doigts", () => {
  const v = vueApresPincement({ vueDepart, rect, departA: { x: 150, y: 150 }, departB: { x: 250, y: 150 }, a: { x: 100, y: 150 }, b: { x: 300, y: 150 } });
  proche(v.l, 20);
  proche(v.h, 15);
  // le point du plan sous le milieu (200, 150) etait (20, 15) ; il y reste
  proche(v.x + 200 * (v.l / 400), 20);
  proche(v.y + 150 * (v.l / 400), 15);
});

test("pincement : un glissement a deux doigts sans changer l'ecartement deplace la vue", () => {
  const v = vueApresPincement({ vueDepart, rect, departA: { x: 150, y: 150 }, departB: { x: 250, y: 150 }, a: { x: 170, y: 150 }, b: { x: 270, y: 150 } });
  proche(v.l, 40);
  proche(v.x, -2); // 20 px vers la droite = la vue recule de 2 m
});

test("pincement : la largeur reste dans les bornes", () => {
  const trop = vueApresPincement({ vueDepart, rect, departA: { x: 190, y: 150 }, departB: { x: 210, y: 150 }, a: { x: 0, y: 150 }, b: { x: 400, y: 150 }, lMin: 2 });
  assert.equal(trop.l, 2);
  const peu = vueApresPincement({ vueDepart, rect, departA: { x: 0, y: 150 }, departB: { x: 400, y: 150 }, a: { x: 195, y: 150 }, b: { x: 205, y: 150 }, lMax: 60 });
  assert.equal(peu.l, 60);
});

test("pincement : doigts confondus ou rectangle vide = vue inchangee", () => {
  const meme = { x: 100, y: 100 };
  assert.deepEqual(vueApresPincement({ vueDepart, rect, departA: meme, departB: meme, a: meme, b: meme }), vueDepart);
  assert.deepEqual(vueApresPincement({ vueDepart, rect: { left: 0, top: 0, width: 0, height: 0 }, departA: { x: 1, y: 1 }, departB: { x: 5, y: 5 }, a: { x: 1, y: 1 }, b: { x: 9, y: 9 } }), vueDepart);
});
