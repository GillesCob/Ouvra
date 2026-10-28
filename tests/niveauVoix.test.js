// Tests du niveau sonore de la voix (src/niveauVoix.js) avec de FAUX flux micro, contexte audio et boucle d'animation : aucun micro reel. Ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { niveauRMS, lisserNiveau, creerNormaliseur, demarrerNiveauVoix } from "../src/niveauVoix.js";

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
  assert.ok(Math.abs(niveauRMS(Uint8Array.from([0, 255, 0, 255])) - 1) < 0.01); // pleine echelle : RMS brut 1 (plus de gain fixe)
  assert.ok(niveauRMS(Uint8Array.from([128 + 4, 128 - 4, 128 + 4, 128 - 4])) < 0.05); // RMS brut : 4/128 reste faible
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

// Simulation : une « voix » = oscillation de RMS donne, bruit = RMS tres faible. 60 images par seconde (16,7 ms).
const IMG = 1000 / 60;
const voix = (i, rms) => rms * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.9))); // enveloppe syllabique
function jouer(n, rmsDe, norm = creerNormaliseur(), debut = 0) {
  const sortie = [];
  for (let i = 0; i < n; i += 1) sortie.push(norm.pousser(rmsDe(i + debut), IMG));
  return { norm, sortie };
}
const moyenne = (t) => t.reduce((a, b) => a + b, 0) / t.length;

test("normaliseur : voix normale d'ordinateur portable (RMS 0,03) atteint au moins 0,7 en moyenne apres un bruit ambiant", () => {
  const { norm } = jouer(30, (i) => 0.004 + 0.001 * Math.sin(i)); // 0,5 s de piece calme : plancher de bruit
  const { sortie } = jouer(120, (i) => voix(i, 0.03), norm, 30);
  assert.ok(moyenne(sortie.slice(20)) >= 0.7, `moyenne ${moyenne(sortie.slice(20))}`);
  assert.ok(Math.max(...sortie) >= 0.9);
});

test("normaliseur : voix faible (RMS 0,015) reste nettement visible (compression racine)", () => {
  const { norm } = jouer(30, () => 0.004);
  const { sortie } = jouer(120, (i) => voix(i, 0.015), norm, 30);
  assert.ok(moyenne(sortie.slice(20)) >= 0.45);
});

test("normaliseur : silence et bruit ambiant (meme assez haut, RMS 0,01) restent sous 0,05, sans amplifier le silence", () => {
  const calme = jouer(300, (i) => 0.003 + 0.0005 * Math.sin(i));
  assert.ok(Math.max(...calme.sortie.slice(20)) < 0.05);
  const bruit = jouer(300, (i) => 0.01 + 0.001 * Math.sin(i * 1.7));
  assert.ok(Math.max(...bruit.sortie.slice(20)) < 0.05, `bruit ${Math.max(...bruit.sortie.slice(20))}`);
  assert.equal(creerNormaliseur().pousser(0, IMG), 0);
});

test("normaliseur : le plancher s'adapte a un bruit ambiant qui monte lentement", () => {
  const { norm } = jouer(30, () => 0.003);
  const monte = jouer(2700, (i) => 0.003 + 0.02 * Math.min(1, i / 300), norm, 30); // 45 s, bruit passe de 0,003 a 0,023 en 5 s puis reste
  assert.ok(Math.max(...monte.sortie.slice(-300)) < 0.15, `fin ${Math.max(...monte.sortie.slice(-300))}`);
});

test("normaliseur : retombee nette apres la voix, le halo atteint vraiment le bas en moins d'une seconde", () => {
  const { norm } = jouer(30, () => 0.004);
  const parle = jouer(90, (i) => voix(i, 0.03), norm, 30);
  assert.ok(Math.max(...parle.sortie) > 0.8);
  const apres = jouer(60, () => 0.004, norm, 120); // 1 s de silence
  let lisse = Math.max(...parle.sortie.slice(-3));
  const lisses = apres.sortie.map((b) => (lisse = lisserNiveau(lisse, b)));
  assert.ok(lisses.at(-1) < 0.05, `retombe a ${lisses.at(-1)}`);
  assert.ok(lisses[1] > 0.1); // mais pas d'un coup
});

test("normaliseur : le pic retombe lentement, une voix plus faible 10 s apres redevient visible", () => {
  const { norm } = jouer(30, () => 0.004);
  jouer(60, (i) => voix(i, 0.15), norm, 30); // cri : pic haut
  const tard = jouer(720, (i) => voix(i, 0.03), norm, 90); // apres ~10 s de voix normale
  assert.ok(moyenne(tard.sortie.slice(-60)) >= 0.5);
});

test("normaliseur : valeurs aberrantes (NaN, negatif, dt nul) donnent un niveau borne entre 0 et 1", () => {
  const n = creerNormaliseur();
  for (const v of [Number.NaN, -1, 5, 0.5]) { const r = n.pousser(v, 0); assert.ok(r >= 0 && r <= 1); }
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
  etat.image(); etat.image(); // piece calme : plancher de bruit
  etat.ech = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 160 : 96)); // voix : RMS brut 0,25
  etat.image(); etat.image(); etat.image();
  const haut = etat.niveaux.at(-1);
  assert.ok(haut > 0.4);
  etat.ech = silence(); etat.image(); etat.image();
  const apres = etat.niveaux.at(-1);
  assert.ok(apres > 0 && apres < haut); // retombe sans chuter d'un coup
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
