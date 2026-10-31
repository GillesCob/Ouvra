// Encart « Demande à l'IA » de la synthese (31/10) : pour la zone Quantitatif, le clic OUVRE la demande ecrite dans l'onglet Quantitatif (modifiable avant l'envoi)
// au lieu de seulement la copier. Les autres zones gardent la copie. Raccourci, retour arriere = ne plus passer `ouvrir`. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creerEncartDemande } from "../src/discussionsIADemandeCopie.js";

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

test("avec ouvrir : le clic ouvre la phrase exacte, la copie reste en filet silencieux, un echec de copie n'empeche rien", async () => {
  const ouverts = []; const copies = [];
  const groupe = creerEncartDemande({ doc, demande: { zone: "quantitatif", phrase: PHRASE }, zone: "Quantitatif", ecrire: async (t) => { copies.push(t); throw new Error("refuse"); }, ouvrir: (p) => ouverts.push(p) });
  const bouton = tous(groupe).find((e) => e.tag === "button");
  await bouton.ecouteurs.click();
  assert.deepEqual(ouverts, [PHRASE]);
  assert.deepEqual(copies, [PHRASE]);
  assert.equal(bouton.dataset.etat, "copier", "pas de retour « Copié » : on quitte la synthese");
});

test("avec ouvrir : libelles « ouvrir » (plus de « coller »), nom accessible qui commence par le texte visible", () => {
  const groupe = creerEncartDemande({ doc, demande: { zone: "quantitatif", phrase: PHRASE }, zone: "Quantitatif", ecrire: async () => {}, ouvrir: () => {} });
  const els = tous(groupe);
  const textes = els.map((e) => e.textContent).join("|");
  assert.match(textes, /Demande à l'IA, à ouvrir dans Quantitatif/);
  assert.match(textes, /Ouvrir/);
  assert.doesNotMatch(textes, /à coller/);
  const bouton = els.find((e) => e.tag === "button");
  assert.match(bouton.attrs["aria-label"], /^Demande à l'IA, à ouvrir dans Quantitatif/);
  assert.match(bouton.attrs["aria-label"], /Ouvrir la demande/);
});

test("sans ouvrir : fonctionnement actuel inchange (copier)", async () => {
  const copies = [];
  const groupe = creerEncartDemande({ doc, demande: { zone: "viewer", phrase: PHRASE }, zone: "Viewer", ecrire: async (t) => { copies.push(t); } });
  const els = tous(groupe);
  assert.match(els.map((e) => e.textContent).join("|"), /à coller dans Viewer/);
  await els.find((e) => e.tag === "button").ecouteurs.click();
  assert.deepEqual(copies, [PHRASE]);
});

test("cablage : seule la zone quantitatif recoit ouvrir ; le montage ferme le rapport puis ouvre la demande dans la page Quantitatif", () => {
  const vue = readFileSync(new URL("../src/discussionsIARapportVue.js", import.meta.url), "utf8");
  assert.match(vue, /demande\.zone === "quantitatif"/);
  assert.match(vue, /ouvrirDemande/);
  const montage = readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8");
  assert.match(montage, /ouvrirDemande/);
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /creerDiscussionsIAMontage\(\{[\s\S]*?ouvrirDemande/);
  assert.match(main, /quantitatif\.ouvrirDemande\(/);
  const page = readFileSync(new URL("../src/quantitatifPage.js", import.meta.url), "utf8");
  assert.match(page, /ouvrirDemande\(phrase\) \{ demandeEnAttente = phrase;/);
  assert.match(page, /saisie\.reformuler\(phrase\)/);
  assert.match(page, /demandeEnAttente = null; saisie|if \(demandeEnAttente\)/, "la phrase est ouverte a l'activation reelle de la page");
  assert.match(montage, /flux\.refuser\(\); bandeau\.masquer\(false\)/, "question en attente abandonnee avant de partir");
});
