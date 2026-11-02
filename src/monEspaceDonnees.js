// Donnees de la page « Mon espace » (portage de vault-perso/Projets/Ouvra/mockups/ouvra-mon-espace.html, 02/11).
// Six widgets d'exemple, chacun ajoute par une phrase (la phrase est aussi celle qu'on retape dans la barre d'instruction pour le faire reapparaitre),
// des suggestions, et les textes de la page. Aucune donnee de projet reelle : tout est factice, pour evoquer l'idee.
// type : "vues" (points de vue), "alertes", "todo", "documents", "compteurs". zone : place dans la grille (grid-area du CSS).
export const TEXTES_ESPACE = {
  filIdees: "Idées d'évolution",
  filCourant: "Mon espace",
  titre: "Mon espace",
  sousTitre: "Ce que tu consultes souvent, au même endroit. Tu le composes en le disant ou en l'écrivant.",
  placeholder: "Dis ou écris ce que tu veux voir ici",
  journal: "Ce que tu as demandé",
  ajoutVue: "Ajouter une vue",
  ajoutVuePhrase: "Ajoute une vue : ",
  journalVide: "Aucune instruction pour l'instant."
};

export const SUGGESTIONS = [
  "Ajoute les alertes de la maquette structure",
  "Montre mes vues du niveau 2",
  "Fais-moi une todo de ce qu'on m'a demandé"
];

export const WIDGETS = [
  {
    id: "vues", zone: "vues", type: "vues", titre: "Mes points de vue", phrase: "Montre mes vues du niveau 2",
    // Chaque vue est produite par une phrase DEJA acceptee par le Viewer (src/commandesExemples.js, champ demande, recopiee a l'identique) et garde un cadrage de camera propre.
    items: [
      { id: "gaines", libelle: "Gaines niveau 2", instruction: "Affiche-moi les gaines au niveau 2", vignette: "gaines" },
      { id: "cvc", libelle: "CVC et Architecture", instruction: "Affiche uniquement le niveau 2 avec les maquettes CVC et Architecture", vignette: "cvc" },
      { id: "plafonds", libelle: "Faux plafonds niveau 1", instruction: "Mets en évidence les faux plafonds du niveau 1", vignette: "plafonds" }
    ]
  },
  {
    id: "alertes", zone: "alertes", type: "alertes", titre: "Alertes", phrase: "Ajoute les alertes de la maquette structure",
    items: [
      { heure: "09:12", texte: "Maquette Structure passée de V3 à V4 : 12 éléments modifiés, 3 supprimés" },
      { heure: "08:40", texte: "Document mis à jour : Notice désenfumage, indice C" },
      { heure: "Hier", texte: "Collision n°14 passée en urgente" }
    ]
  },
  {
    id: "todo", zone: "todo", type: "todo", titre: "Ma todo", repereIA: "Construite à partir des échanges", phrase: "Fais-moi une todo de ce qu'on m'a demandé",
    items: [
      { titre: "Valider le passage de la gaine G12", par: "Camille", discussion: "Réservations niveau 2", heure: "09:12", urgence: "Aujourd'hui" },
      { titre: "Répondre sur l'accès de la grue", par: "Nadir", discussion: "Installation de chantier", heure: "Hier", urgence: "Aujourd'hui" },
      { titre: "Confirmer la cote du plancher bas, niveau 3", par: "Inès", discussion: "Structure et CVC, niveau 3", heure: "Lundi", urgence: "Cette semaine" }
    ]
  },
  {
    id: "documents", zone: "docs", type: "documents", titre: "Documents consultés récemment", phrase: "Garde mes derniers documents consultés",
    items: [
      { texte: "Notice désenfumage, indice C", quand: "Aujourd'hui" },
      { texte: "Plan de réservations, niveau 2", quand: "Hier" },
      { texte: "CCTP lot CVC", quand: "29/10" }
    ]
  },
  {
    id: "collisions", zone: "coll", type: "compteurs", titre: "Collisions suivies", phrase: "Compte mes collisions par statut",
    items: [
      { valeur: 5, libelle: "Nouvelles" },
      { valeur: 9, libelle: "En cours" },
      { valeur: 2, libelle: "Urgentes", urgent: true },
      { valeur: 17, libelle: "Résolues" }
    ]
  }
];
