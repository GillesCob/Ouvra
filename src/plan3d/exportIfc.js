// 2D -> 3D (25/10) : export du modele (src/plan3d/modele.js) en IFC4, texte STEP. Module pur, aucune dependance : le fichier est ecrit a la main.
// Elements produits, tous rattaches a un IfcBuildingStorey (IfcProject > IfcSite > IfcBuilding > IfcBuildingStorey) :
//   IfcWall (+ Pset_WallCommon.IsExternal), IfcSlab (dalle, contour des murs exterieurs), IfcOpeningElement (reserve dans le mur, IfcRelVoidsElement),
//   IfcDoor / IfcWindow (remplissent la reserve, IfcRelFillsElement), IfcSpace (une par piece, avec Qto_SpaceBaseQuantities.NetFloorArea et la
//   surface lue sur le plan dans Ouvra_Plan.SurfaceLueSurLePlan). Geometrie : extrusions de profils (IfcExtrudedAreaSolid), unites en metres.
// Repere : sur le plan 2D, y croit vers le BAS de l'ecran ; en IFC, y croit vers le nord, donc vers le HAUT d'un plan. L'export inverse y : vue de dessus,
// la maquette a la meme orientation que le plan (le haut du plan est le nord).
// Les identifiants IfcGloballyUniqueId sont deduits de l'id du modele (murs M1, pieces P3...) : un meme modele donne toujours le meme fichier,
// donc deux exports successifs se comparent ligne a ligne dans Git.
// Limites assumees de cette version : un seul niveau, les murs ne sont pas prolonges aux angles (longueur = ligne d'axe), pas d'IfcRelSpaceBoundary
// (une piece ne connait pas encore ses murs), pas de materiaux.

import { extremites, longueurMur, contourExterieur, surfaceContour } from "./modele.js";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

// 128 bits deduits d'une cle par quatre hachages FNV-1a (graines differentes), puis codage IFC de 22 caracteres (2 bits + 21 x 6 bits).
export function guidIfc(cle) {
  let n = 0n;
  for (let graine = 0; graine < 4; graine++) {
    let h = (0x811c9dc5 ^ (graine * 0x9e3779b1)) >>> 0;
    for (const c of `${graine}|${cle}`) {
      h ^= c.codePointAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    n = (n << 32n) | BigInt(h);
  }
  let sortie = ALPHABET[Number((n >> 126n) & 3n)];
  for (let i = 0; i < 21; i++) sortie += ALPHABET[Number((n >> BigInt(120 - 6 * i)) & 63n)];
  return sortie;
}

// Chaine STEP : apostrophe doublee, antislash double, caracteres hors ASCII en \X2\....\X0\ (4 chiffres hexadecimaux par caractere du plan de base) ou \X4\........\X0\ au-dela (8 chiffres).
export function texteStep(s) {
  const propre = String(s).replace(/\\/g, "\\\\").replace(/'/g, "''");
  let sortie = "";
  let hors = "";
  const fermer = () => { if (hors) { sortie += `\\X2\\${hors}\\X0\\`; hors = ""; } };
  for (const caractere of propre) {
    const code = caractere.codePointAt(0);
    if (code >= 32 && code < 127) { fermer(); sortie += caractere; } else if (code > 0xffff) { fermer(); sortie += `\\X4\\${code.toString(16).toUpperCase().padStart(8, "0")}\\X0\\`; } else hors += code.toString(16).toUpperCase().padStart(4, "0");
  }
  fermer();
  return `'${sortie}'`;
}

// Reel STEP : toujours avec un point decimal, jamais de notation exponentielle ni de -0.
export function reel(n) {
  if (!Number.isFinite(n)) throw new Error(`Valeur non finie dans le modele : ${n}`);
  if (Math.abs(n) >= 1e15) throw new Error(`Valeur trop grande pour l'IFC : ${n}`);
  const v = Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6;
  const t = String(v);
  return t.includes(".") ? t : `${t}.`;
}

const liste = (refs) => `(${refs.join(",")})`;

export function genererIfc(modele, { nomProjet = "Ouvra 2D-3D", date = new Date() } = {}) {
  const lignes = [];
  let compteur = 0;
  const ajouter = (corps) => { compteur += 1; lignes.push(`#${compteur}=${corps};`); return `#${compteur}`; };
  const pt3 = (x, y, z) => ajouter(`IFCCARTESIANPOINT((${reel(x)},${reel(y)},${reel(z)}))`);
  const pt2 = (x, y) => ajouter(`IFCCARTESIANPOINT((${reel(x)},${reel(y)}))`);
  const dir3 = (x, y, z) => ajouter(`IFCDIRECTION((${reel(x)},${reel(y)},${reel(z)}))`);
  const axe3 = (origine, z = null, x = null) => ajouter(`IFCAXIS2PLACEMENT3D(${origine},${z || "$"},${x || "$"})`);
  const placement = (parent, axe) => ajouter(`IFCLOCALPLACEMENT(${parent || "$"},${axe})`);
  const guid = (cle) => `'${guidIfc(cle)}'`;

  // ---- Contexte, unites, projet ----
  const origine = pt3(0, 0, 0);
  const dirZ = dir3(0, 0, 1);
  const dirZNeg = dir3(0, 0, -1);
  const axeMonde = axe3(origine);
  const contexte = ajouter(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${axeMonde},$)`);
  const corps = ajouter(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${contexte},$,.MODEL_VIEW.,$)`);
  const unites = ajouter(`IFCUNITASSIGNMENT(${liste([
    ajouter("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)"),
    ajouter("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)"),
    ajouter("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)"),
    ajouter("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)")
  ])})`);
  const projet = ajouter(`IFCPROJECT(${guid("projet")},$,${texteStep(nomProjet)},$,$,$,$,${liste([contexte])},${unites})`);
  const plSite = placement(null, axeMonde);
  const site = ajouter(`IFCSITE(${guid("site")},$,'Terrain',$,$,${plSite},$,$,.ELEMENT.,$,$,$,$,$)`);
  const plBatiment = placement(plSite, axeMonde);
  const batiment = ajouter(`IFCBUILDING(${guid("batiment")},$,${texteStep("Bâtiment")},$,$,${plBatiment},$,$,.ELEMENT.,$,$,$)`);
  const plNiveau = placement(plBatiment, axeMonde);
  const nomNiveau = texteStep(modele.niveau.nom || "RDC");
  const niveau = ajouter(`IFCBUILDINGSTOREY(${guid("niveau")},$,${nomNiveau},$,$,${plNiveau},$,${nomNiveau},.ELEMENT.,0.)`);
  const aggreger = (cle, parent, enfants) => ajouter(`IFCRELAGGREGATES(${guid(cle)},$,$,$,${parent},${liste(enfants)})`);
  aggreger("rel-projet-site", projet, [site]);
  aggreger("rel-site-batiment", site, [batiment]);
  aggreger("rel-batiment-niveau", batiment, [niveau]);

  const H = modele.niveau.hauteur;
  const origineLocale = pt3(0, 0, 0);
  const axeLocal = axe3(origineLocale);

  // Forme : un profil extrude. profil = reference d'un IfcProfileDef ; axe = IfcAxis2Placement3D de l'extrusion ; direction = IfcDirection.
  const forme = (profil, profondeur, direction = dirZ, axe = axeLocal) => {
    const solide = ajouter(`IFCEXTRUDEDAREASOLID(${profil},${axe},${direction},${reel(profondeur)})`);
    const representation = ajouter(`IFCSHAPEREPRESENTATION(${corps},'Body','SweptSolid',${liste([solide])})`);
    return ajouter(`IFCPRODUCTDEFINITIONSHAPE($,$,${liste([representation])})`);
  };
  const rectangle = (cx, cy, largeur, hauteurProfil) => ajouter(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${ajouter(`IFCAXIS2PLACEMENT2D(${pt2(cx, cy)},$)`)},${reel(largeur)},${reel(hauteurProfil)})`);
  const polygone = (points) => {
    const fermes = [...points, points[0]].map((p) => pt2(p.x, -p.y)); // meme inversion de y que pour les murs
    return ajouter(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${ajouter(`IFCPOLYLINE(${liste(fermes)})`)})`);
  };
  const propriete = (nom, valeur) => ajouter(`IFCPROPERTYSINGLEVALUE(${texteStep(nom)},$,${valeur},$)`);
  const jeuDePropriete = (cle, nom, proprietes, cibles) => {
    const jeu = ajouter(`IFCPROPERTYSET(${guid(cle)},$,${texteStep(nom)},$,${liste(proprietes)})`);
    ajouter(`IFCRELDEFINESBYPROPERTIES(${guid(`${cle}-rel`)},$,$,$,${liste(cibles)},${jeu})`);
  };

  // Informations libres de l'element (src/plan3d/modele.js, infos) : un jeu de proprietes « Ouvra_Infos », texte, seulement s'il y en a.
  const infosLibres = (cle, element, infos) => {
    const valides = (infos || []).filter((i) => i && i.cle);
    if (valides.length) jeuDePropriete(`${cle}-infos`, "Ouvra_Infos", valides.map((i) => propriete(i.cle, `IFCTEXT(${texteStep(i.valeur)})`)), [element]);
  };

  const contenus = []; // elements rattaches au niveau (IfcRelContainedInSpatialStructure)

  // ---- Murs, ouvertures, portes, fenetres ----
  for (const mur of modele.murs) {
    const e = extremites(modele, mur);
    const L = longueurMur(modele, mur);
    if (!e || L < 1e-6) continue;
    const ux = (e.b.x - e.a.x) / L;
    const uy = (e.b.y - e.a.y) / L;
    const plMur = placement(plNiveau, axe3(pt3(e.a.x, -e.a.y, 0), dirZ, dir3(ux, -uy, 0))); // y du plan vers le bas, y IFC vers le nord : on inverse
    const ref = ajouter(`IFCWALL(${guid(`mur-${mur.id}`)},$,${texteStep(`Mur ${mur.id}`)},$,$,${plMur},${forme(rectangle(L / 2, 0, L, mur.epaisseur), H)},$,.STANDARD.)`);
    contenus.push(ref);
    infosLibres(`mur-${mur.id}`, ref, mur.infos);
    jeuDePropriete(`mur-${mur.id}-pset`, "Pset_WallCommon", [propriete("IsExternal", `IFCBOOLEAN(${mur.type === "exterieur" ? ".T." : ".F."})`)], [ref]);
    for (const o of modele.ouvertures.filter((x) => x.mur === mur.id)) {
      const decalage = Math.min(Math.max(o.decalage, 0), L);
      const largeur = Math.min(o.largeur, L - decalage);
      if (largeur <= 1e-6) continue;
      const hauteur = Math.min(o.hauteur, H - o.allege);
      if (hauteur <= 1e-6) continue;
      const plOuverture = placement(plMur, axe3(pt3(decalage, 0, o.allege)));
      const reserve = ajouter(`IFCOPENINGELEMENT(${guid(`ouv-${o.id}-reserve`)},$,${texteStep(`Réserve ${o.id}`)},$,$,${plOuverture},${forme(rectangle(largeur / 2, 0, largeur, mur.epaisseur + 0.02), hauteur)},$,.OPENING.)`);
      ajouter(`IFCRELVOIDSELEMENT(${guid(`ouv-${o.id}-vide`)},$,$,$,${ref},${reserve})`);
      const epaisseurCadre = Math.min(mur.epaisseur, 0.06);
      const geometrie = forme(rectangle(largeur / 2, 0, largeur, epaisseurCadre), hauteur);
      const nom = texteStep(`${{ porte: "Porte", fenetre: "Fenêtre", coulissante: "Porte coulissante" }[o.genre]} ${o.id}`);
      const element = o.genre === "porte" || o.genre === "coulissante"
        ? ajouter(`IFCDOOR(${guid(`ouv-${o.id}`)},$,${nom},$,$,${plOuverture},${geometrie},$,${reel(hauteur)},${reel(largeur)},.DOOR.,${o.genre === "coulissante" ? ".SLIDING_TO_LEFT." : ".NOTDEFINED."},$)`)
        : ajouter(`IFCWINDOW(${guid(`ouv-${o.id}`)},$,${nom},$,$,${plOuverture},${geometrie},$,${reel(hauteur)},${reel(largeur)},.WINDOW.,.NOTDEFINED.,$)`);
      ajouter(`IFCRELFILLSELEMENT(${guid(`ouv-${o.id}-remplit`)},$,$,$,${reserve},${element})`);
      infosLibres(`ouv-${o.id}`, element, o.infos);
      contenus.push(element);
    }
  }

  // ---- Dalle ----
  const ordre = contourExterieur(modele);
  if (ordre && modele.niveau.epaisseurDalle > 0) {
    const points = ordre.map((id) => modele.noeuds.find((n) => n.id === id));
    const plDalle = placement(plNiveau, axeMonde);
    contenus.push(ajouter(`IFCSLAB(${guid("dalle")},$,'Dalle',$,$,${plDalle},${forme(polygone(points), modele.niveau.epaisseurDalle, dirZNeg)},$,.FLOOR.)`));
  }

  // ---- Pieces ----
  const espaces = [];
  for (const piece of modele.pieces || []) {
    const surface = surfaceContour(piece.contour);
    const plPiece = placement(plNiveau, axeMonde);
    const nom = texteStep(piece.nom);
    const ref = ajouter(`IFCSPACE(${guid(`piece-${piece.id}`)},$,${nom},$,$,${plPiece},${forme(polygone(piece.contour), H)},${nom},.ELEMENT.,.INTERNAL.,$)`);
    espaces.push(ref);
    infosLibres(`piece-${piece.id}`, ref, piece.infos);
    const quantite = ajouter(`IFCQUANTITYAREA('NetFloorArea',$,$,${reel(surface)},$)`);
    const quantites = ajouter(`IFCELEMENTQUANTITY(${guid(`piece-${piece.id}-qto`)},$,'Qto_SpaceBaseQuantities',$,$,${liste([quantite])})`);
    ajouter(`IFCRELDEFINESBYPROPERTIES(${guid(`piece-${piece.id}-qto-rel`)},$,$,$,${liste([ref])},${quantites})`);
    if (piece.surfacePlan != null) jeuDePropriete(`piece-${piece.id}-plan`, "Ouvra_Plan", [propriete("SurfaceLueSurLePlan", `IFCAREAMEASURE(${reel(piece.surfacePlan)})`)], [ref]);
  }
  if (espaces.length) aggreger("rel-niveau-pieces", niveau, espaces);
  if (contenus.length) ajouter(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid("rel-niveau-elements")},$,$,$,${liste(contenus)},${niveau})`);

  const horodatage = date.toISOString().slice(0, 19);
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME('plan-ouvra.ifc','${horodatage}',('Ouvra'),('Ouvra'),'Ouvra 2D-3D','Ouvra','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    ...lignes,
    "ENDSEC;",
    "END-ISO-10303-21;",
    ""
  ].join("\n");
}
