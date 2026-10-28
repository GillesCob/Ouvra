// Tests du FORMAT FIXE du recapitulatif de Discussions (26/10, decision de Gilles) : titre, contexte, intervenants, desaccords, decision.
// Couvre la normalisation commune au relais et a la page (src/discussionsIARapportNormaliser.js) et la version texte (src/discussionsIARapportFormat.js).
// Regle absolue : jamais de decision inventee. Aucune decision exprimee = « Aucune décision prise ».
import test from "node:test";
import assert from "node:assert/strict";
import { normaliserRapport, STATUTS_DECISION } from "../src/discussionsIARapportNormaliser.js";
import { rapportEnTexte, dateJJMMAAAA, perimetreDe, libelleDecision, MESSAGE_AUCUNE_DECISION, MESSAGE_AUCUN_DESACCORD } from "../src/discussionsIARapportFormat.js";
import { conclureRapport, MESSAGE_RIEN } from "../src/discussionsIAMoteur.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { fixture, MAINTENANT } from "./aide/fixtureDiscussions.js";

const TEXTES = { M1: "Le levage est décalé de 12 cm mardi.", M2: "Je décale le planning.", M3: "Non, on maintient le levage." };
const options = { auteurs: new Set(["Ana Roux", "Bob Lenoir", "Vous"]), texteDe: (id) => TEXTES[id] || null };
const decision = (extra = {}) => ({ statut: "aucune", texte: "", sources: [], ...extra });
const brut = (extra = {}) => ({
  rien_a_dire: false,
  titre: "Levage des groupes",
  contexte: { texte: "L'accès grue est bloqué mardi.", sources: ["M1"] },
  intervenants: ["Bob Lenoir", "Vous"],
  desaccords: [],
  decision: decision(),
  ...extra
});

test("statuts de decision : prise, rapportee, incertaine, aucune (enumeration fermee)", () => {
  assert.deepEqual(STATUTS_DECISION, ["prise", "rapportee", "incertaine", "aucune"]);
});

test("normaliser : cas nominal complet, les cinq blocs sont presents", () => {
  const r = normaliserRapport(brut({
    desaccords: [{ opposants: ["Bob Lenoir", "Vous"], objet: "Bob veut maintenir le levage, Vous le décalez.", sources: ["M2", "M3"] }],
    decision: decision({ statut: "prise", texte: "Le levage est décalé de 12 cm.", sources: ["M1"] })
  }), options);
  assert.equal(r.vide, false);
  assert.equal(r.titre, "Levage des groupes");
  assert.deepEqual(r.contexte, { texte: "L'accès grue est bloqué mardi.", sources: ["M1"], confirme: true });
  assert.deepEqual(r.intervenants, ["Bob Lenoir", "Vous"]);
  assert.equal(r.desaccords.length, 1);
  assert.deepEqual(r.desaccords[0].opposants, ["Bob Lenoir", "Vous"]);
  assert.deepEqual(r.decision, { statut: "prise", texte: "Le levage est décalé de 12 cm.", sources: ["M1"], confirme: true });
});

test("normaliser : AUCUNE decision exprimee -> statut aucune, texte vide, jamais de texte invente", () => {
  const r = normaliserRapport(brut({ decision: decision({ statut: "aucune", texte: "On décale probablement.", sources: ["M1"] }) }), options);
  assert.deepEqual(r.decision, { statut: "aucune", texte: "", sources: [], confirme: false });
});

test("normaliser : une decision sans source valide ou sans texte est ramenee a « aucune » (rien d'invente)", () => {
  for (const d of [
    decision({ statut: "prise", texte: "Décalé.", sources: [] }),
    decision({ statut: "prise", texte: "Décalé.", sources: ["M404"] }),
    decision({ statut: "prise", texte: "   ", sources: ["M1"] }),
    decision({ statut: "rapportee", texte: "Il paraît que c'est décalé.", sources: ["M404"] }),
    decision({ statut: "inconnu", texte: "x", sources: ["M1"] }),
    null, "texte", 3
  ]) {
    const r = normaliserRapport(brut({ decision: d }), options);
    assert.equal(r.decision.statut, "aucune", JSON.stringify(d));
    assert.equal(r.decision.texte, "");
    assert.deepEqual(r.decision.sources, []);
  }
});

test("normaliser : decision rapportee de seconde main ou incertaine conservee avec son statut, jamais presentee comme prise", () => {
  for (const statut of ["rapportee", "incertaine"]) {
    const r = normaliserRapport(brut({ decision: decision({ statut, texte: "Le levage serait décalé.", sources: ["M2"] }) }), options);
    assert.equal(r.decision.statut, statut);
    assert.equal(r.decision.texte, "Le levage serait décalé.");
    assert.equal(r.decision.confirme, false); // seule une decision « prise » peut etre confirmee
  }
});

test("normaliser : chiffre ou mois absent des messages cites -> « non confirme » (decision, contexte, desaccord)", () => {
  const r = normaliserRapport(brut({
    contexte: { texte: "Le levage est décalé de 15 cm.", sources: ["M1"] },
    desaccords: [{ opposants: ["Vous"], objet: "Vous décalez de 40 cm.", sources: ["M2"] }],
    decision: decision({ statut: "prise", texte: "Décalé en novembre.", sources: ["M1"] })
  }), options);
  assert.equal(r.contexte.confirme, false); // 15 absent de M1
  assert.equal(r.desaccords[0].confirme, false); // 40 absent de M2
  assert.equal(r.decision.statut, "prise");
  assert.equal(r.decision.confirme, false); // novembre absent de M1
});

test("normaliser : sources inconnues retirees ; un desaccord sans source valide ou sans objet est ecarte", () => {
  const r = normaliserRapport(brut({
    contexte: { texte: "Contexte.", sources: ["M1", "M9"] },
    desaccords: [
      { opposants: ["Vous"], objet: "A", sources: ["M9"] },
      { opposants: ["Vous"], objet: "  ", sources: ["M1"] },
      { opposants: ["Vous"], objet: "B", sources: ["M1", "M9"] }
    ]
  }), options);
  assert.deepEqual(r.contexte.sources, ["M1"]);
  assert.deepEqual(r.desaccords.map((d) => d.objet), ["B"]);
  assert.deepEqual(r.desaccords[0].sources, ["M1"]);
});

test("normaliser : intervenants et opposants limites aux auteurs reels, dedoublonnes ; les opposants entrent dans les intervenants", () => {
  const r = normaliserRapport(brut({
    intervenants: ["Zoé Inventée", "Bob Lenoir", "Bob Lenoir"],
    desaccords: [{ opposants: ["Ana Roux", "Zoé Inventée"], objet: "Désaccord.", sources: ["M1"] }]
  }), options);
  assert.deepEqual(r.intervenants, ["Bob Lenoir", "Ana Roux"]);
  assert.deepEqual(r.desaccords[0].opposants, ["Ana Roux"]);
});

test("normaliser : sans intervenant valide, ils viennent des auteurs des messages cites", () => {
  const auteurDe = (id) => ({ M1: "Bob Lenoir", M2: "Vous", M3: "Ana Roux" })[id];
  const r = normaliserRapport(brut({ intervenants: ["Inconnu"], desaccords: [{ opposants: [], objet: "Désaccord.", sources: ["M3"] }] }), { ...options, auteurDe });
  assert.deepEqual(r.intervenants, ["Bob Lenoir", "Ana Roux"]);
});

test("normaliser : rien_a_dire, ou ni contexte ni desaccord ni decision exploitables -> vide", () => {
  assert.equal(normaliserRapport({ rien_a_dire: true }, options).vide, true);
  assert.equal(normaliserRapport(brut({ rien_a_dire: true }), options).vide, true);
  assert.equal(normaliserRapport(brut({ contexte: { texte: "x", sources: ["M404"] } }), options).vide, true);
  assert.equal(normaliserRapport(brut({ contexte: { texte: "x", sources: ["M404"] }, decision: decision({ statut: "prise", texte: "Fait.", sources: ["M2"] }) }), options).vide, false);
});

test("normaliser : formes invalides refusees (null)", () => {
  for (const mauvais of [null, [], "x", 3, {}, { rien_a_dire: "oui" }, { rien_a_dire: false }, { rien_a_dire: false, contexte: null, decision: null }]) {
    assert.equal(normaliserRapport(mauvais, options), null, JSON.stringify(mauvais));
  }
});

test("normaliser : titre nettoye et borne, texte trop long coupe sans perdre le bloc", () => {
  const r = normaliserRapport(brut({ titre: "  Un   titre\n   long " + "x".repeat(300), contexte: { texte: "mot ".repeat(400), sources: ["M1"] } }), options);
  assert.ok(r.titre.length <= 120);
  assert.ok(!/\s{2}|\n/.test(r.titre));
  assert.ok(r.contexte.texte.length <= 800 && r.contexte.texte.endsWith("…"));
  assert.equal(normaliserRapport(brut({ titre: "   " }), options).titre, "");
});

test("normaliser : plafonds (desaccords, opposants, sources par bloc)", () => {
  const ids = ["M1", "M2", "M3"];
  const desaccords = Array.from({ length: 20 }, (_, i) => ({ opposants: ["Vous"], objet: "D" + i, sources: ids }));
  const r = normaliserRapport(brut({ desaccords }), options);
  assert.equal(r.desaccords.length, 8);
});

// ---------- Via le moteur de la page : conclureRapport ----------
const donnees = fixture();
const index = indexer(donnees.conversations, donnees.personnes);
const table = new Map(index.messages.slice(0, 6).map((m, i) => ["M" + (i + 1), m]));
const auteursTable = Array.from(new Set(Array.from(table.values()).map((m) => m.auteurNom)));

test("conclureRapport : rapport au format fixe, date, sujet, perimetre et chronologie", () => {
  const { rapport } = conclureRapport({
    rien_a_dire: false, titre: "Cloison du local technique",
    contexte: { texte: "La cloison est en CF 1h dans la maquette.", sources: ["M1"] },
    intervenants: [auteursTable[0]], desaccords: [],
    decision: { statut: "prise", texte: "Ana corrige la cloison.", sources: ["M2"] }
  }, table, index, { sujet: "cloison", maintenant: MAINTENANT });
  assert.equal(rapport.vide, false);
  assert.equal(rapport.titre, "Cloison du local technique");
  assert.equal(rapport.sujet, "cloison");
  assert.equal(rapport.date, MAINTENANT);
  assert.equal(rapport.contexte.sources[0].id, "M1");
  assert.equal(rapport.decision.statut, "prise");
  assert.equal(rapport.decision.sources[0].id, "M2");
  assert.deepEqual(rapport.desaccords, []);
  assert.equal(rapport.chronologie.length, 2);
  assert.ok(rapport.chronologie[0].quand <= rapport.chronologie[1].quand);
  assert.equal(rapport.analyses, table.size);
});

test("conclureRapport : sans titre du modele -> « Récapitulatif : sujet » ; rapport vide garde le meme format", () => {
  const { rapport } = conclureRapport({ rien_a_dire: false, titre: "", contexte: { texte: "Contexte.", sources: ["M1"] }, intervenants: [], desaccords: [], decision: { statut: "aucune", texte: "", sources: [] } }, table, index, { sujet: "essai", maintenant: MAINTENANT });
  assert.equal(rapport.titre, "Récapitulatif : essai");
  assert.equal(rapport.decision.statut, "aucune");
  const vide = conclureRapport({ rien_a_dire: true }, new Map(), index, { sujet: "essai", maintenant: MAINTENANT }).rapport;
  assert.equal(vide.vide, true);
  assert.equal(vide.message, MESSAGE_RIEN);
  assert.equal(vide.titre, "Récapitulatif : essai");
  assert.deepEqual(vide.chronologie, []);
});

// ---------- Texte ----------
test("dateJJMMAAAA et perimetre : date locale, nombres et discussions", () => {
  assert.equal(dateJJMMAAAA(new Date(2026, 9, 6, 12).getTime()), "06/10/2026");
  const { rapport } = conclureRapport({
    rien_a_dire: false, titre: "T", contexte: { texte: "C.", sources: ["M1", "M3"] }, intervenants: [], desaccords: [], decision: { statut: "aucune", texte: "", sources: [] }
  }, table, index, { sujet: "s", maintenant: new Date(2026, 9, 26, 9).getTime() });
  const perimetre = perimetreDe(rapport);
  assert.match(perimetre, /^6 messages analysés, 2 messages cités dans \d discussions?, (le \d{2}\/\d{2}\/\d{4}|du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4})$/);
});

test("libelleDecision : aucune, prise, rapportee, incertaine", () => {
  assert.equal(MESSAGE_AUCUNE_DECISION, "Aucune décision prise");
  assert.equal(libelleDecision({ statut: "aucune" }), "Aucune décision prise");
  assert.equal(libelleDecision({ statut: "prise" }), "Décision prise");
  assert.equal(libelleDecision({ statut: "rapportee" }), "Décision rapportée de seconde main");
  assert.equal(libelleDecision({ statut: "incertaine" }), "Décision incertaine");
});

test("rapportEnTexte : cinq blocs dans l'ordre, « Aucune décision prise », sources a la fin", () => {
  const { rapport } = conclureRapport({
    rien_a_dire: false, titre: "Cloison du local technique",
    contexte: { texte: "La cloison est en CF 1h.", sources: ["M1"] },
    intervenants: [auteursTable[0], auteursTable[1] || auteursTable[0]],
    desaccords: [{ opposants: [auteursTable[0]], objet: "S'oppose au report.", sources: ["M2"] }],
    decision: { statut: "aucune", texte: "", sources: [] }
  }, table, index, { sujet: "cloison", maintenant: new Date(2026, 9, 26, 9).getTime() });
  const texte = rapportEnTexte(rapport);
  const positions = ["Cloison du local technique", "Rapport du 26/10/2026", "CONTEXTE", "INTERVENANTS", "DÉSACCORDS EXPRIMÉS", "DÉCISION FINALE", "SOURCES"].map((m) => texte.indexOf(m));
  assert.ok(positions.every((p) => p >= 0), JSON.stringify(positions));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
  assert.match(texte, /DÉCISION FINALE\nAucune décision prise/);
  assert.match(texte, /- .+ : S'oppose au report\./);
  assert.ok(!texte.includes(String.fromCharCode(0x2014)));
});

test("rapportEnTexte : aucun desaccord, decision rapportee, point non confirme, rapport vide", () => {
  const { rapport } = conclureRapport({
    rien_a_dire: false, titre: "T", contexte: { texte: "Décalé de 99 cm.", sources: ["M1"] }, intervenants: [], desaccords: [],
    decision: { statut: "rapportee", texte: "Le levage serait décalé.", sources: ["M2"] }
  }, table, index, { sujet: "s", maintenant: MAINTENANT });
  const texte = rapportEnTexte(rapport);
  assert.ok(texte.includes(MESSAGE_AUCUN_DESACCORD));
  assert.match(texte, /DÉCISION FINALE\nDécision rapportée de seconde main : Le levage serait décalé\./);
  assert.match(texte, /Décalé de 99 cm\. \(non confirmé\)/);
  const vide = conclureRapport({ rien_a_dire: true }, new Map(), index, { sujet: "s", maintenant: MAINTENANT }).rapport;
  assert.match(rapportEnTexte(vide).trim(), new RegExp(MESSAGE_RIEN.replace(/[.]/g, "\\.") + "$"));
});
