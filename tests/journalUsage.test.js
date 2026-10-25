// Tests du journal d'usage (relais/journalUsage.js) et de son branchement dans relais/http.js. Dossier temporaire, jamais le vrai .usage/.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enregistrerUsage, calculerCout, journalActif, reinitialiserAvertissement, TARIFS } from "../relais/journalUsage.js";
import { creerGestionnaire } from "../relais/http.js";

const dossier = () => mkdtempSync(join(tmpdir(), "ouvra-usage-"));
const lignes = (f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const base = { route: "regles", etape: null, resultat: "regle", usage: { entree: 1000, sortie: 200 }, dureeMs: 850.4, modele: "claude-sonnet-5-5" };

test("ecrit une ligne JSON avec les metriques et cree le dossier", () => {
  const f = join(dossier(), "sous", "appels.jsonl");
  enregistrerUsage({ ...base, phraseLongueur: 42 }, { fichier: f, env: {}, maintenant: () => new Date("2026-10-24T10:00:00Z") });
  enregistrerUsage({ ...base, code: "refus" }, { fichier: f, env: {} });
  const [a, b] = lignes(f);
  assert.deepEqual(a, {
    horodatage: "2026-10-24T10:00:00.000Z", route: "regles", etape: null, modele: "claude-sonnet-5-5", jetonsEntree: 1000, jetonsSortie: 200,
    coutDollars: 0.004, dureeMs: 850, statut: "ok", resultat: "regle", phraseLongueur: 42
  });
  assert.equal(b.statut, "refus");
});

test("aucune donnee sensible : texte libre refuse, seules des metriques", () => {
  const f = join(dossier(), "a.jsonl");
  enregistrerUsage({ ...base, resultat: "Passe en urgent les gaines du niveau 1", etape: "texte libre avec espaces", phrase: "ma phrase", extrait: "message prive", cle: "sk-ant-xxx", phraseLongueur: 38 }, { fichier: f, env: {} });
  const brut = readFileSync(f, "utf8");
  for (const interdit of ["gaines", "sk-ant", "ma phrase", "message prive"]) assert.ok(!brut.includes(interdit), interdit);
  const l = lignes(f)[0];
  assert.equal(l.resultat, null);
  assert.equal(l.etape, null);
  assert.equal(l.phraseLongueur, 38);
});

test("echec d'ecriture : aucune exception, un seul avertissement", () => {
  const dir = dossier();
  const bloc = join(dir, "fichier");
  writeFileSync(bloc, "x");
  const avertissements = [];
  const orig = console.warn;
  console.warn = (m) => avertissements.push(m);
  reinitialiserAvertissement();
  try {
    assert.equal(enregistrerUsage(base, { fichier: join(bloc, "impossible", "a.jsonl"), env: {} }), null);
    assert.equal(enregistrerUsage(base, { fichier: join(bloc, "impossible", "a.jsonl"), env: {} }), null);
  } finally {
    console.warn = orig;
  }
  assert.equal(avertissements.length, 1);
});

test("desactive sous Vercel et avec OUVRA_USAGE=0", () => {
  const f = join(dossier(), "a.jsonl");
  assert.equal(enregistrerUsage(base, { fichier: f, env: { VERCEL: "1" } }), null);
  assert.equal(enregistrerUsage(base, { fichier: f, env: { OUVRA_USAGE: "0" } }), null);
  assert.equal(existsSync(f), false);
  assert.equal(journalActif({}), true);
  assert.equal(journalActif({ OUVRA_USAGE: "1" }), true);
});

test("cout : tarif confirme calcule, modele inconnu ou jetons absents = null", () => {
  assert.deepEqual(TARIFS["claude-sonnet-5-5"], { entree: 2, sortie: 10 });
  assert.equal(calculerCout("claude-sonnet-5-5", 1_000_000, 1_000_000), 12);
  assert.equal(calculerCout("claude-inconnu", 1000, 1000), null);
  assert.equal(calculerCout("toString", 1000, 1000), null);
  assert.equal(calculerCout("claude-sonnet-5-5", undefined, 5), null);
  const f = join(dossier(), "a.jsonl");
  enregistrerUsage({ ...base, modele: "claude-inconnu" }, { fichier: f, env: {} });
  enregistrerUsage({ ...base, usage: undefined, code: "ia_indisponible" }, { fichier: f, env: {} });
  const [a, b] = lignes(f);
  assert.equal(a.coutDollars, null);
  assert.equal(b.jetonsEntree, null);
  assert.equal(b.coutDollars, null);
});

// Branchement dans relais/http.js : faux client, journal injecte (aucun fichier ecrit).
const requete = (corps) => new Request("https://x/api/regle", { method: "POST", body: JSON.stringify(corps), headers: { "x-forwarded-for": "203.0.113.9" } });
const valider = (corps) => ({ ok: true, phrase: corps.phrase, etape: corps.etape });

test("http.js : appel reussi journalise, reponse inchangee", async () => {
  const lus = [];
  const client = { messages: { parse: async () => ({ usage: { input_tokens: 10, output_tokens: 5 } }) } };
  const traduire = async (entree, { client: c }) => {
    await c.messages.parse({ model: "claude-sonnet-5-5" });
    return { ok: true, resultat: "regle", usage: { entree: 10, sortie: 5 } };
  };
  const g = creerGestionnaire({ client: () => client, valider, traduire, journal: (l) => lus.push(l), etiquette: "ia-commandes" });
  const r = await g(requete({ phrase: "abcd" }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, resultat: "regle", usage: { entree: 10, sortie: 5 } });
  assert.equal(lus.length, 1);
  assert.equal(lus[0].route, "commande");
  assert.equal(lus[0].modele, "claude-sonnet-5-5");
  assert.deepEqual(lus[0].usage, { entree: 10, sortie: 5 });
  assert.equal(lus[0].code, null);
  assert.equal(lus[0].phraseLongueur, 4);
  assert.ok(lus[0].dureeMs >= 0);
  assert.ok(!JSON.stringify(lus[0]).includes("abcd"));
});

test("http.js : refus du modele (jetons consommes) et erreur reseau (sans jetons) sont journalises avec leur code", async () => {
  const lus = [];
  const refus = { messages: { parse: async () => ({ stop_reason: "refusal", usage: { input_tokens: 30, output_tokens: 2 } }) } };
  const traduireRefus = async (e, { client: c }) => {
    await c.messages.parse({ model: "claude-sonnet-5-5" });
    return { ok: false, code: "refus" };
  };
  const g1 = creerGestionnaire({ client: () => refus, valider, traduire: traduireRefus, journal: (l) => lus.push(l) });
  assert.equal((await g1(requete({ phrase: "x" }))).status, 502);
  const panne = { messages: { parse: async () => { throw Object.assign(new Error("secret interne"), { status: 529 }); } } };
  const traduirePanne = async (e, { client: c }) => {
    try { await c.messages.parse({ model: "claude-sonnet-5-5" }); } catch { return { ok: false, code: "ia_indisponible" }; }
  };
  const g2 = creerGestionnaire({ client: () => panne, valider, traduire: traduirePanne, journal: (l) => lus.push(l) });
  assert.equal((await g2(requete({ phrase: "x" }))).status, 503);
  assert.deepEqual(lus.map((l) => [l.route, l.code, l.usage ? l.usage.entree : null]), [["regles", "refus", 30], ["regles", "ia_indisponible", null]]);
});

test("http.js : aucun appel au modele (critere introuvable) = rien de journalise ; etape transmise ; journal en panne sans effet", async () => {
  const lus = [];
  const g = creerGestionnaire({ client: () => ({ messages: { parse: async () => ({}) } }), valider, traduire: async () => ({ ok: true, resultat: "critere_introuvable" }), journal: (l) => lus.push(l) });
  assert.equal((await g(requete({ phrase: "x" }))).status, 200);
  assert.equal(lus.length, 0);

  const g2 = creerGestionnaire({
    client: () => ({ messages: { parse: async () => ({ usage: { input_tokens: 1, output_tokens: 1 } }) } }), valider, etiquette: "ia-discussions",
    etapeJournal: (e) => e.etape, journal: () => { throw new Error("disque plein"); },
    traduire: async (e, { client: c }) => { await c.messages.parse({ model: "m" }); return { ok: true, resultat: "analyse" }; }
  });
  const avert = console.warn;
  console.warn = () => {};
  try {
    assert.equal((await g2(requete({ phrase: "x", etape: "rapport" }))).status, 200);
  } finally {
    console.warn = avert;
  }
  const lus2 = [];
  const g3 = creerGestionnaire({
    client: () => ({ messages: { parse: async () => ({ usage: { input_tokens: 1, output_tokens: 1 } }) } }), valider, etiquette: "ia-discussions", etapeJournal: (e) => e.etape,
    journal: (l) => lus2.push(l), traduire: async (e, { client: c }) => { await c.messages.parse({ model: "m" }); return { ok: true, resultat: "analyse" }; }
  });
  await g3(requete({ phrase: "x", etape: "rapport" }));
  assert.deepEqual([lus2[0].route, lus2[0].etape, lus2[0].resultat], ["discussions", "rapport", "analyse"]);
});
