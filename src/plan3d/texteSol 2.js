// 2D -> 3D (25/10) : texte des pieces, partage entre le plan 2D (mesure) et la maquette du Viewer (planches posees au sol). Contrairement a
// etiquettesPieces.js (pur), ce module utilise un canvas : mesure d'un texte et dessin d'une planche transparente.

import { placerEtiquette } from "./etiquettesPieces.js";
import { surfaceContour } from "./modele.js";

const POLICE = "system-ui, -apple-system, sans-serif";
const PIXELS_PAR_METRE = 320; // finesse du texte sur la planche
const COTE_MAX = 2048;

export const surfaceTexte = (m2) => `${(Math.round(m2 * 10) / 10).toLocaleString("fr-FR")} m²`;

// Surface affichee d'une piece : la surface CALCULEE sur son contour, et si le plan en donne une autre de plus de 1 %, l'ecart est montre tout de suite
// (« 62,2 m² (plan : 63,5 m²) ») : jamais deux surfaces differentes sans que ce soit visible.
export function surfaceAffichee(piece) {
  const calculee = surfaceContour(piece.contour);
  const base = surfaceTexte(calculee);
  if (piece.surfacePlan != null && piece.surfacePlan > 0 && Math.abs(calculee - piece.surfacePlan) / piece.surfacePlan > 0.01) return `${base} (plan : ${surfaceTexte(piece.surfacePlan)})`;
  return base;
}

// Largeur d'un texte en metres pour une taille donnee, mesuree sur un canvas avec la meme graisse que l'affichage ; marge de 8 % (espacement des lettres).
let contexteMesure = null;
export function mesurerTexte(texte, taille) {
  if (!contexteMesure) {
    contexteMesure = document.createElement("canvas").getContext("2d");
    contexteMesure.font = `700 100px ${POLICE}`;
  }
  return (contexteMesure.measureText(texte).width / 100) * taille * 1.08;
}

// Planche d'une piece pour la maquette : image PNG transparente (nom et surface, memes lignes et memes tailles que sur le plan) et sa taille en metres.
// Le haut de l'image est le nord du plan. Rend { id, image, largeur, hauteur, x, z } : x, z = centre dans la scene du Viewer (z = y du plan, voir exportIfc.js).
export function planchePiece(piece) {
  const e = placerEtiquette(piece.contour, { nom: piece.nom, surface: surfaceAffichee(piece), mesurer: mesurerTexte });
  if (!e.lignes.length) return null;
  const largeur = e.largeur;
  const hauteur = e.hauteur;
  const echelle = Math.min(PIXELS_PAR_METRE, COTE_MAX / Math.max(largeur, hauteur));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.ceil(largeur * echelle), 2);
  canvas.height = Math.max(Math.ceil(hauteur * echelle), 2);
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const l of e.lignes) {
    ctx.font = `${l.role === "nom" ? 700 : 500} ${l.taille * echelle}px ${POLICE}`;
    ctx.fillStyle = l.role === "nom" ? "#1d1d1b" : "#4a4a46";
    ctx.fillText(l.texte, canvas.width / 2, canvas.height / 2 + l.y * echelle);
  }
  return { id: piece.id, image: canvas.toDataURL("image/png"), largeur, hauteur, x: e.x, z: e.y };
}
