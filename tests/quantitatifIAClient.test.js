// Tests du client du relais /api/quantitatif (src/quantitatifIAClient.js) : fetch injecte, aucune cle, aucun reseau.
import test from "node:test";
import assert from "node:assert/strict";
import { demanderQuantitatif } from "../src/quantitatifIAClient.js";

const valeurs = { typesIfc: ["IfcDoor"], niveaux: ["Level 2"], maquettes: [], noms: [], mesures: ["nombre"] };
const requete = { mesure: "nombre", filtres: { typesIfc: ["IfcDoor"], niveaux: ["Level 2"] }, regroupements: [] };
const fetchQui = (corps, { json = true } = {}) => async (url, init) => { fetchQui.dernier = { url, init }; return { json: async () => { if (!json) throw new Error("pas json"); return corps; } }; };
const phrase = "Combien de portes au niveau 2 ?";

test("client : requete valide renvoyee completee, appel POST sans cookie vers /api/quantitatif", async () => {
  const r = await demanderQuantitatif({ phrase, valeurs }, { fetch: fetchQui({ ok: true, resultat: "requete", requete }) });
  assert.deepEqual(r, { ok: true, resultat: "requete", requete: { ...requete, filtres: { typesIfc: ["IfcDoor"], niveaux: ["Level 2"], maquettes: [], noms: [] } } });
  assert.equal(fetchQui.dernier.url, "/api/quantitatif");
  assert.equal(fetchQui.dernier.init.method, "POST");
  assert.equal(fetchQui.dernier.init.credentials, "omit");
  assert.deepEqual(JSON.parse(fetchQui.dernier.init.body), { phrase, valeurs });
});

test("client : critere introuvable et non comprise transmis", async () => {
  const r = await demanderQuantitatif({ phrase, valeurs }, { fetch: fetchQui({ ok: true, resultat: "non_comprise", message: "Je ne calcule pas de poids." }) });
  assert.deepEqual(r, { ok: true, resultat: "non_comprise", message: "Je ne calcule pas de poids." });
});

test("client : requete hors des valeurs envoyees = indisponible (revalidation cote page)", async () => {
  const r = await demanderQuantitatif({ phrase, valeurs }, { fetch: fetchQui({ ok: true, resultat: "requete", requete: { ...requete, filtres: { niveaux: ["Level 9"] } } }) });
  assert.equal(r.ok, false);
  assert.equal(r.code, "ia_indisponible");
});

test("client : echec annonce par le relais, reponse illisible, forme inattendue, reseau coupe", async () => {
  assert.deepEqual(await demanderQuantitatif({ phrase, valeurs }, { fetch: fetchQui({ ok: false, code: "trop_de_requetes", message: "Patiente." }) }), { ok: false, code: "trop_de_requetes", message: "Patiente." });
  for (const f of [fetchQui(null, { json: false }), fetchQui("x"), fetchQui({ ok: true }), fetchQui({ ok: true, resultat: "requete" }), async () => { throw new Error("reseau"); }]) {
    const r = await demanderQuantitatif({ phrase, valeurs }, { fetch: f });
    assert.equal(r.code, "ia_indisponible");
  }
});

test("client : delai depasse = code « delai » distinct", async () => {
  const lent = (url, init) => new Promise((_, rejeter) => init.signal.addEventListener("abort", () => rejeter(new Error("abort"))));
  const r = await demanderQuantitatif({ phrase, valeurs }, { fetch: lent, delaiMs: 20 });
  assert.equal(r.code, "delai");
});
