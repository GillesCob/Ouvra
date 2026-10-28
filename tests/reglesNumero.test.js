// Ciblage d'une collision par son numero dans les regles IA (28/10) : tests ecrits avant le code.
// Le numero est celui AFFICHE (rang dans CLASHES + 1, src/main.js) : la regle le lit via contexte.numero(clash).
import test from "node:test";
import assert from "node:assert/strict";
import { validerRegle, appliquerRegle, messageAucuneCollision } from "../src/reglesCollision.js";
import { convertirSortie } from "../relais/sortie.js";
import { construireSchemaJson } from "../relais/schema.js";
import { traduire } from "../relais/traduire.js";
import { CONSIGNE, messageUtilisateur } from "../relais/consigne.js";
import { validerEntree } from "../relais/entree.js";
import { demanderRegle } from "../src/reglesIAClient.js";
import { HOSPITAL_CLASHES } from "../src/clashesHospital.js";

const permises = { priorite: ["urgente", "haute", "normale", "basse"], statut: ["nouveau", "confirme", "ecarte"] };
const valeurs = {
  typesIfc: ["IfcDuctSegment"], niveaux: ["Level 1"], maquettes: ["Architecture"], noms: ["Diffuser"],
  numeros: [1, 2, 3], ...permises
};
const clashes = [
  { id: "c1", entityIds: ["a1", "b1"], priorite: "haute", statut: "nouveau" },
  { id: "c2", entityIds: ["a2", "b2"], priorite: "haute", statut: "nouveau" },
  { id: "c3", entityIds: ["a3", "b3"], priorite: "basse", statut: "confirme" }
];
const numero = (c) => clashes.indexOf(c) + 1;
const etat = (c) => ({ priorite: c.priorite, statut: c.statut });
const lire = () => ({ nom: "x", typeIfc: "IfcWall", niveau: "Level 1", maquette: "Architecture" });
const ids = (t) => t.map((x) => x.clash.id);
const phrase = "Passe en urgent la collision 2";
const sortieIA = (surcharge = {}) => ({
  resultat: "regle", portee: "un_des_deux", criteres: [], etat: null, dates: [], numeros: [2],
  action: { champ: "priorite", valeur: "urgente" }, relecture: "Passer en urgente la collision 2.", critere_introuvable: null, ...surcharge
});

test("phrase « Passe en urgent la collision 2 » : traduite en regle valide qui touche exactement la collision 2", () => {
  const r = convertirSortie(sortieIA(), valeurs, phrase);
  assert.equal(r.ok, true);
  assert.deepEqual(r.regle.filtre, { portee: "un_des_deux", criteres: [], numeros: [2] });
  assert.equal(validerRegle(r.regle, permises).ok, true);
  const t = appliquerRegle(r.regle, clashes, lire, etat, { numero });
  assert.deepEqual(ids(t), ["c2"]);
  assert.deepEqual([t[0].de, t[0].vers, t[0].inchange], ["haute", "urgente", false]);
});

test("plusieurs numeros, dans n'importe quel ordre, doublons ignores", () => {
  const r = convertirSortie(sortieIA({ numeros: [3, 1, 3] }), valeurs, "les collisions 1 et 3");
  assert.deepEqual(r.regle.filtre.numeros, [1, 3]);
  assert.deepEqual(ids(appliquerRegle(r.regle, clashes, lire, etat, { numero })), ["c1", "c3"]);
});

test("numero combine avec un etat et avec l'action afficher", () => {
  const regle = { demande: "x", filtre: { portee: "un_des_deux", criteres: [], numeros: [1, 3], etat: { priorite: "basse" } }, action: { champ: "afficher" } };
  assert.equal(validerRegle(regle, permises).ok, true);
  const t = appliquerRegle(regle, clashes, lire, etat, { numero });
  assert.deepEqual(ids(t), ["c3"]);
  assert.deepEqual([t[0].de, t[0].vers, t[0].inchange], [null, null, false]);
});

test("numero inexistant : aucune collision touchee, pas d'erreur", () => {
  const regle = { demande: "x", filtre: { portee: "un_des_deux", criteres: [], numeros: [99] }, action: { champ: "priorite", valeur: "urgente" } };
  assert.equal(validerRegle(regle, permises).ok, true);
  assert.deepEqual(appliquerRegle(regle, clashes, lire, etat, { numero }), []);
});

test("numero sans fonction de numerotation fournie : rien n'est touche (jamais tout)", () => {
  const regle = { demande: "x", filtre: { portee: "un_des_deux", criteres: [], numeros: [2] }, action: { champ: "afficher" } };
  assert.deepEqual(appliquerRegle(regle, clashes, lire, etat), []);
});

test("regles existantes : sans numeros, aucun changement de comportement", () => {
  const regle = { demande: "x", filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcWall" }] }, action: { champ: "afficher" } };
  assert.deepEqual(ids(appliquerRegle(regle, clashes, lire, etat)), ["c1", "c2", "c3"]);
});

test("validerRegle : numeros mal formes refuses", () => {
  const avec = (numeros) => validerRegle({ filtre: { portee: "un_des_deux", criteres: [], numeros }, action: { champ: "afficher" } }, permises);
  for (const mauvais of [[], [0], [-1], [1.5], ["2"], [null], "2", 2, Array.from({ length: 101 }, (_, i) => i + 1)]) assert.equal(avec(mauvais).ok, false, JSON.stringify(mauvais));
  assert.equal(avec([2]).ok, true);
});

test("convertirSortie : numero hors des collisions reelles -> critere introuvable avec message clair, jamais une regle", () => {
  const r = convertirSortie(sortieIA({ numeros: [99] }), valeurs, "la collision 99");
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "critere_introuvable");
  assert.match(r.message, /99/);
});

test("convertirSortie : numeros non entiers ou mal formes rejetes", () => {
  for (const mauvais of ["2", [1.5], [0], ["2"], [null]]) assert.equal(convertirSortie(sortieIA({ numeros: mauvais }), valeurs, phrase).ok, false, JSON.stringify(mauvais));
  assert.equal(convertirSortie(sortieIA({ numeros: undefined }), valeurs, phrase).ok, false); // ni critere ni numero : rien a filtrer
});

test("convertirSortie : sans aucun filtre (ni numero), rejetee comme avant", () => {
  assert.equal(convertirSortie(sortieIA({ numeros: [] }), valeurs, phrase).ok, false);
});

test("schema : le critere numeros est present et ses valeurs viennent des vraies collisions", () => {
  const schema = construireSchemaJson(valeurs);
  assert.ok(schema.required.includes("numeros"));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.numeros.items.enum, [1, 2, 3]);
  const autre = construireSchemaJson({ ...valeurs, numeros: [7, 12] });
  assert.deepEqual(autre.properties.numeros.items.enum, [7, 12]);
  assert.equal(JSON.stringify(autre).includes('"enum":[1,2,3]'), false);
});

test("schema : sans collision reelle, le tableau reste valide (revalidation apres coup)", () => {
  const schema = construireSchemaJson({ ...valeurs, numeros: [] });
  assert.equal(schema.properties.numeros.type, "array");
});

test("consigne : explique le critere numero", () => {
  for (const mot of ["numeros", "collision 2", "n°2", "numéro 2", "collisions 2 et 5", "numéro 7"]) assert.ok(CONSIGNE.includes(mot), mot);
  assert.match(messageUtilisateur(phrase, valeurs, "2026-10-28"), /numeros : 1 \| 2 \| 3/);
});

test("entree du relais : numeros acceptes (entiers positifs, dedoublonnes), absents = liste vide, mal formes refuses", () => {
  const base = { phrase, valeurs: { typesIfc: [], niveaux: [], maquettes: [], noms: [], priorite: ["urgente"], statut: ["nouveau"] } };
  assert.deepEqual(validerEntree({ ...base, valeurs: { ...base.valeurs, numeros: [2, 5, 2] } }).valeurs.numeros, [2, 5]);
  assert.deepEqual(validerEntree(base).valeurs.numeros, []);
  for (const mauvais of ["2", [0], [1.5], ["2"], [1e9], Array.from({ length: 301 }, (_, i) => i + 1)]) {
    assert.equal(validerEntree({ ...base, valeurs: { ...base.valeurs, numeros: mauvais } }).ok, false, JSON.stringify(mauvais));
  }
});

test("traduire (faux client) : « la collision 2 » donne la regle avec numeros [2]", async () => {
  const client = { messages: { parse: async () => ({ parsed_output: sortieIA(), stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) } };
  const r = await traduire({ phrase, valeurs, aujourdhui: "2026-10-28" }, { client });
  assert.equal(r.resultat, "regle");
  assert.deepEqual(r.regle.filtre.numeros, [2]);
});

test("client de la page : la regle recue est revalidee, un numero absent de la liste envoyee est refuse", async () => {
  const appel = (regle) => async () => ({ json: async () => ({ ok: true, resultat: "regle", regle }) });
  const regle = (numeros) => ({ demande: phrase, filtre: { portee: "un_des_deux", criteres: [], numeros }, action: { champ: "afficher" } });
  assert.equal((await demanderRegle({ phrase, valeurs }, { fetch: appel(regle([2])) })).resultat, "regle");
  assert.equal((await demanderRegle({ phrase, valeurs }, { fetch: appel(regle([99])) })).ok, false);
});

// ---------- Coherence avec le numero affiche ----------
test("hopital : le numero de la regle est le rang affiche (hosp-clash-N = collision n° N)", () => {
  const liste = HOSPITAL_CLASHES.filter((c) => !c.factice);
  const num = (c) => liste.indexOf(c) + 1;
  const regle = { demande: "x", filtre: { portee: "un_des_deux", criteres: [], numeros: [2] }, action: { champ: "afficher" } };
  const t = appliquerRegle(regle, liste, () => null, etat, { numero: num });
  assert.deepEqual(ids(t), ["hosp-clash-2"]);
  assert.equal(liste[1].id, "hosp-clash-2");
});

test("modale vide : message clair qui nomme les numeros introuvables, message habituel sinon", () => {
  const avec = (numeros, action = { champ: "priorite", valeur: "urgente" }) => ({ filtre: { portee: "un_des_deux", criteres: [], numeros }, action });
  assert.equal(messageAucuneCollision(avec([99]), [1, 2, 3]), "Aucune collision n° 99 dans cette détection.");
  assert.equal(messageAucuneCollision(avec([4, 99]), [1, 2, 3]), "Aucune collision n° 4 ni n° 99 dans cette détection.");
  assert.equal(messageAucuneCollision(avec([99], { champ: "afficher" }), [1, 2, 3]), "Aucune collision n° 99 dans cette détection.");
  // le numero existe mais les autres conditions ne correspondent pas : message habituel
  assert.equal(messageAucuneCollision(avec([2]), [1, 2, 3]), "Aucune collision ne correspond à cette règle.");
  assert.equal(messageAucuneCollision(avec([2], { champ: "afficher" }), [1, 2, 3]), "Aucune collision ne correspond à cette demande.");
  assert.equal(messageAucuneCollision({ filtre: { portee: "un_des_deux", criteres: [] }, action: { champ: "afficher" } }, []), "Aucune collision ne correspond à cette demande.");
});
