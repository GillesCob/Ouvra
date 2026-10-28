// Tests des rendus d'export (PDF, Excel) : contenu verifie par le code, sans capture. Les vraies bibliotheques (jspdf, jspdf-autotable, exceljs) tournent sous Node.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { calculer } from "../src/quantitatif.js";
import { construireRapport, formaterNombre, nomFichier } from "../src/quantitatifRapport.js";
import { comparerVersions } from "../src/quantitatifVersions.js";
import { definitionPdf, construirePdf } from "../src/quantitatifExportPdf.js";
import { construireClasseur, NOM_FEUILLE, NOM_FEUILLE_INFOS } from "../src/quantitatifExportXlsx.js";

const el = (id, typeIfc, niveau, maquette, nom, boite = null) => ({ id, nom, famille: nom, typeIfc, niveau, maquette, maquetteId: maquette, boite, quantites: null });
const ELEMENTS = [
  el("a", "IfcDoor", "Level 1", "Architecture", "Porte"), el("b", "IfcDoor", "Level 2", "Architecture", "Porte"), el("c", "IfcDoor", "Level 2", "Architecture", "Porte"),
  el("d", "IfcDuctSegment", "Level 1", "Mechanical (CVC)", "Gaine", [0, 0, 0, 4.5, 1, 1]), el("e", "IfcDuctSegment", "Level 2", "Mechanical (CVC)", "Gaine", [0, 0, 0, 2, 1, 1])
];
const filtres = (f = {}) => ({ typesIfc: [], niveaux: [], maquettes: [], noms: [], ...f });
const VERSIONS = [{ id: "arch", label: "Architecture", url: "/a.xkt", empreinte: "etag:A1" }, { id: "mep", label: "Mechanical (CVC)", url: "/m.xkt", empreinte: "etag:M1" }];
const rapport = (req) => construireRapport({ resultat: calculer(ELEMENTS, req), phrase: "Combien de portes par niveau ?", versions: VERSIONS, calculeLe: new Date("2026-10-24T10:05:00") });
const portes = () => rapport({ mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDoor"] }), regroupements: ["niveau"] });
const gaines = () => rapport({ mesure: "longueur_estimee", filtres: filtres({ typesIfc: ["IfcDuctSegment"] }), regroupements: ["niveau"] });
const aJour = { etat: "a_jour", changees: [], inconnues: [] };
const obsolete = comparerVersions([{ id: "arch", label: "Architecture", empreinte: "etag:A1" }], [{ id: "arch", label: "Architecture", empreinte: "etag:A2" }]);

test("formaterNombre : virgule decimale, espaces ordinaires (pas d'espace insecable hors encodage PDF)", () => {
  assert.equal(formaterNombre(1234567.5), "1 234 567,5");
  assert.ok(!/[  ]/.test(formaterNombre(1234567.5)));
  assert.equal(nomFichier(portes(), "pdf"), "quantitatif-2026-10-24-10h05.pdf");
});

// ---------- PDF ----------
test("pdf : definition = titre, informations, tableau de metre, total, avertissement « compte »", () => {
  const d = definitionPdf(portes(), aJour);
  assert.equal(d.titre, "Quantitatif");
  assert.equal(d.bandeau, null);
  assert.deepEqual(d.tableau.tete, ["Niveau", "Unité", "Quantité (nombre)", "Origine", "Éléments", "Sans donnée"]);
  assert.deepEqual(d.tableau.corps[0], ["Level 1", "u", "1", "compté", "1", "0"]);
  assert.deepEqual(d.tableau.corps[1], ["Level 2", "u", "2", "compté", "2", "0"]);
  assert.deepEqual(d.tableau.pied[0], ["Total", "u", "3", "compté", "3", "0"]);
  assert.ok(d.avertissements[0].includes("nombre exact"));
  assert.ok(d.infos.some(([k, v]) => k === "Maquettes concernées" && v === "Architecture"));
  assert.ok(d.infos.some(([k, v]) => k === "État du rapport" && /^À jour/.test(v)));
});

test("pdf : estime = « estimé » en toutes lettres + avertissement de chiffrage ; obsolete = bandeau", () => {
  const d = definitionPdf(gaines(), obsolete);
  assert.equal(d.tableau.corps[0][3], "estimé");
  assert.equal(d.tableau.corps[0][1], "m");
  assert.ok(d.avertissements.some((a) => a.includes("ne pas utiliser pour un chiffrage ferme")));
  assert.match(d.bandeau, /^OBSOLÈTE : la maquette Architecture/);
  assert.ok(!/[  ’…]/.test(JSON.stringify(d)));
});

test("pdf : document A4 genere (en-tete PDF, pages numerotees, bandeau obsolete sur chaque page)", () => {
  const def = definitionPdf(gaines(), obsolete);
  const logo = "data:image/png;base64," + readFileSync(new URL("../public/icons/icon-192.png", import.meta.url)).toString("base64");
  const doc = construirePdf({ jsPDF, autoTable }, def, { logoPng: logo, maintenant: new Date("2026-10-24") });
  assert.ok(doc.getNumberOfPages() >= 1);
  const octets = Buffer.from(doc.output("arraybuffer"));
  assert.equal(octets.subarray(0, 5).toString(), "%PDF-");
  assert.ok(octets.length > 2000);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.01);
});

test("pdf : sans logo, sans resultat et tres long (plusieurs pages) restent valides", () => {
  const vide = construirePdf({ jsPDF, autoTable }, definitionPdf(rapport({ mesure: "nombre", filtres: filtres({ typesIfc: ["IfcWindow"] }), regroupements: ["niveau"] }), null), {});
  assert.equal(vide.getNumberOfPages(), 1);
  const beaucoup = Array.from({ length: 200 }, (_, i) => el("x" + i, "IfcDoor", "Level " + (i % 7), "Architecture", "Porte type " + i));
  const long = construireRapport({ resultat: calculer(beaucoup, { mesure: "nombre", filtres: filtres(), regroupements: ["famille"] }), phrase: "x", versions: VERSIONS });
  const doc = construirePdf({ jsPDF, autoTable }, definitionPdf(long, aJour), {});
  assert.ok(doc.getNumberOfPages() > 1);
});

// ---------- Excel ----------
async function relire(classeur) {
  const tampon = await classeur.xlsx.writeBuffer();
  const lu = new ExcelJS.Workbook();
  await lu.xlsx.load(tampon);
  return lu;
}

test("excel : deux feuilles, en-tete sur une ligne, un enregistrement par ligne, aucune cellule fusionnee", async () => {
  const lu = await relire(construireClasseur(ExcelJS, portes(), aJour));
  assert.deepEqual(lu.worksheets.map((f) => f.name), [NOM_FEUILLE, NOM_FEUILLE_INFOS]);
  const f = lu.getWorksheet(NOM_FEUILLE);
  assert.deepEqual(f.getRow(8).values.slice(1), ["Niveau", "Unité", "Quantité (nombre)", "Origine", "Éléments", "Sans donnée"]);
  assert.deepEqual(f.getRow(9).values.slice(1), ["Level 1", "u", 1, "compté", 1, 0]);
  assert.deepEqual(f.getRow(10).values.slice(1), ["Level 2", "u", 2, "compté", 2, 0]);
  assert.deepEqual(f.model.merges || [], []);
  assert.equal(f.views[0].ySplit, 8);
  assert.ok(f.autoFilter);
});

test("excel : totaux en vraies formules SOUS.TOTAL (SUBTOTAL), separes des donnees par une ligne vide", async () => {
  const f = (await relire(construireClasseur(ExcelJS, portes(), aJour))).getWorksheet(NOM_FEUILLE);
  assert.equal(f.getRow(11).values.filter(Boolean).length, 0);
  const total = f.getRow(12);
  assert.equal(total.getCell(1).value, "Total");
  assert.equal(total.getCell(3).value.formula, "SUBTOTAL(109,C9:C10)");
  assert.equal(total.getCell(3).value.result, 3);
  assert.equal(total.getCell(5).value.formula, "SUBTOTAL(109,E9:E10)");
});

test("excel : estime = texte « estimé », mise en forme conditionnelle orange, avertissement en tete, deux decimales", async () => {
  const f = (await relire(construireClasseur(ExcelJS, gaines(), aJour))).getWorksheet(NOM_FEUILLE);
  assert.equal(f.getCell("D9").value, "estimé");
  assert.equal(f.getCell("B9").value, "m");
  assert.equal(f.getCell("C9").value, 4.5);
  assert.equal(f.getCell("C9").numFmt, "#,##0.00");
  assert.match(f.getCell("A6").value, /ne pas utiliser pour un chiffrage ferme/);
  const mef = f.conditionalFormattings;
  assert.ok(mef.length >= 1);
  assert.equal(mef[0].ref, "D9:D10");
});

test("excel : rapport obsolete = bandeau rouge en tete (texte clair) et ligne rouge dans Informations", async () => {
  const lu = await relire(construireClasseur(ExcelJS, portes(), obsolete));
  const f = lu.getWorksheet(NOM_FEUILLE);
  assert.match(f.getCell("A5").value, /^OBSOLÈTE : la maquette Architecture/);
  assert.equal(f.getCell("A5").fill.fgColor.argb, "FFB22222");
  const infos = lu.getWorksheet(NOM_FEUILLE_INFOS);
  assert.equal(infos.getCell("A3").value, "RAPPORT OBSOLÈTE");
});

test("excel : informations = demande, requete JSON, maquettes avec empreinte, avertissement ; version inconnue signalee", async () => {
  const sansVersion = construireRapport({ resultat: calculer(ELEMENTS, { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDoor"] }), regroupements: [] }), phrase: "x", versions: [] });
  const lu = await relire(construireClasseur(ExcelJS, sansVersion, comparerVersions(sansVersion.maquettes, [])));
  const texte = JSON.stringify(lu.getWorksheet(NOM_FEUILLE_INFOS).model.rows.map((r) => r.cells.map((c) => c.value)));
  assert.match(texte, /empreinte : inconnue/);
  assert.match(texte, /Version des maquettes inconnue/);
  assert.match(texte, /mesure/);
  assert.match(lu.getWorksheet(NOM_FEUILLE).getCell("A5").value, /Version des maquettes inconnue/);
});

test("excel : sans resultat, tableau vide valide ; logo optionnel incruste", async () => {
  const vide = rapport({ mesure: "nombre", filtres: filtres({ typesIfc: ["IfcWindow"] }), regroupements: ["niveau"] });
  const f = (await relire(construireClasseur(ExcelJS, vide, null))).getWorksheet(NOM_FEUILLE);
  assert.equal(f.getRow(9).values.filter(Boolean).length, 0);
  const logo = readFileSync(new URL("../public/icons/icon-192.png", import.meta.url));
  const avecLogo = await relire(construireClasseur(ExcelJS, portes(), aJour, { logoPng: logo }));
  assert.equal(avecLogo.getWorksheet(NOM_FEUILLE).getImages().length, 1);
});
