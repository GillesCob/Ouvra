// Phrases d'exemple du panneau « IA » de la page Collision (22/10), pour tester les regles sans IA branchee (mode hors IA du cadrage).
// Chaque exemple = une demande en francais naturel + la regle au format du moteur (src/reglesCollision.js), construite sur les vraies donnees
// de l'hopital : types IFC (IfcWallStandardCase, IfcDuctSegment, IfcCovering, IfcValve), niveaux (Level 1 a 5) et noms Revit (Diffuser).
// Dans les collisions de l'hopital, l'element A vient de la maquette Architecture et l'element B de la maquette Mecanique.
// Les phrases ne parlent jamais de « premier » ou de « deuxième » élément (retour de Gilles du 22/10) : elles disent ce qui est impliqué.
// Pour changer un exemple, il suffit d'editer ce fichier : chaque regle doit donner au moins une collision listee dans la modale.

export const EXEMPLES_REGLES = [
  {
    demande: "Passe en urgent toutes les collisions qui impliquent des gaines du niveau 2",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcDuctSegment" }, { champ: "niveau", contient: "Level 2" }] },
    action: { champ: "priorite", valeur: "urgente" }
  },
  {
    demande: "Passe en haute priorité les collisions qui impliquent des murs du niveau 1",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcWallStandardCase" }, { champ: "niveau", contient: "Level 1" }] },
    action: { champ: "priorite", valeur: "haute" }
  },
  {
    demande: "Passe en urgent toutes les collisions qui impliquent des gaines",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcDuctSegment" }] },
    action: { champ: "priorite", valeur: "urgente" }
  },
  {
    demande: "Confirme les collisions entre deux éléments du niveau 1",
    filtre: { portee: "les_deux", criteres: [{ champ: "niveau", contient: "Level 1" }] },
    action: { champ: "statut", valeur: "confirme" }
  },
  {
    demande: "Écarte les collisions qui impliquent un diffuseur",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "nom", contient: "Diffuser" }] },
    action: { champ: "statut", valeur: "ecarte" }
  },
  {
    demande: "Passe en basse priorité les collisions qui impliquent des faux plafonds",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcCovering" }] },
    action: { champ: "priorite", valeur: "basse" }
  },
  {
    demande: "Passe en urgent les collisions qui impliquent une vanne",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcValve" }] },
    action: { champ: "priorite", valeur: "urgente" }
  },
  {
    demande: "Affiche les collisions urgentes sans message depuis 3 jours",
    filtre: {
      portee: "un_des_deux",
      criteres: [],
      etat: { priorite: "urgente" },
      dates: [{ evenement: "message", presence: "aucun", periode: { type: "depuis", nombre: 3, unite: "jour" } }]
    },
    action: { champ: "afficher" }
  },
  {
    demande: "Affiche les collisions dont la priorité ou le statut a changé depuis le 16 octobre",
    filtre: {
      portee: "un_des_deux",
      criteres: [],
      dates: [{ evenement: "modification", presence: "au_moins_un", periode: { type: "depuis_le", date: "2026-10-16" } }]
    },
    action: { champ: "afficher" }
  },
  {
    demande: "Passe en urgent la collision 2",
    filtre: { portee: "un_des_deux", criteres: [], numeros: [2] },
    action: { champ: "priorite", valeur: "urgente" }
  }
];
