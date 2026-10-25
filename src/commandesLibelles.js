// Viewer par commande (24/10) : noms lisibles des types IFC et des niveaux, communs au moteur, aux selecteurs et aux comptes rendus.

// Meme regroupement que les niveaux du drawer du Viewer (canonicalStoreyName, src/main.js) : « Level 2 Ceiling » et « Level 2 TOS » sont le niveau
// « Level 2 », « Level 7A » le niveau « Level 7 ». A garder alignee sur cette fonction.
export function canoniqueNiveau(nom) {
  return String(nom || "")
    .replace(/\s+Ceiling$/i, "")
    .replace(/\s+TOS$/i, "")
    .replace(/^(Level\s+\d+)[A-Z]$/i, "$1")
    .trim();
}

// Libelles francais des types IFC, pour les comptes rendus seulement (la commande porte toujours le type IFC). Types presents dans les maquettes
// de l'hopital (lus dans les metadonnees des maquettes, public/models/hospital/*.json). Un type inconnu s'affiche sous son nom IFC.
const LIBELLES_TYPES_IFC = {
  IfcDuctSegment: "gaines",
  IfcDuctFitting: "raccords de gaine",
  IfcPipeSegment: "tuyaux",
  IfcPipeFitting: "raccords de tuyau",
  IfcValve: "vannes",
  IfcWallStandardCase: "murs",
  IfcWall: "murs",
  IfcCurtainWall: "murs-rideaux",
  IfcCovering: "faux plafonds et revêtements",
  IfcDoor: "portes",
  IfcWindow: "fenêtres",
  IfcColumn: "poteaux",
  IfcBeam: "poutres",
  IfcSlab: "dalles",
  IfcFooting: "fondations",
  IfcStair: "escaliers",
  IfcRailing: "garde-corps",
  IfcRoof: "toitures",
  IfcFurniture: "mobilier",
  IfcFlowSegment: "segments de réseau",
  IfcFlowFitting: "raccords de réseau",
  IfcFlowTerminal: "terminaux de réseau",
  IfcFlowController: "organes de réseau",
  IfcBuildingElementProxy: "éléments génériques"
};
export const libelleTypeIfc = (type) => LIBELLES_TYPES_IFC[type] || type;

// « Level 2 » -> « niveau 2 » ; un autre nom est repris tel quel.
export function libelleNiveauCourt(nom) {
  const m = /^\s*(?:level|niveau)\s+(\S+)\s*$/i.exec(nom);
  return m ? "niveau " + m[1] : nom;
}

export const pluriel = (n, un, plusieurs) => n.toLocaleString("fr-FR") + " " + (n > 1 ? plusieurs : un);
