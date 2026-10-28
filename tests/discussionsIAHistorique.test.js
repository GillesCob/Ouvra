// Historique des syntheses de conversation (28/10) : demonstration a la premiere utilisation, ajout, tri, bornes, stockage absent ou corrompu.
import test from "node:test";
import assert from "node:assert/strict";
import { listerSyntheses, ajouterSynthese, dateSynthese, CLE_SYNTHESES, SYNTHESES_MAX } from "../src/discussionsIAHistorique.js";

const stockageMemoire = (initial = {}) => {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
};
const MAINTENANT = new Date("2026-10-28T12:00:00").getTime();
const rapport = (titre) => ({ titre, date: MAINTENANT, vide: false, contexte: { texte: "x", confirme: true, sources: [] } });

test("premiere utilisation : deux syntheses de demonstration, la plus recente d'abord, enregistrees", () => {
  const s = stockageMemoire();
  const l = listerSyntheses({ stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, 2);
  assert.ok(l[0].creeLe > l[1].creeLe);
  assert.ok(l.every((e) => e.demo && e.nom));
  assert.equal(JSON.parse(s.getItem(CLE_SYNTHESES)).length, 2);
});

test("les syntheses de demonstration ne reviennent pas une fois la cle ecrite", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  assert.deepEqual(listerSyntheses({ stockage: s, maintenant: MAINTENANT }), []);
});

test("ajout : le nouveau rapport est en tete, avec son nom et sa date, et survit a une relecture", () => {
  const s = stockageMemoire();
  const l = ajouterSynthese(rapport("Accès grue"), { stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, 3);
  assert.equal(l[0].nom, "Accès grue");
  assert.equal(dateSynthese(l[0]), "28/10/2026");
  assert.equal(listerSyntheses({ stockage: s, maintenant: MAINTENANT + 1000 })[0].nom, "Accès grue");
});

test("rapport vide, modele ou absent : rien n'est ajoute", () => {
  const s = stockageMemoire();
  const avant = listerSyntheses({ stockage: s, maintenant: MAINTENANT }).length;
  for (const r of [null, { ...rapport("v"), vide: true }, { ...rapport("m"), modele: true }]) {
    assert.equal(ajouterSynthese(r, { stockage: s, maintenant: MAINTENANT }).length, avant);
  }
});

test("borne : au-dela du maximum, les plus anciennes sont retirees", () => {
  const s = stockageMemoire({ [CLE_SYNTHESES]: "[]" });
  for (let i = 0; i < SYNTHESES_MAX + 5; i++) ajouterSynthese(rapport("R" + i), { stockage: s, maintenant: MAINTENANT + i * 1000 });
  const l = listerSyntheses({ stockage: s, maintenant: MAINTENANT });
  assert.equal(l.length, SYNTHESES_MAX);
  assert.equal(l[0].nom, "R" + (SYNTHESES_MAX + 4));
});

test("stockage absent, plein ou JSON corrompu : aucune exception", () => {
  assert.equal(listerSyntheses({ stockage: null, maintenant: MAINTENANT }).length, 2);
  const plein = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.equal(ajouterSynthese(rapport("A"), { stockage: plein, maintenant: MAINTENANT })[0].nom, "A");
  assert.deepEqual(listerSyntheses({ stockage: stockageMemoire({ [CLE_SYNTHESES]: "{pas du json" }), maintenant: MAINTENANT }), []);
  assert.deepEqual(listerSyntheses({ stockage: stockageMemoire({ [CLE_SYNTHESES]: JSON.stringify([{ id: 3 }, null, { id: "a", nom: "n", creeLe: 1 }]) }), maintenant: MAINTENANT }), []);
});
