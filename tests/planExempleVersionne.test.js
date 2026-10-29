// Plan d'exemple 2D -> 3D (29/10) : versionne et deploye avec l'accord du proprietaire du plan, sinon le bouton « Essayer avec un plan d'exemple » reste cache en production (404).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const racine = new URL("../", import.meta.url).pathname;
const lire = (chemin) => readFileSync(racine + chemin);

test("les deux fichiers du plan d'exemple ne sont pas ignores par git", () => {
  for (const f of ["plan-salome.json", "plan-salome.jpg"]) {
    const r = spawnSync("git", ["check-ignore", "-q", "public/plan3d-local/" + f], { cwd: racine });
    assert.equal(r.status, 1, f + " ne doit pas etre ignore");
  }
});

test("le JSON est valide et le JPG est une vraie image", () => {
  const plan = JSON.parse(lire("public/plan3d-local/plan-salome.json").toString("utf8"));
  assert.ok(Array.isArray(plan.noeuds) && plan.noeuds.length > 0);
  const jpg = lire("public/plan3d-local/plan-salome.jpg");
  assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test("la page charge exactement ces deux fichiers", () => {
  const src = lire("src/plan3d/plan3dPage.js").toString("utf8");
  assert.ok(src.includes('"/plan3d-local/plan-salome.json"') && src.includes('"/plan3d-local/plan-salome.jpg"'));
});
