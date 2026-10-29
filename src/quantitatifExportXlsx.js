// Export Excel (.xlsx) d'un rapport de quantitatif (24/10), pense pour etre repris tel quel dans un tableur de chiffrage (etude de prix) :
//  - feuille « Quantitatif » : bandeau de presentation au-dessus (titre, demande, date, maquettes, etat, avertissement), puis UNE ligne d'en-tetes,
//    un enregistrement par ligne, AUCUNE cellule fusionnee, filtres automatiques, volets figes sous l'en-tete ; les totaux sont de vraies FORMULES
//    (SOUS.TOTAL, qui ignore les lignes filtrees) placees sous les donnees, separees d'une ligne vide ;
//  - colonne « Origine » en toutes lettres (compte / estime), « estime » en orange gras par mise en forme conditionnelle ET texte ;
//  - feuille « Informations » : requete structuree, maquettes et empreintes de version, date de calcul, etat, avertissement sur les quantites estimees ;
//  - rapport OBSOLETE : bandeau rouge en tete de la feuille Quantitatif ET ligne rouge dans Informations.
// Bibliotheque : exceljs 4.4.0 (MIT), chargee A LA DEMANDE au clic. Pas de graphique : exceljs ne sait pas en ecrire (piste : graphique en barres du
// regroupement principal avec une autre bibliotheque ou un modele .xlsx pre-construit).
// Couleurs et styles partages dans STYLE_OUVRA : base d'un futur modele de classeur reutilisable.

import { tableauDe, informationsDe, nomFichier } from "./quantitatifRapport.js";
import { libelleStatut } from "./quantitatifVersions.js";

export const STYLE_OUVRA = {
  vert: "FF5C7A5F", vertPale: "FFE8EEE6", bande: "FFF5F8F4", rouge: "FFB22222", rougePale: "FFFBE3E3", orange: "FFFDECDC", orangeTexte: "FF9A4A00", texte: "FF1E2821", gris: "FF6E7871",
  police: "Calibri"
};
const contour = { style: "thin", color: { argb: "FFD2D6D0" } };
const bordures = { top: contour, bottom: contour, left: contour, right: contour };

export const NOM_FEUILLE = "Quantitatif";
export const NOM_FEUILLE_INFOS = "Informations";
const colonne = (n) => { let s = ""; for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

// ExcelJS : le module (new ExcelJS.Workbook()). statut : comparerVersions ou null. logoPng : ArrayBuffer/Uint8Array ou null.
export function construireClasseur(ExcelJS, rapport, statut, { logoPng = null } = {}) {
  const t = tableauDe(rapport);
  const r = rapport.resultat;
  const obsolete = !!statut && statut.etat === "obsolete";
  const texteStatut = statut ? libelleStatut(statut) : "";
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "Ouvra";
  classeur.created = new Date(rapport.calculeLe);
  const feuille = classeur.addWorksheet(NOM_FEUILLE, { views: [{ state: "frozen", ySplit: 8, showGridLines: false }] });
  const nCol = t.colonnes.length;

  // --- Bandeau de presentation (lignes 1 a 7, sans fusion) ---
  const ligneTexte = (n, texte, options = {}) => {
    const c = feuille.getCell("A" + n);
    c.value = texte;
    c.font = { name: STYLE_OUVRA.police, size: options.taille || 10, bold: !!options.gras, color: { argb: options.couleur || STYLE_OUVRA.texte } };
    c.alignment = { vertical: "middle", wrapText: false };
    if (options.fond) for (let i = 1; i <= nCol; i += 1) feuille.getCell(colonne(i) + n).fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fond } };
  };
  ligneTexte(1, "      OUVRA  |  Quantitatif", { taille: 16, gras: true, couleur: STYLE_OUVRA.vert });
  feuille.getRow(1).height = 34;
  ligneTexte(2, "Demande : " + rapport.phrase);
  ligneTexte(3, "Requête comprise : " + rapport.relecture);
  ligneTexte(4, "Calculé le " + new Date(rapport.calculeLe).toLocaleString("fr-FR") + "  |  Maquettes : " + (rapport.maquettes.map((m) => m.label).join(", ") || "aucune"), { couleur: STYLE_OUVRA.gris });
  if (obsolete) ligneTexte(5, "OBSOLÈTE : " + texteStatut.replace(/^OBSOLÈTE : /, ""), { gras: true, couleur: "FFFFFFFF", fond: STYLE_OUVRA.rouge });
  else if (statut) ligneTexte(5, texteStatut, { couleur: statut.etat === "inconnue" ? STYLE_OUVRA.orangeTexte : STYLE_OUVRA.gris, gras: statut.etat === "inconnue" });
  ligneTexte(6, t.metre.explication, { gras: t.metre.origine === "estime", couleur: t.metre.origine === "estime" ? STYLE_OUVRA.orangeTexte : STYLE_OUVRA.gris });
  if (logoPng) {
    const id = classeur.addImage({ buffer: logoPng, extension: "png" });
    feuille.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 30, height: 30 } });
  }

  // --- Tableau : une ligne d'en-tetes (ligne 8), un enregistrement par ligne ---
  const enteteLigne = 8;
  const entete = feuille.getRow(enteteLigne);
  t.colonnes.forEach((c, i) => {
    const cell = entete.getCell(i + 1);
    cell.value = c.libelle;
    cell.font = { name: STYLE_OUVRA.police, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STYLE_OUVRA.vert } };
    cell.alignment = { vertical: "middle", horizontal: c.type === "nombre" ? "right" : "left", wrapText: true };
    cell.border = bordures;
  });
  entete.height = 24;
  const colQte = t.nCles + 2; // apres les cles et « Unite »
  const colOrigine = t.nCles + 3;
  const colElements = t.nCles + 4;
  const colSans = t.nCles + 5;
  const formatQuantite = t.metre.origine === "compte" ? "#,##0" : "#,##0.00";
  t.lignes.forEach((valeurs, k) => {
    const ligne = feuille.getRow(enteteLigne + 1 + k);
    valeurs.forEach((v, i) => {
      const cell = ligne.getCell(i + 1);
      cell.value = v;
      cell.font = { name: STYLE_OUVRA.police, color: { argb: STYLE_OUVRA.texte } };
      cell.border = bordures;
      if (k % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STYLE_OUVRA.bande } };
      if (t.colonnes[i].type === "nombre") { cell.numFmt = i + 1 === colQte ? formatQuantite : "#,##0"; cell.alignment = { horizontal: "right" }; }
    });
  });
  const premiere = enteteLigne + 1;
  const derniere = enteteLigne + t.lignes.length;
  feuille.autoFilter = { from: { row: enteteLigne, column: 1 }, to: { row: Math.max(derniere, enteteLigne), column: nCol } };

  // « estime » : orange gras, par mise en forme conditionnelle (le texte dit deja « estimé »).
  if (t.lignes.length) {
    feuille.addConditionalFormatting({
      ref: colonne(colOrigine) + premiere + ":" + colonne(colOrigine) + derniere,
      rules: [{ type: "cellIs", operator: "equal", formulae: ['"estimé"'], style: { font: { bold: true, color: { argb: STYLE_OUVRA.orangeTexte } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: STYLE_OUVRA.orange } } } }]
    });
  }

  // --- Totaux : vraies formules, une ligne vide plus bas pour rester hors de la zone de donnees ---
  const ligneTotal = Math.max(derniere, enteteLigne) + 2;
  const total = feuille.getRow(ligneTotal);
  total.getCell(1).value = "Total";
  const formule = (col, resultat) => (t.lignes.length ? { formula: "SUBTOTAL(109," + colonne(col) + premiere + ":" + colonne(col) + derniere + ")", result: resultat } : 0);
  total.getCell(t.nCles + 1).value = t.total.unite;
  total.getCell(colQte).value = formule(colQte, t.total.quantite);
  total.getCell(colQte).numFmt = formatQuantite;
  total.getCell(colOrigine).value = t.total.origine;
  if (t.avecElements) {
    total.getCell(colElements).value = formule(colElements, t.total.elements);
    total.getCell(colSans).value = formule(colSans, t.total.sansDonnee);
  }
  for (let i = 1; i <= nCol; i += 1) {
    const cell = total.getCell(i);
    cell.font = { name: STYLE_OUVRA.police, bold: true, color: { argb: STYLE_OUVRA.texte } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STYLE_OUVRA.vertPale } };
    cell.border = bordures;
    if (t.colonnes[i - 1].type === "nombre") cell.alignment = { horizontal: "right" };
  }

  // Largeurs : cles larges, nombres etroits.
  t.colonnes.forEach((c, i) => { feuille.getColumn(i + 1).width = i < t.nCles ? (t.nCles > 1 ? 28 : 36) : c.type === "nombre" ? 16 : 12; });
  feuille.getColumn(1).width = Math.max(feuille.getColumn(1).width, 30);
  feuille.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  feuille.headerFooter = { oddFooter: "&LOuvra&CPage &P / &N&R&D" };

  // --- Feuille Informations ---
  const infos = classeur.addWorksheet(NOM_FEUILLE_INFOS, { views: [{ showGridLines: false }] });
  infos.getColumn(1).width = 30;
  infos.getColumn(2).width = 110;
  const titre = infos.getCell("A1");
  titre.value = "Informations sur le rapport";
  titre.font = { name: STYLE_OUVRA.police, size: 14, bold: true, color: { argb: STYLE_OUVRA.vert } };
  let n = 3;
  const paire = (k, v, options = {}) => {
    infos.getCell("A" + n).value = k;
    infos.getCell("A" + n).font = { name: STYLE_OUVRA.police, bold: true, color: { argb: options.couleur || STYLE_OUVRA.texte } };
    infos.getCell("B" + n).value = v;
    infos.getCell("B" + n).font = { name: STYLE_OUVRA.police, bold: !!options.gras, color: { argb: options.couleur || STYLE_OUVRA.texte } };
    infos.getCell("B" + n).alignment = { wrapText: true, vertical: "top" };
    infos.getCell("A" + n).alignment = { vertical: "top" };
    if (options.fond) { infos.getCell("A" + n).fill = infos.getCell("B" + n).fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fond } }; }
    n += 1;
  };
  if (obsolete) paire("RAPPORT OBSOLÈTE", texteStatut, { couleur: "FFFFFFFF", gras: true, fond: STYLE_OUVRA.rouge });
  for (const [k, v] of informationsDe(rapport, obsolete ? "" : texteStatut)) paire(k, v);
  paire("Avertissement", t.metre.explication, { gras: t.metre.origine === "estime", couleur: t.metre.origine === "estime" ? STYLE_OUVRA.orangeTexte : STYLE_OUVRA.texte });
  r.notes.slice(1).forEach((note) => paire("Remarque", note));
  n += 1;
  infos.getCell("A" + n).value = "Versions des maquettes concernées";
  infos.getCell("A" + n).font = { name: STYLE_OUVRA.police, bold: true, color: { argb: STYLE_OUVRA.vert } };
  n += 1;
  for (const m of rapport.maquettes) paire(m.label, (m.url || "") + "  |  empreinte : " + (m.empreinte || "inconnue"));
  n += 1;
  infos.getCell("A" + n).value = "Requête structurée";
  infos.getCell("A" + n).font = { name: STYLE_OUVRA.police, bold: true, color: { argb: STYLE_OUVRA.vert } };
  n += 1;
  paire("JSON", JSON.stringify(rapport.requete));
  return classeur;
}

async function chargerLogo(fetchFn) {
  try {
    const reponse = await fetchFn("/icons/icon-192.png");
    return reponse.ok ? new Uint8Array(await reponse.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function exporterXlsx(rapport, statut, { telecharger, fetch: appel = (...a) => globalThis.fetch(...a) }) {
  const module = await import("exceljs");
  const ExcelJS = module.default || module;
  const classeur = construireClasseur(ExcelJS, rapport, statut, { logoPng: await chargerLogo(appel) });
  const tampon = await classeur.xlsx.writeBuffer();
  telecharger(nomFichier(rapport, "xlsx"), new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
