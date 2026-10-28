// Export PDF du recapitulatif de Discussions (26/10), A4 portrait : un mini rapport partageable. Meme principe que le PDF du Quantitatif
// (src/quantitatifExportPdf.js) :
//  - definitionRapportPdf(rapport) : PURE, le contenu mis en forme en texte (blocs, sources, nom de fichier) ; testee ;
//  - construireRapportPdf({ jsPDF, autoTable }, definition, { logoPng }) : dessine cette definition avec jsPDF 4.2.1 + jspdf-autotable 5.0.8 (MIT).
//    Les bibliotheques sont chargees A LA DEMANDE (exporterRapportPdf, import dynamique au clic), jamais au chargement de l'application.
// Format fixe, dans cet ordre : titre, contexte, intervenants, desaccords exprimes, decision finale, puis les sources (expediteur, date, extrait court).
// Police : Helvetica standard du PDF (WinAnsi) : tout texte passe par sansSpecial (src/exportPdfCommun.js). Logo : public/icons/icon-192.png.
// Tout est genere dans le navigateur : rien n'est envoye a un serveur.

import { VERT, sansSpecial, chargerLogo } from "./exportPdfCommun.js";
import {
  dateJJMMAAAA, dateDuRapport, perimetreDe, libelleDecision, nomsEnPhrase, refsDe,
  MESSAGE_AUCUN_DESACCORD, MESSAGE_CONTEXTE_ABSENT, MENTION_NON_CONFIRME
} from "./discussionsIARapportFormat.js";

export const TITRE_DOCUMENT = "Récapitulatif de discussion";
export const FILIGRANE_MODELE = "Modèle de présentation";
const EXTRAIT_PDF_MAX = 160;
const SUJET_FICHIER_MAX = 40;

// ouvra-recap-<sujet>-AAAA-MM-JJ.pdf : sujet sans accent ni caractere special, en minuscules, separe par des tirets, borne.
export function nomFichierRapport(sujet, dateMs) {
  const d = new Date(dateMs);
  const deux = (n) => String(n).padStart(2, "0");
  const slug = String(sujet || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, SUJET_FICHIER_MAX).replace(/-+$/g, "");
  return "ouvra-recap-" + (slug || "discussion") + "-" + d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()) + ".pdf";
}

const court = (texte, max) => (texte.length <= max ? texte : texte.slice(0, max - 3).trimEnd() + "...");

export function definitionRapportPdf(rapport) {
  const t = sansSpecial;
  const base = {
    titreDocument: TITRE_DOCUMENT, titre: t(rapport.titre), sujet: t(rapport.sujet), date: dateJJMMAAAA(rapport.date), dateLibelle: dateDuRapport(rapport),
    vide: !!rapport.vide, nomFichier: nomFichierRapport(rapport.sujet, rapport.date), pied: "Généré par Ouvra",
    filigrane: rapport.modele ? t(FILIGRANE_MODELE) : null // 28/10 : seulement le rapport modele prepare a l'avance, jamais un rapport genere par l'IA
  };
  if (rapport.vide) return { ...base, perimetre: t(perimetreDe(rapport)), message: t(rapport.message), sources: [] };
  const decision = rapport.decision;
  return {
    ...base,
    perimetre: t(perimetreDe(rapport)),
    contexte: { texte: t(rapport.contexte.texte || MESSAGE_CONTEXTE_ABSENT), nonConfirme: !!rapport.contexte.texte && !rapport.contexte.confirme, refs: refsDe(rapport, rapport.contexte.sources) },
    intervenants: rapport.intervenants.map(t),
    desaccords: rapport.desaccords.map((d) => ({ opposants: t(nomsEnPhrase(d.opposants)), objet: t(d.objet), nonConfirme: !d.confirme, refs: refsDe(rapport, d.sources) })),
    aucunDesaccord: rapport.desaccords.length ? null : MESSAGE_AUCUN_DESACCORD,
    decision: { statut: decision.statut, libelle: libelleDecision(decision), texte: t(decision.texte), nonConfirme: decision.statut === "prise" && !decision.confirme, refs: refsDe(rapport, decision.sources) },
    sources: rapport.chronologie.map((s, i) => ({ numero: i + 1, expediteur: t(s.auteurNom), date: t(s.quandLibelle), discussion: t(s.discussion), extrait: t(court(s.extrait.texte, EXTRAIT_PDF_MAX)) }))
  };
}

const marque = (nonConfirme) => (nonConfirme ? " (" + MENTION_NON_CONFIRME + ")" : "");

export function construireRapportPdf({ jsPDF, autoTable }, def, { logoPng = null, maintenant = new Date() } = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const marge = 16;
  const utile = largeur - 2 * marge;
  const haut = 30; // sous l'en-tete
  const bas = hauteur - 18; // au-dessus du pied
  let y = haut;

  // Saute a la page suivante s'il ne reste pas h millimetres.
  const assurer = (h) => { if (y + h > bas) { doc.addPage(); y = haut; } };
  // Ecrit un paragraphe ligne par ligne (le saut de page peut tomber au milieu).
  function paragraphe(texte, { taille = 10.5, gras = false, couleur = [30, 40, 33], interligne = 5, retrait = 0 } = {}) {
    doc.setFont("helvetica", gras ? "bold" : "normal").setFontSize(taille).setTextColor(...couleur);
    for (const ligne of doc.splitTextToSize(texte, utile - retrait)) { assurer(interligne); doc.text(ligne, marge + retrait, y + interligne - 1.2); y += interligne; }
  }
  function titreBloc(libelle) {
    assurer(16);
    y += 5;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERT);
    doc.text(libelle, marge, y);
    doc.setDrawColor(...VERT).setLineWidth(0.3).line(marge, y + 1.8, largeur - marge, y + 1.8);
    y += 5;
  }

  // 1. Titre
  paragraphe(def.titre, { taille: 20, gras: true, interligne: 8.5 });
  y += 1.5;
  paragraphe(def.dateLibelle, { taille: 11, couleur: [60, 70, 63], interligne: 5.5 });
  paragraphe(def.perimetre, { taille: 9, couleur: [110, 120, 113], interligne: 4.5 });

  if (def.vide) {
    y += 6;
    paragraphe(def.message, { taille: 12, gras: true });
  } else {
    // 2. Contexte
    titreBloc("CONTEXTE");
    paragraphe(def.contexte.texte + marque(def.contexte.nonConfirme) + def.contexte.refs);

    // 3. Intervenants
    titreBloc("INTERVENANTS");
    for (const nom of def.intervenants) paragraphe("- " + nom, { interligne: 5 });
    if (!def.intervenants.length) paragraphe("Aucun intervenant identifié.", { couleur: [110, 120, 113] });

    // 4. Desaccords exprimes
    titreBloc("DÉSACCORDS EXPRIMÉS");
    if (def.aucunDesaccord) {
      paragraphe(def.aucunDesaccord, { couleur: [60, 70, 63] });
    } else {
      autoTable(doc, {
        startY: y, margin: { left: marge, right: marge, top: haut, bottom: 18 }, theme: "grid",
        body: def.desaccords.map((d) => [d.opposants || "Non précisé", d.objet + marque(d.nonConfirme) + d.refs]),
        styles: { font: "helvetica", fontSize: 9.5, cellPadding: 2.2, lineColor: [210, 214, 208], lineWidth: 0.1, textColor: [30, 40, 33], overflow: "linebreak" },
        columnStyles: { 0: { cellWidth: 48, fontStyle: "bold", fillColor: [247, 249, 246] }, 1: { cellWidth: "auto" } }
      });
      y = doc.lastAutoTable.finalY + 2;
    }

    // 5. Decision finale : encadre, l'absence de decision est dite en toutes lettres.
    titreBloc("DÉCISION FINALE");
    const d = def.decision;
    const texteDecision = d.statut === "aucune" ? "" : d.texte + (d.statut === "prise" ? marque(d.nonConfirme) : "") + d.refs;
    doc.setFont("helvetica", "normal").setFontSize(10.5);
    const lignes = texteDecision ? doc.splitTextToSize(texteDecision, utile - 10) : [];
    const hBoite = 11 + lignes.length * 5;
    assurer(hBoite + 2);
    doc.setFillColor(232, 238, 230).rect(marge, y, utile, hBoite, "F");
    doc.setFillColor(...VERT).rect(marge, y, 1.6, hBoite, "F");
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30, 40, 33).text(d.libelle, marge + 6, y + 6.5);
    doc.setFont("helvetica", "normal").setFontSize(10.5);
    lignes.forEach((ligne, i) => doc.text(ligne, marge + 6, y + 12.2 + i * 5));
    y += hBoite + 2;
  }

  // 6. Sources, en fin de document : expediteur, date, extrait court.
  if (def.sources.length) {
    titreBloc("SOURCES");
    autoTable(doc, {
      startY: y, margin: { left: marge, right: marge, top: haut, bottom: 18 }, theme: "grid",
      head: [["N°", "Date", "Expéditeur", "Discussion", "Extrait"]],
      body: def.sources.map((s) => [String(s.numero), s.date, s.expediteur, s.discussion, s.extrait]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: [210, 214, 208], lineWidth: 0.1, textColor: [30, 40, 33], overflow: "linebreak" },
      headStyles: { fillColor: VERT, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 246] },
      columnStyles: { 0: { cellWidth: 9, halign: "right" }, 1: { cellWidth: 27 }, 2: { cellWidth: 28 }, 3: { cellWidth: 32 }, 4: { cellWidth: "auto" } }
    });
  }

  // En-tete et pied de chaque page, une fois le nombre de pages connu.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    if (def.filigrane) {
      // Filigrane : texte vert tres clair a 45 degres, centre sur la page. Position calculee ici (le centrage de jsPDF n'est pas fiable avec un angle) :
      // le texte part de (centre - demi-largeur le long de la diagonale), la page etant orientee vers le bas.
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.12 }));
      doc.setFont("helvetica", "bold").setFontSize(44).setTextColor(...VERT);
      const demi = doc.getTextWidth(def.filigrane) / 2;
      const c = Math.SQRT1_2;
      doc.text(def.filigrane, largeur / 2 - demi * c, hauteur / 2 + demi * c, { angle: 45 });
      doc.restoreGraphicsState();
    }
    const hautLogo = 6;
    if (logoPng) doc.addImage(logoPng, "PNG", marge, hautLogo, 11, 11);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...VERT).text("OUVRA", marge + (logoPng ? 14 : 0), hautLogo + 7.5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110, 120, 113).text(def.titreDocument, largeur - marge, hautLogo + 7.5, { align: "right" });
    doc.setDrawColor(...VERT).setLineWidth(0.4).line(marge, hautLogo + 13, largeur - marge, hautLogo + 13);
    doc.setDrawColor(200, 205, 198).setLineWidth(0.2).line(marge, hauteur - 12, largeur - marge, hauteur - 12);
    doc.setFontSize(8).setTextColor(110, 120, 113);
    doc.text(def.pied + " · le " + dateJJMMAAAA(maintenant.getTime()), marge, hauteur - 7);
    doc.text("Page " + p + " / " + pages, largeur - marge, hauteur - 7, { align: "right" });
  }
  return doc;
}

// Livre le PDF (28/10) : dans l'onglet deja ouvert au clic (le lecteur PDF du navigateur l'affiche, avec son propre bouton de telechargement : rien ne tombe
// dans le dossier Telechargements devant le public), sinon, onglet bloque ou ferme, en telechargement comme avant. Rend "ouvert" ou "telecharge".
// L'adresse du blob est revoquee apres un delai : le temps que le lecteur la charge et que l'utilisateur le telecharge depuis le lecteur.
export function livrerRapportPdf(nomFichier, blob, { onglet = null, telecharger, creerUrl = (b) => URL.createObjectURL(b), revoquer = (u) => URL.revokeObjectURL(u), delaiRevocationMs = 600000 }) {
  if (onglet && !onglet.closed) {
    const url = creerUrl(blob);
    onglet.location.href = url;
    setTimeout(() => revoquer(url), delaiRevocationMs);
    return "ouvert";
  }
  telecharger(nomFichier, blob);
  return "telecharge";
}

// Les bibliotheques sont importees ici, au clic. onglet : fenetre ouverte par la page pendant le geste de l'utilisateur (sinon les bloqueurs de pop-up la refusent).
export async function exporterRapportPdf(rapport, { telecharger, onglet = null, fetch: appel = (...a) => globalThis.fetch(...a), maintenant = new Date() }) {
  const [{ jsPDF }, autotable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const def = definitionRapportPdf(rapport);
  const doc = construireRapportPdf({ jsPDF, autoTable: autotable.autoTable || autotable.default }, def, { logoPng: await chargerLogo(appel), maintenant });
  return livrerRapportPdf(def.nomFichier, doc.output("blob"), { onglet, telecharger });
}
