// Phrases toutes faites du bouton « IA » du Viewer (24/10), calquees sur src/reglesExemples.js : une demande en francais naturel + la commande
// au format du moteur (src/commandesViewer.js), construites sur les vraies donnees de l'hopital.
// Types IFC, niveaux et maquettes lus dans les metadonnees des maquettes (public/models/hospital/*.json) : IfcDuctSegment et IfcDuctFitting
// (gaines et leurs raccords, maquette Mechanical), IfcPipeSegment et IfcPipeFitting (tuyaux), IfcValve (vannes), IfcCovering (faux plafonds,
// maquette Architecture), IfcWallStandardCase et IfcWall (murs), niveaux Level 1 a Level 3 (« Level 2 Ceiling » et « Level 2 TOS » comptent dans
// « Level 2 »), maquette « Mechanical (CVC) » (libelle de la maquette, src/main.js).
// Quand l'utilisateur envoie EXACTEMENT une de ces phrases (a la casse, aux accents et a la ponctuation pres), la commande est reconnue ici, sans
// appel a l'IA : le Viewer reste utilisable sans reseau ni budget, et chaque appel evite est gratuit.
// Les phrases couvrent chaque famille de presentation (niveau_repere, isoler, focus, transparence, masquer) ; « zone » n'y figure pas car une zone
// n'existe que si l'utilisateur l'a definie. Pour changer un exemple, il suffit d'editer ce fichier.

import { normaliser } from "./reglesCollision.js";

export const EXEMPLES_COMMANDES = [
  {
    // Phrase de demo (28/10) : une seule phrase agit sur les niveaux ET sur les maquettes (la Structure se decoche, l'Architecture et la CVC restent).
    demande: "Affiche uniquement le niveau 2 avec les maquettes CVC et Architecture",
    relecture: "Afficher les éléments du niveau 2 des maquettes Architecture et Mechanical (CVC)",
    commande: { action: "afficher", parametres: { niveaux: ["Level 2"], maquettes: ["Architecture", "Mechanical (CVC)"] } }
  },
  {
    demande: "Affiche-moi les gaines au niveau 2",
    relecture: "Afficher les gaines et raccords de gaine du niveau 2",
    commande: { action: "afficher", parametres: { typesIfc: ["IfcDuctSegment", "IfcDuctFitting"], niveaux: ["Level 2"], presentation: "niveau_repere" } }
  },
  {
    demande: "Montre-moi uniquement les vannes",
    relecture: "Afficher les vannes",
    commande: { action: "afficher", parametres: { typesIfc: ["IfcValve"] } }
  },
  {
    demande: "Affiche le niveau 3 seul",
    relecture: "Afficher le niveau 3",
    commande: { action: "afficher", parametres: { niveaux: ["Level 3"] } }
  },
  {
    demande: "Affiche uniquement la maquette Mécanique",
    relecture: "Afficher la maquette Mechanical (CVC)",
    commande: { action: "afficher", parametres: { maquettes: ["Mechanical (CVC)"] } }
  },
  {
    demande: "Mets en évidence les faux plafonds du niveau 1",
    relecture: "Mettre en évidence les faux plafonds et revêtements du niveau 1",
    commande: { action: "afficher", parametres: { typesIfc: ["IfcCovering"], niveaux: ["Level 1"], isoler: false, surbrillance: true } }
  },
  {
    // Vanne reelle de la maquette mecanique (public/models/hospital/legere/mechanical.json) ; le focus passe le modele en fantome autour d'elle.
    demande: "Montre-moi la vanne 1165462",
    relecture: "Montrer l'élément « M_Ball Valve - 50-150 mm:15 mm:1165462 »",
    commande: { action: "afficher", parametres: { elements: ["M_Ball Valve - 50-150 mm:15 mm:1165462"], presentation: "focus" } }
  },
  {
    demande: "Rends les murs transparents",
    relecture: "Rendre les murs transparents",
    commande: { action: "afficher", parametres: { typesIfc: ["IfcWallStandardCase", "IfcWall"], presentation: "transparence", cadrer: false } }
  },
  {
    demande: "Masque les faux plafonds et le mobilier",
    relecture: "Masquer les faux plafonds et revêtements et mobilier",
    commande: { action: "afficher", parametres: { typesIfc: ["IfcCovering", "IfcFurniture"], presentation: "masquer", cadrer: false } }
  },
  {
    demande: "Masque la structure",
    relecture: "Masquer la maquette Structure",
    commande: { action: "afficher", parametres: { maquettes: ["Structure"], presentation: "masquer", cadrer: false } }
  },
  {
    // Cumul : une commande ne touche que les criteres qu'elle mentionne (src/commandesVue.js). Ces trois phrases se jouent l'une apres l'autre.
    demande: "Ajoute le niveau 3",
    relecture: "Ajouter le niveau 3",
    commande: { action: "afficher", parametres: { niveaux: ["Level 3"], modeNiveaux: "ajouter" } }
  },
  {
    demande: "Enlève le niveau 2",
    relecture: "Retirer le niveau 2",
    commande: { action: "afficher", parametres: { niveaux: ["Level 2"], modeNiveaux: "retirer" } }
  },
  {
    demande: "Affiche uniquement la maquette Structure",
    relecture: "Afficher la maquette Structure",
    commande: { action: "afficher", parametres: { maquettes: ["Structure"] } }
  },
  {
    // Contexte : la selection (gaines du niveau 2, maquette mecanique) n'est jamais filtree ; seul le reste du niveau est limite a la structure, l'architecture est masquee.
    demande: "Affiche les gaines du niveau 2 avec la structure en contexte",
    relecture: "Afficher les gaines et raccords de gaine du niveau 2 avec la maquette Structure en contexte",
    commande: { action: "afficher", parametres: { typesIfc: ["IfcDuctSegment", "IfcDuctFitting"], niveaux: ["Level 2"], presentation: "niveau_repere", contexteMaquettes: ["Structure"] } }
  },
  {
    demande: "Réaffiche tout",
    relecture: "Tout réafficher",
    commande: { action: "tout_afficher" }
  }
];

// Forme comparable d'une phrase : sans casse, accents, ponctuation ni espaces en double.
const comparable = (texte) => normaliser(texte).replace(/[^a-z0-9]+/g, " ").trim();

// Commande de l'exemple dont la phrase est exactement celle-ci, ou null. Rend { demande, relecture, ...commande } comme le fait l'IA.
export function reconnaitreExemple(phrase, exemples = EXEMPLES_COMMANDES) {
  const cherchee = comparable(phrase);
  if (!cherchee) return null;
  const trouve = exemples.find((e) => comparable(e.demande) === cherchee);
  return trouve ? { ...trouve.commande, demande: phrase, relecture: trouve.relecture } : null;
}
