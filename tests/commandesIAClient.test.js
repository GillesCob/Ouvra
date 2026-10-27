// Tests du client du relais /api/commande (src/commandesIAClient.js) avec un FAUX fetch : aucun reseau.
import test from "node:test";
import assert from "node:assert/strict";
import { demanderCommande } from "../src/commandesIAClient.js";

const valeurs = { typesIfc: ["IfcDuctSegment", "IfcDuctFitting"], niveaux: ["Level 2"], maquettes: ["Mechanical (CVC)"], noms: [] };
const phrase = "Affiche-moi les gaines au niveau 2";
const reponseJson = (corps) => async () => ({ json: async () => corps });
const commandeOk = { action: "afficher", parametres: { typesIfc: ["IfcDuctSegment"], niveaux: ["Level 2"], maquettes: [], noms: [], isoler: true, surbrillance: true, cadrer: true }, demande: phrase, relecture: "Afficher les gaines du niveau 2." };

test("nominal : commande revalidee rendue, requete POST sans cookie ni cle", async () => {
  let vu;
  const r = await demanderCommande({ phrase, valeurs }, { fetch: async (url, options) => { vu = { url, options }; return { json: async () => ({ ok: true, resultat: "commande", commande: commandeOk }) }; } });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "commande");
  assert.equal(r.commande.action, "afficher");
  assert.equal(r.commande.relecture, "Afficher les gaines du niveau 2", "relecture construite depuis la commande validee, pas depuis le texte du modele");
  assert.equal(vu.url, "/api/commande");
  assert.equal(vu.options.method, "POST");
  assert.equal(vu.options.credentials, "omit");
  assert.deepEqual(JSON.parse(vu.options.body), { phrase, valeurs });
});

test("critere introuvable et non comprise : message transmis", async () => {
  for (const resultat of ["critere_introuvable", "non_comprise"]) {
    const r = await demanderCommande({ phrase, valeurs }, { fetch: reponseJson({ ok: true, resultat, message: "Pas de radiateur." }) });
    assert.deepEqual(r, { ok: true, resultat, message: "Pas de radiateur." });
  }
});

test("echec annonce par le relais : code et message repris", async () => {
  const r = await demanderCommande({ phrase, valeurs }, { fetch: reponseJson({ ok: false, code: "trop_de_requetes", message: "Réessaie dans 10 secondes." }) });
  assert.deepEqual(r, { ok: false, code: "trop_de_requetes", message: "Réessaie dans 10 secondes." });
});

test("commande hors des valeurs envoyees ou action inconnue : ia_indisponible (jamais appliquee)", async () => {
  for (const commande of [
    { ...commandeOk, parametres: { ...commandeOk.parametres, typesIfc: ["IfcRadiateur"] } },
    { action: "danser", parametres: {} },
    null
  ]) {
    const r = await demanderCommande({ phrase, valeurs }, { fetch: reponseJson({ ok: true, resultat: "commande", commande }) });
    assert.equal(r.ok, false);
    assert.equal(r.code, "ia_indisponible");
  }
});

test("reponse inexploitable, reseau coupe, route absente : ia_indisponible sans exception", async () => {
  const cas = [
    async () => ({ json: async () => { throw new Error("pas du json"); } }),
    reponseJson(null),
    reponseJson({ ok: "peut-etre" }),
    async () => { throw new Error("reseau coupe"); }
  ];
  for (const fetch of cas) {
    const r = await demanderCommande({ phrase, valeurs }, { fetch });
    assert.equal(r.code, "ia_indisponible");
    assert.match(r.message, /phrase d'exemple/);
  }
});

test("delai depasse : code distinct", async () => {
  const fetch = (url, options) => new Promise((_, rejeter) => options.signal.addEventListener("abort", () => rejeter(new Error("abort"))));
  const r = await demanderCommande({ phrase, valeurs }, { fetch, delaiMs: 10 });
  assert.equal(r.code, "delai");
});

test("la vue actuelle, en mots, accompagne la requete quand elle existe", async () => {
  let corps;
  const etat = { etapes: 1, facettes: { niveaux: ["Level 2"] }, exclues: {}, sansContexte: false, couches: [], focus: "" };
  await demanderCommande({ phrase, valeurs, etat }, { fetch: async (url, options) => { corps = JSON.parse(options.body); return { json: async () => ({ ok: true, resultat: "non_comprise", message: "x" }) }; } });
  assert.deepEqual(corps.etat, etat);
});
