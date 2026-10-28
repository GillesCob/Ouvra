// 2D -> 3D (25/10) : placement du nom et de la surface d'une piece sur le plan. Module pur, sans DOM : la mesure du texte est injectee.
// Regle : le bloc de texte (nom + surface) tient ENTIEREMENT dans le contour de la piece. On cherche, pour chaque piece, l'endroit et la taille ou le bloc
// rentre : taille normale d'abord, puis reduite par paliers, avec le nom sur une ou deux lignes. Le centre de gravite n'est pas utilise seul : pour une
// piece en L il tombe parfois hors de la piece. Tailles en metres du plan (le texte suit le plan quand on zoome, comme une cote de piece imprimee).
//
//   placerEtiquette(contour, { nom, surface, mesurer }) -> { lignes: [{ texte, role: "nom" | "surface", taille, y }], x, y, echelle, tient }
//     contour : [{ x, y }] polygone de la piece ; nom : texte du nom ; surface : texte de la surface (« 11,8 m² ») ;
//     mesurer(texte, taille) : largeur du texte en metres pour cette taille.
//     lignes[i].y = decalage vertical du milieu de la ligne par rapport a (x, y) ; largeur, hauteur = taille du bloc de texte (metres) ; echelle = taille finale / taille normale ; tient = false si meme
//     la plus petite taille ne rentre pas (le texte est alors pose au mieux, a la plus petite taille).

const TAILLE_NOM = 0.22; // metres
const RAPPORT_SURFACE = 0.85;
const RAPPORT_LIGNE = 1.2;
const ECHELLES = Array.from({ length: 15 }, (_, i) => Math.round((1 - i * 0.05) * 100) / 100); // 1 -> 0,30
const PAS_GRILLE = 28;

// Largeur approchee sans navigateur (tests) : majuscules grasses, environ 0,66 de la taille par caractere.
export const mesurerApproximatif = (texte, taille) => texte.length * taille * 0.66;

export function pointDansPolygone(p, poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans;
  }
  return dedans;
}

// Un rectangle centre en (cx, cy), demi-largeur hw, demi-hauteur hh, est-il entierement dans le polygone ? Le contour du rectangle est echantillonne
// (3 points par cote) et aucun sommet du polygone ne doit etre a l'interieur du rectangle (cas d'une piece en L ou en U).
function rectangleDans(poly, cx, cy, hw, hh) {
  const xs = [cx - hw, cx, cx + hw];
  const ys = [cy - hh, cy, cy + hh];
  for (const x of xs) for (const y of ys) if (!pointDansPolygone({ x, y }, poly)) return false;
  for (const q of poly) if (q.x > cx - hw + 1e-9 && q.x < cx + hw - 1e-9 && q.y > cy - hh + 1e-9 && q.y < cy + hh - 1e-9) return false;
  return true;
}

function centreDeGravite(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  return Math.abs(a) < 1e-9 ? { x: poly[0].x, y: poly[0].y } : { x: cx / (3 * a), y: cy / (3 * a) };
}

// Decoupes un nom en une ligne, ou en deux lignes aux espaces (la coupe qui rend la plus longue ligne la plus courte).
function decoupes(nom, mesurer) {
  const mots = nom.split(/\s+/).filter(Boolean);
  const options = [[nom]];
  if (mots.length > 1) {
    let meilleure = null;
    for (let i = 1; i < mots.length; i++) {
      const l = [mots.slice(0, i).join(" "), mots.slice(i).join(" ")];
      const largeur = Math.max(mesurer(l[0], TAILLE_NOM), mesurer(l[1], TAILLE_NOM));
      if (!meilleure || largeur < meilleure.largeur) meilleure = { l, largeur };
    }
    options.push(meilleure.l);
  }
  return options;
}

function disposer(lignesNom, surface, mesurer, echelle) {
  const fn = TAILLE_NOM * echelle;
  const fs = TAILLE_NOM * RAPPORT_SURFACE * echelle;
  const lignes = [];
  let y = 0;
  for (const texte of lignesNom) { lignes.push({ texte, role: "nom", taille: fn, y: y + (fn * RAPPORT_LIGNE) / 2 }); y += fn * RAPPORT_LIGNE; }
  if (surface) { lignes.push({ texte: surface, role: "surface", taille: fs, y: y + (fs * RAPPORT_LIGNE) / 2 }); y += fs * RAPPORT_LIGNE; }
  const largeur = Math.max(...lignes.map((l) => mesurer(l.texte, l.taille))) * 1.06; // marge : la mesure n'est pas exacte au pixel
  const hauteur = y;
  return { lignes: lignes.map((l) => ({ ...l, y: l.y - hauteur / 2 })), largeur, hauteur };
}

export function placerEtiquette(contour, { nom, surface = "", mesurer = mesurerApproximatif }) {
  if (!Array.isArray(contour) || contour.length < 3) return { lignes: [], largeur: 0, hauteur: 0, x: 0, y: 0, echelle: 1, tient: false };
  const poly = contour.map((q) => ({ x: q.x, y: q.y }));
  const xs = poly.map((q) => q.x);
  const ys = poly.map((q) => q.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const gravite = centreDeGravite(poly);
  const texteNom = String(nom || "").toUpperCase();
  const options = texteNom ? decoupes(texteNom, mesurer) : [[]];

  let meilleur = null;
  for (const echelle of ECHELLES) {
    for (const lignesNom of options) {
      const bloc = disposer(lignesNom, surface, mesurer, echelle);
      if (!bloc.lignes.length) continue;
      const hw = bloc.largeur / 2, hh = bloc.hauteur / 2;
      if (hw * 2 > maxX - minX || hh * 2 > maxY - minY) continue;
      let choix = null;
      for (let i = 0; i <= PAS_GRILLE; i++) {
        for (let j = 0; j <= PAS_GRILLE; j++) {
          const cx = minX + hw + ((maxX - minX - 2 * hw) * i) / PAS_GRILLE;
          const cy = minY + hh + ((maxY - minY - 2 * hh) * j) / PAS_GRILLE;
          if (!rectangleDans(poly, cx, cy, hw, hh)) continue;
          const d = Math.hypot(cx - gravite.x, cy - gravite.y);
          if (!choix || d < choix.d) choix = { cx, cy, d };
        }
      }
      if (choix) { meilleur = { bloc, ...choix, echelle }; break; }
    }
    if (meilleur) break; // plus grande echelle qui rentre ; a echelle egale, la premiere option (une seule ligne de nom) l'emporte
  }
  if (meilleur) return { lignes: meilleur.bloc.lignes, largeur: meilleur.bloc.largeur, hauteur: meilleur.bloc.hauteur, x: meilleur.cx, y: meilleur.cy, echelle: meilleur.echelle, tient: true };

  // Rien ne rentre meme a la plus petite taille : pose au mieux, dans la piece, a la plus petite taille.
  const bloc = disposer(options[options.length - 1], surface, mesurer, ECHELLES[ECHELLES.length - 1]);
  const dedans = pointDansPolygone(gravite, poly) ? gravite : trouverPointDedans(poly, minX, maxX, minY, maxY) || gravite;
  return { lignes: bloc.lignes, largeur: bloc.largeur, hauteur: bloc.hauteur, x: dedans.x, y: dedans.y, echelle: ECHELLES[ECHELLES.length - 1], tient: false };
}

function trouverPointDedans(poly, minX, maxX, minY, maxY) {
  for (let i = 0; i <= PAS_GRILLE; i++) {
    for (let j = 0; j <= PAS_GRILLE; j++) {
      const p = { x: minX + ((maxX - minX) * i) / PAS_GRILLE, y: minY + ((maxY - minY) * j) / PAS_GRILLE };
      if (pointDansPolygone(p, poly)) return p;
    }
  }
  return null;
}
