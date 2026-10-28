// Tests de la couche HTTP du relais (relais/http.js) : Request/Response standard, faux client.
import test from "node:test";
import assert from "node:assert/strict";
import { creerGestionnaire, MESSAGES } from "../relais/http.js";

const valeurs = {
  typesIfc: ["IfcDuctSegment"], niveaux: ["Level 1"], maquettes: ["Architecture"], noms: [],
  priorite: ["urgente", "haute", "normale", "basse"], statut: ["nouveau", "confirme", "ecarte"]
};
const sortieOk = {
  resultat: "regle", portee: "un_des_deux", criteres: [{ champ: "typeIfc", valeur: "IfcDuctSegment" }],
  action: { champ: "priorite", valeur: "urgente" }, relecture: "Passer en urgente les collisions qui impliquent une gaine.", critere_introuvable: null
};
const fauxClient = (impl) => ({ messages: { parse: impl || (async () => ({ parsed_output: sortieOk, stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } })) } });
const requete = (corps, { methode = "POST", ip = "203.0.113.7", brut } = {}) =>
  new Request("https://ouvra.gillescobigo.com/api/regle", { method: methode, headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: methode === "GET" ? undefined : (brut ?? JSON.stringify(corps)) });
const corpsValide = { phrase: "Passe en urgent les gaines", valeurs };
const lire = async (r) => ({ statut: r.status, json: await r.json() });

test("succes : 200 et regle", async () => {
  const g = creerGestionnaire({ client: () => fauxClient() });
  const { statut, json } = await lire(await g(requete(corpsValide)));
  assert.equal(statut, 200);
  assert.equal(json.ok, true);
  assert.equal(json.regle.action.valeur, "urgente");
});

test("seule la methode POST est acceptee", async () => {
  const g = creerGestionnaire({ client: () => fauxClient() });
  const r = await g(requete(null, { methode: "GET" }));
  assert.equal(r.status, 405);
  assert.equal(r.headers.get("allow"), "POST");
});

test("corps qui n'est pas du JSON : 400", async () => {
  const g = creerGestionnaire({ client: () => fauxClient() });
  const { statut, json } = await lire(await g(requete(null, { brut: "{pas du json" })));
  assert.equal(statut, 400);
  assert.equal(json.code, "entree_invalide");
});

test("corps trop gros : 413 sans appeler le modele", async () => {
  let appels = 0;
  const g = creerGestionnaire({ client: () => fauxClient(async () => { appels += 1; }) });
  const { statut, json } = await lire(await g(requete(null, { brut: JSON.stringify({ phrase: "a", pad: "x".repeat(40000) }) })));
  assert.equal(statut, 413);
  assert.equal(json.code, "entree_invalide");
  assert.equal(appels, 0);
});

test("phrase vide : 400, sans appel", async () => {
  let appels = 0;
  const g = creerGestionnaire({ client: () => fauxClient(async () => { appels += 1; }) });
  const { statut } = await lire(await g(requete({ ...corpsValide, phrase: "" })));
  assert.equal(statut, 400);
  assert.equal(appels, 0);
});

test("limite par visiteur : refus 429 au-dela, un autre visiteur passe", async () => {
  const g = creerGestionnaire({ client: () => fauxClient(), limites: { parMinute: 2, parHeure: 100 } });
  const codes = [];
  for (let i = 0; i < 3; i += 1) codes.push((await g(requete(corpsValide))).status);
  assert.deepEqual(codes, [200, 200, 429]);
  assert.equal((await g(requete(corpsValide, { ip: "198.51.100.9" }))).status, 200);
});

test("la limite compte aussi les requetes invalides (pas de contournement par du bruit)", async () => {
  const g = creerGestionnaire({ client: () => fauxClient(), limites: { parMinute: 2, parHeure: 100 } });
  await g(requete({ ...corpsValide, phrase: "" }));
  await g(requete({ ...corpsValide, phrase: "" }));
  assert.equal((await g(requete(corpsValide))).status, 429);
});

test("budget epuise : 503 et code budget_epuise", async () => {
  const g = creerGestionnaire({ client: () => fauxClient(async () => { throw Object.assign(new Error("x"), { status: 429, error: { error: { details: { error_code: "enforced_spend_limit_reached" } } } }); }) });
  const { statut, json } = await lire(await g(requete(corpsValide)));
  assert.equal(statut, 503);
  assert.equal(json.code, "budget_epuise");
  assert.match(json.message, /budget/i);
});

test("erreur reseau : 503 ia_indisponible", async () => {
  const g = creerGestionnaire({ client: () => fauxClient(async () => { throw new Error("ECONNRESET"); }) });
  const { statut, json } = await lire(await g(requete(corpsValide)));
  assert.equal(statut, 503);
  assert.equal(json.code, "ia_indisponible");
});

test("la cle n'apparait jamais dans une reponse, succes comme erreur", async () => {
  const cle = "CLE-FACTICE-SECRETE-DE-TEST";
  const g = creerGestionnaire({ client: () => fauxClient(async () => { throw new Error("401 invalid x-api-key " + cle); }), cle });
  const erreur = JSON.stringify((await lire(await g(requete(corpsValide)))).json);
  assert.equal(erreur.includes("CLE-FACTICE-SECRETE"), false);
  const g2 = creerGestionnaire({ client: () => fauxClient(), cle });
  const ok = JSON.stringify((await lire(await g2(requete(corpsValide)))).json);
  assert.equal(ok.includes("CLE-FACTICE-SECRETE"), false);
});

test("pas de client (cle absente) : 503 ia_indisponible", async () => {
  const g = creerGestionnaire({ client: () => null });
  const { statut, json } = await lire(await g(requete(corpsValide)));
  assert.equal(statut, 503);
  assert.equal(json.code, "ia_indisponible");
});

test("reponses jamais mises en cache", async () => {
  const g = creerGestionnaire({ client: () => fauxClient() });
  assert.equal((await g(requete(corpsValide))).headers.get("cache-control"), "no-store");
});

test("limite atteinte : message humain qui dit quand reessayer, en secondes puis en minutes, et en-tete retry-after", async () => {
  let t = 1000000;
  const g = creerGestionnaire({ client: () => fauxClient(), limites: { parMinute: 1, parHeure: 100 }, maintenant: () => t });
  await g(requete(corpsValide));
  t += 20000;
  let r = await g(requete(corpsValide));
  const json = await r.json();
  assert.equal(r.status, 429);
  assert.equal(json.code, "trop_de_requetes");
  assert.equal(json.message, "Trop de demandes envoyées. Réessayer dans 40 secondes.");
  assert.equal(r.headers.get("retry-after"), "40");
  // limite horaire : on parle en minutes
  t = 5000000;
  const h = creerGestionnaire({ client: () => fauxClient(), limites: { parMinute: 100, parHeure: 1 }, maintenant: () => t });
  await h(requete(corpsValide));
  t += 60000;
  r = await h(requete(corpsValide));
  assert.equal((await r.json()).message, "Trop de demandes envoyées. Réessayer dans environ 59 minutes.");
  // une seconde restante : singulier
  t = 9000000;
  const u = creerGestionnaire({ client: () => fauxClient(), limites: { parMinute: 1, parHeure: 100 }, maintenant: () => t });
  await u(requete(corpsValide));
  t += 59000;
  assert.equal((await (await u(requete(corpsValide))).json()).message, "Trop de demandes envoyées. Réessayer dans 1 seconde.");
});

test("tous les textes affiches par le relais : forme impersonnelle, deux phrases au plus, sans tiret long ni jargon ni virgule avant et/ou ni deux-points", () => {
  for (const [code, m] of Object.entries(MESSAGES)) {
    assert.equal(/—|–/.test(m), false, code);
    assert.equal(/, (et|ou) /.test(m), false, code + " : virgule avant et/ou");
    assert.equal(m.includes(":"), false, code + " : deux-points");
    assert.ok(m.split(/(?<=[.!?])\s+/).length <= 2, code + " : plus de deux phrases");
    assert.equal(/\b(code|erreur \d|http|json|api|serveur|relais|budget_epuise)\b/i.test(m), false, code + " : jargon");
    assert.equal(/\b(vous|votre|vos)\b/i.test(m), false, code + " : vouvoiement");
  }
});
