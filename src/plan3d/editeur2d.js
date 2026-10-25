// 2D -> 3D (25/10) : editeur du plan en SVG. Il dessine le modele (src/plan3d/modele.js), reçoit les gestes (souris et toucher) et rend un NOUVEAU
// modele a chaque modification via surChangement ; il ne garde aucun etat du plan lui-meme (l'historique et la 3D sont dans la page).
// Le repere du SVG est celui du plan : metres, y vers le bas. Zoom et deplacement = la viewBox.
//
//   surChangement(modele, { fusion }) : fusion = true pour les mouvements successifs d'un meme geste (un seul pas d'annulation)
//   surSelection(selection)           : { type: "mur" | "ouverture" | "noeud" | "piece", id } ou null
//   surCalibrer(p, q)                 : deux points cliques en mode « calibrer » (metres)
//   surCote(murId)                    : clic sur une cote (la page place le curseur dans le champ de longueur)
//   typeMurNeuf()                     : « exterieur » | « interieur » pour un mur trace
//   surTrace(etat)                    : « mur » | « piece » tant qu'un trace est en cours (la page affiche alors « Terminer », seul moyen de finir au doigt), sinon null

import { vueApresPincement } from "./pincement.js";
import { placerEtiquette } from "./etiquettesPieces.js";
import { mesurerTexte, surfaceAffichee } from "./texteSol.js";
import {
  murDe, noeudDe, extremites, longueurMur, ajouterNoeud, ajouterMur, deplacerNoeud, ajouterOuverture, scinderMur, supprimerMur, supprimerOuverture,
  ajouterPiece, supprimerPiece, surfaceContour
} from "./modele.js";

const NS = "http://www.w3.org/2000/svg";
const RAYON_ACCROCHE_PX = 14; // distance d'accroche a un noeud ou a un mur, en pixels ecran
const SEUIL_CLIC_PX = 4;
const MARGE_VUE = 1.5; // metres : marge fixe autour du plan, limite du dezoom
const ZONE_MIN = { l: 12, h: 8 }; // metres : taille minimale de la zone de travail (un plan presque vide)
const ANGLE_ORTHO = (4 * Math.PI) / 180;

function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

const formaterCote = (m) => `${Math.round(m * 100)} cm`;
const COULEURS_PIECES = ["#8fc79a", "#8fb6dc", "#e3bf8a", "#d79bc4", "#c3d38a", "#a9a9dc", "#dca594"];

// Rectangle d'un mur (epaisseur) sous forme de points SVG.
function pointsMur(a, b, epaisseur) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * (epaisseur / 2);
  const ny = (dx / L) * (epaisseur / 2);
  return [[a.x + nx, a.y + ny], [b.x + nx, b.y + ny], [b.x - nx, b.y - ny], [a.x - nx, a.y - ny]].map((p) => p.join(",")).join(" ");
}

export function creerEditeur2d({ conteneur, surChangement, surSelection, surCalibrer, surCote, surTrace = () => {}, typeMurNeuf = () => "interieur" }) {
  const svg = el("svg", { class: "p3d-svg", role: "img", "aria-label": "Plan 2D éditable", tabindex: 0 });
  conteneur.appendChild(svg);

  let modele = null;
  let fond = null; // { url, l, h } : image du plan et sa taille en pixels
  let mode = "selection"; // selection | mur | porte | fenetre | coulissante | calibrer
  let selection = null;
  let toutesCotes = false;
  let opaciteFond = 0.35;
  let opaciteMaquette = 1; // visibilite du plan redessine (pieces, murs, ouvertures, noms) ; les cotes et les poignees restent entiers
  let vitesseZoom = 0.5; // 1 = 100 % : une graduation de molette (deltaY 100) change l'echelle de 22 % ; a 50 %, de 10 %
  let fondVisible = true; // « masquer le plan de base » : seul le plan redessine reste
  let vue = { x: -1, y: -1, l: 12, h: 8 }; // viewBox
  let ajustee = true; // vrai tant que la vue est au dezoom maximal (plan entier, centre) : elle suit alors les changements de taille de la zone (en-tete et barre d'outils qui apparaissent)
  let brouillon = null; // trace en cours : { depart: {x, y}, curseur: {x, y} } ; calibration : { points: [{x,y}], curseur }
  let geste = null; // geste du pointeur en cours : { type, ... }
  const doigts = new Map(); // pointeurs actifs (id -> position ecran) : deux doigts = pincement
  let pincement = null; // { vueDepart, departA, departB, ids } tant que deux doigts sont poses
  let traceSignale = null;

  const metresParPixel = () => vue.l / Math.max(svg.clientWidth, 1);
  const enMetres = (e) => {
    const r = svg.getBoundingClientRect();
    const k = vue.l / Math.max(r.width, 1);
    return { x: vue.x + (e.clientX - r.left) * k, y: vue.y + (e.clientY - r.top) * k };
  };

  const rapportEcran = () => { const r = svg.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r.height / r.width : 0.7; };

  // Zone de travail : le plan (murs, pieces, image de fond) entoure d'une marge FIXE en metres, d'au moins ZONE_MIN. On ne peut ni dezoomer au-dela
  // de la vue qui montre toute cette zone, ni deplacer la vue hors d'elle : au-dela il n'y a rien a voir ni a faire.
  function zoneContenu() {
    const xs = [];
    const ys = [];
    for (const n of modele ? modele.noeuds : []) { xs.push(n.x); ys.push(n.y); }
    for (const pc of (modele && modele.pieces) || []) for (const q of pc.contour) { xs.push(q.x); ys.push(q.y); }
    const f = modele && modele.fond;
    if (fond && f) { xs.push(f.x, f.x + fond.l * f.echelle); ys.push(f.y, f.y + fond.h * f.echelle); }
    if (!xs.length) return { x: -1, y: -1, l: ZONE_MIN.l, h: ZONE_MIN.h };
    const x0 = Math.min(...xs) - MARGE_VUE, x1 = Math.max(...xs) + MARGE_VUE;
    const y0 = Math.min(...ys) - MARGE_VUE, y1 = Math.max(...ys) + MARGE_VUE;
    const l = Math.max(x1 - x0, ZONE_MIN.l);
    const h = Math.max(y1 - y0, ZONE_MIN.h);
    return { x: (x0 + x1) / 2 - l / 2, y: (y0 + y1) / 2 - h / 2, l, h };
  }

  // Plus grande vue permise : toute la zone, au rapport de l'ecran, centree sur elle.
  function vueAjustee() {
    const z = zoneContenu();
    const ratio = rapportEcran();
    const l = Math.max(z.l, z.h / ratio);
    return { x: z.x + z.l / 2 - l / 2, y: z.y + z.h / 2 - (l * ratio) / 2, l, h: l * ratio };
  }

  // Limites : on ne dezoome pas au-dela de la vue ajustee, et le CENTRE de la vue reste dans la zone. Cette regle (et non « la vue entiere dans la zone », qui recentrait
  // d'office la vue quand elle depassait la zone) laisse le zoom a la souris fonctionner partout, y compris dans un coin du plan, des le premier cran.
  function contraindreVue() {
    const z = zoneContenu();
    vue.l = Math.min(vue.l, vueAjustee().l);
    vue.h = vue.l * rapportEcran();
    const cx = Math.min(Math.max(vue.x + vue.l / 2, z.x), z.x + z.l);
    const cy = Math.min(Math.max(vue.y + vue.h / 2, z.y), z.y + z.h);
    vue.x = cx - vue.l / 2;
    vue.y = cy - vue.h / 2;
  }

  function appliquerVue() {
    // La viewBox suit le rapport de l'ecran (sinon l'image serait deformee par preserveAspectRatio) et reste dans la zone de travail.
    vue.h = vue.l * rapportEcran();
    contraindreVue();
    svg.setAttribute("viewBox", `${vue.x} ${vue.y} ${vue.l} ${vue.h}`);
  }

  // ---- Dessin ----
  function signalerTrace() {
    const etat = mode === "mur" && brouillon && brouillon.depart ? "mur" : mode === "piece" && brouillon && brouillon.contour && brouillon.contour.length ? "piece" : null;
    if (etat !== traceSignale) { traceSignale = etat; surTrace(etat); }
  }

  function dessiner() {
    signalerTrace();
    appliquerVue();
    svg.replaceChildren();
    if (!modele) return;
    const px = metresParPixel();
    if (fond && fondVisible) {
      const f = modele.fond || { echelle: 0.01, x: 0, y: 0 };
      el("image", { href: fond.url, x: f.x, y: f.y, width: fond.l * f.echelle, height: fond.h * f.echelle, opacity: opaciteFond, class: "p3d-fond" }, svg);
    }
    const avantMaquette = svg.childNodes.length;
    dessinerPieces(px);
    for (const w of modele.murs) {
      const e = extremites(modele, w);
      if (!e) continue;
      const estSel = selection && selection.type === "mur" && selection.id === w.id;
      el("polygon", { points: pointsMur(e.a, e.b, w.epaisseur), class: `p3d-mur ${w.type}${estSel ? " sel" : ""}`, "data-kind": "mur", "data-id": w.id }, svg);
    }
    for (const o of modele.ouvertures) dessinerOuverture(o, px);
    dessinerEtiquettesPieces();
    // Le plan redessine est regroupe pour pouvoir etre estompe d'un bloc ; a 0 il n'est plus cliquable (on ne selectionne pas ce qu'on ne voit pas).
    const groupe = el("g", { class: "p3d-maquette", opacity: opaciteMaquette }, svg);
    if (opaciteMaquette === 0) groupe.setAttribute("pointer-events", "none");
    [...svg.childNodes].slice(avantMaquette).forEach((n) => { if (n !== groupe) groupe.appendChild(n); });
    dessinerCotes(px);
    dessinerPoignees(px);
    dessinerBrouillon(px);
  }

  // Ouverture en symbole d'architecte : la coupe dans le mur (couleur du papier), puis pour une fenetre trois traits fins (deux faces du mur et le vitrage),
  // pour une porte le vantail ouvert a 90 degres et l'arc de debattement. Un polygone transparent par-dessus porte le clic et la selection.
  function dessinerOuverture(o, px) {
    const w = murDe(modele, o.mur);
    const e = w && extremites(modele, w);
    if (!e) return;
    const L = longueurMur(modele, w) || 1;
    const ux = (e.b.x - e.a.x) / L;
    const uy = (e.b.y - e.a.y) / L;
    const nx = -uy;
    const ny = ux;
    const a = { x: e.a.x + ux * o.decalage, y: e.a.y + uy * o.decalage };
    const b = { x: e.a.x + ux * (o.decalage + o.largeur), y: e.a.y + uy * (o.decalage + o.largeur) };
    const demi = w.epaisseur / 2;
    const estSel = selection && selection.type === "ouverture" && selection.id === o.id;
    el("polygon", { points: pointsMur(a, b, w.epaisseur + 0.004), class: "p3d-coupe" }, svg);
    const trait = (p, q, classe) => el("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: classe }, svg);
    const decale = (p, d) => ({ x: p.x + nx * d, y: p.y + ny * d });
    trait(decale(a, demi), decale(b, demi), "p3d-trait");
    trait(decale(a, -demi), decale(b, -demi), "p3d-trait");
    trait(decale(a, demi), decale(a, -demi), "p3d-trait");
    trait(decale(b, demi), decale(b, -demi), "p3d-trait");
    if (o.genre === "fenetre") {
      trait(a, b, "p3d-trait p3d-vitrage");
    } else if (o.genre === "coulissante") {
      // Porte coulissante : aucun debattement. Deux vantaux minces dans l'epaisseur du mur, decales de part et d'autre de l'axe, qui se chevauchent au milieu.
      const t = demi / 2;
      const part = (d, de, vers) => trait(decale({ x: a.x + (b.x - a.x) * de, y: a.y + (b.y - a.y) * de }, d), decale({ x: a.x + (b.x - a.x) * vers, y: a.y + (b.y - a.y) * vers }, d), "p3d-trait p3d-coulissant");
      part(t, 0, 0.55);
      part(-t, 0.45, 1);
    } else {
      const bout = { x: a.x + nx * o.largeur, y: a.y + ny * o.largeur }; // vantail ouvert, charniere au debut de l'ouverture
      trait(a, bout, "p3d-trait p3d-vantail");
      el("path", { d: `M ${bout.x} ${bout.y} A ${o.largeur} ${o.largeur} 0 0 0 ${b.x} ${b.y}`, class: "p3d-trait p3d-arc", fill: "none" }, svg);
    }
    el("polygon", { points: pointsMur(a, b, w.epaisseur), class: `p3d-ouv ${o.genre}${estSel ? " sel" : ""}`, "data-kind": "ouverture", "data-id": o.id }, svg);
  }

  // Poignees : jamais de points sur tout le plan. Seuls les angles du mur ou de l'angle selectionnes sont visibles, et en mode « tracer un mur » les angles
  // existants (reperes d'accroche). En mode selection, tous les angles restent saisissables par une zone invisible.
  function dessinerPoignees(px) {
    if (mode !== "selection" && mode !== "mur") return;
    const visibles = new Set();
    if (selection && selection.type === "noeud") visibles.add(selection.id);
    if (selection && selection.type === "mur") { const w = murDe(modele, selection.id); if (w) { visibles.add(w.a); visibles.add(w.b); } }
    if (mode === "mur") modele.noeuds.forEach((n) => visibles.add(n.id));
    for (const n of modele.noeuds) {
      const vu = visibles.has(n.id);
      const estSel = selection && selection.type === "noeud" && selection.id === n.id;
      const cote = (vu ? (mode === "mur" ? 3 : 4.5) : 8) * px;
      if (!vu) { el("circle", { cx: n.x, cy: n.y, r: cote, class: "p3d-noeud-zone", "data-kind": "noeud", "data-id": n.id }, svg); continue; }
      const r = el("rect", { x: n.x - cote, y: n.y - cote, width: cote * 2, height: cote * 2, class: `p3d-poignee${mode === "mur" ? " repere" : ""}${estSel ? " sel" : ""}`, "data-kind": "noeud", "data-id": n.id }, svg);
      r.setAttribute("rx", String(px));
    }
  }

  // Noms et surfaces des pieces : dessines APRES les murs et les ouvertures, donc jamais caches par eux, et places par etiquettesPieces.js de facon a
  // tenir entierement dans le contour de la piece (taille reduite ou nom sur deux lignes si besoin). Placement mis en cache : il ne depend que de la piece.
  const placements = new Map();
  function dessinerEtiquettesPieces() {
    for (const pc of modele.pieces || []) {
      const surface = surfaceAffichee(pc);
      const cle = `${pc.nom}|${surface}|${JSON.stringify(pc.contour)}`;
      if (!placements.has(cle)) {
        if (placements.size > 200) placements.clear();
        placements.set(cle, placerEtiquette(pc.contour, { nom: pc.nom, surface, mesurer: mesurerTexte }));
      }
      const e = placements.get(cle);
      const g = el("g", { class: "p3d-piece-etiquette", transform: `translate(${e.x} ${e.y})` }, svg);
      for (const l of e.lignes) {
        const t = el("text", { x: 0, y: l.y, "font-size": l.taille, "text-anchor": "middle", "dominant-baseline": "central", class: l.role === "nom" ? "p3d-piece-nom" : "p3d-piece-surface", "stroke-width": l.taille * 0.12 }, g);
        t.textContent = l.texte;
      }
    }
  }

  // Pieces : aplat tres leger sous les murs (plus marque a la selection), nom et surface calculee au centre, en lettres fines avec un halo de la couleur
  // du papier. Une piece dont le centre de gravite tombe hors du polygone (forme en L) garde son etiquette la : c'est un repere, pas un placement exact.
  function dessinerPieces(px) {
    (modele.pieces || []).forEach((pc, i) => {
      const estSel = selection && selection.type === "piece" && selection.id === pc.id;
      el("polygon", { points: pc.contour.map((q) => `${q.x},${q.y}`).join(" "), fill: COULEURS_PIECES[i % COULEURS_PIECES.length], class: `p3d-piece${estSel ? " sel" : ""}`, "data-kind": "piece", "data-id": pc.id }, svg);
    });
  }

  // Cotes : ligne de cote parallele au mur, repoussee de sa face exterieure, avec traits de rappel et barres obliques aux extremites (convention des plans).
  // Le texte est pose au-dessus de la ligne, lisible de gauche a droite, avec un halo ; un rectangle invisible rend la cote cliquable.
  function dessinerCotes(px) {
    const ids = new Set();
    if (toutesCotes) modele.murs.forEach((w) => ids.add(w.id));
    if (selection && selection.type === "mur") ids.add(selection.id);
    if (selection && selection.type === "noeud") modele.murs.filter((w) => w.a === selection.id || w.b === selection.id).forEach((w) => ids.add(w.id));
    for (const id of ids) {
      const w = murDe(modele, id);
      const e = w && extremites(modele, w);
      if (!e) continue;
      const L = longueurMur(modele, w);
      if (L < 0.01) continue;
      const nx = -(e.b.y - e.a.y) / L;
      const ny = (e.b.x - e.a.x) / L;
      const decal = w.epaisseur / 2 + 16 * px;
      const mx = (e.a.x + e.b.x) / 2 + nx * decal;
      const my = (e.a.y + e.b.y) / 2 + ny * decal;
      let angle = (Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x) * 180) / Math.PI;
      const retourne = angle > 90 || angle < -90;
      if (retourne) angle += 180;
      const g = el("g", { transform: `translate(${mx} ${my}) rotate(${angle})`, class: "p3d-cote", "data-kind": "cote", "data-id": id }, svg);
      const sens = retourne ? 1 : -1; // dans ce repere local, le mur est du cote `sens` de la ligne de cote
      const demiL = L / 2;
      const t = 3 * px;
      const trait = (x1, y1, x2, y2) => el("line", { x1, y1, x2, y2, class: "p3d-cote-trait" }, g);
      el("rect", { x: -demiL, y: -9 * px, width: L, height: 18 * px, class: "p3d-cote-zone" }, g);
      trait(-demiL, 0, demiL, 0);
      for (const x of [-demiL, demiL]) {
        trait(x - t, t, x + t, -t); // barre oblique
        trait(x, sens * (decal - w.epaisseur / 2 - 2 * px), x, -sens * 2 * px); // trait de rappel jusqu'au mur
      }
      const texte = el("text", { x: 0, y: -4 * px, "font-size": 9 * px, "text-anchor": "middle", "stroke-width": 2.5 * px }, g);
      texte.textContent = formaterCote(L);
    }
  }

  function dessinerBrouillon(px) {
    if (!brouillon) return;
    if (brouillon.depart && brouillon.curseur) {
      const n = brouillon.depart;
      el("line", { x1: n.x, y1: n.y, x2: brouillon.curseur.x, y2: brouillon.curseur.y, class: "p3d-brouillon", "stroke-width": 2 * px }, svg);
    }
    if (brouillon.points) {
      const pts = [...brouillon.points, ...(brouillon.curseur && brouillon.points.length < 2 ? [brouillon.curseur] : [])];
      if (pts.length === 2) el("line", { x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y, class: "p3d-calibre", "stroke-width": 2 * px }, svg);
      for (const p of brouillon.points) el("circle", { cx: p.x, cy: p.y, r: 5 * px, class: "p3d-calibre-pt" }, svg);
    }
    if (brouillon.contour && brouillon.contour.length) {
      const pts = [...brouillon.contour, ...(brouillon.curseur ? [brouillon.curseur] : [])];
      el("polyline", { points: pts.map((q) => `${q.x},${q.y}`).join(" "), class: "p3d-brouillon p3d-brouillon-piece", fill: "none", "stroke-width": 2 * px }, svg);
      brouillon.contour.forEach((q, i) => el("circle", { cx: q.x, cy: q.y, r: (i === 0 ? 7 : 4) * px, class: "p3d-calibre-pt" }, svg));
    }
    if (brouillon.accroche) el("circle", { cx: brouillon.accroche.x, cy: brouillon.accroche.y, r: 8 * px, class: "p3d-accroche" }, svg);
  }

  // ---- Accroche (trace) ----
  // Point d'un clic, dans l'ordre : noeud proche, mur proche (jonction en T), puis point libre (aligne sur l'horizontale ou la verticale du depart si proche).
  function accrocher(p, depart) { // depart : point {x, y} du debut du mur en cours, ou null
    const rayon = RAYON_ACCROCHE_PX * metresParPixel();
    let noeud = null;
    let dist = rayon;
    for (const n of modele.noeuds) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < dist) { noeud = n; dist = d; }
    }
    if (noeud) return { type: "noeud", id: noeud.id, x: noeud.x, y: noeud.y };
    let mur = null;
    dist = rayon;
    for (const w of modele.murs) {
      const e = extremites(modele, w);
      if (!e) continue;
      const L = longueurMur(modele, w);
      if (L === 0) continue;
      const t = Math.min(Math.max(((p.x - e.a.x) * (e.b.x - e.a.x) + (p.y - e.a.y) * (e.b.y - e.a.y)) / (L * L), 0), 1);
      const q = { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < dist) { mur = { w, q }; dist = d; }
    }
    if (mur) return { type: "mur", id: mur.w.id, x: mur.q.x, y: mur.q.y };
    const d = depart;
    if (d) {
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      const a = Math.atan2(dy, dx);
      const reste = Math.abs(a) % (Math.PI / 2);
      if (Math.min(reste, Math.PI / 2 - reste) < ANGLE_ORTHO) {
        return Math.abs(dx) >= Math.abs(dy) ? { type: "libre", x: p.x, y: d.y } : { type: "libre", x: d.x, y: p.y };
      }
    }
    return { type: "libre", x: p.x, y: p.y };
  }

  // Resout un point accroche en id de noeud (cree le noeud, coupe le mur pour une jonction en T).
  function noeudDepuisAccroche(m, a) {
    if (a.type === "noeud") return { modele: m, id: a.id };
    if (a.type === "mur") return scinderMur(m, a.id, a.x, a.y);
    return ajouterNoeud(m, a.x, a.y);
  }

  // ---- Gestes ----
  function changer(m, fusion = false) {
    modele = m;
    surChangement(m, { fusion });
    dessiner();
  }

  function selectionner(sel) {
    selection = sel;
    surSelection(sel);
    dessiner();
  }

  function sur(e) {
    const cible = e.target.closest ? e.target.closest("[data-kind]") : null;
    return cible ? { kind: cible.dataset.kind, id: cible.dataset.id } : null;
  }

  svg.addEventListener("pointerdown", (e) => {
    if (!modele || e.button > 0) return;
    svg.setPointerCapture(e.pointerId);
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.size === 2) {
      // deuxieme doigt : le geste en cours (clic, deplacement) est abandonne, le pincement prend le relais
      const [a, b] = [...doigts.values()];
      geste = null;
      pincement = { vueDepart: { ...vue }, departA: a, departB: b };
      return;
    }
    if (doigts.size > 2) return;
    const p = enMetres(e);
    const cible = sur(e);
    geste = { id: e.pointerId, depart: { x: e.clientX, y: e.clientY }, vueDepart: { ...vue }, deplace: false, cible, p0: p, noeud: null };
    if (mode === "selection" && cible && cible.kind === "noeud") geste.noeud = cible.id;
  });

  svg.addEventListener("pointermove", (e) => {
    if (!modele) return;
    if (doigts.has(e.pointerId)) doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pincement) {
      if (doigts.size < 2) return;
      const [a, b] = [...doigts.values()];
      const rect = svg.getBoundingClientRect();
      vue = vueApresPincement({ vueDepart: pincement.vueDepart, rect, departA: pincement.departA, departB: pincement.departB, a, b, lMax: vueAjustee().l });
      ajustee = vue.l >= vueAjustee().l - 1e-6;
      dessiner();
      return;
    }
    const p = enMetres(e);
    if (!geste || geste.id !== e.pointerId) {
      if (mode === "mur" || mode === "calibrer" || mode === "piece") {
        const a = mode === "mur" ? accrocher(p, brouillon && brouillon.depart) : { x: p.x, y: p.y };
        brouillon = { ...(brouillon || {}), curseur: { x: a.x, y: a.y }, accroche: a.type && a.type !== "libre" ? a : null };
        dessiner();
      }
      return;
    }
    const dpx = Math.hypot(e.clientX - geste.depart.x, e.clientY - geste.depart.y);
    if (!geste.deplace && dpx < SEUIL_CLIC_PX) return;
    const premier = !geste.deplace;
    geste.deplace = true;
    if (geste.noeud) {
      // deplacement d'un noeud : les murs et les ouvertures qui y tiennent suivent
      changer(deplacerNoeud(modele, geste.noeud, p.x, p.y), !premier);
      return;
    }
    // sinon : deplacement de la vue (fond, murs ou vide)
    const k = metresParPixel();
    ajustee = false;
    vue.x = geste.vueDepart.x - (e.clientX - geste.depart.x) * k;
    vue.y = geste.vueDepart.y - (e.clientY - geste.depart.y) * k;
    dessiner();
  });

  const leverDoigt = (e) => {
    doigts.delete(e.pointerId);
    if (doigts.size < 2) pincement = null;
  };
  svg.addEventListener("pointerup", (e) => {
    const etaitPincement = pincement !== null;
    leverDoigt(e);
    if (etaitPincement || !geste || geste.id !== e.pointerId) return;
    const g = geste;
    geste = null;
    if (g.deplace || !modele) return;
    clic(enMetres(e), g.cible);
  });
  svg.addEventListener("pointercancel", (e) => { leverDoigt(e); geste = null; });

  function clic(p, cible) {
    if (mode === "selection") {
      if (!cible) return selectionner(null);
      if (cible.kind === "cote") { selectionner({ type: "mur", id: cible.id }); surCote(cible.id); return; }
      return selectionner({ type: cible.kind, id: cible.id });
    }
    if (mode === "mur") return clicMur(p);
    if (mode === "porte" || mode === "fenetre" || mode === "coulissante") return clicOuverture(p, cible);
    if (mode === "calibrer") return clicCalibrer(p);
    if (mode === "piece") return clicPiece(p);
  }

  // Tracé d'une pièce : un clic par sommet (faces interieures des murs), clic sur le premier point, double clic ou Entree pour fermer.
  function clicPiece(p) {
    const contour = (brouillon && brouillon.contour) || [];
    const rayon = RAYON_ACCROCHE_PX * metresParPixel();
    if (contour.length >= 3 && Math.hypot(contour[0].x - p.x, contour[0].y - p.y) < rayon) return fermerPiece();
    brouillon = { contour: [...contour, { x: p.x, y: p.y }], curseur: { x: p.x, y: p.y } };
    dessiner();
  }

  function fermerPiece() {
    let contour = (brouillon && brouillon.contour) || [];
    const tol = 3 * metresParPixel();
    // un double clic ajoute le meme point deux fois : on retire le doublon final
    while (contour.length > 1 && Math.hypot(contour[contour.length - 1].x - contour[contour.length - 2].x, contour[contour.length - 1].y - contour[contour.length - 2].y) < tol) contour = contour.slice(0, -1);
    brouillon = null;
    if (contour.length < 3) return dessiner();
    const r = ajouterPiece(modele, "Pièce", contour);
    if (!r.id) return dessiner();
    changer(r.modele);
    selectionner({ type: "piece", id: r.id });
  }

  // Premier clic : le point de depart est memorise (rien n'est cree). Clic suivant : les noeuds sont crees (ou le mur coupe pour une jonction en T),
  // le mur est ajoute, et sa fin devient le depart du mur suivant (trace en chaine) jusqu'a Echap ou double clic.
  function clicMur(p) {
    const a = accrocher(p, brouillon && brouillon.depart);
    if (!brouillon || !brouillon.depart) {
      brouillon = { depart: { x: a.x, y: a.y }, curseur: { x: a.x, y: a.y } };
      return dessiner();
    }
    const debut = noeudDepuisAccroche(modele, accrocher(brouillon.depart, null));
    if (!debut.id) return;
    // la coupe d'un mur a pu changer les murs voisins : la fin est re-accrochee sur le modele a jour
    const fin = noeudDepuisAccroche(debut.modele, accrocher({ x: a.x, y: a.y }, null));
    if (!fin.id || fin.id === debut.id) return;
    const r = ajouterMur(fin.modele, debut.id, fin.id, { type: typeMurNeuf() });
    const noeudFin = noeudDe(r.modele, fin.id);
    brouillon = { depart: { x: noeudFin.x, y: noeudFin.y }, curseur: { x: noeudFin.x, y: noeudFin.y } };
    changer(r.modele);
  }

  function clicOuverture(p, cible) {
    const a = accrocher(p, null);
    const mur = cible && cible.kind === "mur" ? murDe(modele, cible.id) : a.type === "mur" ? murDe(modele, a.id) : null;
    const e = mur && extremites(modele, mur);
    if (!e) return;
    const L = longueurMur(modele, mur);
    const t = ((p.x - e.a.x) * (e.b.x - e.a.x) + (p.y - e.a.y) * (e.b.y - e.a.y)) / L;
    const r = ajouterOuverture(modele, mur.id, mode, t);
    if (!r.id) return;
    changer(r.modele);
    selectionner({ type: "ouverture", id: r.id });
  }

  function clicCalibrer(p) {
    const points = [...((brouillon && brouillon.points) || []), { x: p.x, y: p.y }];
    if (points.length < 2) { brouillon = { points, curseur: p }; return dessiner(); }
    brouillon = null;
    dessiner();
    surCalibrer(points[0], points[1]);
  }

  svg.addEventListener("dblclick", () => { if (mode === "mur") terminerTrace(); if (mode === "piece") fermerPiece(); });
  svg.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { terminerTrace(); brouillon = null; dessiner(); }
    if (e.key === "Enter" && mode === "piece") fermerPiece();
    if ((e.key === "Delete" || e.key === "Backspace") && selection) supprimerSelection();
  });
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    // Zoom continu : proportionnel a la quantite de molette (un pave tactile envoie beaucoup de petits deltaY), borne par evenement.
    const dy = Math.max(-100, Math.min(100, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY));
    zoomer(Math.exp(dy * 0.002 * vitesseZoom), enMetres(e));
  }, { passive: false });

  // ---- API ----
  function zoomer(facteur, centre = null) {
    const c = centre || { x: vue.x + vue.l / 2, y: vue.y + vue.h / 2 };
    const max = vueAjustee();
    const l = Math.min(Math.max(vue.l * facteur, 1), Math.max(max.l, 1));
    const k = l / vue.l;
    // Le point sous la souris reste sous la souris ; au dezoom maximal, la vue se recale d'elle-meme sur le plan entier.
    vue = l >= max.l - 1e-6 ? max : { x: c.x - (c.x - vue.x) * k, y: c.y - (c.y - vue.y) * k, l, h: vue.h * k };
    ajustee = l >= max.l - 1e-6;
    dessiner();
  }

  function cadrer() {
    if (!modele) return;
    ajustee = true;
    vue = vueAjustee();
    dessiner();
  }

  function supprimerSelection() {
    if (!selection || !modele) return;
    const sel = selection;
    selection = null;
    surSelection(null);
    if (sel.type === "mur") changer(supprimerMur(modele, sel.id));
    else if (sel.type === "ouverture") changer(supprimerOuverture(modele, sel.id));
    else if (sel.type === "piece") changer(supprimerPiece(modele, sel.id));
    else if (sel.type === "noeud") changer(modele.murs.filter((w) => w.a === sel.id || w.b === sel.id).reduce((m, w) => supprimerMur(m, w.id), modele));
  }

  function terminerTrace() {
    brouillon = null;
    dessiner();
  }

  const observateur = new ResizeObserver(() => { if (ajustee && modele) vue = vueAjustee(); dessiner(); });
  observateur.observe(conteneur);

  return {
    definirModele(m) { modele = m; if (selection && !selectionValide(m, selection)) { selection = null; surSelection(null); } dessiner(); },
    definirFond(f) { fond = f; dessiner(); },
    definirMode(m) { mode = m; brouillon = null; dessiner(); svg.style.cursor = m === "selection" ? "" : "crosshair"; },
    selectionner,
    supprimerSelection,
    cadrer,
    zoomer,
    terminerTrace,
    finirTrace() { if (mode === "piece") fermerPiece(); else terminerTrace(); },
    afficherCotes(v) { toutesCotes = Boolean(v); dessiner(); },
    opaciteFond(v) { opaciteFond = v; dessiner(); },
    definirVitesseZoom(pourcent) { if (Number.isFinite(pourcent) && pourcent > 0) vitesseZoom = pourcent / 100; },
    opaciteMaquette(v) { opaciteMaquette = Math.min(Math.max(Number(v), 0), 1); dessiner(); },
    afficherFond(v) { fondVisible = Boolean(v); dessiner(); },
    detruire() { observateur.disconnect(); svg.remove(); }
  };
}

function selectionValide(modele, sel) {
  if (sel.type === "mur") return Boolean(murDe(modele, sel.id));
  if (sel.type === "noeud") return Boolean(noeudDe(modele, sel.id));
  if (sel.type === "piece") return (modele.pieces || []).some((p) => p.id === sel.id);
  if (sel.type === "dalle") return true;
  return modele.ouvertures.some((o) => o.id === sel.id);
}
