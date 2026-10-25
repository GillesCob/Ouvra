// Tests de la revalidation de la sortie du modele (relais/sortie.js) : ecrits avant le code.
import test from "node:test";
import assert from "node:assert/strict";
import { convertirSortie } from "../relais/sortie.js";
import { validerRegle } from "../src/reglesCollision.js";

const valeurs = {
  typesIfc: ["IfcDuctSegment", "IfcWallStandardCase"],
  niveaux: ["Level 1", "Level 2"],
  maquettes: ["Architecture", "Mechanical (CVC)"],
  noms: ["Diffuser:Supply Diffuser"],
  priorite: ["urgente", "haute", "normale", "basse"],
  statut: ["nouveau", "confirme", "ecarte"]
};
const sortie = (surcharge = {}) => ({
  resultat: "regle",
  portee: "un_des_deux",
  criteres: [{ champ: "typeIfc", valeur: "IfcDuctSegment" }],
  action: { champ: "priorite", valeur: "urgente" },
  relecture: "Passer en urgente les collisions qui impliquent une gaine.",
  critere_introuvable: null,
  ...surcharge
});
const phrase = "Passe en urgent les gaines";

test("sortie valide : regle au format exact du moteur", () => {
  const r = convertirSortie(sortie(), valeurs, phrase);
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "regle");
  assert.deepEqual(r.regle, {
    demande: phrase,
    relecture: "Passer en urgente les collisions qui impliquent une gaine.",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcDuctSegment" }] },
    action: { champ: "priorite", valeur: "urgente" }
  });
  const verdict = validerRegle(r.regle, { priorite: valeurs.priorite, statut: valeurs.statut });
  assert.equal(verdict.ok, true, verdict.erreur);
});

test("valeur inventee pour un critere : rejetee", () => {
  const r = convertirSortie(sortie({ criteres: [{ champ: "typeIfc", valeur: "IfcPlanete" }] }), valeurs, phrase);
  assert.equal(r.ok, false);
  assert.equal(r.code, "sortie_invalide");
});

test("valeur inventee pour l'action : rejetee", () => {
  const r = convertirSortie(sortie({ action: { champ: "priorite", valeur: "critique" } }), valeurs, phrase);
  assert.equal(r.ok, false);
  assert.equal(r.code, "sortie_invalide");
  const s = convertirSortie(sortie({ action: { champ: "statut", valeur: "resolu" } }), valeurs, phrase);
  assert.equal(s.ok, false);
});

test("casse differente : la valeur canonique de la liste est restituee", () => {
  const r = convertirSortie(sortie({ criteres: [{ champ: "niveau", valeur: "level 1" }] }), valeurs, phrase);
  assert.equal(r.ok, true);
  assert.equal(r.regle.filtre.criteres[0].contient, "Level 1");
});

test("portee a ou b jamais acceptee, les_deux oui", () => {
  for (const portee of ["a", "b", "premier", null, undefined]) {
    assert.equal(convertirSortie(sortie({ portee }), valeurs, phrase).ok, false, String(portee));
  }
  assert.equal(convertirSortie(sortie({ portee: "les_deux" }), valeurs, phrase).ok, true);
});

test("regle sans critere ou sans action : rejetee", () => {
  assert.equal(convertirSortie(sortie({ criteres: [] }), valeurs, phrase).ok, false);
  assert.equal(convertirSortie(sortie({ action: null }), valeurs, phrase).ok, false);
});

test("deux criteres sur le meme champ : rejetes (ils ne pourraient pas etre vrais ensemble)", () => {
  const criteres = [{ champ: "niveau", valeur: "Level 1" }, { champ: "niveau", valeur: "Level 2" }];
  assert.equal(convertirSortie(sortie({ criteres }), valeurs, phrase).ok, false);
});

test("plusieurs champs differents : acceptes", () => {
  const criteres = [{ champ: "typeIfc", valeur: "IfcWallStandardCase" }, { champ: "niveau", valeur: "Level 1" }];
  const r = convertirSortie(sortie({ criteres }), valeurs, phrase);
  assert.equal(r.ok, true);
  assert.equal(r.regle.filtre.criteres.length, 2);
});

test("critere introuvable : message pour l'utilisateur, aucune regle", () => {
  const r = convertirSortie(
    sortie({ resultat: "critere_introuvable", portee: null, criteres: [], action: null, critere_introuvable: "radiateur", relecture: "Rien dans la maquette ne correspond à « radiateur »." }),
    valeurs, phrase
  );
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "critere_introuvable");
  assert.equal(r.regle, undefined);
  assert.match(r.message, /radiateur/);
});

test("phrase non comprise : message, aucune regle", () => {
  const r = convertirSortie(
    sortie({ resultat: "non_comprise", portee: null, criteres: [], action: null, relecture: "Une seule règle par phrase." }),
    valeurs, phrase
  );
  assert.equal(r.ok, true);
  assert.equal(r.resultat, "non_comprise");
  assert.equal(r.message, "Une seule règle par phrase.");
});

test("sortie absente ou d'un autre type : rejetee", () => {
  for (const mauvais of [null, undefined, "regle", 3, []]) assert.equal(convertirSortie(mauvais, valeurs, phrase).ok, false);
});

test("relecture vide : rejetee (la relecture est obligatoire)", () => {
  assert.equal(convertirSortie(sortie({ relecture: "  " }), valeurs, phrase).ok, false);
});

// ---------- 23/10 : action « afficher », filtre par etat, criteres de date ----------
const afficher = (surcharge = {}) => sortie({ action: { champ: "afficher" }, ...surcharge });
const dateDepuis = (surcharge = {}) => ({ evenement: "message", presence: "aucun", periode: { type: "depuis", nombre: 3, unite: "jour" }, ...surcharge });

test("afficher : regle sans valeur d'action, au format du moteur", () => {
  const r = convertirSortie(afficher({ relecture: "Afficher les collisions qui impliquent une gaine." }), valeurs, phrase);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.regle.action, { champ: "afficher" });
  assert.equal(validerRegle(r.regle, { priorite: valeurs.priorite, statut: valeurs.statut }).ok, true);
});

test("afficher : une valeur d'action eventuelle est ignoree, pas rejetee", () => {
  const r = convertirSortie(afficher({ action: { champ: "afficher", valeur: "n'importe quoi" } }), valeurs, phrase);
  assert.equal(r.ok, true);
  assert.deepEqual(r.regle.action, { champ: "afficher" });
});

test("filtre par etat seul : accepte, valeurs canoniques, champs nuls retires", () => {
  const r = convertirSortie(afficher({ criteres: [], etat: { priorite: "Urgente", statut: null } }), valeurs, phrase);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.regle.filtre.etat, { priorite: "urgente" });
  assert.equal(r.regle.filtre.criteres.length, 0);
  assert.equal(validerRegle(r.regle, { priorite: valeurs.priorite, statut: valeurs.statut }).ok, true);
});

test("etat avec une valeur inventee : rejete ; etat aux deux champs nuls compte pour rien", () => {
  assert.equal(convertirSortie(afficher({ criteres: [], etat: { priorite: "critique", statut: null } }), valeurs, phrase).ok, false);
  assert.equal(convertirSortie(afficher({ criteres: [], etat: { priorite: null, statut: null } }), valeurs, phrase).ok, false); // plus aucun filtre
});

test("filtre par date seul : accepte, rendu au format du moteur", () => {
  const r = convertirSortie(afficher({ criteres: [], dates: [dateDepuis()] }), valeurs, phrase);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.regle.filtre.dates, [dateDepuis()]);
  assert.equal(validerRegle(r.regle, { priorite: valeurs.priorite, statut: valeurs.statut }).ok, true);
});

test("date mal formee : rejetee (unite inconnue, date impossible, fin avant debut)", () => {
  const mauvais = [
    dateDepuis({ periode: { type: "depuis", nombre: 3, unite: "heure" } }),
    dateDepuis({ periode: { type: "avant", date: "2026-02-30" } }),
    dateDepuis({ periode: { type: "entre", du: "2026-10-18", au: "2026-10-15" } })
  ];
  for (const d of mauvais) assert.equal(convertirSortie(afficher({ criteres: [], dates: [d] }), valeurs, phrase).ok, false);
});

test("date, etat et criteres d'element se combinent", () => {
  const r = convertirSortie(sortie({ etat: { priorite: null, statut: "nouveau" }, dates: [dateDepuis()] }), valeurs, phrase);
  assert.equal(r.ok, true, r.message);
  assert.equal(r.regle.filtre.criteres.length, 1);
  assert.deepEqual(r.regle.filtre.etat, { statut: "nouveau" });
  assert.equal(r.regle.filtre.dates.length, 1);
});

test("changement de priorite avec un filtre de date : accepte", () => {
  const r = convertirSortie(sortie({ criteres: [], dates: [dateDepuis()], action: { champ: "priorite", valeur: "urgente" } }), valeurs, phrase);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.regle.action, { champ: "priorite", valeur: "urgente" });
});
