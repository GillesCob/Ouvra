// Tests de la traduction (relais/traduire.js) avec un FAUX client Anthropic : aucun appel reseau, aucune cle.
import test from "node:test";
import assert from "node:assert/strict";
import { traduire, MODELE } from "../relais/traduire.js";
import { CONSIGNE } from "../relais/consigne.js";

const valeurs = {
  typesIfc: ["IfcDuctSegment", "IfcWallStandardCase"],
  niveaux: ["Level 1", "Level 2"],
  maquettes: ["Architecture", "Mechanical (CVC)"],
  noms: ["Diffuser:Supply Diffuser"],
  priorite: ["urgente", "haute", "normale", "basse"],
  statut: ["nouveau", "confirme", "ecarte"]
};
const entree = { phrase: "Passe en urgent les gaines", valeurs };
const bonneSortie = {
  resultat: "regle", portee: "un_des_deux", criteres: [{ champ: "typeIfc", valeur: "IfcDuctSegment" }],
  action: { champ: "priorite", valeur: "urgente" }, relecture: "Passer en urgente les collisions qui impliquent une gaine.", critere_introuvable: null
};
const clientQui = (reponse) => ({ messages: { parse: async (params, options) => { clientQui.dernier = { params, options }; return typeof reponse === "function" ? reponse() : reponse; } } });
const reponse = (parsed, extra = {}) => ({ parsed_output: parsed, stop_reason: "end_turn", usage: { input_tokens: 900, output_tokens: 120 }, ...extra });
const erreurAvecStatut = (status, message, code) => Object.assign(new Error(message), { status, error: code ? { error: { details: { error_code: code } } } : undefined });

test("nominal : regle du moteur + usage releve", async () => {
  const r = await traduire(entree, { client: clientQui(reponse(bonneSortie)) });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "regle");
  assert.equal(r.regle.action.valeur, "urgente");
  assert.deepEqual(r.usage, { entree: 900, sortie: 120 });
});

test("requete envoyee : modele, schema contraint, pas de reflexion, max_tokens borne, phrase dans <demande>", async () => {
  await traduire(entree, { client: clientQui(reponse(bonneSortie)) });
  const { params } = clientQui.dernier;
  assert.equal(params.model, MODELE);
  assert.equal(MODELE, "claude-sonnet-5-5");
  assert.ok(params.max_tokens <= 1000);
  assert.deepEqual(params.thinking, { type: "between_tools" });
  assert.equal(params.output_config.effort, "low");
  assert.equal(params.output_config.format.type, "json_schema");
  const contenu = params.messages[0].content;
  assert.match(contenu, /<demande>Passe en urgent les gaines<\/demande>/);
  assert.match(contenu, /IfcDuctSegment/);
  assert.equal(JSON.stringify(params).includes("geometrie"), false);
});

test("le schema envoye ne laisse passer que les valeurs presentes (enum calculees)", async () => {
  await traduire(entree, { client: clientQui(reponse(bonneSortie)) });
  const schema = JSON.stringify(clientQui.dernier.params.output_config.format.schema);
  for (const v of ["IfcDuctSegment", "IfcWallStandardCase", "Level 2", "Mechanical (CVC)", "Diffuser:Supply Diffuser", "urgente", "ecarte"]) assert.ok(schema.includes(v), v);
  assert.equal(schema.includes("IfcSlab"), false);
  for (const interdit of ['"a"', '"b"', "premier"]) assert.equal(schema.includes(interdit), false, interdit);
});

test("enumerations REELLES envoyees a l'API (pas deplacees dans une description) et objets fermes", async () => {
  await traduire(entree, { client: clientQui(reponse(bonneSortie)) });
  const schema = clientQui.dernier.params.output_config.format.schema;
  const texte = JSON.stringify(schema);
  assert.ok(texte.includes('"enum":["IfcDuctSegment","IfcWallStandardCase"]'), "enum des types IFC");
  assert.ok(texte.includes('"enum":["urgente","haute","normale","basse"]'), "enum des priorites");
  assert.equal(texte.includes("{enum:"), false, "enum transformee en texte par le SDK");
  assert.equal(schema.$schema, undefined);
  assert.equal(schema.additionalProperties, false);
});

test("aucune liste de criteres disponible : critere introuvable sans appeler le modele", async () => {
  let appels = 0;
  const client = { messages: { parse: async () => { appels += 1; return reponse(bonneSortie); } } };
  const vides = { ...valeurs, typesIfc: [], niveaux: [], maquettes: [], noms: [] };
  const r = await traduire({ phrase: "x", valeurs: vides }, { client });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "critere_introuvable");
  assert.equal(appels, 0);
});

test("valeur inventee par le modele : rejetee", async () => {
  const mauvaise = { ...bonneSortie, criteres: [{ champ: "typeIfc", valeur: "IfcRadiateur" }] };
  const r = await traduire(entree, { client: clientQui(reponse(mauvaise)) });
  assert.equal(r.ok, false);
  assert.equal(r.code, "sortie_invalide");
});

test("critere introuvable renvoye par le modele", async () => {
  const s = { resultat: "critere_introuvable", portee: null, criteres: [], action: null, relecture: "Aucun radiateur dans la maquette.", critere_introuvable: "radiateur" };
  const r = await traduire(entree, { client: clientQui(reponse(s)) });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "critere_introuvable");
});

test("erreur reseau (aucun statut) : ia_indisponible", async () => {
  const r = await traduire(entree, { client: clientQui(() => { throw new Error("fetch failed"); }) });
  assert.equal(r.ok, false);
  assert.equal(r.code, "ia_indisponible");
});

test("budget epuise : plafond du palier (429 enforced_spend_limit_reached)", async () => {
  const r = await traduire(entree, { client: clientQui(() => { throw erreurAvecStatut(429, "You have reached your API usage limits", "enforced_spend_limit_reached"); }) });
  assert.equal(r.code, "budget_epuise");
});

test("budget epuise : plafond fixe par l'organisation (400 « specified API usage limits »)", async () => {
  const r = await traduire(entree, { client: clientQui(() => { throw erreurAvecStatut(400, "You have reached your specified API usage limits. You will regain access on 2026-11-01"); }) });
  assert.equal(r.code, "budget_epuise");
});

test("limite de debit Anthropic (429 sans code de depense) : trop_de_requetes", async () => {
  const r = await traduire(entree, { client: clientQui(() => { throw erreurAvecStatut(429, "rate limit"); }) });
  assert.equal(r.code, "trop_de_requetes");
});

test("erreurs serveur et authentification : ia_indisponible, sans fuite du message brut", async () => {
  for (const status of [500, 529, 401, 403, 404]) {
    const r = await traduire(entree, { client: clientQui(() => { throw erreurAvecStatut(status, "secret-interne-xxxx"); }) });
    assert.equal(r.ok, false, String(status));
    assert.equal(r.code, "ia_indisponible", String(status));
    assert.equal(JSON.stringify(r).includes("secret-interne"), false);
  }
});

test("autre 400 (requete refusee par l'API) : ia_indisponible", async () => {
  const r = await traduire(entree, { client: clientQui(() => { throw erreurAvecStatut(400, "invalid_request_error: autre chose"); }) });
  assert.equal(r.code, "ia_indisponible");
});

test("reponse du modele qui n'est pas du JSON exploitable : sortie_invalide", async () => {
  const r = await traduire(entree, { client: clientQui(() => { throw new Error("Failed to parse structured output: Unexpected token"); }) });
  assert.equal(r.code, "sortie_invalide");
});

test("refus du modele (stop_reason refusal)", async () => {
  const r = await traduire(entree, { client: clientQui(reponse(null, { stop_reason: "refusal" })) });
  assert.equal(r.code, "refus");
});

test("sortie tronquee ou non parsable", async () => {
  assert.equal((await traduire(entree, { client: clientQui(reponse(null)) })).code, "sortie_invalide");
  assert.equal((await traduire(entree, { client: clientQui(reponse(bonneSortie, { stop_reason: "max_tokens" })) })).code, "sortie_invalide");
});

test("cle absente : ia_indisponible, aucun appel", async () => {
  const r = await traduire(entree, { client: null });
  assert.equal(r.ok, false);
  assert.equal(r.code, "ia_indisponible");
});

test("consigne : les messages destines a l'utilisateur sont courts, tutoyes et sans jargon de consigne", () => {
  assert.match(CONSIGNE, /tutoi/i);
  assert.match(CONSIGNE, /deux phrases au plus/i);
  assert.match(CONSIGNE, /jamais « valeurs permises »/);
  assert.equal(/—|–/.test(CONSIGNE), false, "tiret long dans la consigne");
});
