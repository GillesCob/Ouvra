// Tests de l'appel du relais depuis la page (src/discussionsIAClient.js) avec un FAUX fetch : aucun reseau.
import test from "node:test";
import assert from "node:assert/strict";
import { demanderComprehension, demanderAnalyse } from "../src/discussionsIAClient.js";

const repond = (corps, statut = 200) => async () => ({ status: statut, json: async () => corps });
const valeurs = { personnes: ["Ana Roux"], extra: "ignoré" };

test("comprehension : commande recue, corps envoye minimal (etape, phrase, noms, date)", async () => {
  let envoye;
  const fetch = async (url, init) => { envoye = { url, init }; return { json: async () => ({ ok: true, resultat: "commande", commande: { action: "etat_discussions", parametres: {} }, relecture: "Afficher." }) }; };
  const r = await demanderComprehension({ phrase: "non lues", valeurs, aujourdhui: "2026-10-24" }, { fetch });
  assert.deepEqual(r, { ok: true, resultat: "commande", commande: { action: "etat_discussions", parametres: {} }, relecture: "Afficher." });
  assert.equal(envoye.url, "/api/discussions");
  assert.equal(envoye.init.credentials, "omit");
  assert.deepEqual(JSON.parse(envoye.init.body), { etape: "comprendre", phrase: "non lues", valeurs: { personnes: ["Ana Roux"] }, aujourdhui: "2026-10-24" });
});

test("comprehension : critere introuvable et non comprise rendus tels quels", async () => {
  for (const resultat of ["critere_introuvable", "non_comprise"]) {
    const r = await demanderComprehension({ phrase: "x", valeurs, aujourdhui: "2026-10-24" }, { fetch: repond({ ok: true, resultat, message: "Message." }) });
    assert.deepEqual(r, { ok: true, resultat, message: "Message." });
  }
});

test("comprehension : erreur du relais relayee ; reponse inattendue, JSON invalide, reseau coupe -> ia_indisponible", async () => {
  const echec = await demanderComprehension({ phrase: "x", valeurs, aujourdhui: "2026-10-24" }, { fetch: repond({ ok: false, code: "budget_epuise", message: "Budget épuisé." }, 503) });
  assert.deepEqual(echec, { ok: false, code: "budget_epuise", message: "Budget épuisé." });
  const inattendues = [{ ok: true, resultat: "commande" }, { ok: true }, null, "x", { ok: false }];
  for (const corps of inattendues) assert.equal((await demanderComprehension({ phrase: "x", valeurs, aujourdhui: "d" }, { fetch: repond(corps) })).code, "ia_indisponible");
  assert.equal((await demanderComprehension({ phrase: "x", valeurs, aujourdhui: "d" }, { fetch: async () => ({ json: async () => { throw new Error("pas du json"); } }) })).code, "ia_indisponible");
  assert.equal((await demanderComprehension({ phrase: "x", valeurs, aujourdhui: "d" }, { fetch: async () => { throw new Error("réseau"); } })).code, "ia_indisponible");
});

test("delai depasse -> code delai, message distinct", async () => {
  const fetch = (url, init) => new Promise((_, rejette) => init.signal.addEventListener("abort", () => rejette(new Error("abort"))));
  const r = await demanderComprehension({ phrase: "x", valeurs, aujourdhui: "d" }, { fetch, delaiMs: 5 });
  assert.equal(r.code, "delai");
  assert.match(r.message, /trop de temps/);
});

test("analyse : sortie rendue ; corps envoye = action, phrase, sujet, extraits", async () => {
  let envoye;
  const fetch = async (url, init) => { envoye = JSON.parse(init.body); return { json: async () => ({ ok: true, sortie: { resultats: [] } }) }; };
  const extraits = [{ id: "M1", discussion: "d", auteur: "a", quand: "2026-10-22 14:00", texte: "t" }];
  const r = await demanderAnalyse({ action: "retrouver_echange", phrase: "p", sujet: "s", extraits }, { fetch });
  assert.deepEqual(r, { ok: true, sortie: { resultats: [] } });
  assert.deepEqual(envoye, { etape: "analyser", action: "retrouver_echange", phrase: "p", sujet: "s", extraits });
});

test("analyse : relais qui refuse le lot -> message specifique, pas celui de la phrase ; sortie absente -> ia_indisponible", async () => {
  const r = await demanderAnalyse({ action: "rapport", phrase: "p", sujet: "s", extraits: [] }, { fetch: repond({ ok: false, code: "entree_invalide", message: "La demande n'est pas valide (phrase vide ou de plus de 200 caractères)." }, 400) });
  assert.equal(r.code, "entree_invalide");
  assert.match(r.message, /messages à analyser/);
  assert.equal((await demanderAnalyse({ action: "rapport", phrase: "p", sujet: "s", extraits: [] }, { fetch: repond({ ok: true }) })).code, "ia_indisponible");
});
