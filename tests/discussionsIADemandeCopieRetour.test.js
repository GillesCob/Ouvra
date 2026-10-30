// Encart « Demande à l'IA » (30/10) : le retour de la copie se voit DANS l'encart (libelle « Copié ✓ » ~2 s puis retour a « Copier »), jamais dans une bulle detachee.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerEncartDemande, DUREE_COPIE_MS, LIBELLES_COPIE } from "../src/discussionsIADemandeCopie.js";

function faux(tag) {
  const el = { tag, className: "", textContent: "", attrs: {}, dataset: {}, enfants: [], ecouteurs: {}, type: "" };
  el.setAttribute = (k, v) => { el.attrs[k] = v; };
  el.append = (...e) => { el.enfants.push(...e); };
  el.appendChild = (e) => { el.enfants.push(e); return e; };
  el.addEventListener = (n, f) => { el.ecouteurs[n] = f; };
  return el;
}
const doc = { createElement: faux };
const tous = (el) => [el, ...el.enfants.flatMap(tous)];
const PHRASE = "Compte les gaines du niveau 2, par famille";
function monter(ecrire) {
  const minuteurs = [];
  const planifier = (f, ms) => { minuteurs.push({ f, ms, annule: false }); return minuteurs.length - 1; };
  const annuler = (id) => { if (minuteurs[id]) minuteurs[id].annule = true; };
  const groupe = creerEncartDemande({ doc, demande: { zone: "quantitatif", phrase: PHRASE }, zone: "Quantitatif", ecrire, planifier, annuler });
  const els = tous(groupe);
  return { groupe, bouton: els.find((e) => e.tag === "button"), annonce: els.find((e) => e.attrs.role === "status"), minuteurs, els };
}

test("avant le clic : l'invite « Copier » est lisible dans l'encart, etat initial", () => {
  const { bouton, els } = monter(async () => {});
  assert.equal(bouton.dataset.etat, "copier");
  const libelles = els.filter((e) => e.dataset.libelle).map((e) => [e.dataset.libelle, e.textContent]);
  assert.deepEqual(libelles, [["copier", "Copier"], ["copie", "Copié ✓"], ["echec", "Non copié"]]);
  assert.deepEqual(LIBELLES_COPIE, { copier: "Copier", copie: "Copié ✓", echec: "Non copié" });
});

test("clic : phrase exacte copiee, etat « copie » dans l'encart, annonce role=status, puis retour a « copier » apres 2 s", async () => {
  const copies = [];
  const { bouton, annonce, minuteurs } = monter(async (t) => { copies.push(t); });
  await bouton.ecouteurs.click();
  assert.deepEqual(copies, [PHRASE]);
  assert.equal(bouton.dataset.etat, "copie");
  assert.equal(annonce.textContent, "Demande copiée");
  assert.equal(annonce.attrs["aria-live"], "polite");
  assert.equal(minuteurs.length, 1);
  assert.equal(minuteurs[0].ms, DUREE_COPIE_MS);
  assert.equal(DUREE_COPIE_MS, 2000);
  minuteurs[0].f();
  assert.equal(bouton.dataset.etat, "copier");
  assert.equal(annonce.textContent, "");
});

test("deux clics rapproches : le premier minuteur est annule, l'etat reste « copie » pleine duree", async () => {
  const { bouton, minuteurs } = monter(async () => {});
  await bouton.ecouteurs.click();
  await bouton.ecouteurs.click();
  assert.equal(minuteurs[0].annule, true);
  assert.equal(minuteurs.length, 2);
  assert.equal(bouton.dataset.etat, "copie");
});

test("copie refusee : etat « echec » dans l'encart, annonce, retour a « copier »", async () => {
  const { bouton, annonce, minuteurs } = monter(async () => { throw new Error("refus"); });
  await bouton.ecouteurs.click();
  assert.equal(bouton.dataset.etat, "echec");
  assert.equal(annonce.textContent, "Copie impossible");
  minuteurs[0].f();
  assert.equal(bouton.dataset.etat, "copier");
});

test("accessibilite : vrai bouton, nom accessible commence par le texte visible, aucune bulle (pas de title ni de tooltip)", () => {
  const { bouton, els } = monter(async () => {});
  assert.equal(bouton.tag, "button");
  assert.equal(bouton.type, "button");
  assert.ok(bouton.attrs["aria-label"].startsWith("Demande à l'IA, à coller dans Quantitatif"));
  assert.ok(bouton.attrs["aria-label"].includes(PHRASE));
  assert.ok(els.every((e) => !("title" in e.attrs) && !e.attrs.popover));
});

test("css : etats par data-etat, place reservee (grille, libelles empiles), style de validation vert existant, mouvement reduit, pas de bulle", () => {
  const css = readFileSync(new URL("../src/discussionsIA.css", import.meta.url), "utf8");
  assert.match(css, /\.disc-rapport-demande\[data-etat="copie"\]/);
  assert.match(css, /\.disc-rapport-demande-etat \{[^}]*display: inline-grid/);
  assert.match(css, /\.disc-rapport-demande-etat > span \{[^}]*grid-area: 1 \/ 1; visibility: hidden/);
  assert.match(css, /#7fae84/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^}]*disc-rapport-demande/);
  const vue = readFileSync(new URL("../src/discussionsIARapportVue.js", import.meta.url), "utf8");
  assert.ok(vue.includes("creerEncartDemande"));
  assert.doesNotMatch(vue, /etat\.textContent/);
});
