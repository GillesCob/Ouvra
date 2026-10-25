// Phrases toutes faites de la page Quantitatif (24/10), pour tester sans IA branchee et pour montrer ce qu'on peut demander.
// Calquees sur src/reglesExemples.js : chaque exemple = une demande en francais naturel + la requete du moteur (src/quantitatif.js), construite sur les
// vraies donnees de l'hopital (types IFC, niveaux « Level 1 » a « Level 7 », maquettes Architecture / Mechanical (CVC)).
// Une phrase identique (sans accents, casse ni ponctuation) est reconnue en local par reconnaitreExemple : aucun appel a l'IA.
// Ajouter un exemple = une entree ici ; tests/quantitatifExemples.test.js verifie sur les vraies metadonnees qu'elle donne au moins un element.
// Les exemples « estimes » (longueur, surface) donnent leur resultat une fois les maquettes chargees dans le Viewer (geometrie).

import { normaliser } from "./reglesCollision.js";

const filtres = (f) => ({ typesIfc: [], niveaux: [], maquettes: [], noms: [], ...f });

export const EXEMPLES_QUANTITATIF = [
  { demande: "Combien de portes au niveau 2 ?", requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDoor"], niveaux: ["Level 2"] }), regroupements: [] } },
  { demande: "Le nombre de gaines par niveau", requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcDuctSegment", "IfcDuctFitting"] }), regroupements: ["niveau"] } },
  { demande: "Liste des vannes de la maquette mécanique", requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcValve"], maquettes: ["Mechanical (CVC)"] }), regroupements: ["famille"] } },
  { demande: "Combien de murs par niveau et par type ?", requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcWallStandardCase"] }), regroupements: ["niveau", "famille"] } },
  { demande: "Quantité de faux plafonds du niveau 1", requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcCovering"], niveaux: ["Level 1"] }), regroupements: [] } },
  { demande: "Longueur totale des tuyaux (estimée)", requete: { mesure: "longueur_estimee", filtres: filtres({ typesIfc: ["IfcPipeSegment"] }), regroupements: [] } },
  { demande: "Nombre de poteaux par niveau et par maquette", requete: { mesure: "nombre", filtres: filtres({ typesIfc: ["IfcColumn"] }), regroupements: ["niveau", "maquette"] } },
  { demande: "Surface estimée des faux plafonds par niveau", requete: { mesure: "surface_estimee", filtres: filtres({ typesIfc: ["IfcCovering"] }), regroupements: ["niveau"] } }
];

const cle = (phrase) => normaliser(phrase).replace(/[^a-z0-9]+/g, " ").trim();

// Requete de l'exemple dont la phrase est identique, ou null.
export function reconnaitreExemple(phrase, exemples = EXEMPLES_QUANTITATIF) {
  const voulue = cle(phrase);
  if (!voulue) return null;
  const trouve = exemples.find((e) => cle(e.demande) === voulue);
  return trouve ? JSON.parse(JSON.stringify(trouve.requete)) : null;
}
