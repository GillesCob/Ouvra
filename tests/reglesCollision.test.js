// Tests du moteur de regles de collision (src/reglesCollision.js) : action « afficher », filtre par etat (priorite, statut) et criteres de date
// (23/10). Ecrits avant le code. Fonctions pures : aucune scene, aucun navigateur.
import test from "node:test";
import assert from "node:assert/strict";
import { validerRegle, appliquerRegle, validerCritereDate, periodeEnMs } from "../src/reglesCollision.js";
import { HOSPITAL_CLASHES } from "../src/clashesHospital.js";
import { EXEMPLES_REGLES } from "../src/reglesExemples.js";

const permises = { priorite: ["urgente", "haute", "normale", "basse"], statut: ["nouveau", "confirme", "ecarte"] };
const MAINTENANT = new Date(2026, 9, 23, 12, 0, 0).getTime(); // 23/10/2026 12h, heure locale
const jour = (j, h = 12) => new Date(2026, 9, j, h, 0, 0).getTime();
const JOUR_MS = 24 * 3600 * 1000;

const regleAfficher = (filtre) => ({ demande: "x", filtre: { portee: "un_des_deux", criteres: [], ...filtre }, action: { champ: "afficher" } });

// ---------- validerRegle ----------
test("action afficher : acceptee sans valeur", () => {
  assert.equal(validerRegle(regleAfficher({ criteres: [{ champ: "typeIfc", contient: "IfcWall" }] }), permises).ok, true);
});

test("action inconnue : rejetee", () => {
  const r = regleAfficher({ criteres: [{ champ: "typeIfc", contient: "IfcWall" }] });
  r.action = { champ: "supprimer" };
  assert.equal(validerRegle(r, permises).ok, false);
});

test("changement de priorite : la valeur reste obligatoire et permise", () => {
  const r = regleAfficher({ criteres: [{ champ: "typeIfc", contient: "IfcWall" }] });
  r.action = { champ: "priorite", valeur: "critique" };
  assert.equal(validerRegle(r, permises).ok, false);
  r.action = { champ: "priorite", valeur: "haute" };
  assert.equal(validerRegle(r, permises).ok, true);
});

test("filtre sans critere, sans etat et sans date : rejete", () => {
  const verdict = validerRegle(regleAfficher({}), permises);
  assert.equal(verdict.ok, false);
  assert.match(verdict.erreur, /au moins/);
});

test("filtre par etat seul : accepte ; valeur d'etat inconnue : rejetee", () => {
  assert.equal(validerRegle(regleAfficher({ etat: { priorite: "urgente" } }), permises).ok, true);
  assert.equal(validerRegle(regleAfficher({ etat: { statut: "confirme", priorite: "haute" } }), permises).ok, true);
  assert.equal(validerRegle(regleAfficher({ etat: { priorite: "critique" } }), permises).ok, false);
  assert.equal(validerRegle(regleAfficher({ etat: { statut: "resolu" } }), permises).ok, false);
  assert.equal(validerRegle(regleAfficher({ etat: {} }), permises).ok, false); // etat vide = aucun filtre
});

test("filtre par date seul : accepte", () => {
  const dates = [{ evenement: "message", presence: "aucun", periode: { type: "depuis", nombre: 3, unite: "jour" } }];
  assert.equal(validerRegle(regleAfficher({ dates }), permises).ok, true);
});

// ---------- validerCritereDate ----------
const critere = (surcharge = {}) => ({ evenement: "activite", presence: "au_moins_un", periode: { type: "depuis", nombre: 3, unite: "jour" }, ...surcharge });

test("critere de date valide : toutes les formes de periode", () => {
  assert.equal(validerCritereDate(critere()).ok, true);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: 2, unite: "semaine" } })).ok, true);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: 1, unite: "mois" } })).ok, true);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis_le", date: "2026-10-15" } })).ok, true);
  assert.equal(validerCritereDate(critere({ periode: { type: "avant", date: "2026-10-15" } })).ok, true);
  assert.equal(validerCritereDate(critere({ periode: { type: "entre", du: "2026-10-15", au: "2026-10-18" } })).ok, true);
  assert.equal(validerCritereDate(critere({ periode: { type: "entre", du: "2026-10-15", au: "2026-10-15" } })).ok, true); // meme jour
});

test("critere de date invalide : evenement, presence, periode, nombre, unite, dates", () => {
  assert.equal(validerCritereDate(critere({ evenement: "appel" })).ok, false);
  assert.equal(validerCritereDate(critere({ presence: "souvent" })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: null })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "bientot" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: 0, unite: "jour" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: -2, unite: "jour" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: 2.5, unite: "jour" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: 400, unite: "jour" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis", nombre: 3, unite: "heure" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "depuis_le", date: "15/10/2026" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "avant", date: "2026-13-40" } })).ok, false);
  assert.equal(validerCritereDate(critere({ periode: { type: "entre", du: "2026-10-18", au: "2026-10-15" } })).ok, false); // fin avant debut
  assert.equal(validerCritereDate(null).ok, false);
});

// ---------- periodeEnMs ----------
test("periode relative : les N derniers jours / semaines / mois jusqu'a maintenant", () => {
  const p = periodeEnMs({ type: "depuis", nombre: 3, unite: "jour" }, MAINTENANT);
  assert.equal(p.debut, MAINTENANT - 3 * JOUR_MS);
  assert.equal(p.fin, MAINTENANT);
  assert.equal(periodeEnMs({ type: "depuis", nombre: 2, unite: "semaine" }, MAINTENANT).debut, MAINTENANT - 14 * JOUR_MS);
  assert.equal(periodeEnMs({ type: "depuis", nombre: 1, unite: "mois" }, MAINTENANT).debut, new Date(2026, 8, 23, 12, 0, 0).getTime());
});

test("periode absolue : depuis_le inclut le jour, avant l'exclut, entre inclut les deux bornes", () => {
  const depuis = periodeEnMs({ type: "depuis_le", date: "2026-10-15" }, MAINTENANT);
  assert.equal(depuis.debut, new Date(2026, 9, 15, 0, 0, 0, 0).getTime());
  assert.equal(depuis.fin, Infinity);
  const avant = periodeEnMs({ type: "avant", date: "2026-10-15" }, MAINTENANT);
  assert.equal(avant.debut, -Infinity);
  assert.equal(avant.fin, new Date(2026, 9, 15, 0, 0, 0, 0).getTime() - 1);
  const entre = periodeEnMs({ type: "entre", du: "2026-10-15", au: "2026-10-18" }, MAINTENANT);
  assert.equal(entre.debut, new Date(2026, 9, 15, 0, 0, 0, 0).getTime());
  assert.equal(entre.fin, new Date(2026, 9, 18, 23, 59, 59, 999).getTime());
});

// ---------- appliquerRegle ----------
// Trois collisions : c1 (Murs, haute, nouveau), c2 (Gaines, urgente, confirme), c3 (Murs, basse, ecarte). Elements : a = A, b = B.
const clashes = [
  { id: "c1", entityIds: ["m1", "g1"], priorite: "haute", statut: "nouveau" },
  { id: "c2", entityIds: ["m2", "g2"], priorite: "urgente", statut: "confirme" },
  { id: "c3", entityIds: ["m3", "g3"], priorite: "basse", statut: "ecarte" },
  { id: "c4", entityIds: ["m4", "g4"], priorite: "normale", statut: "nouveau", factice: true }
];
const elements = {
  m1: { nom: "Mur", typeIfc: "IfcWall", niveau: "Level 1", maquette: "Architecture" },
  m2: { nom: "Mur", typeIfc: "IfcWall", niveau: "Level 2", maquette: "Architecture" },
  m3: { nom: "Mur", typeIfc: "IfcWall", niveau: "Level 1", maquette: "Architecture" },
  g1: { nom: "Gaine", typeIfc: "IfcDuctSegment", niveau: "Level 1", maquette: "Mechanical" },
  g2: { nom: "Gaine", typeIfc: "IfcDuctSegment", niveau: "Level 2", maquette: "Mechanical" },
  g3: { nom: "Gaine", typeIfc: "IfcDuctSegment", niveau: "Level 1", maquette: "Mechanical" }
};
const lire = (id) => elements[id] || null;
const etat = (c) => ({ priorite: c.priorite, statut: c.statut });
// c1 : message il y a 1 jour (22/10), modification il y a 8 jours (15/10). c2 : message le 16/10 seulement. c3 : aucun evenement.
const evenementsParId = {
  c1: [{ type: "message", quand: jour(22) }, { type: "modification", quand: jour(15) }],
  c2: [{ type: "message", quand: jour(16) }],
  c3: []
};
const contexte = { maintenant: MAINTENANT, evenements: (c) => evenementsParId[c.id] || [] };
const ids = (touchees) => touchees.map((t) => t.clash.id);

test("changement de priorite : comportement inchange (touchees, avant, apres, inchange)", () => {
  const regle = { demande: "x", filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcWall" }] }, action: { champ: "priorite", valeur: "haute" } };
  const t = appliquerRegle(regle, clashes, lire, etat);
  assert.deepEqual(ids(t), ["c1", "c2", "c3"]);
  assert.deepEqual(t.map((x) => [x.de, x.vers, x.inchange]), [["haute", "haute", true], ["urgente", "haute", false], ["basse", "haute", false]]);
});

test("afficher : toutes les collisions qui correspondent, y compris celles deja a la valeur, sans avant ni apres", () => {
  const t = appliquerRegle(regleAfficher({ criteres: [{ champ: "niveau", contient: "Level 1" }] }), clashes, lire, etat);
  assert.deepEqual(ids(t), ["c1", "c3"]);
  assert.deepEqual(t.map((x) => [x.de, x.vers, x.inchange]), [[null, null, false], [null, null, false]]);
});

test("afficher par etat : priorite, statut, ou les deux", () => {
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ etat: { priorite: "urgente" } }), clashes, lire, etat)), ["c2"]);
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ etat: { statut: "nouveau" } }), clashes, lire, etat)), ["c1"]);
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ etat: { statut: "ecarte", priorite: "basse" } }), clashes, lire, etat)), ["c3"]);
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ etat: { statut: "ecarte", priorite: "haute" } }), clashes, lire, etat)), []);
});

test("critere d'element et etat se combinent (tous vrais)", () => {
  const f = { criteres: [{ champ: "typeIfc", contient: "IfcWall" }], etat: { statut: "confirme" } };
  assert.deepEqual(ids(appliquerRegle(regleAfficher(f), clashes, lire, etat)), ["c2"]);
});

test("date : au moins un message dans les 3 derniers jours", () => {
  const dates = [{ evenement: "message", presence: "au_moins_un", periode: { type: "depuis", nombre: 3, unite: "jour" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates }), clashes, lire, etat, contexte)), ["c1"]);
});

test("date : aucun message depuis 3 jours (sans reponse), une collision sans evenement correspond", () => {
  const dates = [{ evenement: "message", presence: "aucun", periode: { type: "depuis", nombre: 3, unite: "jour" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates }), clashes, lire, etat, contexte)), ["c2", "c3"]);
});

test("date : seuls les messages comptent pour « message », seules les modifications pour « modification », les deux pour « activite »", () => {
  const sur = (evenement) => [{ evenement, presence: "au_moins_un", periode: { type: "entre", du: "2026-10-15", au: "2026-10-15" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates: sur("modification") }), clashes, lire, etat, contexte)), ["c1"]);
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates: sur("message") }), clashes, lire, etat, contexte)), []);
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates: sur("activite") }), clashes, lire, etat, contexte)), ["c1"]);
});

test("date absolue : entre le 15 et le 16 inclus, bornes comprises", () => {
  const dates = [{ evenement: "activite", presence: "au_moins_un", periode: { type: "entre", du: "2026-10-15", au: "2026-10-16" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates }), clashes, lire, etat, contexte)), ["c1", "c2"]);
});

test("date : avant une date, et depuis une date", () => {
  const avant = [{ evenement: "activite", presence: "au_moins_un", periode: { type: "avant", date: "2026-10-16" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates: avant }), clashes, lire, etat, contexte)), ["c1"]); // modification du 15
  const depuis = [{ evenement: "activite", presence: "aucun", periode: { type: "depuis_le", date: "2026-10-17" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates: depuis }), clashes, lire, etat, contexte)), ["c2", "c3"]); // rien depuis le 17
});

test("plusieurs criteres de date : tous vrais", () => {
  const dates = [
    { evenement: "message", presence: "au_moins_un", periode: { type: "depuis", nombre: 10, unite: "jour" } },
    { evenement: "modification", presence: "aucun", periode: { type: "depuis", nombre: 3, unite: "jour" } }
  ];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates }), clashes, lire, etat, contexte)), ["c1", "c2"]);
});

test("evenement sans date lisible ignore ; contexte absent : aucun evenement connu", () => {
  const ctx = { maintenant: MAINTENANT, evenements: () => [{ type: "message", quand: NaN }] };
  const dates = [{ evenement: "message", presence: "au_moins_un", periode: { type: "depuis", nombre: 3, unite: "jour" } }];
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates }), clashes, lire, etat, ctx)), []);
  assert.deepEqual(ids(appliquerRegle(regleAfficher({ dates }), clashes, lire, etat)), []);
});

test("collisions fictives ou sans deux elements : jamais touchees, meme pour afficher", () => {
  const t = appliquerRegle(regleAfficher({ etat: { statut: "nouveau" } }), [...clashes, { id: "c5", entityIds: ["m1"], priorite: "haute", statut: "nouveau" }], lire, etat);
  assert.deepEqual(ids(t), ["c1"]); // c4 est factice, c5 n'a qu'un element
});

// ---------- Scenario de la demo (28/10) : « Passe en urgent toutes les collisions qui impliquent des gaines du niveau 2 » ----------
// Scene factice avec les metadonnees de l'hopital : type IFC et niveau deduits de la zone de chaque collision (noms Revit, niveau en fin de ligne).
const typeDeLaZone = (nom) => /Duct :/.test(nom) ? "IfcDuctSegment" : /Pipe Types/.test(nom) ? "IfcPipeSegment" : /Wall/.test(nom) ? "IfcWallStandardCase" : "IfcCovering";
const sceneHopital = {};
HOSPITAL_CLASHES.forEach((c) => {
  const [noms, niveau] = c.zone.split(" · ");
  const [a, b] = noms.split(" ↔ ");
  sceneHopital[c.entityIds[0]] = { nom: a, typeIfc: typeDeLaZone(a), niveau, maquette: "Architecture" };
  sceneHopital[c.entityIds[1]] = { nom: b, typeIfc: typeDeLaZone(b), niveau, maquette: "Mecanique" };
});
const etatHopital = (c) => ({ priorite: c.priorite, statut: c.statut });

test("demo : la collision n°2 de l'hopital demarre en priorite haute", () => {
  assert.equal(HOSPITAL_CLASHES.find((c) => c.id === "hosp-clash-2").priorite, "haute");
});

test("demo : la phrase « gaines du niveau 2 » touche exactement hosp-clash-2 et la change de haute a urgente", () => {
  const t = appliquerRegle(EXEMPLES_REGLES[0], HOSPITAL_CLASHES, (id) => sceneHopital[id] || null, etatHopital);
  assert.deepEqual(ids(t), ["hosp-clash-2"]);
  assert.deepEqual(t.map((x) => [x.de, x.vers, x.inchange]), [["haute", "urgente", false]]);
});

test("demo : « urgentes sans message depuis 3 jours » trouve toujours au moins une collision (hosp-clash-10)", () => {
  const evenements = (c) => (c.discussion || []).map((m) => ({ type: "message", quand: Date.parse(m.quand) }))
    .concat((c.historique || []).map((h) => ({ type: "modification", quand: Date.parse(h.quand) })));
  const regle = EXEMPLES_REGLES.find((e) => e.demande === "Affiche les collisions urgentes sans message depuis 3 jours");
  const t = appliquerRegle(regle, HOSPITAL_CLASHES, (id) => sceneHopital[id] || null, etatHopital, { maintenant: new Date(2026, 9, 28, 12).getTime(), evenements });
  assert.deepEqual(ids(t), ["hosp-clash-10"]);
});

test("demo : le dernier message de la discussion de hosp-clash-2 renvoie vers les autres conversations", async () => {
  const { ECHANGES_HOSPITAL } = await import("../src/clashesHospitalEchanges.js");
  const d = ECHANGES_HOSPITAL["hosp-clash-2"].discussion;
  const dernier = d[d.length - 1];
  assert.equal(dernier.auteur, "Vous");
  assert.ok(dernier.texte.includes("conversation avec Sophie") && dernier.texte.includes("le groupe") && dernier.texte.includes("celle avec Claire"));
  assert.ok(Date.parse(dernier.quand) > Date.parse(d[d.length - 2].quand));
  assert.ok(Date.parse(dernier.quand) < Date.parse("2026-11-03"));
});
