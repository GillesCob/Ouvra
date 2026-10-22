// Phrases d'exemple du panneau « IA » de la page Collision (22/10), pour tester les regles sans IA branchee (mode hors IA du cadrage).
// Chaque exemple = une demande en francais naturel + la regle au format du moteur (src/reglesCollision.js), construite sur les vraies donnees
// de l'hopital : types IFC (IfcWallStandardCase, IfcDuctSegment, IfcCovering, IfcValve), niveaux (Level 1 a 5) et noms Revit (Diffuser).
// Dans les collisions de l'hopital, l'element A vient de la maquette Architecture et l'element B de la maquette Mecanique.
// Pour changer un exemple, il suffit d'editer ce fichier : chaque regle doit donner au moins une collision listee dans la modale.

export const EXEMPLES_REGLES = [
  {
    demande: "Passe en haute priorité les collisions qui concernent des murs du niveau 1",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcWallStandardCase" }, { champ: "niveau", contient: "Level 1" }] },
    action: { champ: "priorite", valeur: "haute" }
  },
  {
    demande: "Passe en urgent les collisions dont le deuxième élément est une gaine",
    filtre: { portee: "b", criteres: [{ champ: "typeIfc", contient: "IfcDuctSegment" }] },
    action: { champ: "priorite", valeur: "urgente" }
  },
  {
    demande: "Confirme les collisions dont les deux éléments sont au niveau 1",
    filtre: { portee: "les_deux", criteres: [{ champ: "niveau", contient: "Level 1" }] },
    action: { champ: "statut", valeur: "confirme" }
  },
  {
    demande: "Écarte les collisions qui concernent un diffuseur",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "nom", contient: "Diffuser" }] },
    action: { champ: "statut", valeur: "ecarte" }
  },
  {
    demande: "Passe en basse priorité les collisions dont le premier élément est un faux plafond",
    filtre: { portee: "a", criteres: [{ champ: "typeIfc", contient: "IfcCovering" }] },
    action: { champ: "priorite", valeur: "basse" }
  },
  {
    demande: "Passe en urgent les collisions qui concernent une vanne",
    filtre: { portee: "un_des_deux", criteres: [{ champ: "typeIfc", contient: "IfcValve" }] },
    action: { champ: "priorite", valeur: "urgente" }
  }
];
