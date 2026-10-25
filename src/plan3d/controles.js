// 2D -> 3D (25/10) : controles de collision de base sur le modele d'un plan. Module pur, sans DOM ni reseau.
// But : signaler tout ce qui est physiquement impossible ou suspect (porte qui mange tout le mur, porte qui entre dans un mur perpendiculaire, battement qui
// heurte un mur, murs qui se croisent, pieces qui se chevauchent) pour que celui qui releve un plan (Claude, plus tard l'IA de lecture) reexamine l'image.
//
//   controlerPlan(modele) -> [{ gravite: "erreur" | "alerte", regle, texte, cibles: ["O18", "M26"] }]   (erreurs d'abord)
//     erreur : impossible tel quel ; alerte : possible mais suspect, a verifier sur le plan d'origine.
//
// Regles : ouverture-bout (l'ouverture entre dans l'epaisseur d'un mur perpendiculaire, ou laisse moins de 5 cm de mur plein), ouvertures-recouvrement,
// battement (la porte ne peut s'ouvrir d'aucun cote, ou son battement dessine heurte un mur), dimensions (hauteur, largeur anormale), murs-croises,
// mur-non-raccorde, pieces-recouvrement, mur-dans-piece, ouverture-orpheline (ouverture qui ne donne dans aucune piece : contour de piece mal place).

import { extremites, longueurMur } from "./modele.js";
import { pointDansPolygone } from "./etiquettesPieces.js";

const JAMBAGE_MIN = 0.03; // metres de mur plein en dessous desquels on signale une ouverture collee a un mur perpendiculaire (relevé a +-1 px = 1,1 cm pres)
const MARGE_BATTEMENT = 0.02; // un battement qui effleure une face de mur (< 2 cm) n'est pas un choc
const PAS = 0.1;
const PAS_FIN = 0.05;

const distanceSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const croisement = (a, b, c, d) => {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  return d1 * d2 < -1e-12 && d3 * d4 < -1e-12;
};

const distanceContour = (p, contour) => Math.min(...contour.map((q, i) => distanceSegment(p, q, contour[(i + 1) % contour.length])));
const cm = (m) => `${Math.round(m * 100)} cm`;

// Murs avec leurs extremites ; un mur sans extremites est ignore (validerModele le refuse deja).
function mursGeometrie(modele) {
  return modele.murs.map((w) => ({ w, e: extremites(modele, w) })).filter((x) => x.e);
}

// Axe de l'ouverture : point de depart, vecteur le long du mur, normale.
function axeOuverture(modele, o, g) {
  const L = longueurMur(modele, g.w) || 1;
  const u = { x: (g.e.b.x - g.e.a.x) / L, y: (g.e.b.y - g.e.a.y) / L };
  return { L, u, n: { x: -u.y, y: u.x }, depart: { x: g.e.a.x + u.x * o.decalage, y: g.e.a.y + u.y * o.decalage } };
}

// Mur plein reserve a un bout : la bande occupee, le long du mur porteur, par les murs qui arrivent sur ce noeud.
function reserveAuNoeud(modele, g, idNoeud, u) {
  let reserve = 0;
  for (const autre of modele.murs) {
    if (autre.id === g.w.id || (autre.a !== idNoeud && autre.b !== idNoeud)) continue;
    const e = extremites(modele, autre);
    if (!e) continue;
    const l = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1;
    const sin = Math.abs((u.x * (e.b.y - e.a.y) - u.y * (e.b.x - e.a.x)) / l); // sinus de l'angle entre les deux murs
    if (sin < 0.2) continue; // quasi alignes : le mur prolonge simplement le porteur
    reserve = Math.max(reserve, autre.epaisseur / 2 / sin);
  }
  return reserve;
}

function controlesOuvertures(modele, geo, sortie) {
  const H = modele.niveau.hauteur;
  for (const o of modele.ouvertures) {
    const g = geo.find((x) => x.w.id === o.mur);
    if (!g) continue;
    const { L, u } = axeOuverture(modele, o, g);
    const bouts = [
      { lib: "de départ", jambage: o.decalage, noeud: g.w.a },
      { lib: "de fin", jambage: L - (o.decalage + o.largeur), noeud: g.w.b }
    ];
    for (const b of bouts) {
      const reserve = reserveAuNoeud(modele, g, b.noeud, u);
      if (reserve === 0) continue;
      if (b.jambage < reserve - 0.005) {
        sortie.push({ gravite: "erreur", regle: "ouverture-bout", cibles: [o.id, g.w.id],
          texte: `${o.id} (${cm(o.largeur)}) sur ${g.w.id} : le bout ${b.lib} entre de ${cm(reserve - b.jambage)} dans l'épaisseur du mur perpendiculaire (il reste ${cm(Math.max(b.jambage, 0))} jusqu'à l'axe, il en faut au moins ${cm(reserve)}). L'ouverture prend toute la longueur du mur ou presque.` });
      } else if (b.jambage - reserve < JAMBAGE_MIN) {
        sortie.push({ gravite: "alerte", regle: "ouverture-bout", cibles: [o.id, g.w.id],
          texte: `${o.id} sur ${g.w.id} : seulement ${cm(b.jambage - reserve)} de mur plein au bout ${b.lib} (moins de ${cm(JAMBAGE_MIN)}). Ouverture collée au mur : vérifier sur le plan que le vantail ne le chevauche pas.` });
      }
    }
    if (o.allege + o.hauteur > H + 0.01) sortie.push({ gravite: "alerte", regle: "dimensions", cibles: [o.id], texte: `${o.id} : allège + hauteur (${cm(o.allege + o.hauteur)}) dépasse la hauteur du niveau (${cm(H)}).` });
    if (o.genre === "porte" && o.largeur > 1.4) sortie.push({ gravite: "alerte", regle: "dimensions", cibles: [o.id], texte: `${o.id} : porte battante de ${cm(o.largeur)} (plus de 1,40 m). Probablement une porte coulissante ou une paroi, à vérifier sur le plan.` });
    if (o.genre === "porte" && o.largeur < 0.6) sortie.push({ gravite: "alerte", regle: "dimensions", cibles: [o.id], texte: `${o.id} : porte de ${cm(o.largeur)} seulement (moins de 60 cm).` });
    if (o.genre === "fenetre" && o.largeur > L - 0.1) sortie.push({ gravite: "alerte", regle: "dimensions", cibles: [o.id, g.w.id], texte: `${o.id} : fenêtre de ${cm(o.largeur)} sur un mur de ${cm(L)}.` });
  }
  // Deux ouvertures du meme mur
  for (const w of modele.murs) {
    const liste = modele.ouvertures.filter((o) => o.mur === w.id).sort((a, b) => a.decalage - b.decalage);
    for (let i = 0; i + 1 < liste.length; i++) {
      const a = liste[i], b = liste[i + 1];
      const ecart = b.decalage - (a.decalage + a.largeur);
      if (ecart < -0.005) sortie.push({ gravite: "erreur", regle: "ouvertures-recouvrement", cibles: [a.id, b.id, w.id], texte: `${a.id} et ${b.id} se chevauchent de ${cm(-ecart)} sur ${w.id}.` });
      else if (ecart < JAMBAGE_MIN) sortie.push({ gravite: "alerte", regle: "ouvertures-recouvrement", cibles: [a.id, b.id, w.id], texte: `${a.id} et ${b.id} ne sont séparées que de ${cm(Math.max(ecart, 0))} sur ${w.id}.` });
    }
  }
}

// Battement d'une porte battante : quart de disque de rayon = largeur, charniere au debut de l'ouverture, d'un cote ou de l'autre du mur.
function battementHeurte(modele, geo, o, g, cote) {
  const { u, n, depart } = axeOuverture(modele, o, g);
  const sens = cote === "dessine" ? 1 : -1; // l'editeur dessine toujours le vantail du cote de la normale (-uy, ux)
  for (let r = PAS; r <= o.largeur * 0.97; r += PAS) {
    for (let phi = 0; phi <= 90; phi += 10) {
      const c = Math.cos((phi * Math.PI) / 180), s = Math.sin((phi * Math.PI) / 180);
      const p = { x: depart.x + r * (c * u.x + s * sens * n.x), y: depart.y + r * (c * u.y + s * sens * n.y) };
      for (const autre of geo) {
        if (autre.w.id === g.w.id) continue;
        if (distanceSegment(p, autre.e.a, autre.e.b) < autre.w.epaisseur / 2 - MARGE_BATTEMENT) return autre.w.id;
      }
    }
  }
  return null;
}

function controlesBattements(modele, geo, sortie) {
  for (const o of modele.ouvertures.filter((x) => x.genre === "porte")) {
    const g = geo.find((x) => x.w.id === o.mur);
    if (!g) continue;
    const dessine = battementHeurte(modele, geo, o, g, "dessine");
    const oppose = battementHeurte(modele, geo, o, g, "oppose");
    if (dessine && oppose) sortie.push({ gravite: "erreur", regle: "battement", cibles: [o.id, g.w.id, dessine], texte: `${o.id} (${cm(o.largeur)}) sur ${g.w.id} : le battement heurte un mur des deux côtés (${dessine} et ${oppose}), la porte ne peut s'ouvrir d'aucun côté.` });
    else if (dessine) sortie.push({ gravite: "alerte", regle: "battement", cibles: [o.id, g.w.id, dessine], texte: `${o.id} sur ${g.w.id} : le battement dessiné heurte ${dessine} (l'autre côté est libre : la porte est peut-être retournée ou mal placée).` });
  }
}

function controlesMurs(modele, geo, sortie) {
  for (let i = 0; i < geo.length; i++) {
    for (let j = i + 1; j < geo.length; j++) {
      const p = geo[i], q = geo[j];
      const commun = [p.w.a, p.w.b].some((n) => n === q.w.a || n === q.w.b);
      if (commun) continue;
      if (croisement(p.e.a, p.e.b, q.e.a, q.e.b)) sortie.push({ gravite: "erreur", regle: "murs-croises", cibles: [p.w.id, q.w.id], texte: `${p.w.id} et ${q.w.id} se croisent sans noeud commun.` });
    }
  }
  // Un noeud qui entre dans un mur dont il n'est pas une extremite : T non raccorde
  for (const n of modele.noeuds) {
    for (const g of geo) {
      if (g.w.a === n.id || g.w.b === n.id) continue;
      const d = distanceSegment(n, g.e.a, g.e.b);
      if (d < g.w.epaisseur / 2 - 0.005) sortie.push({ gravite: "alerte", regle: "mur-non-raccorde", cibles: [n.id, g.w.id], texte: `Le noeud ${n.id} est dans l'épaisseur de ${g.w.id} sans en être une extrémité (mur non raccordé, ou noeud en double).` });
    }
  }
}

const boite = (poly) => ({ x0: Math.min(...poly.map((q) => q.x)), x1: Math.max(...poly.map((q) => q.x)), y0: Math.min(...poly.map((q) => q.y)), y1: Math.max(...poly.map((q) => q.y)) });

function controlesPieces(modele, geo, sortie) {
  const pieces = (modele.pieces || []).filter((p) => Array.isArray(p.contour) && p.contour.length >= 3);
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      const A = boite(a.contour), B = boite(b.contour);
      const x0 = Math.max(A.x0, B.x0), x1 = Math.min(A.x1, B.x1), y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1);
      if (x0 >= x1 || y0 >= y1) continue;
      let n = 0;
      for (let x = x0 + PAS_FIN / 2; x < x1; x += PAS_FIN) for (let y = y0 + PAS_FIN / 2; y < y1; y += PAS_FIN) if (pointDansPolygone({ x, y }, a.contour) && pointDansPolygone({ x, y }, b.contour)) n++;
      const surface = n * PAS_FIN * PAS_FIN;
      if (surface > 0.08) sortie.push({ gravite: "erreur", regle: "pieces-recouvrement", cibles: [a.id, b.id], texte: `${a.nom} (${a.id}) et ${b.nom} (${b.id}) se recouvrent sur environ ${surface.toFixed(1).replace(".", ",")} m².` });
    }
  }
  // Un mur dont l'axe traverse le vide d'une piece (a plus de demi-epaisseur + 5 cm de son bord : en dessous, c'est le contour qui frole le mur, pas une cloison dans la piece)
  for (const p of pieces) {
    for (const g of geo) {
      const L = longueurMur(modele, g.w);
      if (L < 0.4) continue;
      let dedans = 0, total = 0;
      for (let d = 0.2; d < L - 0.2; d += PAS) {
        total++;
        const pt = { x: g.e.a.x + ((g.e.b.x - g.e.a.x) * d) / L, y: g.e.a.y + ((g.e.b.y - g.e.a.y) * d) / L };
        if (pointDansPolygone(pt, p.contour) && distanceContour(pt, p.contour) > g.w.epaisseur / 2 + 0.05) dedans++;
      }
      if (total && dedans / total > 0.5) sortie.push({ gravite: "alerte", regle: "mur-dans-piece", cibles: [g.w.id, p.id], texte: `${g.w.id} traverse le vide de ${p.nom} (${p.id}) sur ${Math.round((100 * dedans) / total)} % de sa longueur : cloison dans la pièce, ou contour de pièce trop grand.` });
    }
  }
}

// Une ouverture dont aucun des deux cotes tombe dans une piece : le contour de la piece voisine est probablement trop loin du mur (la description envoyee a l'IA l'oublierait).
function controlesOrphelines(modele, geo, sortie) {
  const pieces = (modele.pieces || []).filter((p) => Array.isArray(p.contour) && p.contour.length >= 3);
  if (!pieces.length) return;
  for (const o of modele.ouvertures) {
    const g = geo.find((x) => x.w.id === o.mur);
    if (!g) continue;
    const { u, n, depart } = axeOuverture(modele, o, g);
    const milieu = { x: depart.x + u.x * o.largeur / 2, y: depart.y + u.y * o.largeur / 2 };
    const d = g.w.epaisseur / 2 + 0.15;
    const cotes = [1, -1].map((sens) => ({ x: milieu.x + n.x * d * sens, y: milieu.y + n.y * d * sens }));
    if (!cotes.some((pt) => pieces.some((p) => pointDansPolygone(pt, p.contour)))) {
      sortie.push({ gravite: "alerte", regle: "ouverture-orpheline", cibles: [o.id, g.w.id], texte: `${o.id} sur ${g.w.id} ne donne dans aucune pièce (à 15 cm du mur, des deux côtés) : le contour de la pièce voisine est sans doute trop loin du mur.` });
    }
  }
}

export function controlerPlan(modele) {
  const geo = mursGeometrie(modele);
  const sortie = [];
  controlesOuvertures(modele, geo, sortie);
  controlesBattements(modele, geo, sortie);
  controlesMurs(modele, geo, sortie);
  controlesPieces(modele, geo, sortie);
  controlesOrphelines(modele, geo, sortie);
  return sortie.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === "erreur" ? -1 : 1));
}
