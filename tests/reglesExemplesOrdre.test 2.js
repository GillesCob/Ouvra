// Ordre de la demo (28/10) : la phrase de la page Collision utilisee en demo ouvre la liste des phrases toutes faites.
import test from "node:test";
import assert from "node:assert/strict";
import { EXEMPLES_REGLES } from "../src/reglesExemples.js";

test("ordre de la demo : la phrase « gaines du niveau 2 » est la premiere de la liste", () => {
  assert.equal(EXEMPLES_REGLES[0].demande, "Passe en urgent toutes les collisions qui impliquent des gaines du niveau 2");
});
