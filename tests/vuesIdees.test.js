import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ongletDeVue, VUES_SANS_ONGLET, estVueIdees, VUE_IDEES, VUE_ESPACE } from "../src/vuesIdees.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");

test("routage : #espace n'a pas d'onglet, l'onglet des idees reste allume pendant qu'on y est", () => {
  assert.equal(ongletDeVue(VUE_ESPACE), VUE_IDEES);
  assert.equal(ongletDeVue(VUE_IDEES), VUE_IDEES);
  assert.equal(ongletDeVue("viewer"), "viewer"); // les autres vues ne changent pas
  assert.equal(ongletDeVue(undefined), undefined);
  assert.equal(ongletDeVue(null), null);
});

test("routage : seule la vue « espace » est atteignable par le hash sans onglet ; les deux pages sont reconnues", () => {
  assert.deepEqual(VUES_SANS_ONGLET, ["espace"]);
  assert.ok(estVueIdees("idees") && estVueIdees("espace"));
  assert.equal(estVueIdees("quantitatif"), false);
  assert.equal(estVueIdees(""), false);
});

test("index.html : l'onglet « Idées d'évolution » vient juste apres Quantitatif, a la place ou se trouvait 2D → 3D, et les deux vues existent", () => {
  const html = lire("index.html");
  const ordre = [...html.matchAll(/<button type="button" class="nav-link" data-view="([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ordre.slice(0, 6), ["viewer", "collision", "discussions", "quantitatif", "plan3d", "idees"]);
  assert.match(html, /data-view="idees"[^>]*>Idées d'évolution<\/button>/);
  assert.match(html, /<div id="view-idees" class="view" hidden>\s*<div id="ideesRoot"><\/div>/);
  assert.match(html, /<div id="view-espace" class="view" hidden>\s*<div id="espaceRoot"><\/div>/);
  assert.equal((html.match(/data-view="espace"/g) || []).length, 0, "« Mon espace » n'est pas un onglet");
});

test("main.js : les deux pages sont creees avant le premier activateView (sinon « Cannot access before initialization »), et le hash #espace est une vue valide", () => {
  const source = lire("src/main.js");
  const creation = source.indexOf("\nconst ideesEvolution = creerIdeesEvolution(");
  const creationEspace = source.indexOf("\nconst monEspace = creerMonEspace(");
  const premier = source.indexOf("\nactivateView(savedView);");
  assert.ok(creation > -1 && creationEspace > -1 && premier > -1);
  assert.ok(creation < premier && creationEspace < premier);
  assert.ok(source.includes('.concat(["landing", "accueil"], VUES_SANS_ONGLET)'));
  assert.ok(source.includes("l.dataset.view === ongletDeVue(viewName)"), "onglet allume pour « Mon espace »");
  assert.ok(source.includes("l.dataset.view === ongletDeVue(currentViewName)"), "applyPersona ne renvoie pas #espace vers le Viewer");
  assert.ok(/HOSPITAL_VISIBLE_VIEWS = \[[^\]]*"idees"/.test(source), "onglet visible sur le projet hopital");
});

test("CSS : display: block des deux pages est limite a :not([hidden]) (sinon la page masquee resterait affichee) et les SVG des batiments sont dans public", () => {
  assert.match(lire("src/ideesEvolution.css"), /#view-idees:not\(\[hidden\]\) \{ display: block;/);
  assert.match(lire("src/monEspace.css"), /#view-espace:not\(\[hidden\]\) \{ display: block;/);
  assert.doesNotMatch(lire("src/ideesEvolution.css"), /(^|\n)#view-idees \{[^}]*display:/);
  for (const nom of ["2-consulter", "3-preparer", "4-construire"]) assert.ok(existsSync(new URL(`../public/images/idees/batiment-estime-${nom}.svg`, import.meta.url)), nom);
});

test("retour visiteur : les deux pages ont un libelle lisible", async () => {
  const { libellePage } = await import("../src/retourVisiteur.js");
  assert.equal(libellePage("idees"), "Idées d'évolution");
  assert.equal(libellePage("espace"), "Mon espace");
});

test("idees : appliquerFriseCentrale allume la frise qui entre dans la bande centrale et remet a l'etat initial celle qui en sort (l'animation se rejoue)", async () => {
  const { appliquerFriseCentrale, MARGE_FRISE_CENTRALE } = await import("../src/ideesEvolution.js");
  const fausse = () => { const c = new Set(); return { classList: { toggle: (n, v) => (v ? c.add(n) : c.delete(n)), contains: (n) => c.has(n) } }; };
  const a = fausse(), b = fausse();
  appliquerFriseCentrale([{ target: a, isIntersecting: true }]);
  assert.ok(a.classList.contains("ide-vu") && !b.classList.contains("ide-vu"));
  appliquerFriseCentrale([{ target: a, isIntersecting: false }, { target: b, isIntersecting: true }]);
  assert.ok(!a.classList.contains("ide-vu") && b.classList.contains("ide-vu"), "une seule frise animee a la fois");
  appliquerFriseCentrale([{ target: a, isIntersecting: true }, { target: b, isIntersecting: false }]);
  assert.ok(a.classList.contains("ide-vu"), "revenue au centre, elle se rallume (donc rejoue)");
  assert.match(MARGE_FRISE_CENTRALE, /^-40% 0px -40% 0px$/);
});

test("idees : l'accroche (scroll-snap) est portee par #view-idees seulement via la classe ide-accroche, posee et retiree par surVueActivee, desactivee si moins d'animations", () => {
  const css = lire("src/ideesEvolution.css");
  const js = lire("src/ideesEvolution.js");
  assert.match(css, /#view-idees\.ide-accroche \{ scroll-snap-type: y mandatory; \}/);
  const proximity = css.indexOf("#view-idees.ide-accroche { scroll-snap-type: y proximity; }");
  assert.ok(proximity > css.lastIndexOf("@media (max-width: 899px)", proximity) && css.lastIndexOf("@media (max-width: 899px)", proximity) > css.lastIndexOf("@media (min-width", proximity), "mobile : proximity, jamais de blocage dans une frise verticale haute");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*#view-idees\.ide-accroche \{ scroll-snap-type: none; \}/);
  assert.doesNotMatch(css, /(^|\n)#view-idees(?!\.ide-accroche)[^{]*\{[^}]*scroll-snap-type/, "aucune accroche hors de la classe");
  assert.match(css, /\.ide-scn \{[^}]*min-height: var\(--ide-hauteur[^}]*scroll-snap-align: center;/);
  assert.match(js, /classList\.toggle\("ide-accroche", vue === VUE_IDEES && !reduit\)/);
  assert.match(js, /new IntersectionObserver\(appliquerFriseCentrale, \{ root: conteneur \|\| null, rootMargin: MARGE_FRISE_CENTRALE/);
  assert.doesNotMatch(js, /unobserve/, "la frise ne reste plus allumee a vie");
});
