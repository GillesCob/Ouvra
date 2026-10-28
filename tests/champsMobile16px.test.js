// Champs de saisie sur mobile (28/10) : 16 px minimum, sinon Safari iOS zoome la page au focus et ne la dezoome pas au retour du clavier.
// Les mesures de font-size calculee sont faites dans WebKit (390 px) ; ici, la regle partagee et l'absence de blocage du zoom.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("CSS : une regle partagee force 16 px sur input, textarea, select et contenteditable sous 768 px", () => {
  const css = lire("src/style.css");
  const debut = css.indexOf("@media (max-width: 768px) {\n  html body :is(input:not(");
  assert.ok(debut > 0, "bloc de la regle partagee");
  const bloc = css.slice(debut, css.indexOf("\n}\n", debut));
  for (const type of ["checkbox", "radio", "range", "file", "hidden", "button", "submit"]) assert.ok(bloc.includes('[type="' + type + '"]'), type + " exclu");
  assert.ok(bloc.includes("textarea") && bloc.includes("select") && bloc.includes("[contenteditable]"));
  assert.ok(bloc.includes("font-size: 16px;"));
});

test("CSS : le champ du nom du plan (2D -> 3D) n'impose plus 13 px sur mobile", () => {
  const css = lire("src/plan3d/plan3d.css");
  const mobile = css.slice(css.indexOf("@media (max-width: 768px) {"));
  const ligne = mobile.split("\n").find((l) => l.includes(".p3d-nom-projet {"));
  assert.ok(ligne && !/font-size/.test(ligne), ligne);
});

test("HTML : le zoom de la page n'est jamais desactive (accessibilite)", () => {
  const html = lire("index.html");
  assert.equal(/maximum-scale|user-scalable/i.test(html), false);
});
