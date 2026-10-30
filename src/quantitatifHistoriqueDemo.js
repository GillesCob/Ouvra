// Historique de demonstration du Quantitatif (28/10, retour de recette mobile) : deux demandes deja passees, bien fournies (date, intitule, tableau de lignes),
// pour que le menu « Historique » ne soit pas vide a la premiere ouverture. Ce sont des quantites FICTIVES de demonstration, calculees par le vrai moteur
// (calculer) sur une liste d'elements synthetiques : le rapport a exactement la forme d'un rapport reel, il se rouvre et s'exporte comme lui.
// Amorcage une seule fois par navigateur et par version du drapeau : une demonstration supprimee ne revient pas.

import { calculer } from "./quantitatif.js";
import { construireRapport } from "./quantitatifRapport.js";
import { EMPREINTE_DEMO_A_JOUR, EMPREINTE_DEMO_ANCIENNE } from "./quantitatifVersions.js";

export const CLE_DRAPEAU_DEMO = "ouvra-quantitatif-historique-demo";
const VERSION_DEMO = "5"; // 29/10 : "5" reamorce les navigateurs qui avaient la version "4" (lignes fictives sans element reel)
const JOUR = 24 * 3600 * 1000;

const filtres = (f) => ({ typesIfc: [], niveaux: [], maquettes: [], noms: [], ...f });

// [typeIfc, niveau, nombre d'elements] par maquette. Les couples (type, niveau) et leurs nombres sont ceux des VRAIES maquettes de l'hopital (metadonnees
// de public/models/hospital/legere) : le bouton « Voir » d'une ligne isole alors de vrais elements (29/10 : la maquette CVC n'a aucune vanne au niveau 2, la ligne
// fictive « IfcValve, Level 2 » affichait « Rien à voir dans le Viewer »). Verrouille par tests/quantitatifHistoriqueDemo.test.js.
const ARCHITECTURE = [
  ["IfcDoor", "Level 1", 114], ["IfcDoor", "Level 2", 56], ["IfcDoor", "Level 3", 96], ["IfcDoor", "Level 4", 88], ["IfcDoor", "Level 5", 73], ["IfcDoor", "Level 6", 5], ["IfcDoor", "Level 7", 1],
  ["IfcWindow", "Level 1", 66], ["IfcWindow", "Level 2", 65],
  ["IfcWallStandardCase", "Level 1", 271], ["IfcWallStandardCase", "Level 2", 205], ["IfcWallStandardCase", "Level 3", 273], ["IfcWallStandardCase", "Level 4", 284],
  ["IfcWallStandardCase", "Level 5", 223], ["IfcWallStandardCase", "Level 6", 15], ["IfcWallStandardCase", "Level 7", 8]
];
const MECANIQUE = [
  ["IfcDuctSegment", "Level 1", 920], ["IfcDuctSegment", "Level 2", 20], ["IfcDuctSegment", "Level 3", 51], ["IfcDuctSegment", "Level 4", 1040], ["IfcDuctSegment", "Level 5", 43],
  ["IfcDuctFitting", "Level 1", 665], ["IfcDuctFitting", "Level 2", 712], ["IfcDuctFitting", "Level 3", 1134], ["IfcDuctFitting", "Level 4", 1174], ["IfcDuctFitting", "Level 5", 963],
  ["IfcPipeSegment", "Level 1", 275], ["IfcPipeSegment", "Level 2", 49], ["IfcPipeSegment", "Level 3", 129], ["IfcPipeSegment", "Level 4", 957], ["IfcPipeSegment", "Level 5", 87],
  ["IfcValve", "Level 1", 5], ["IfcValve", "Level 3", 96], ["IfcValve", "Level 4", 96], ["IfcValve", "Level 5", 66]
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
    phrase: "Compte les gaines, les raccords de gaine, les tuyaux et les vannes de la maquette CVC, par niveau et par type",
    ilYa: 1,
    heure: 16,
    aJour: true, // la demonstration « a jour » (empreinte factice a jour) ; l'autre est « obsolete »
    maquette: "Mechanical (CVC)", maquetteId: "hosp-mep",
    elements: () => elementsSynthetiques(MECANIQUE, "Mechanical (CVC)", "hosp-mep"),
    requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDuctSegment", "IfcDuctFitting", "IfcPipeSegment", "IfcValve"], maquettes: ["Mechanical (CVC)"] }), regroupements: ["niveau", "typeIfc"] }
  },
  {
    id: "demo-quantitatif-architecture",
    phrase: "Combien de portes, de fenêtres et de murs par niveau ?",
    ilYa: 4,
    heure: 10,
    maquette: "Architecture", maquetteId: "hosp-arch",
    elements: () => elementsSynthetiques(ARCHITECTURE, "Architecture", "hosp-arch"),
    requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDoor", "IfcWindow", "IfcWallStandardCase"] }), regroupements: ["niveau", "typeIfc"] }
  }
];

// Chaque demonstration porte des maquettes EXPLICITES (identifiants reels des maquettes de l'hopital) et une empreinte factice : son statut ne depend ni des
// en-tetes HEAD ni du moment du chargement des maquettes (au premier amorcage la liste des versions est souvent encore vide). Voir statutRapport.
export function rapportsDemo({ maintenant = new Date() } = {}) {
  return DEMANDES.map((d) => {
    const resultat = calculer(d.elements(), d.requete);
    const jour = new Date(maintenant.getTime() - d.ilYa * JOUR);
    jour.setHours(d.heure, 12, 0, 0);
    const rapport = construireRapport({ resultat, phrase: d.phrase, calculeLe: jour, versions: [], id: d.id });
    rapport.maquettes = [{ id: d.maquetteId, label: d.maquette, url: "", empreinte: d.aJour ? EMPREINTE_DEMO_A_JOUR : EMPREINTE_DEMO_ANCIENNE }];
    return rapport;
  });
}

// Amorce les demonstrations (reecrites par identifiant « demo-... », jamais une entree de l'utilisateur ecrasee ni dupliquee), une seule fois par version du drapeau ;
// Avant le 28/10 le drapeau etait pose des qu'une entree utilisateur existait : ces navigateurs n'avaient aucune demonstration. Le drapeau versionne
// les reamorce proprement une fois. Le drapeau n'est pose qu'apres l'ecriture reussie. Ne leve jamais ; rend true si au moins une demonstration a ete ajoutee.
export async function amorcerHistoriqueDemo({ historique, stockage = null, maintenant = new Date() }) {
  const acces = () => { try { return stockage || globalThis.localStorage || null; } catch { return null; } };
  try {
    const s = acces();
    if (!s) return false;
    if (s.getItem(CLE_DRAPEAU_DEMO) === VERSION_DEMO) return false;
    // Changement de version du drapeau : les demonstrations (identifiants « demo-... », jamais les rapports de l'utilisateur) sont reecrites a leur etat voulu.
    const manquants = rapportsDemo({ maintenant });
    let ajoute = false;
    for (const r of manquants) ajoute = (await historique.ajouter(r)).ok || ajoute;
    if (ajoute) s.setItem(CLE_DRAPEAU_DEMO, VERSION_DEMO);
    return ajoute;
  } catch {
    return false;
  }
}
