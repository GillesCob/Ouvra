import test from "node:test";
import assert from "node:assert/strict";
import { peutDefiler, zoneDuGeste, verrouillerArrierePlan } from "../src/verrouDefilement.js";

const zone = (o) => ({ scrollHeight: 500, clientHeight: 200, scrollTop: 0, contains: (c) => c === o?.cible, ...o });

test("peutDefiler : zone qui ne depasse pas, debut, milieu, fin", () => {
  assert.equal(peutDefiler(null, true), false);
  assert.equal(peutDefiler(zone({ scrollHeight: 200 }), true), false);
  assert.equal(peutDefiler(zone({ scrollTop: 0 }), false), false);
  assert.equal(peutDefiler(zone({ scrollTop: 0 }), true), true);
  assert.equal(peutDefiler(zone({ scrollTop: 150 }), false), true);
  assert.equal(peutDefiler(zone({ scrollTop: 300 }), true), false);
});

test("zoneDuGeste : trouve la zone qui contient la cible, sinon null", () => {
  const a = zone({ cible: "x" });
  assert.equal(zoneDuGeste([null, a], "x"), a);
  assert.equal(zoneDuGeste(a, "y"), null);
});

test("verrouillerArrierePlan : classe posee/retiree, glissement hors zone annule, idempotent", () => {
  const classes = new Set();
  const doc = { body: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } } };
  const ecouteurs = {};
  const fond = { addEventListener: (t, f) => { ecouteurs[t] = f; }, removeEventListener: (t) => { delete ecouteurs[t]; } };
  const liste = zone({ cible: "liste" });
  const v = verrouillerArrierePlan(fond, () => [liste], "verrou", doc);
  v.verrouiller(); v.verrouiller();
  assert.ok(classes.has("verrou"));
  ecouteurs.touchstart({ touches: [{ clientY: 300 }] });
  let annule = 0;
  const geste = (cible, y) => ecouteurs.touchmove({ touches: [{ clientY: y }], target: cible, preventDefault: () => { annule += 1; } });
  geste("ailleurs", 200); assert.equal(annule, 1); // hors zone
  geste("liste", 200); assert.equal(annule, 1); // dans la liste, vers le bas possible
  geste("liste", 400); assert.equal(annule, 2); // vers le haut impossible (scrollTop 0)
  v.deverrouiller();
  assert.ok(!classes.has("verrou"));
  assert.equal(ecouteurs.touchmove, undefined);
});
