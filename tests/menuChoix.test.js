import test from "node:test";
import assert from "node:assert/strict";
import { positionner } from "../src/menuChoix.js";

const champ = (top, bottom) => ({ left: 16, top, bottom, width: 300 });

test("menu de choix : largeur et abscisse du champ, ouverture vers le bas quand la place suffit", () => {
  const p = positionner(champ(100, 144), 200, 700);
  assert.deepEqual(p, { left: 16, width: 300, minWidth: 0, top: 150, maxHeight: 542 });
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

import { optionsDuSelect, libelleChoisi } from "../src/menuChoix.js";

test("optionsDuSelect : ecarte les options desactivees (placeholder), liste vide sans options", () => {
  const select = { options: [{ value: "", textContent: "Choisir", disabled: true }, { value: "1", textContent: "Page 1 / 2", disabled: false }, { value: "2", textContent: "Page 2 / 2", disabled: false }] };
  assert.deepEqual(optionsDuSelect(select), [{ valeur: "1", libelle: "Page 1 / 2" }, { valeur: "2", libelle: "Page 2 / 2" }]);
  assert.deepEqual(optionsDuSelect({}), []);
});

test("libelleChoisi : libelle de la valeur, repli si inconnue", () => {
  const options = [{ valeur: "a", libelle: "A" }];
  assert.equal(libelleChoisi(options, "a"), "A");
  assert.equal(libelleChoisi(options, "z", "Choisir"), "Choisir");
  assert.equal(libelleChoisi([], "a"), "");
});

test("positionner : largeur automatique, au moins celle du champ, decalee pour rester dans l'ecran", () => {
  const large = positionner({ left: 300, top: 100, bottom: 140, width: 90 }, 120, 700, { largeurAuto: 160, largeurFenetre: 390 });
  assert.equal(large.minWidth, 160);
  assert.equal(large.width, 0);
  assert.equal(large.left, 390 - 160 - 8); // deborderait a droite : ramene dans l'ecran
  const etroit = positionner({ left: 20, top: 100, bottom: 140, width: 200 }, 120, 700, { largeurAuto: 120, largeurFenetre: 1280 });
  assert.equal(etroit.minWidth, 200); // jamais plus etroit que le champ
  assert.equal(etroit.left, 20);
});

// Mini DOM : assez pour exercer creerMenuChoix sans navigateur (ouverture, titre, ecouteurs globaux, fermeture).
class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.style = {}; this.parent = null; this.className = ""; this.textContent = ""; this.ecouteurs = {}; this.focus = () => { globalThis.document.activeElement = this; }; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  set id(v) { this.attrs.id = v; }
  get id() { return this.attrs.id || ""; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  contains(n) { return n === this || this.children.some((c) => c.contains(n)); }
  addEventListener(t, f) { (this.ecouteurs[t] ||= []).push(f); }
  tous() { return this.children.flatMap((c) => [c, ...c.tous()]); }
  correspond(sel) {
    if (sel === '[aria-selected="true"]') return this.attrs["aria-selected"] === "true";
    if (sel.startsWith(".")) return this.className.split(" ").includes(sel.slice(1));
    return false;
  }
  querySelector(sel) { return this.tous().find((n) => n.correspond(sel)) || null; }
  querySelectorAll(sel) { return this.tous().filter((n) => n.correspond(sel)); }
  getBoundingClientRect() { return { left: 10, top: 100, bottom: 140, width: 200 }; }
  get offsetHeight() { return 120; }
  get offsetWidth() { return 150; }
}

function monterFauxDom() {
  const ecouteurs = new Map(); // "cible:type" -> ensemble de fonctions
  const suivre = (cible) => ({
    addEventListener: (t, f) => { const k = cible + ":" + t; ecouteurs.set(k, (ecouteurs.get(k) || new Set()).add(f)); },
    removeEventListener: (t, f) => { ecouteurs.get(cible + ":" + t)?.delete(f); },
  });
  globalThis.document = { ...suivre("document"), createElement: (t) => new Faux(t), contains: () => true, activeElement: null };
  globalThis.window = { ...suivre("window"), innerHeight: 700, innerWidth: 1280 };
  globalThis.Event = class { constructor(t) { this.type = t; } };
  const total = () => Array.from(ecouteurs.values()).reduce((n, e) => n + e.size, 0);
  return { total, ecouteurs };
}

import { creerMenuChoix } from "../src/menuChoix.js";

test("creerMenuChoix : le titre est hors du listbox (ARIA valide), seules des options dans le listbox", () => {
  monterFauxDom();
  const conteneur = new Faux("div");
  const decl = new Faux("button");
  const m = creerMenuChoix({ conteneur });
  m.ouvrir(decl, { titre: "Exporter en", options: [{ valeur: "a", libelle: "A" }, { valeur: "b", libelle: "B" }], valeur: "b", surChoix() {} });
  const menu = conteneur.children[0];
  assert.equal(menu.getAttribute("role"), null);
  assert.equal(menu.children[0].className, "collision-menu-titre");
  const liste = menu.children[1];
  assert.equal(liste.getAttribute("role"), "listbox");
  assert.equal(liste.getAttribute("aria-label"), "Exporter en");
  assert.ok(liste.children.length === 2 && liste.children.every((o) => o.getAttribute("role") === "option"));
  assert.equal(decl.getAttribute("aria-expanded"), "true");
});

test("creerMenuChoix : sans titre pas de titre, sans option un menu vide mais sans erreur, fermer sans menu ouvert sans effet", () => {
  monterFauxDom();
  const conteneur = new Faux("div");
  const m = creerMenuChoix({ conteneur });
  assert.doesNotThrow(() => m.fermer());
  m.ouvrir(new Faux("button"), { options: [], surChoix() {} });
  const menu = conteneur.children[0];
  assert.equal(menu.children.length, 1); // le seul listbox, vide
  assert.equal(menu.children[0].children.length, 0);
  m.fermer();
  assert.equal(m.ouvert(), false);
});

test("creerMenuChoix : tous les ecouteurs globaux sont retires a la fermeture (aucune fuite apres plusieurs cycles)", () => {
  const { total } = monterFauxDom();
  const conteneur = new Faux("div");
  const decl = new Faux("button");
  const m = creerMenuChoix({ conteneur });
  const ouvertures = { titre: "T", options: [{ valeur: "a", libelle: "A" }], surChoix() {}, fermerAuDefilement: true, largeurAuto: true };
  for (let i = 0; i < 3; i++) {
    m.ouvrir(decl, { ...ouvertures });
    assert.ok(total() >= 4, "pointerdown, keydown, resize, scroll");
    m.fermer();
    assert.equal(total(), 0);
    assert.equal(conteneur.children.length, 0);
  }
});

test("creerMenuChoix : ouvrir sur un autre declencheur remplace le menu, sur le meme declencheur le ferme", () => {
  const { total } = monterFauxDom();
  const conteneur = new Faux("div");
  const d1 = new Faux("button"), d2 = new Faux("button");
  const m = creerMenuChoix({ conteneur });
  const o = () => ({ options: [{ valeur: "a", libelle: "A" }], surChoix() {} });
  m.ouvrir(d1, o());
  m.ouvrir(d2, o());
  assert.equal(conteneur.children.length, 1);
  assert.equal(d1.getAttribute("aria-expanded"), "false");
  m.ouvrir(d2, o());
  assert.equal(m.ouvert(), false);
  assert.equal(total(), 0);
});

test("creerMenuChoix : choisir une option ferme le menu et renvoie la valeur", () => {
  monterFauxDom();
  const conteneur = new Faux("div");
  const m = creerMenuChoix({ conteneur });
  let recu = null;
  m.ouvrir(new Faux("button"), { options: [{ valeur: "pdf", libelle: "PDF" }], surChoix: (v) => { recu = v; } });
  conteneur.children[0].children[0].children[0].ecouteurs.click[0]();
  assert.equal(recu, "pdf");
  assert.equal(m.ouvert(), false);
});
