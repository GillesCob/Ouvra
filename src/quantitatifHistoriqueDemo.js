// Historique de demonstration du Quantitatif (28/10, retour de recette mobile) : deux demandes deja passees, bien fournies (date, intitule, tableau de lignes),
// pour que le menu « Historique » ne soit pas vide a la premiere ouverture. Ce sont des quantites FICTIVES de demonstration, calculees par le vrai moteur
// (calculer) sur une liste d'elements synthetiques : le rapport a exactement la forme d'un rapport reel, il se rouvre et s'exporte comme lui.
// Amorcage une seule fois par navigateur (drapeau dans le stockage) : une demonstration supprimee ne revient pas.

import { calculer } from "./quantitatif.js";
import { construireRapport } from "./quantitatifRapport.js";

export const CLE_DRAPEAU_DEMO = "ouvra-quantitatif-historique-demo";
const JOUR = 24 * 3600 * 1000;

const filtres = (f) => ({ typesIfc: [], niveaux: [], maquettes: [], noms: [], ...f });

// [typeIfc, niveau, nombre d'elements] par maquette.
const ARCHITECTURE = [
  ["IfcDoor", "Level 1", 64], ["IfcDoor", "Level 2", 58], ["IfcDoor", "Level 3", 47], ["IfcDoor", "Level 4", 31],
  ["IfcWindow", "Level 1", 42], ["IfcWindow", "Level 2", 40], ["IfcWindow", "Level 3", 36], ["IfcWindow", "Level 4", 22],
  ["IfcWallStandardCase", "Level 1", 188], ["IfcWallStandardCase", "Level 2", 172], ["IfcWallStandardCase", "Level 3", 141], ["IfcWallStandardCase", "Level 4", 96]
];
const MECANIQUE = [
  ["IfcDuctSegment", "Level 1", 120], ["IfcDuctSegment", "Level 2", 134], ["IfcDuctSegment", "Level 3", 98], ["IfcDuctSegment", "Level 4", 61], ["IfcDuctSegment", "Level 5", 27],
  ["IfcDuctFitting", "Level 1", 86], ["IfcDuctFitting", "Level 2", 97], ["IfcDuctFitting", "Level 3", 70], ["IfcDuctFitting", "Level 4", 44], ["IfcDuctFitting", "Level 5", 19],
  ["IfcPipeSegment", "Level 1", 210], ["IfcPipeSegment", "Level 2", 188], ["IfcPipeSegment", "Level 3", 143], ["IfcPipeSegment", "Level 4", 90], ["IfcPipeSegment", "Level 5", 38],
  ["IfcValve", "Level 1", 34], ["IfcValve", "Level 2", 41], ["IfcValve", "Level 3", 29], ["IfcValve", "Level 4", 18], ["IfcValve", "Level 5", 7]
];

function elementsSynthetiques(table, maquette, maquetteId) {
  const elements = [];
  for (const [typeIfc, niveau, n] of table) {
    for (let i = 0; i < n; i += 1) elements.push({ id: maquetteId + ":" + typeIfc + ":" + niveau + ":" + i, nom: typeIfc, famille: typeIfc, typeIfc, niveau, maquette, maquetteId, boite: null, quantites: null });
  }
  return elements;
}

// Les deux demandes de demonstration : la plus recente d'abord ; `ilYa` en jours. Chacune devient un rapport complet.
const DEMANDES = [
  {
    id: "demo-quantitatif-cvc",
    phrase: "Compte les gaines, les raccords de gaine, les tuyaux et les vannes de la maquette mécanique, par niveau et par type",
    ilYa: 1,
    heure: 16,
    elements: () => elementsSynthetiques(MECANIQUE, "Mechanical (CVC)", "hosp-mep"),
    requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDuctSegment", "IfcDuctFitting", "IfcPipeSegment", "IfcValve"], maquettes: ["Mechanical (CVC)"] }), regroupements: ["niveau", "typeIfc"] }
  },
  {
    id: "demo-quantitatif-architecture",
    phrase: "Combien de portes, de fenêtres et de murs par niveau ?",
    ilYa: 4,
    heure: 10,
    elements: () => elementsSynthetiques(ARCHITECTURE, "Architecture", "hosp-arch"),
    requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDoor", "IfcWindow", "IfcWallStandardCase"] }), regroupements: ["niveau", "typeIfc"] }
  }
];

// versions : [{ id, label, url, empreinte }] des maquettes chargees (les rapports de demonstration y prennent l'empreinte reelle ; sans elle, version « inconnue »).
export function rapportsDemo({ maintenant = new Date(), versions = [] } = {}) {
  return DEMANDES.map((d) => {
    const resultat = calculer(d.elements(), d.requete);
    const jour = new Date(maintenant.getTime() - d.ilYa * JOUR);
    jour.setHours(d.heure, 12, 0, 0);
    return construireRapport({ resultat, phrase: d.phrase, calculeLe: jour, versions, id: d.id });
  });
}

// Amorce l'historique avec la demonstration, une seule fois par navigateur, et seulement s'il est vide. Ne leve jamais.
export async function amorcerHistoriqueDemo({ historique, versions = async () => [], stockage = null, maintenant = new Date() }) {
  const acces = () => { try { return stockage || globalThis.localStorage || null; } catch { return null; } };
  try {
    const s = acces();
    if (!s || s.getItem(CLE_DRAPEAU_DEMO)) return false;
    s.setItem(CLE_DRAPEAU_DEMO, "1");
    if ((await historique.lister()).length) return false;
    const rapports = rapportsDemo({ maintenant, versions: await versions() });
    for (const r of rapports) await historique.ajouter(r);
    return true;
  } catch {
    return false;
  }
}
