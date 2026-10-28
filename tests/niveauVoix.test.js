// Tests du niveau sonore de la voix (src/niveauVoix.js) avec de FAUX flux micro, contexte audio et boucle d'animation : aucun micro reel. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { niveauRMS, lisserNiveau, demarrerNiveauVoix } from "../src/niveauVoix.js";

const silence = (n = 8) => new Uint8Array(n).fill(128);

test("niveauRMS : silence et echantillons vides donnent 0", () => {
  assert.equal(niveauRMS(silence()), 0);
  assert.equal(niveauRMS(new Uint8Array(0)), 0);
  assert.equal(niveauRMS(null), 0);
});

test("niveauRMS : un signal plus fort donne un niveau plus haut, toujours borne entre 0 et 1", () => {
  const faible = niveauRMS(Uint8Array.from([128, 132, 124, 130, 126, 128, 131, 125]));
  const fort = niveauRMS(Uint8Array.from([128, 200, 56, 190, 66, 128, 210, 46]));
  assert.ok(faible > 0 && faible < fort);
  assert.equal(niveauRMS(Uint8Array.from([0, 255, 0, 255])), 1); // sature : plafonne a 1
  assert.ok(fort <= 1 && faible >= 0);
});

test("lisserNiveau : attaque rapide, retombee lente, bornes 0 a 1", () => {
  const monte = lisserNiveau(0, 1);
  const descend = lisserNiveau(1, 0);
  assert.ok(monte > 0.4); // monte vite
  assert.ok(1 - descend < 0.2); // redescend lentement
  assert.ok(monte > 1 - descend);
  assert.equal(lisserNiveau(0, 0), 0);
  assert.ok(lisserNiveau(0.5, 5) <= 1);
  assert.ok(lisserNiveau(0.5, -3) >= 0);
  assert.equal(lisserNiveau(Number.NaN, 0.3) >= 0, true);
});

function fabrique({ refuse = false, sansMedia = false } = {}) {
  const etat = { pistesArretees: 0, contexteFerme: 0, flux: 0, boucles: new Map(), annulees: [], niveaux: [], prochain: 1, ech: silence(), resolu: null };
  const piste = { stop: () => { etat.pistesArretees += 1; } };
  const flux = { getTracks: () => [piste] };
  const analyseur = { fftSize: 256, getByteTimeDomainData: (t) => { t.fill(128); t.set(etat.ech.subarray(0, t.length)); } };
  const contexte = {
    createMediaStreamSource: () => ({ connect: () => {} }),
    createAnalyser: () => analyseur,
    resume: () => Promise.resolve(),
    close: () => { etat.contexteFerme += 1; return Promise.resolve(); }
  };
  const deps = {
    mediaDevices: sansMedia ? undefined : { getUserMedia: () => { etat.flux += 1; return refuse ? Promise.reject(new Error("refus")) : new Promise((res) => { etat.resolu = () => res(flux); }); } },
    creerContexte: () => contexte,
    planifier: (f) => { const id = etat.prochain++; etat.boucles.set(id, f); return id; },
    annuler: (id) => { etat.annulees.push(id); etat.boucles.delete(id); },
    surNiveau: (n) => etat.niveaux.push(n)
  };
  etat.image = () => { const [[id, f]] = [...etat.boucles]; etat.boucles.delete(id); f(); };
  return { etat, deps };
}
const attendre = () => new Promise((r) => setImmediate(r));

test("ouverture reussie : une boucle tourne et publie le niveau lisse", async () => {
  const { etat, deps } = fabrique();
  const ouvertures = [];
  const h = demarrerNiveauVoix({ ...deps, surOuvert: () => ouvertures.push(true) });
  etat.resolu(); await attendre();
  assert.deepEqual(ouvertures, [true]);
  etat.ech = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 255 : 0));
  etat.image();
  assert.ok(etat.niveaux.at(-1) > 0.4);
  etat.ech = silence(); etat.image(); etat.image();
  const apres = etat.niveaux.at(-1);
  assert.ok(apres > 0 && apres < etat.niveaux[0]); // retombe sans chuter d'un coup
  h.fermer();
});

test("fermer libere tout : pistes arretees, contexte ferme, boucle annulee, plus de niveau publie", async () => {
  const { etat, deps } = fabrique();
  const h = demarrerNiveauVoix(deps);
  etat.resolu(); await attendre();
  h.fermer();
  assert.equal(etat.pistesArretees, 1);
  assert.equal(etat.contexteFerme, 1);
  assert.equal(etat.boucles.size, 0);
  assert.ok(etat.annulees.length >= 1);
  h.fermer(); // idempotent
  assert.equal(etat.pistesArretees, 1);
  assert.equal(etat.contexteFerme, 1);
});

test("fermer avant la fin de l'ouverture : le flux obtenu ensuite est aussitot libere, aucune boucle ne demarre", async () => {
  const { etat, deps } = fabrique();
  const ouvertures = [];
  const h = demarrerNiveauVoix({ ...deps, surOuvert: () => ouvertures.push(true) });
  h.fermer();
  etat.resolu(); await attendre();
  assert.equal(etat.pistesArretees, 1);
  assert.equal(etat.boucles.size, 0);
  assert.deepEqual(ouvertures, []);
});

test("refus du micro : silence total, aucune exception, aucune boucle, le repli est signale", async () => {
  const { etat, deps } = fabrique({ refuse: true });
  const echecs = [];
  const h = demarrerNiveauVoix({ ...deps, surEchec: () => echecs.push(true) });
  await attendre();
  assert.equal(etat.boucles.size, 0);
  assert.deepEqual(echecs, [true]);
  assert.doesNotThrow(() => h.fermer());
});

test("pas de mediaDevices ni de contexte audio : repli sans exception", async () => {
  const a = fabrique({ sansMedia: true });
  assert.doesNotThrow(() => demarrerNiveauVoix(a.deps).fermer());
  const b = fabrique();
  const h = demarrerNiveauVoix({ ...b.deps, creerContexte: () => { throw new Error("pas d'AudioContext"); } });
  b.etat.resolu(); await attendre();
  assert.equal(b.etat.pistesArretees, 1); // la piste ouverte est liberee meme si le contexte echoue
  assert.equal(b.etat.boucles.size, 0);
  h.fermer();
});

test("dependances absentes (mediaDevices indefini) : jamais d'exception", () => {
  assert.doesNotThrow(() => demarrerNiveauVoix({}).fermer());
});
