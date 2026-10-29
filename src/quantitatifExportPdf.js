// Export PDF d'un rapport de quantitatif (24/10), A4 portrait. Deux etages, comme pour tous les rendus :
//  - definitionPdf(rapport, statut) : PURE, le contenu mis en forme en texte (titre, bandeau, informations, tableau, avertissements) ; testee.
//  - construirePdf({ jsPDF, autoTable }, definition, { logoPng }) : dessine cette definition avec jsPDF 4.2.1 + jspdf-autotable 5.0.8 (licence MIT).
//    Les bibliotheques sont chargees A LA DEMANDE (exporterPdf, import dynamique au clic), jamais au chargement de l'application.
// Police : Helvetica standard du PDF (encodage WinAnsi : accents francais, m², m³ corrects). Aucun caractere hors de cet encodage n'est emis (voir formaterNombre).
// Logo : public/icons/icon-192.png (le logo vectoriel .svg ne s'incruste pas dans jsPDF sans plugin supplementaire : piste).
// Tout est genere dans le navigateur : aucune donnee n'est envoyee a un serveur.

import { tableauDe, informationsDe, formaterNombre, nomFichier } from "./quantitatifRapport.js";
import { libelleStatut } from "./quantitatifVersions.js";
import { VERT, PAGE_MOBILE, afficherPdfPleinOnglet, sansSpecial, chargerLogo } from "./exportPdfCommun.js";

export { PAGE_MOBILE, afficherPdfPleinOnglet };
import { livrerRapportPdf } from "./discussionsIARapportPdf.js";

const ROUGE = [178, 34, 34];
const ORANGE_PALE = [253, 236, 220];

// Variante MOBILE (28/10) : page etroite 105 x 186 mm (9:16), affichee en pleine largeur sur un telephone (390 px pour 105 mm : le corps de 10 pt y mesure ~13 px,
// alors qu'en A4 la meme largeur reduit 8,5 pt a ~5,6 px). Colonnes reduites a l'essentiel : cles + quantite (unite collee). Le PDF laptop reste l'A4 portrait.
const INFOS_MOBILE = new Set(["Demande", "Mesure", "Éléments pris en compte", "État du rapport"]);


// statut : sortie de comparerVersions (ou null si non evalue).
export function definitionPdf(rapport, statut, { mobile = false } = {}) {
  const t = tableauDe(rapport);
  const r = rapport.resultat;
  const obsolete = !!statut && statut.etat === "obsolete";
  const texteStatut = statut ? libelleStatut(statut) : "";
  const tete = t.colonnes.map((c) => c.libelle);
  const corps = t.lignes.map((l) => l.map((v, i) => (t.colonnes[i].type === "nombre" ? formaterNombre(v) : sansSpecial(v))));
  const pied = r.regroupements.length > 0 || r.aucunResultat ? [["Total", ...Array(t.nCles - 1).fill(""), t.total.unite, formaterNombre(t.total.quantite), t.total.origine, ...(t.avecElements ? [formaterNombre(t.total.elements), formaterNombre(t.total.sansDonnee)] : [])]] : [];
  const unite = t.total.unite ? " " + sansSpecial(t.total.unite) : "";
  const mobileTableau = mobile ? {
    tete: [...tete.slice(0, t.nCles), "Quantité"],
    corps: corps.map((l) => [...l.slice(0, t.nCles), l[t.nCles + 1] + unite]),
    pied: pied.length ? [["Total", ...Array(t.nCles - 1).fill(""), formaterNombre(t.total.quantite) + unite]] : []
  } : null;
  return {
    titre: "Quantitatif",
    sousTitre: sansSpecial(rapport.phrase),
    bandeau: obsolete ? sansSpecial(texteStatut) : null,
    infos: informationsDe(rapport, texteStatut).filter(([k]) => !mobile || INFOS_MOBILE.has(k)).map(([k, v]) => [k, sansSpecial(v)]),
    tableau: mobile
      ? { tete: mobileTableau.tete, corps: mobileTableau.corps.map((l) => l.map(sansSpecial)), pied: mobileTableau.pied.map((l) => l.map(sansSpecial)), colonneQuantite: t.nCles, colonneOrigine: -1, nCles: t.nCles }
      : { tete, corps: corps.map((l) => l.map(sansSpecial)), pied: pied.map((l) => l.map(sansSpecial)), colonneQuantite: t.nCles + 1, colonneOrigine: t.nCles + 2, nCles: t.nCles },
    mobile,
    aucunResultat: r.aucunResultat,
    avertissements: r.notes.map(sansSpecial),
    nomFichier: nomFichier(rapport, "pdf"),
    date: new Date().toLocaleDateString("fr-FR")
  };
}

export function construirePdf({ jsPDF, autoTable }, def, { logoPng = null, maintenant = new Date() } = {}) {
  const mob = !!def.mobile; // variante telephone : page etroite, corps de 10 pt ; sinon A4 portrait inchange
  const doc = new jsPDF({ unit: "mm", format: mob ? PAGE_MOBILE : "a4", orientation: "portrait" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const marge = mob ? 6 : 14;
  const hautEntete = def.bandeau ? (mob ? 26 : 30) : (mob ? 18 : 22);

  let y = hautEntete + 8;
  doc.setFont("helvetica", "bold").setFontSize(mob ? 16 : 18).setTextColor(30, 40, 33);
  doc.text(def.titre, marge, y);
  y += mob ? 6 : 7;
  doc.setFont("helvetica", "normal").setFontSize(mob ? 10 : 11).setTextColor(60, 70, 63);
  const phrase = doc.splitTextToSize(def.sousTitre, largeur - 2 * marge);
  doc.text(phrase, marge, y);
  y += phrase.length * (mob ? 4.4 : 5) + 3;

  // Bloc d'informations : intitule / valeur, valeurs longues a la ligne.
  autoTable(doc, {
    startY: y, margin: { left: marge, right: marge, top: hautEntete + 4, bottom: 16 }, theme: "plain", body: def.infos,
    styles: { font: "helvetica", fontSize: mob ? 10 : 9, cellPadding: 1.2, textColor: [40, 50, 43] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: mob ? 26 : 42 }, 1: { cellWidth: "auto" } }
  });
  y = doc.lastAutoTable.finalY + 6;

  if (def.aucunResultat) {
    doc.setFontSize(10).setTextColor(60, 70, 63);
    const vide = doc.splitTextToSize("Aucun élément ne correspond à cette demande dans les maquettes chargées.", largeur - 2 * marge);
    doc.text(vide, marge, y);
    y += vide.length * 4.4 + 4;
  } else {
    const qte = def.tableau.colonneQuantite;
    autoTable(doc, {
      startY: y, margin: { left: marge, right: marge, top: hautEntete + 4, bottom: 16 },
      head: [def.tableau.tete], body: def.tableau.corps, foot: def.tableau.pied.length ? def.tableau.pied : undefined,
      theme: "grid", showFoot: "lastPage",
      styles: { font: "helvetica", fontSize: mob ? 10 : 8.5, cellPadding: mob ? 1.6 : 1.8, lineColor: [210, 214, 208], lineWidth: 0.1, textColor: [30, 40, 33], overflow: "linebreak" },
      headStyles: { fillColor: VERT, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [232, 238, 230], textColor: [30, 40, 33], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 246] },
      columnStyles: mob ? { [qte]: { halign: "right", fontStyle: "bold" } } : { [qte]: { halign: "right" }, [qte + 2]: { halign: "right" }, [qte + 3]: { halign: "right" } },
      // « estime » en toutes lettres et teinte distincte, jamais seulement une couleur.
      didParseCell: (d) => { if (d.section === "body" && d.column.index === def.tableau.colonneOrigine && d.cell.raw === "estimé") { d.cell.styles.fillColor = ORANGE_PALE; d.cell.styles.fontStyle = "bold"; } }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Avertissements (compte / estime, exclusions, sans donnee).
  const interNote = mob ? 4.4 : 4;
  doc.setFont("helvetica", "normal").setFontSize(mob ? 10 : 8.5).setTextColor(60, 70, 63);
  for (const note of def.avertissements) {
    const lignes = doc.splitTextToSize("- " + note, largeur - 2 * marge);
    if (y + lignes.length * interNote > hauteur - 18) { doc.addPage(); y = hautEntete + 8; }
    doc.text(lignes, marge, y);
    y += lignes.length * interNote + 1;
  }

  // En-tete et pied de chaque page, une fois le nombre de pages connu.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    if (def.bandeau) {
      doc.setFillColor(...ROUGE).rect(0, 0, largeur, 12, "F");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
      doc.text("OBSOLÈTE", marge, 7.5);
      doc.setFont("helvetica", "normal").setFontSize(8);
      doc.text(doc.splitTextToSize(def.bandeau, largeur - 2 * marge - 26).slice(0, 2), marge + 26, 5.5);
    }
    const haut = def.bandeau ? 14 : 6;
    if (logoPng) doc.addImage(logoPng, "PNG", marge, haut, 11, 11);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...VERT).text("OUVRA", marge + (logoPng ? 14 : 0), haut + 7.5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110, 120, 113).text("Quantitatif", largeur - marge, haut + 7.5, { align: "right" });
    doc.setDrawColor(...VERT).setLineWidth(0.4).line(marge, haut + 13, largeur - marge, haut + 13);
    doc.setDrawColor(200, 205, 198).setLineWidth(0.2).line(marge, hauteur - 12, largeur - marge, hauteur - 12);
    doc.setFontSize(8).setTextColor(110, 120, 113);
    doc.text("Ouvra · édité le " + maintenant.toLocaleDateString("fr-FR") + (def.bandeau && !mob ? " · RAPPORT OBSOLÈTE" : ""), marge, hauteur - 7);
    doc.text("Page " + p + " / " + pages, largeur - marge, hauteur - 7, { align: "right" });
  }
  return doc;
}

// Livre le PDF (28/10) : ouvert dans l'onglet deja ouvert au clic (meme mecanisme que le rapport des discussions), sinon telecharge. Rend "ouvert" ou "telecharge".
// Les bibliotheques sont importees ici, au clic. Le contenu du PDF est inchange.
// mobile (largeur <= 768 px) : PDF en page etroite lisible sur telephone, et onglet navigue VERS le PDF (lecteur natif d'iOS : toutes les pages, zoom), car
// un PDF dans un iframe n'affiche que sa premiere page sur iOS Safari. Laptop : A4 dans l'iframe, inchange.
export async function exporterPdf(rapport, statut, { telecharger, onglet = null, mobile = false, fetch: appel = (...a) => globalThis.fetch(...a) }) {
  const [{ jsPDF }, autotable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const def = definitionPdf(rapport, statut, { mobile });
  const doc = construirePdf({ jsPDF, autoTable: autotable.autoTable || autotable.default }, def, { logoPng: await chargerLogo(appel) });
  return livrerRapportPdf(def.nomFichier, doc.output("blob"), { onglet, telecharger, ...(mobile ? { afficher: afficherPdfPleinOnglet } : {}) });
}
