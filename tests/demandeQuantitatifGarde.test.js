// Garde-fou (30/10) : la phrase « Demande a l'IA » d'une zone quantitatif ne doit jamais etre refusee par l'IA du Quantitatif (relais/consigneQuantitatif.js :
// une seule requete, une seule mesure, aucune action ni collision, « niveau 2 » et non « R+2 »). Sinon le champ est ignore et la phrase de l'exemple est jointe.
import test from "node:test";
import assert from "node:assert/strict";
import { phraseQuantitatifAcceptable } from "../src/demandeQuantitatifGarde.js";
import { EXEMPLES_QUANTITATIF } from "../src/quantitatifExemples.js";
import { normaliserRapport } from "../src/discussionsIARapportNormaliser.js";
import { creerPipeline } from "../src/discussionsIAPipeline.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { CONSIGNE_RAPPORT } from "../relais/consigneDiscussions.js";
import { chargerDemo } from "./aide/demoMessagerie.js";

const REFUSEE = "Compte les gaines et les raccords de gaine à reprendre, le faux plafond à déposer et à refaire, et le linéaire de cloison touchée par la collision de la gaine rectangulaire avec la cloison de 123 mm au R+2.";
const ATTENDUE = "Compte les gaines, les raccords de gaine et les faux plafonds du niveau 2, par famille";

test("garde : la phrase refusee en essai reel est rejetee", () => {
  assert.equal(phraseQuantitatifAcceptable(REFUSEE), false);
});

test("garde : toutes les phrases des exemples du Quantitatif sont acceptees", () => {
  for (const e of EXEMPLES_QUANTITATIF) assert.equal(phraseQuantitatifAcceptable(e.demande), true, e.demande);
});

test("garde : phrases simples valides acceptees", () => {
  for (const p of ["Combien de portes au niveau 2 ?", "Compte les gaines du niveau 2, par famille", "Fais-moi le point sur le niveau 2", "Longueur totale des gaines du niveau 2", "Surface des faux plafonds par niveau"])
    assert.equal(phraseQuantitatifAcceptable(p), true, p);
});

test("garde : collision, R+n, deux mesures, action, deux demandes = rejetes", () => {
  for (const p of ["Compte les gaines en collision avec les cloisons du niveau 2", "Combien de collisions de gaines au niveau 2 ?", "Compte les gaines au R+2",
    "Compte les gaines au r+3", "Compte les gaines et donne le linéaire de cloison du niveau 2", "Combien de murs et quelle surface de murs au niveau 2 ?",
    "Longueur totale et volume des gaines", "Compte les gaines à déposer au niveau 2",
    "Affiche les gaines du niveau 2", "Compte les gaines du niveau 2 et compte les portes du niveau 2", "Combien de gaines au niveau 2 ? Combien de portes ?",
    "Compte les gaines du niveau 2 et à refaire les faux plafonds"])
    assert.equal(phraseQuantitatifAcceptable(p), false, p);
});

test("garde : entree vide ou invalide rejetee", () => {
  for (const p of ["", "   ", null, undefined, 42, {}]) assert.equal(phraseQuantitatifAcceptable(p), false);
});

// ---------- Normaliseur : seule la zone quantitatif est filtree ----------
const TEXTES = { M1: "Collision entre la gaine rectangulaire et la cloison de 123 mm au R+2.", M2: "On ne tranche pas sans métré du niveau 2." };
const options = { auteurs: new Set(["Ana"]), texteDe: (id) => TEXTES[id] ?? null, auteurDe: () => "Ana" };
const brut = (demande_ia) => ({
  rien_a_dire: false, titre: "Gaines", contexte: { texte: "Collision au R+2.", sources: ["M1"] }, intervenants: ["Ana"], desaccords: [],
  decision: { statut: "prise", texte: "On ne tranche pas sans métré du niveau 2.", sources: ["M2"] }, demande_ia
});

test("normaliseur : quantitatif invalide = champ ignore sans erreur ; valide = conserve ; autres zones inchangees", () => {
  const rejetee = normaliserRapport(brut({ zone: "quantitatif", phrase: "Compte les gaines au R+2 en collision" }), options);
  assert.ok(rejetee);
  assert.equal(rejetee.demandeIA, null);
  assert.equal(rejetee.decision.statut, "prise");
  assert.deepEqual(normaliserRapport(brut({ zone: "quantitatif", phrase: ATTENDUE }), options).demandeIA, { zone: "quantitatif", phrase: ATTENDUE });
  for (const zone of ["viewer", "collision", "discussions"]) {
    const phrase = "Affiche la collision de la gaine au R+2 et filtre";
    assert.deepEqual(normaliserRapport(brut({ zone, phrase }), options).demandeIA, { zone, phrase });
  }
});

test("consigne : la zone quantitatif rappelle les regles du Quantitatif", () => {
  assert.match(CONSIGNE_RAPPORT, /UNE seule question/);
  assert.match(CONSIGNE_RAPPORT, /jamais « collision »/);
});

// ---------- De bout en bout : phrase du modele refusee, phrase de l'exemple jointe ----------
test("bout en bout : phrase du modele refusee par le Quantitatif = encart de l'exemple reconnu sans IA", async () => {
  const maintenant = new Date("2026-10-30T09:00:00");
  const demo = await chargerDemo(maintenant);
  const index = indexer(demo.conversations, demo.personnes);
  const pipeline = creerPipeline({
    lireIndex: () => index,
    maintenant: () => maintenant.getTime(),
    comprendre: async () => ({ ok: false, code: "ia_indisponible", message: "hors ligne" }),
    analyser: async ({ extraits }) => {
      const id = (debut) => extraits.find((e) => e.texte.startsWith(debut)).id;
      return { ok: true, sortie: {
        rien_a_dire: false, titre: "Gaines au R+2", contexte: { texte: "Une gaine traverse une cloison.", sources: [id("Gilles, j'ai une collision. La gaine rectangulaire")] },
        intervenants: ["Sophie Lambert"], desaccords: [],
        decision: { statut: "prise", texte: "Ne pas trancher sans métré.", sources: [id("Sur la collision de la gaine rectangulaire et de la cloison au R+2, je propose de ne pas trancher")] },
        demande_ia: { zone: "quantitatif", phrase: REFUSEE }
      } };
    }
  });
  const r = await pipeline.traiter("Fais-moi un rapport sur les collisions avec les gaines");
  assert.equal(r.type, "rapport");
  assert.deepEqual(r.rapport.demandeIA, { zone: "quantitatif", phrase: ATTENDUE });
  assert.equal(phraseQuantitatifAcceptable(r.rapport.demandeIA.phrase), true);
});
