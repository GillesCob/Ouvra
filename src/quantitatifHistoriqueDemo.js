// Historique de demonstration du Quantitatif (28/10, retour de recette mobile) : deux demandes deja passees, bien fournies (date, intitule, tableau de lignes),
// pour que le menu « Historique » ne soit pas vide a la premiere ouverture. Ce sont des quantites FICTIVES de demonstration, calculees par le vrai moteur
// (calculer) sur une liste d'elements synthetiques : le rapport a exactement la forme d'un rapport reel, il se rouvre et s'exporte comme lui.
// Amorcage une seule fois par navigateur et par version du drapeau : une demonstration supprimee ne revient pas.

import { calculer } from "./quantitatif.js";
import { construireRapport } from "./quantitatifRapport.js";

export const CLE_DRAPEAU_DEMO = "ouvra-quantitatif-historique-demo";
const VERSION_DEMO = "3";
// Empreinte factice d'une version anterieure des maquettes : la demonstration « obsolete » ne correspond JAMAIS a la version courante, quel que soit le moment du chargement.
const EMPREINTE_ANCIENNE = "etag:demo-version-anterieure";
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
    aJour: true, // la demonstration « a jour » : ses empreintes suivent celles des maquettes courantes (voir resynchroniser)
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
    const rapport = construireRapport({ resultat, phrase: d.phrase, calculeLe: jour, versions, id: d.id });
    if (!d.aJour) rapport.maquettes = rapport.maquettes.map((m) => ({ ...m, empreinte: EMPREINTE_ANCIENNE }));
    return rapport;
  });
}

// Remet la demonstration « a jour » en phase avec les empreintes COURANTES des maquettes (elles changent a chaque deploiement) : elle reste « À jour »
// de facon deterministe. Ne touche ni aux demonstrations obsoletes ni aux rapports de l'utilisateur. Sans empreinte courante connue, ne change rien.
// Rend true si une entree a ete reecrite.
async function resynchroniser(historique, versions) {
  let change = false;
  for (const d of DEMANDES.filter((x) => x.aJour)) {
    const entree = await historique.obtenir(d.id);
    if (!entree) continue;
    const courantes = new Map(versions.map((v) => [v.id, v.empreinte]));
    if (!entree.rapport.maquettes.every((m) => courantes.get(m.id))) continue;
    if (entree.rapport.maquettes.every((m) => m.empreinte === courantes.get(m.id))) continue;
    const rapport = { ...entree.rapport, maquettes: entree.rapport.maquettes.map((m) => ({ ...m, empreinte: courantes.get(m.id) })) };
    change = (await historique.ajouter(rapport)).ok || change;
  }
  return change;
}

// Amorce les demonstrations (reecrites par identifiant « demo-... », jamais une entree de l'utilisateur ecrasee ni dupliquee), une seule fois par version du drapeau ;
// ensuite, a chaque chargement, resynchronise seulement la demonstration « a jour ».
// Avant le 28/10 le drapeau etait pose des qu'une entree utilisateur existait : ces navigateurs n'avaient aucune demonstration. Le drapeau versionne
// les reamorce proprement une fois. Le drapeau n'est pose qu'apres l'ecriture reussie. Ne leve jamais ; rend true si au moins une demonstration a ete ajoutee.
export async function amorcerHistoriqueDemo({ historique, versions = async () => [], stockage = null, maintenant = new Date() }) {
  const acces = () => { try { return stockage || globalThis.localStorage || null; } catch { return null; } };
  try {
    const s = acces();
    if (!s) return false;
    const courantes = await versions();
    if (s.getItem(CLE_DRAPEAU_DEMO) === VERSION_DEMO) return await resynchroniser(historique, courantes);
    // Changement de version du drapeau : les demonstrations (identifiants « demo-... », jamais les rapports de l'utilisateur) sont reecrites a leur etat voulu.
    const manquants = rapportsDemo({ maintenant, versions: courantes });
    let ajoute = false;
    for (const r of manquants) ajoute = (await historique.ajouter(r)).ok || ajoute;
    if (ajoute) s.setItem(CLE_DRAPEAU_DEMO, VERSION_DEMO);
    return ajoute;
  } catch {
    return false;
  }
}
