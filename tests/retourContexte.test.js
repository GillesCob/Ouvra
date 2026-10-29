// Tests du bandeau de retour generique (src/retourContexte.js) : etat pur, DOM simule, markup/CSS statique et non-regression des deux bandeaux existants.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerCoeurRetour, creerRetourContexte } from "../src/retourContexte.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8");
const contexte = (libelle = "Retour au quantitatif", surRetour = () => {}) => ({ libelle, surRetour });

// ---------- Etat ----------
test("coeur : montrer affiche, le plus recent gagne (un seul a la fois)", () => {
  const c = creerCoeurRetour();
  assert.equal(c.actif(), false);
  assert.equal(c.montrer(contexte("Retour A")), true);
  assert.equal(c.montrer(contexte("Retour B")), true);
  assert.equal(c.contexte().libelle, "Retour B");
});

test("coeur : contexte invalide refuse, rien ne s'affiche", () => {
  const c = creerCoeurRetour();
  for (const mauvais of [null, undefined, {}, { libelle: "x" }, { surRetour() {} }, { libelle: "", surRetour() {} }, { libelle: 3, surRetour() {} }, { libelle: "x", surRetour: "non" }]) assert.equal(c.montrer(mauvais), false);
  assert.equal(c.actif(), false);
});

test("coeur : declencher appelle le rappel UNE fois, le bandeau disparait d'abord, un second clic ne fait rien", () => {
  const c = creerCoeurRetour();
  let appels = 0;
  let actifPendantRappel = null;
  c.montrer(contexte("Retour", () => { appels += 1; actifPendantRappel = c.actif(); }));
  assert.equal(c.declencher(), true);
  assert.equal(c.declencher(), false);
  assert.equal(appels, 1);
  assert.equal(actifPendantRappel, false);
});

test("coeur : effacer (changement de page) supprime sans appeler le rappel ; effacer a vide ne fait rien", () => {
  const c = creerCoeurRetour();
  let appels = 0;
  c.montrer(contexte("Retour", () => { appels += 1; }));
  assert.equal(c.effacer(), true);
  assert.equal(c.effacer(), false);
  assert.equal(c.declencher(), false);
  assert.equal(appels, 0);
});

test("coeur : les abonnes sont prevenus de chaque changement", () => {
  const c = creerCoeurRetour();
  const vus = [];
  c.surChangement((x) => vus.push(x && x.libelle));
  c.montrer(contexte("A"));
  c.montrer(contexte("B"));
  c.effacer();
  assert.deepEqual(vus, ["A", "B", null]);
});

// ---------- DOM simule ----------
function faussDocument() {
  const classes = new Set();
  const fabrique = (tag) => {
    const el = { tag, hidden: false, children: [], attributs: {}, ecouteurs: {}, textContent: "", id: "", type: "" };
    el.setAttribute = (k, v) => { el.attributs[k] = v; };
    el.appendChild = (e) => { el.children.push(e); return e; };
    el.addEventListener = (type, f) => { el.ecouteurs[type] = f; };
    return el;
  };
  const doc = { body: fabrique("body"), createElement: fabrique };
  doc.body.classList = { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) };
  doc.classes = classes;
  return doc;
}

test("DOM : le bandeau est cree a la demande, libelle avec fleche, role region, classe de corps, clic = rappel une fois", () => {
  const doc = faussDocument();
  const r = creerRetourContexte({ doc, id: "quantitatifBandeauRetour", classeCorps: "quantitatif-retour-actif", ariaLabel: "Retour au quantitatif" });
  assert.equal(doc.body.children.length, 0); // rien tant qu'aucun contexte
  let appels = 0;
  r.montrer(contexte("Retour au quantitatif", () => { appels += 1; }));
  const bandeau = doc.body.children[0];
  assert.equal(bandeau.id, "quantitatifBandeauRetour");
  assert.equal(bandeau.attributs.role, "region");
  assert.equal(bandeau.attributs["aria-label"], "Retour au quantitatif");
  assert.equal(bandeau.hidden, false);
  assert.equal(bandeau.children[0].textContent, "← Retour au quantitatif");
  assert.ok(doc.classes.has("quantitatif-retour-actif"));
  bandeau.ecouteurs.click({ target: { closest: () => bandeau.children[0] } });
  bandeau.ecouteurs.click({ target: { closest: () => bandeau.children[0] } });
  assert.equal(appels, 1);
  assert.equal(bandeau.hidden, true);
  assert.ok(!doc.classes.has("quantitatif-retour-actif"));
});

test("DOM : un clic hors du bouton ne declenche rien ; effacer cache et retire la classe de corps", () => {
  const doc = faussDocument();
  const r = creerRetourContexte({ doc, id: "b", classeCorps: "c" });
  let appels = 0;
  r.montrer(contexte("Retour", () => { appels += 1; }));
  doc.body.children[0].ecouteurs.click({ target: { closest: () => null } });
  assert.equal(appels, 0);
  r.effacer();
  assert.equal(doc.body.children[0].hidden, true);
  assert.ok(!doc.classes.has("c"));
});

// ---------- Markup / CSS statique ----------
test("css : meme placement, hauteur, z-index et decalage de barre d'outils que les deux bandeaux existants", () => {
  const css = lire("src/retourContexte.css");
  const msg = lire("src/messagerie/messagerie.css");
  const regles = lire("src/reglesModale.css");
  for (const source of [css, regles]) {
    assert.match(source, /position: fixed; top: 52px; left: 0; right: 0; z-index: 55;/);
    assert.match(source, /height: 44px; box-sizing: border-box; padding: 2px 12px;/);
  }
  assert.match(msg, /#msgBandeauVue, #msgBandeauRetour \{\s*position: fixed; top: 52px; left: 0; right: 0; z-index: 55;/);
  // Le bandeau « Retour au plan 2D » (25/10) partage ces memes regles : meme composant, meme placement.
  assert.match(css, /body\.quantitatif-retour-actif #viewerToolbar, body\.plan3d-retour-actif #viewerToolbar \{ top: 56px; \}/);
  assert.match(msg, /body\.msg-retour-actif #viewerToolbar \{ top: 56px; \}/);
  assert.match(css, /min-height: 40px; border-radius: 8px; padding: 6px 16px;/);
  assert.match(css, /@media \(max-width: 768px\)[^\n]*min-height: 44px/);
  assert.match(css, /#quantitatifBandeauRetour\[hidden\], #plan3dBandeauRetour\[hidden\] \{ display: none !important; \}/);
  // tous les selecteurs sont propres au bandeau : les deux existants ne sont pas touches
  for (const ligne of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map((b) => b.split("{")[0].trim()).filter((x) => x && !x.startsWith("@"))) assert.match(ligne, /^(#quantitatifBandeauRetour|body\.quantitatif-retour-actif)/);
});

test("coexistence avec « Est-ce bien votre demande ? » du Viewer : z-index 56 > 55, barre d'outils decalee par la regle plus specifique", () => {
  const cmd = lire("src/commandesIA.css");
  assert.match(cmd, /#commandesBandeau \{\s*position: absolute; top: 0; left: 0; right: 0; z-index: 56;/);
  assert.match(cmd, /body\.commandes-confirm-actif #view-viewer #viewerToolbar \{ top: calc\(var\(--commandes-bandeau-h, 44px\) \+ 12px\); \}/);
});

test("non-regression : les deux bandeaux existants gardent leur identifiant, leur classe de corps et leur libelle", () => {
  const msgJs = lire("src/messagerie/messagerie.js");
  const reglesJs = lire("src/reglesModale.js");
  assert.match(msgJs, /bandeauRetour\.id = "msgBandeauRetour"/);
  assert.match(msgJs, /Retour à la conversation/);
  assert.match(msgJs, /classList\.toggle\("msg-retour-actif", visible\)/);
  assert.match(reglesJs, /bandeau\.id = "reglesBandeauRetour"/);
  assert.match(reglesJs, /classList\.toggle\("regles-retour-actif", visible\)/);
});

test("main.js : le bandeau est efface hors du Viewer, remplace par un autre bandeau de retour, et appele via le rappel de la page", () => {
  const main = lire("src/main.js");
  assert.match(main, /if \(retourQuantitatif && viewName !== "viewer"\) retourQuantitatif\.effacer\(\)/);
  assert.match(main, /autresClasses: \["msg-retour-actif", "regles-retour-actif"\]/);
  assert.match(main, /retour\.surRetour\(\)/);
  assert.match(main, /classeCorps: "quantitatif-retour-actif"/);
});

// ---------- Retour du systeme (29/10) : une entree d'historique posee a l'ouverture, consommee a la fermeture ----------
import { creerEntreeHistorique } from "../src/retourContexte.js";

function faussesFenetre() {
  const ecouteurs = [];
  const piles = { poussees: 0, retours: 0 };
  return {
    piles,
    history: { pushState: () => { piles.poussees += 1; }, back: () => { piles.retours += 1; } },
    addEventListener: (type, f) => { if (type === "popstate") ecouteurs.push(f); },
    popstate: () => ecouteurs.forEach((f) => f())
  };
}

test("historique : poser pousse UNE entree, une seconde pose ne fait rien", () => {
  const w = faussesFenetre();
  const h = creerEntreeHistorique(w, () => {});
  h.poser(); h.poser();
  assert.equal(w.piles.poussees, 1);
});

test("historique : le retour du systeme appelle le rappel une fois et l'entree est consommee", () => {
  const w = faussesFenetre();
  let appels = 0;
  const h = creerEntreeHistorique(w, () => { appels += 1; });
  h.poser();
  w.popstate();
  w.popstate();
  assert.equal(appels, 1);
  assert.equal(w.piles.retours, 0);
});

test("historique : liberer (retour par le bandeau ou changement de page) revient d'une entree et le popstate induit est ignore", () => {
  const w = faussesFenetre();
  let appels = 0;
  const h = creerEntreeHistorique(w, () => { appels += 1; });
  h.poser();
  h.liberer();
  assert.equal(w.piles.retours, 1);
  w.popstate();
  assert.equal(appels, 0);
  h.liberer();
  assert.equal(w.piles.retours, 1); // rien a liberer
});

test("bandeau : l'option retourSysteme branche l'entree d'historique sur le coeur ; Quantitatif l'utilise et la page rouvre le rapport a l'activation de la vue", () => {
  const rc = lire("src/retourContexte.js");
  assert.match(rc, /retourSysteme/);
  assert.match(lire("src/main.js"), /creerRetourContexte\(\{\s*id: "quantitatifBandeauRetour"[^}]*retourSysteme: true/);
  const page = lire("src/quantitatifPage.js");
  assert.match(page, /retourEnAttente/);
  assert.match(page, /surVueActivee\(nomVue\) \{\s*if \(nomVue === "quantitatif"\) \{[^}]*if \(retourEnAttente\) \{ const retour = retourEnAttente;/);
});
