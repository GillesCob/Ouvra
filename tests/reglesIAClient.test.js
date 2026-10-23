// Tests du client du relais (src/reglesIAClient.js) avec un faux fetch : ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { demanderRegle } from "../src/reglesIAClient.js";

const valeurs = { typesIfc: ["IfcDuctSegment"], niveaux: [], maquettes: [], noms: [], priorite: ["urgente"], statut: ["ecarte"] };
const entree = { phrase: "Passe en urgent les gaines", valeurs };
const json = (statut, corps) => async () => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });

test("succes : le corps du relais est rendu tel quel", async () => {
  const regle = { demande: "x", relecture: "y", filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcDuctSegment" }] }, action: { champ: "priorite", valeur: "urgente" } };
  const r = await demanderRegle(entree, { fetch: json(200, { ok: true, resultat: "regle", regle }) });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "regle");
  assert.deepEqual(r.regle, regle);
});

test("requete : POST JSON vers /api/regle, uniquement la phrase et les valeurs", async () => {
  let vu;
  await demanderRegle({ ...entree, geometrie: [1, 2, 3] }, { fetch: async (url, init) => { vu = { url, init }; return new Response(JSON.stringify({ ok: true, resultat: "non_comprise", message: "m" })); } });
  assert.equal(vu.url, "/api/regle");
  assert.equal(vu.init.method, "POST");
  assert.deepEqual(Object.keys(JSON.parse(vu.init.body)).sort(), ["phrase", "valeurs"]);
  assert.equal(vu.init.credentials, "omit");
});

test("critere introuvable : message conserve", async () => {
  const r = await demanderRegle(entree, { fetch: json(200, { ok: true, resultat: "critere_introuvable", message: "Aucun radiateur." }) });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "critere_introuvable");
  assert.equal(r.message, "Aucun radiateur.");
});

test("refus du relais (429, budget) : code et message du relais conserves", async () => {
  const r = await demanderRegle(entree, { fetch: json(503, { ok: false, code: "budget_epuise", message: "Budget épuisé." }) });
  assert.deepEqual([r.ok, r.code, r.message], [false, "budget_epuise", "Budget épuisé."]);
});

test("erreur reseau : ia_indisponible avec un message clair", async () => {
  const r = await demanderRegle(entree, { fetch: async () => { throw new TypeError("Failed to fetch"); } });
  assert.equal(r.ok, false);
  assert.equal(r.code, "ia_indisponible");
  assert.match(r.message, /exemple/);
});

test("route absente (404 HTML, serveur de previsualisation sans fonction) : ia_indisponible", async () => {
  const r = await demanderRegle(entree, { fetch: async () => new Response("<html>404</html>", { status: 404 }) });
  assert.equal(r.code, "ia_indisponible");
});

test("reponse qui n'est pas du JSON, ou de forme inattendue : ia_indisponible", async () => {
  assert.equal((await demanderRegle(entree, { fetch: async () => new Response("pas json", { status: 200 }) })).code, "ia_indisponible");
  assert.equal((await demanderRegle(entree, { fetch: json(200, { ok: true, resultat: "inconnu" }) })).code, "ia_indisponible");
  assert.equal((await demanderRegle(entree, { fetch: json(200, { ok: true, resultat: "regle" }) })).code, "ia_indisponible");
  assert.equal((await demanderRegle(entree, { fetch: json(200, null) })).code, "ia_indisponible");
});

test("delai depasse : ia_indisponible", async () => {
  const fetchLent = (url, init) => new Promise((_, rejeter) => init.signal.addEventListener("abort", () => rejeter(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const r = await demanderRegle(entree, { fetch: fetchLent, delaiMs: 20 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "ia_indisponible");
});

test("la regle recue est revalidee : une regle de forme invalide est refusee", async () => {
  const r = await demanderRegle(entree, { fetch: json(200, { ok: true, resultat: "regle", regle: { demande: "x", filtre: { portee: "a", criteres: [] }, action: { champ: "priorite", valeur: "urgente" } } }) });
  assert.equal(r.ok, false);
  assert.equal(r.code, "ia_indisponible");
});

test("la regle recue ne peut contenir qu'une valeur presente dans les listes envoyees", async () => {
  const regle = { demande: "x", relecture: "y", filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcInvente" }] }, action: { champ: "priorite", valeur: "urgente" } };
  const r = await demanderRegle(entree, { fetch: json(200, { ok: true, resultat: "regle", regle }) });
  assert.equal(r.ok, false);
});
