import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/safeArea.css", import.meta.url), "utf8");

test("safeArea : le mode application installee ne s'applique que sur mobile (une PWA sur ordinateur ne perd pas 14 px en bas)", () => {
  const blocs = css.match(/@media[^{]*display-mode: standalone[^{]*\{/g) || [];
  assert.ok(blocs.length >= 1);
  for (const b of blocs) assert.match(b, /\(max-width: 768px\)/);
  assert.doesNotMatch(css, /@media \(display-mode: standalone\) \{/); // jamais sans la garde
});

test("safeArea : la marge basse de 14 px et les insets restent dans le bloc garde", () => {
  const debut = css.indexOf("(max-width: 768px)");
  assert.ok(debut > 0 && css.indexOf("+ 14px") > debut);
});
