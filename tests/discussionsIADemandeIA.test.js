// Encart « Demande à l'IA » du rapport de Discussions (30/10, decision de Gilles) : champ optionnel `demande_ia` { zone, phrase } de la reponse du modele.
// Normalisation (zone dans la liste, phrase non vide et bornee, tout le reste = pas d'encart), schema, consigne, PDF, copie, rapport modele.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { normaliserRapport, ZONES_DEMANDE_IA, DEMANDE_IA_MAX } from "../src/discussionsIARapportNormaliser.js";
import { mentionDemandeIA, libelleZoneDemande, rapportEnTexte } from "../src/discussionsIARapportFormat.js";
import { definitionRapportPdf, construireRapportPdf } from "../src/discussionsIARapportPdf.js";
import { construireRapportModele } from "../src/discussionsIARapportModele.js";
import { conclureRapport } from "../src/discussionsIAMoteur.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { construireSchemaAnalyseJson } from "../relais/schemaDiscussions.js";
import { CONSIGNE_RAPPORT } from "../relais/consigneDiscussions.js";
import { convertirSortieAnalyse } from "../relais/sortieDiscussions.js";
import { fixture } from "./aide/fixtureDiscussions.js";
import { chargerDemo } from "./aide/demoMessagerie.js";

const TEXTES = { M1: "Le local technique du niveau 2 est en CF 1h. 20/10 octobre", M2: "On compte les gaines du niveau 2 avant de trancher. octobre" };
const options = { auteurs: new Set(["Ana"]), texteDe: (id) => TEXTES[id] ?? null, auteurDe: () => "Ana" };
const brut = (extra = {}) => ({
  rien_a_dire: false, titre: "Local technique",
  contexte: { texte: "Le local est en CF 1h.", sources: ["M1"] }, intervenants: ["Ana"], desaccords: [],
  decision: { statut: "prise", texte: "On compte les gaines du niveau 2.", sources: ["M2"] },
  demande_ia: { zone: "quantitatif", phrase: "Compte les gaines du niveau 2, par famille" }, ...extra
});
const demande = (extra) => normaliserRapport(brut(extra), options).demandeIA;

test("normalisation : zone valide + phrase = demande conservee (phrase nettoyee)", () => {
  assert.deepEqual(demande(), { zone: "quantitatif", phrase: "Compte les gaines du niveau 2, par famille" });
  assert.deepEqual(demande({ demande_ia: { zone: "viewer", phrase: "  Affiche-moi   les gaines \n du niveau 2 " } }), { zone: "viewer", phrase: "Affiche-moi les gaines du niveau 2" });
  for (const zone of ZONES_DEMANDE_IA) assert.equal(demande({ demande_ia: { zone, phrase: "Fais-moi le point sur le niveau 2" } }).zone, zone);
  assert.deepEqual([...ZONES_DEMANDE_IA], ["viewer", "collision", "quantitatif", "discussions"]);
});

test("normalisation : champ absent, null, zone inconnue ou « aucune », phrase vide ou non textuelle = aucun encart, sans erreur", () => {
  const sans = brut();
  delete sans.demande_ia;
  assert.equal(normaliserRapport(sans, options).demandeIA, null);
  for (const d of [null, undefined, "x", 3, [], {}, { zone: "aucune", phrase: "" }, { zone: "aucune", phrase: "Compte les gaines du niveau 2" },
    { zone: "inconnue", phrase: "Compte les gaines du niveau 2" }, { zone: "Quantitatif", phrase: "Compte les gaines du niveau 2" }, { zone: "viewer", phrase: "" },
    { zone: "viewer", phrase: "   " }, { zone: "viewer" }, { phrase: "Compte les gaines du niveau 2" }, { zone: "viewer", phrase: 42 }]) {
    const r = normaliserRapport(brut({ demande_ia: d }), options);
    assert.ok(r, "rapport conserve");
    assert.equal(r.demandeIA, null, JSON.stringify(d));
    assert.equal(r.decision.statut, "prise");
  }
});

test("normalisation : phrase trop longue = ignoree (jamais tronquee) ; a la limite exacte = conservee", () => {
  const limite = "a".repeat(DEMANDE_IA_MAX);
  assert.equal(demande({ demande_ia: { zone: "viewer", phrase: limite } }).phrase, limite);
  assert.equal(demande({ demande_ia: { zone: "viewer", phrase: limite + "a" } }), null);
});

test("normalisation : pas de decision (statut aucune) ou rapport vide = pas de demande", () => {
  assert.equal(normaliserRapport(brut({ decision: { statut: "aucune", texte: "", sources: [] } }), options).demandeIA, null);
  assert.equal(normaliserRapport({ rien_a_dire: true, demande_ia: { zone: "viewer", phrase: "Affiche-moi tout" } }, options).demandeIA, null);
});

test("normalisation : un chiffre de la phrase absent de la decision et de ses sources = demande ignoree (rien d'invente)", () => {
  assert.equal(demande({ demande_ia: { zone: "quantitatif", phrase: "Compte les gaines du niveau 7" } }), null);
  assert.equal(demande({ demande_ia: { zone: "quantitatif", phrase: "Compte les gaines du niveau 2 en novembre" } }), null);
});

test("normalisation : un chiffre cite par le contexte ou un desaccord du rapport (cloison de 123 mm) est permis dans la phrase ; hors de tous les messages cites, toujours refuse", () => {
  const phrase = "Compte les cloisons CF 1h du niveau 2";
  assert.deepEqual(demande({ demande_ia: { zone: "quantitatif", phrase } }), { zone: "quantitatif", phrase });
  const avecDesaccord = { desaccords: [{ opposants: ["Ana"], objet: "Le renfort de 15 cm.", sources: ["M3"] }] };
  const autre = { ...options, texteDe: (id) => (id === "M3" ? "Le renfort fait 15 cm." : TEXTES[id] ?? null) };
  const r = normaliserRapport(brut({ ...avecDesaccord, demande_ia: { zone: "quantitatif", phrase: "Compte les renforts de 15 cm au niveau 2" } }), autre);
  assert.equal(r.demandeIA.zone, "quantitatif");
  assert.equal(demande({ demande_ia: { zone: "quantitatif", phrase: "Compte les cloisons de 123 mm du niveau 2" } }), null);
});

test("relais : la demande traverse la normalisation du relais ; sans demande valide, le champ est absent de la sortie", () => {
  const extraits = [{ id: "M1", discussion: "Fil", auteur: "Ana", quand: "2026-10-20 10:00", texte: TEXTES.M1 }, { id: "M2", discussion: "Fil", auteur: "Ana", quand: "2026-10-20 11:00", texte: TEXTES.M2 }];
  const avec = convertirSortieAnalyse(brut(), "rapport", extraits).sortie;
  assert.deepEqual(avec.demande_ia, { zone: "quantitatif", phrase: "Compte les gaines du niveau 2, par famille" });
  const sans = convertirSortieAnalyse(brut({ demande_ia: { zone: "aucune", phrase: "" } }), "rapport", extraits).sortie;
  assert.equal("demande_ia" in sans, false);
  // la page reverifie la sortie du relais avec le meme code : la demande survit au second passage
  assert.deepEqual(normaliserRapport(avec, options).demandeIA, avec.demande_ia);
});

test("schema : champ demande_ia { zone, phrase } avec « aucune » pour ne rien demander ; schema toujours plat et petit", () => {
  const schema = construireSchemaAnalyseJson("rapport", ["M1", "M2"], ["Ana", "Vous"]);
  const d = schema.properties.demande_ia;
  assert.ok(d, "demande_ia dans le schema");
  assert.deepEqual(d.properties.zone.enum, [...ZONES_DEMANDE_IA, "aucune"]);
  assert.equal(d.properties.phrase.type, "string");
  assert.ok(JSON.stringify(schema).length <= 3000, "schema de " + JSON.stringify(schema).length);
  assert.doesNotMatch(JSON.stringify(schema), /anyOf|oneOf/);
});

test("consigne : demande a l'IA seulement quand la decision appelle une action dans Ouvra, sans rien inventer", () => {
  assert.match(CONSIGNE_RAPPORT, /demande_ia/);
  assert.match(CONSIGNE_RAPPORT, /zone "aucune"/);
  for (const zone of ZONES_DEMANDE_IA) assert.ok(CONSIGNE_RAPPORT.includes(zone), zone);
  assert.doesNotMatch(CONSIGNE_RAPPORT, /\u2014|\u2013/);
});

test("consigne : une decision en attente d'une information mesurable appelle une demande, meme si un collegue la prepare (rapport des gaines du R+2)", () => {
  assert.match(CONSIGNE_RAPPORT, /ne pas trancher avant|en attente d'une information/);
  assert.match(CONSIGNE_RAPPORT, /métré/);
  assert.match(CONSIGNE_RAPPORT, /même si un collègue/);
  assert.doesNotMatch(CONSIGNE_RAPPORT, /Dans le doute : zone "aucune"/);
  assert.match(CONSIGNE_RAPPORT, /coupe-feu/);
});

const donnees = fixture();
const index = indexer(donnees.conversations, donnees.personnes);
const table = new Map(index.messages.slice(0, 8).map((m, i) => ["M" + (i + 1), m]));
const DATE = new Date(2026, 9, 26, 9, 30).getTime();
const rapportAvec = (demande_ia) => conclureRapport({
  rien_a_dire: false, titre: "Cloison du local technique",
  contexte: { texte: "La cloison est en CF 1h dans la maquette, le programme dit CF 2h.", sources: ["M1"] }, intervenants: [], desaccords: [],
  decision: { statut: "prise", texte: "Ana corrige la cloison.", sources: ["M3"] }, ...(demande_ia === undefined ? {} : { demande_ia })
}, table, index, { sujet: "Cloison coupe-feu", maintenant: DATE }).rapport;
const PHRASE = "Compte les cloisons du niveau 1";

test("moteur : la demande valide arrive dans le rapport ; sans demande, demandeIA est null", () => {
  assert.deepEqual(rapportAvec({ zone: "quantitatif", phrase: PHRASE }).demandeIA, { zone: "quantitatif", phrase: PHRASE });
  assert.equal(rapportAvec(undefined).demandeIA, null);
  assert.equal(rapportAvec({ zone: "aucune", phrase: "" }).demandeIA, null);
});

test("format : libelle de zone et mention du PDF « Demande à l'IA (Quantitatif) : « … » »", () => {
  assert.equal(libelleZoneDemande("quantitatif"), "Quantitatif");
  assert.equal(mentionDemandeIA({ zone: "collision", phrase: PHRASE }), "Demande à l'IA (Collision) : « " + PHRASE + " »");
});

test("PDF : la mention est ecrite en texte selectionnable apres la decision, seulement si le champ existe", () => {
  const avec = definitionRapportPdf(rapportAvec({ zone: "quantitatif", phrase: PHRASE }));
  assert.equal(avec.demandeIA, "Demande à l'IA (Quantitatif) : « " + PHRASE + " »");
  assert.equal(definitionRapportPdf(rapportAvec(undefined)).demandeIA, null);
  const texte = (def) => Buffer.from(construireRapportPdf({ jsPDF, autoTable }, def, { maintenant: new Date(DATE) }).output("arraybuffer")).toString("latin1");
  assert.ok(/Demande . l'IA \\\(Quantitatif\\\) : /.test(texte(avec)));
  assert.ok(texte(avec).includes(PHRASE));
  assert.ok(!/Demande . l'IA/.test(texte(definitionRapportPdf(rapportAvec(undefined)))));
});

test("copie en texte : inchangee (la demande n'y est pas ajoutee)", () => {
  assert.equal(rapportEnTexte(rapportAvec({ zone: "quantitatif", phrase: PHRASE })), rapportEnTexte(rapportAvec(undefined)));
});

test("rapport modele de la demo : encart Quantitatif avec la phrase exacte de l'etape suivante", async () => {
  const maintenant = new Date("2026-10-30T09:00:00");
  const demo = await chargerDemo(maintenant);
  const r = construireRapportModele(indexer(demo.conversations, demo.personnes), { maintenant: maintenant.getTime() });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rapport.demandeIA, { zone: "quantitatif", phrase: "Compte les gaines, les raccords de gaine et les faux plafonds du niveau 2, par famille" });
  assert.equal(definitionRapportPdf(r.rapport).demandeIA, "Demande à l'IA (Quantitatif) : « Compte les gaines, les raccords de gaine et les faux plafonds du niveau 2, par famille »");
});

test("vue : l'encart est un vrai bouton, cree seulement si le rapport a une demande, et copie la phrase exacte", () => {
  const src = readFileSync(new URL("../src/discussionsIARapportVue.js", import.meta.url), "utf8");
  assert.match(src, /if \(!rapport\.demandeIA\) return null/);
  assert.match(src, /creerEncartDemande\(\{ demande, zone, ecrire: \(texte\) => navigator\.clipboard\.writeText\(texte\) \}\)/);
  const encart = readFileSync(new URL("../src/discussionsIADemandeCopie.js", import.meta.url), "utf8");
  assert.match(encart, /creer\("button", "disc-rapport-demande"\)/);
  assert.match(encart, /ecrire\(demande\.phrase\)/);
  assert.match(encart, /aria-live/);
});
