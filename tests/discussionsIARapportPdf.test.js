// Tests de l'export PDF du recapitulatif de Discussions (26/10) : definition pure (comme definitionPdf du Quantitatif) et document genere avec les VRAIES
// bibliotheques (jspdf, jspdf-autotable) sous Node. Tout est verifie par le code, sans capture.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { definitionRapportPdf, construireRapportPdf, nomFichierRapport } from "../src/discussionsIARapportPdf.js";
import { sansSpecial, horsWinAnsi } from "../src/exportPdfCommun.js";
import { conclureRapport } from "../src/discussionsIAMoteur.js";
import { indexer } from "../src/discussionsIAIndex.js";
import { fixture } from "./aide/fixtureDiscussions.js";

const donnees = fixture();
const index = indexer(donnees.conversations, donnees.personnes);
const table = new Map(index.messages.slice(0, 8).map((m, i) => ["M" + (i + 1), m]));
const DATE = new Date(2026, 9, 26, 9, 30).getTime();
const aucune = { statut: "aucune", texte: "", sources: [] };
const complet = (extra = {}) => conclureRapport({
  rien_a_dire: false, titre: "Cloison du local technique",
  contexte: { texte: "La cloison est en CF 1h dans la maquette, le programme dit CF 2h.", sources: ["M1"] },
  intervenants: [], desaccords: [{ opposants: [], objet: "Désaccord sur l'indice du coupe-feu.", sources: ["M2"] }],
  decision: { statut: "prise", texte: "Ana corrige la cloison.", sources: ["M3"] }, ...extra
}, table, index, { sujet: "Cloison coupe-feu", maintenant: DATE }).rapport;
// Texte ecrit dans le PDF : jsPDF ecrit les chaines en WinAnsi (un octet par caractere), relues ici en latin1.
const textePdf = (doc) => Buffer.from(doc.output("arraybuffer")).toString("latin1");
const logo = "data:image/png;base64," + readFileSync(new URL("../public/icons/icon-192.png", import.meta.url)).toString("base64");

test("nomFichierRapport : ouvra-recap-<sujet>-AAAA-MM-JJ.pdf, sujet sans accent ni caractere special, borne", () => {
  assert.equal(nomFichierRapport("Cloison coupe-feu", DATE), "ouvra-recap-cloison-coupe-feu-2026-10-26.pdf");
  assert.equal(nomFichierRapport("  Accès grue : semaine 44 / été !  ", DATE), "ouvra-recap-acces-grue-semaine-44-ete-2026-10-26.pdf");
  assert.equal(nomFichierRapport("", DATE), "ouvra-recap-discussion-2026-10-26.pdf");
  assert.equal(nomFichierRapport("😀😀", DATE), "ouvra-recap-discussion-2026-10-26.pdf");
  assert.ok(nomFichierRapport("mot ".repeat(60), DATE).length <= 70);
});

test("definition : cinq blocs, date, perimetre, nom de fichier ; aucun caractere hors encodage", () => {
  const d = definitionRapportPdf(complet());
  assert.equal(d.titreDocument, "Récapitulatif de discussion");
  assert.equal(d.titre, "Cloison du local technique");
  assert.equal(d.dateLibelle, "Rapport du 26/10/2026");
  assert.match(d.perimetre, /^8 messages analysés, 3 messages cités/);
  assert.ok(d.contexte.texte.startsWith("La cloison est en CF 1h"));
  assert.ok(d.intervenants.length >= 1);
  assert.equal(d.desaccords.length, 1);
  assert.equal(d.decision.libelle, "Décision prise");
  assert.equal(d.decision.texte, "Ana corrige la cloison.");
  assert.equal(d.nomFichier, "ouvra-recap-cloison-coupe-feu-2026-10-26.pdf");
  assert.equal(d.sources.length, 3);
  assert.deepEqual(d.sources.map((s) => s.numero), [1, 2, 3]);
  for (const s of d.sources) assert.ok(s.expediteur && s.date && s.extrait && s.discussion);
  assert.equal(horsWinAnsi(JSON.stringify(d)), false);
});

test("definition : aucune decision -> « Aucune décision prise » ; aucun desaccord signale ; decision de seconde main marquee", () => {
  const sans = definitionRapportPdf(complet({ decision: aucune, desaccords: [] }));
  assert.equal(sans.decision.libelle, "Aucune décision prise");
  assert.equal(sans.decision.texte, "");
  assert.equal(sans.desaccords.length, 0);
  assert.equal(sans.aucunDesaccord, "Aucun désaccord exprimé.");
  const rapportee = definitionRapportPdf(complet({ decision: { statut: "rapportee", texte: "Le levage serait décalé.", sources: ["M3"] } }));
  assert.equal(rapportee.decision.libelle, "Décision rapportée de seconde main");
});

test("definition : texte de message avec emoji, guillemets typographiques, tirets et espaces insecables -> encodage sur", () => {
  const messages = new Map(Array.from(table).map(([id, m]) => [id, { ...m, texte: "Voilà 😀 « ok » – d’accord : 12 000 → fait … ✔" }]));
  const rapport = conclureRapport({
    rien_a_dire: false, titre: "Titre 😀 " + String.fromCharCode(0x2014) + " long", contexte: { texte: "Contexte “citing”", sources: ["M1"] }, intervenants: [], desaccords: [],
    decision: { statut: "aucune", texte: "", sources: [] }
  }, messages, index, { sujet: "s", maintenant: DATE }).rapport;
  const d = definitionRapportPdf(rapport);
  assert.equal(horsWinAnsi(JSON.stringify(d)), false);
  assert.ok(d.titre.includes("Titre ? - long"));
  assert.ok(d.contexte.texte.includes("\"citing\""));
  assert.ok(d.sources[0].extrait.includes("Voilà ? « ok » - d'accord : 12 000 -> fait ... ?"));
});

test("sansSpecial et horsWinAnsi : accents et œ gardes, emoji et symboles remplaces", () => {
  assert.equal(sansSpecial("Éléphant œuvre à ça ï ü m² m³ €"), "Éléphant œuvre à ça ï ü m² m³ €");
  assert.equal(horsWinAnsi("é œ €"), false);
  assert.equal(horsWinAnsi("😀"), true);
  assert.equal(sansSpecial("a😀b"), "a?b");
  assert.equal(sansSpecial(null), "");
});

test("definition : rapport vide -> message « Rien n'a été dit à ce sujet. », aucune source", () => {
  const vide = conclureRapport({ rien_a_dire: true }, new Map(), index, { sujet: "grue", maintenant: DATE }).rapport;
  const d = definitionRapportPdf(vide);
  assert.equal(d.vide, true);
  assert.equal(d.message, "Rien n'a été dit à ce sujet.");
  assert.deepEqual(d.sources, []);
  assert.equal(construireRapportPdf({ jsPDF, autoTable }, d, { logoPng: logo }).getNumberOfPages(), 1);
});

test("pdf : A4 portrait, en-tete avec logo, pied « Généré par Ouvra » et « Page n / N » sur chaque page, textes presents", () => {
  const def = definitionRapportPdf(complet());
  const doc = construireRapportPdf({ jsPDF, autoTable }, def, { logoPng: logo, maintenant: new Date(2026, 9, 26) });
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.01);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 297) < 0.01);
  const n = doc.getNumberOfPages();
  assert.ok(n >= 1);
  const octets = Buffer.from(doc.output("arraybuffer"));
  assert.equal(octets.subarray(0, 5).toString(), "%PDF-");
  const pdf = octets.toString("latin1");
  assert.ok(/\/Subtype\s*\/Image/.test(pdf), "le logo doit etre incruste");
  assert.ok(pdf.includes("Helvetica"));
  assert.ok(!/\/Subtype\s*\/Type0/.test(pdf), "police standard seulement");
  // Le texte des pages (le contenu non compresse par defaut) : on relit les chaines ecrites.
  const texte = textePdf(doc);
  for (const attendu of ["OUVRA", "Récapitulatif de discussion", "Cloison du local technique", "Rapport du 26/10/2026", "CONTEXTE", "INTERVENANTS", "DÉSACCORDS EXPRIMÉS", "DÉCISION FINALE", "SOURCES", "Généré par Ouvra", "Page 1 / " + n]) {
    assert.ok(texte.includes(attendu), "texte absent : " + attendu);
  }
  const ordre = ["CONTEXTE", "INTERVENANTS", "DÉSACCORDS EXPRIMÉS", "DÉCISION FINALE", "SOURCES"].map((m) => texte.indexOf(m));
  assert.deepEqual(ordre, ordre.slice().sort((a, b) => a - b));
});

test("pdf : sans logo, sans decision et tres long (plusieurs pages) restent valides, pied sur chaque page", () => {
  const sans = construireRapportPdf({ jsPDF, autoTable }, definitionRapportPdf(complet({ decision: aucune })), {});
  assert.equal(sans.getNumberOfPages(), 1);
  assert.ok(textePdf(sans).includes("Aucune décision prise"));
  const longueSource = { rien_a_dire: false, titre: "Long", contexte: { texte: "Mot ".repeat(190), sources: ["M1"] }, intervenants: [], decision: aucune, desaccords: Array.from({ length: 8 }, (_, i) => ({ opposants: [], objet: "Désaccord numéro " + i + " " + "texte ".repeat(70), sources: ["M2"] })) };
  const long = construireRapportPdf({ jsPDF, autoTable }, definitionRapportPdf(conclureRapport(longueSource, table, index, { sujet: "long", maintenant: DATE }).rapport), { logoPng: logo });
  const pages = long.getNumberOfPages();
  assert.ok(pages > 1);
  for (let p = 1; p <= pages; p += 1) assert.ok(textePdf(long).includes("Page " + p + " / " + pages), "pied de la page " + p);
});

// Filigrane « Modèle de présentation » (28/10) : seulement sur le PDF du rapport modèle (modele: true), jamais sur un rapport généré par l'IA.
test("filigrane : defini seulement pour un rapport modele", () => {
  assert.equal(definitionRapportPdf(complet()).filigrane, null);
  assert.equal(definitionRapportPdf({ ...complet(), modele: true }).filigrane, "Modèle de présentation");
});

test("filigrane : present sur chaque page du PDF d'un rapport modele, absent d'un rapport normal", () => {
  const normal = construireRapportPdf({ jsPDF, autoTable }, definitionRapportPdf(complet()), { logoPng: logo });
  assert.equal(textePdf(normal).includes("Modèle de présentation"), false);
  const longueSource = { rien_a_dire: false, titre: "Long", contexte: { texte: "Mot ".repeat(190), sources: ["M1"] }, intervenants: [], decision: aucune, desaccords: Array.from({ length: 8 }, (_, i) => ({ opposants: [], objet: "Désaccord numéro " + i + " " + "mot ".repeat(60), sources: ["M2"] })) };
  const modele = { ...conclureRapport(longueSource, table, index, { sujet: "long", maintenant: DATE }).rapport, modele: true };
  const doc = construireRapportPdf({ jsPDF, autoTable }, definitionRapportPdf(modele), { logoPng: logo });
  const pages = doc.getNumberOfPages();
  assert.ok(pages > 1);
  assert.ok(textePdf(doc).split("Modèle de présentation").length - 1 >= pages, "un filigrane par page");
  assert.match(textePdf(doc), /\/ca 0\.12/, "filigrane translucide (opacite de remplissage)");
});

test("pdf mobile (29/10) : page etroite 105 x 186 mm comme le Quantitatif, corps >= 10 pt, tout le contenu present, laptop inchange", () => {
  const def = definitionRapportPdf(complet());
  const doc = construireRapportPdf({ jsPDF, autoTable }, def, { logoPng: logo, maintenant: new Date(2026, 9, 29), mobile: true });
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 105) < 0.01 && Math.abs(doc.internal.pageSize.getHeight() - 186) < 0.01);
  const brut = textePdf(doc);
  const polices = new Set([...brut.matchAll(/([\d.]+) Tf/g)].map((m) => Number(m[1])));
  assert.ok(Math.min(...[...polices].filter((t) => t >= 9)) >= 10);
  for (const attendu of ["Cloison du local technique", "CONTEXTE", "Ana corrige la cloison.", "SOURCES"]) assert.ok(brut.includes(attendu), attendu);
  const laptop = construireRapportPdf({ jsPDF, autoTable }, def, { logoPng: logo });
  assert.ok(Math.abs(laptop.internal.pageSize.getWidth() - 210) < 0.01);
});

test("export mobile : l'onglet navigue vers le PDF (meme mecanisme que le Quantitatif), branche depuis Discussions", () => {
  const src = readFileSync(new URL("../src/discussionsIARapportPdf.js", import.meta.url), "utf8");
  assert.ok(src.includes("{ onglet, telecharger, ...(mobile ? { afficher: afficherPdfPleinOnglet } : {}) }"));
  assert.ok(readFileSync(new URL("../src/discussionsIAMontage.js", import.meta.url), "utf8").includes("mobile: !!window.matchMedia && window.matchMedia(REQUETE_MOBILE).matches"));
});
