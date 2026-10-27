// 2D -> 3D, IA du plan (25/10) : la description TEXTUELLE du plan, seule representation qui part vers l'IA (jamais l'image, jamais des coordonnees).
// Module pur, sans reseau ni DOM. Il repond a la question « qu'est-ce qu'on appelle la fenetre nord du salon ? » : chaque piece a un libelle UNIQUE, quatre cotes
// (nord, sud, est, ouest, le nord etant le HAUT du plan), et sur chaque cote les ouvertures numerotees dans l'ordre (de l'ouest vers l'est pour le nord et le sud,
// du nord vers le sud pour l'est et l'ouest). Une commande de l'IA designe un element par (piece, cote, rang), jamais par un identifiant interne.
//
//   decrirePlan(modele) -> { pieces: [{ id, nom, libelle, surface, cotes: { nord: { murs: [ids], ouvertures: [...] }, ... } }], parLibelle: Map(libelle -> piece) }
//   ouverture : { id, rang, genre, mur, largeur, hauteur, allege, centre } (metres ; centre = coordonnee du milieu le long du cote)

import { extremites, longueurMur, surfaceContour } from "../modele.js";
import { pointDansPolygone } from "../etiquettesPieces.js";

export const COTES = ["nord", "sud", "est", "ouest"];
const PAS_ECHANTILLON = 0.4; // metres : un mur est teste tous les 0,4 m pour savoir quelle(s) piece(s) il borde
const MARGE = 0.15; // metres au-dela de la demi-epaisseur du mur, pour tomber franchement dans la piece ou franchement hors d'elle

const arrondi1 = (v) => (Math.round(v * 10) / 10).toLocaleString("fr-FR");

// Libelles uniques : « Chambre » trois fois devient « Chambre (14,6 m²) » ; deux pieces de meme nom ET meme surface sont numerotees.
function libellesUniques(pieces) {
  const compte = new Map();
  pieces.forEach((p) => compte.set(p.nom.toLowerCase(), (compte.get(p.nom.toLowerCase()) || 0) + 1));
  const vus = new Map();
  return pieces.map((p) => {
    if (compte.get(p.nom.toLowerCase()) === 1) return p.nom;
    const base = `${p.nom} (${arrondi1(p.surface)} m²)`;
    const n = (vus.get(base) || 0) + 1;
    vus.set(base, n);
    return n === 1 ? base : `${base} n°${n}`;
  }).map((l, i, tous) => {
    // une premiere occurrence dont un doublon exact existe plus loin recoit aussi « n°1 »
    const exact = tous.filter((x) => x === l).length;
    return exact > 1 ? `${l} n°1` : l;
  });
}

// Cote de la piece que borde un mur, d'apres le sens dans lequel la piece se trouve par rapport au mur : une piece au SUD d'un mur horizontal a ce mur pour cote NORD.
function coteSelonNormale(n) {
  if (n.y > 0.5) return "nord";
  if (n.y < -0.5) return "sud";
  if (n.x > 0.5) return "ouest";
  return "est";
}

function normaleDuMur(e) {
  const horizontal = Math.abs(e.b.x - e.a.x) >= Math.abs(e.b.y - e.a.y);
  return horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
}

// Pour un mur et une piece : la normale (orientee vers l'interieur de la piece) si le mur borde la piece, sinon null.
function normaleVersPiece(modele, mur, e, contour) {
  const L = longueurMur(modele, mur);
  if (L < 0.05) return null;
  const n = normaleDuMur(e);
  const d = mur.epaisseur / 2 + MARGE;
  const nb = Math.max(3, Math.ceil(L / PAS_ECHANTILLON));
  let positifs = 0;
  let negatifs = 0;
  for (let i = 0; i < nb; i++) {
    const t = (L * (i + 0.5)) / nb / L;
    const s = { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t };
    const p1 = pointDansPolygone({ x: s.x + n.x * d, y: s.y + n.y * d }, contour);
    const p2 = pointDansPolygone({ x: s.x - n.x * d, y: s.y - n.y * d }, contour);
    if (p1 && !p2) positifs += 1;
    else if (p2 && !p1) negatifs += 1;
  }
  if (positifs === 0 && negatifs === 0) return null;
  return positifs >= negatifs ? n : { x: -n.x, y: -n.y };
}

export function decrirePlan(modele) {
  const pieces = (modele.pieces || []).map((p) => ({ id: p.id, nom: p.nom, surface: surfaceContour(p.contour), contour: p.contour }));
  const libelles = libellesUniques(pieces);
  const description = { pieces: [], parLibelle: new Map() };
  pieces.forEach((p, i) => {
    const cotes = Object.fromEntries(COTES.map((c) => [c, { murs: [], ouvertures: [] }]));
    for (const mur of modele.murs) {
      const e = extremites(modele, mur);
      if (!e) continue;
      const n = normaleVersPiece(modele, mur, e, p.contour);
      if (!n) continue;
      const cote = coteSelonNormale(n);
      cotes[cote].murs.push(mur.id);
      const L = longueurMur(modele, mur);
      const u = { x: (e.b.x - e.a.x) / L, y: (e.b.y - e.a.y) / L };
      const d = mur.epaisseur / 2 + MARGE;
      for (const o of modele.ouvertures.filter((x) => x.mur === mur.id)) {
        const milieu = o.decalage + o.largeur / 2;
        const c = { x: e.a.x + u.x * milieu, y: e.a.y + u.y * milieu };
        if (!pointDansPolygone({ x: c.x + n.x * d, y: c.y + n.y * d }, p.contour)) continue; // ouverture d'un autre troncon du meme mur, ou de la piece voisine
        const horizontal = cote === "nord" || cote === "sud";
        cotes[cote].ouvertures.push({ id: o.id, genre: o.genre, mur: mur.id, largeur: o.largeur, hauteur: o.hauteur, allege: o.allege, centre: horizontal ? c.x : c.y });
      }
    }
    for (const cote of COTES) {
      cotes[cote].ouvertures.sort((a, b) => a.centre - b.centre);
      cotes[cote].ouvertures.forEach((o, k) => { o.rang = k + 1; });
    }
    // contour : usage interne du moteur (emplacement des ouvertures ajoutees), jamais ecrit dans le texte envoye a l'IA
    const piece = { id: p.id, nom: p.nom, libelle: libelles[i], surface: p.surface, contour: p.contour, cotes };
    description.pieces.push(piece);
    description.parLibelle.set(piece.libelle, piece);
  });
  return description;
}

const NOM_TEXTE = { porte: "porte", fenetre: "fenêtre", coulissante: "porte coulissante" };
const cmTexte = (m) => `${Math.round(m * 100)} cm`;

// Texte envoye a l'IA : une piece par bloc, un cote par ligne, un element par segment. Que des mots et des nombres.
export function texteDuPlan(description) {
  return description.pieces.map((p) => {
    const lignes = COTES.filter((c) => p.cotes[c].murs.length > 0).map((c) => {
      const o = p.cotes[c].ouvertures;
      const liste = o.length ? o.map((x) => `${x.rang}. ${NOM_TEXTE[x.genre]} largeur ${cmTexte(x.largeur)}, hauteur ${cmTexte(x.hauteur)}${x.genre === "fenetre" ? `, allège ${cmTexte(x.allege)}` : ""}`).join(" ; ") : "aucune ouverture";
      return `  côté ${c} : ${liste}`;
    });
    // le libelle porte deja la surface quand deux pieces ont le meme nom
    return `${p.libelle.includes("m²)") ? p.libelle : `${p.libelle} (${arrondi1(p.surface)} m²)`}\n${lignes.join("\n")}`;
  }).join("\n");
}
