// Donnees de la page « Mon espace » (portage de vault-perso/Projets/Ouvra/mockups/ouvra-mon-espace.html, 02/11).
// Six widgets, chacun ajoute par une phrase (la phrase est aussi celle qu'on retape dans la barre d'instruction pour le faire reapparaitre),
// des suggestions, et les textes de la page. Les donnees viennent des messages et des collisions DEJA presents dans l'application :
//  - messages : corpus de la messagerie (src/messagerie/corpus/*.json) ; la cible d'un element est { type: "message", convId, sujetId, texte }, le texte etant celui du
//    message source, recopie tel quel (la page le retrouve par ce texte : les messages n'ont pas d'identifiant et leur position change avec les evenements du journal) ;
//  - collisions : les 15 collisions de l'hopital (src/clashesHospital.js) ; la cible est { type: "collision", clashId } et la carte lit la collision elle-meme ;
//  - points de vue : cadrages du Viewer 3D, cible { type: "vue3d", camera: { eye, look, up } }, sans aucun lien avec une collision ;
//  - un message (Karim) s'adresse a l'utilisateur par « Gilles » : le texte est cite tel quel.
// type : "vues" (points de vue 3D enregistres), "alertes", "todo", "echeances", "documents", "compteurs". zone : place dans la grille (grid-area du CSS).
export const TEXTES_ESPACE = {
  filIdees: "Idées d'évolution",
  filCourant: "Mon espace",
  titre: "Mon espace",
  sousTitre: "Ce que tu consultes souvent, au même endroit.",
  placeholder: "Dis ou écris ce que tu veux voir ici",
  journal: "Ce que tu as demandé",
  ajoutVue: "Ajouter une vue",
  journalVide: "Aucune instruction pour l'instant.",
  libelleRetour: "Retour à Mon espace"
};

export const SUGGESTIONS = [
  "Ajoute les alertes de la maquette structure",
  "Montre mes vues du niveau 2",
  "Fais-moi une todo de ce qu'on m'a demandé"
];

export const WIDGETS = [
  {
    id: "vues", zone: "vues", type: "vues", titre: "Mes points de vue", phrase: "Montre mes vues du niveau 2",
    // Un point de vue 3D enregistre = un titre (personnalisable), une miniature de la scene neutre (public/images/mon-espace/) et un cadrage de camera du Viewer.
    // Aucun lien avec une collision : ni numero, ni statut, ni couleur, ni bulle. Le clic ouvre le Viewer 3D (jamais la page Collision) et la camera vole vers le cadrage.
    // Les coordonnees (eye = position, look = cible, up = verticale) sont de simples valeurs d'exemple.
    items: [
      { id: "vue-1", titre: "Point de vue 1", miniature: "/images/mon-espace/point-de-vue-1.jpg", cible: { type: "vue3d", camera: { eye: [3.654, 174.913, -80.198], look: [2.154, 175.913, -81.064], up: [0, 1, 0] } } },
      { id: "vue-2", titre: "Point de vue 2", miniature: "/images/mon-espace/point-de-vue-2.jpg", cible: { type: "vue3d", camera: { eye: [62.826, 178.972, -85.897], look: [61.094, 177.972, -85.897], up: [0, 1, 0] } } },
      { id: "vue-3", titre: "Point de vue 3", miniature: "/images/mon-espace/point-de-vue-3.jpg", cible: { type: "vue3d", camera: { eye: [66.047, 170.662, -60.525], look: [66.047, 169.662, -58.793], up: [0, 1, 0] } } },
      { id: "vue-4", titre: "Point de vue 4", miniature: "/images/mon-espace/point-de-vue-4.jpg", cible: { type: "vue3d", camera: { eye: [10.828, 184.383, -119.011], look: [10.828, 184.947, -116.904], up: [0, 1, 0] } } }
    ]
  },
  {
    id: "alertes", zone: "alertes", type: "alertes", titre: "Alertes", phrase: "Ajoute les alertes de la maquette structure",
    // Pas de bouton « Voir » sans cible : la mise a jour de maquette n'en a pas. Un document mis a jour ouvre la discussion ou il a ete depose (l'application ne branche aucune GED reelle).
    items: [
      { id: "alerte-document", heure: "30/10", texte: "Document mis à jour : nomenclature_gaines_R2.xlsx",
        cible: { type: "message", convId: "g-fluides", sujetId: null, texte: "[fichier : nomenclature_gaines_R2.xlsx]" } },
      { id: "alerte-maquette", heure: "28/10", texte: "Maquette Architecture passée en V3.1 par Claire Martin" },
      { id: "alerte-collision-10", heure: "15/10", texte: "Collision n° 10 passée en urgente", cible: { type: "collision", clashId: "hosp-clash-10" } }
    ]
  },
  {
    id: "todo", zone: "todo", type: "todo", titre: "Ma todo", repereIA: "Construite à partir des échanges", phrase: "Fais-moi une todo de ce qu'on m'a demandé",
    // citation = message source, recopie tel quel. heure = quand il a ete ecrit.
    items: [
      {
        id: "todo-metre", titre: "Sortir le métré du R+2 et prévenir Claire et Julien", par: "Sophie Lambert", discussion: "Collision gaine rectangulaire / cloison, couloir R+2",
        heure: "09:48", urgence: "Aujourd'hui",
        citation: "Tu me dis dès que le métré est sorti, je ne fige rien avant. Et tu préviens Claire et Julien que ça reste ouvert ?",
        cible: { type: "message", convId: "sophie", sujetId: "s1", texte: "Tu me dis dès que le métré est sorti, je ne fige rien avant. Et tu préviens Claire et Julien que ça reste ouvert ?" }
      },
      {
        id: "todo-bcf", titre: "Envoyer le BCF à Karim (percement poutre R+1)", par: "Karim Benali", discussion: "Karim Benali",
        heure: "Hier", urgence: "Cette semaine",
        citation: "D'accord. Envoie-moi le BCF d'abord",
        cible: { type: "message", convId: "karim", sujetId: null, texte: "D'accord. Envoie-moi le BCF d'abord" }
      },
      {
        id: "todo-poutre", titre: "Confirmer la retombée de la poutre de rive R+3", par: "Claire Martin", discussion: "Claire Martin",
        heure: "Vendredi", urgence: "Cette semaine",
        citation: "Réservation fenêtre R+3 : j'ai un conflit entre l'allège et la poutre de rive, tu peux regarder la coupe BCF que je t'ai envoyée ?",
        cible: { type: "message", convId: "claire", sujetId: null, texte: "Réservation fenêtre R+3 : j'ai un conflit entre l'allège et la poutre de rive, tu peux regarder la coupe BCF que je t'ai envoyée ?" }
      }
    ]
  },
  {
    id: "echeances", zone: "ech", type: "echeances", titre: "Échéances", repereIA: "Tirées des discussions", phrase: "Ajoute mes échéances tirées des discussions",
    // Une seule liste, dans l'ordre des dates (date : jour reel, non affichee). Chaque ligne montre son titre et la discussion d'origine.
    items: [
      {
        id: "ech-poutre-axe-c", date: "2026-11-02", titre: "Point avec Nadia sur la poutre axe C (C40/50 avec section 60 contre section 70)",
        discussion: "Poutre axe C : reprise de section",
        cible: { type: "message", convId: "karim", sujetId: "k1", texte: "Parfait, je prends ça demain pour le point avec Nadia. Je garde la section 70 comme hypothèse de travail dans la V4." }
      },
      {
        id: "ech-visite-maquette", date: "2026-11-04", titre: "Visite de la maquette avec la direction des soins",
        discussion: "Coordination tous lots",
        cible: { type: "message", convId: "g-coord", sujetId: null, texte: "Bonjour, pouvez-vous me confirmer que la visite de la maquette avec la direction des soins reste calée le 4 novembre ?" }
      },
      {
        id: "ech-plans-coffrage", date: "2026-11-05", titre: "Geler les plans de coffrage R+2 avec l'indice D",
        discussion: "Lot Structure",
        cible: { type: "message", convId: "g-structure", sujetId: null, texte: "On gèle les plans avant le 5, tu seras prêt ?" }
      },
      {
        id: "ech-synthese", date: "2026-11-05", titre: "Synthèse : figer les réservations et les trémies, apporter les listes à jour",
        discussion: "Synthèse hebdomadaire",
        cible: { type: "message", convId: "g-synthese", sujetId: null, texte: "Jeudi prochain, on fige les réservations et les trémies avant l'indice du 5. Merci d'amener vos listes à jour." }
      }
    ]
  },
  {
    // Pas de GED reelle dans l'application : ce sont les pieces jointes citees dans les messages, avec leur auteur et leur discussion. « Voir » ouvre le message qui porte la piece jointe.
    id: "documents", zone: "docs", type: "documents", titre: "Documents consultés récemment", phrase: "Garde mes derniers documents consultés",
    items: [
      {
        id: "doc-coupe", texte: "coupe-gaine-cloison-R2.pdf", quand: "Aujourd'hui", meta: "Déposé par Sophie Lambert · Collision gaine rectangulaire / cloison, couloir R+2",
        cible: { type: "message", convId: "sophie", sujetId: "s1", texte: "Je te mets la coupe avec le passage actuel en attendant. [fichier : coupe-gaine-cloison-R2.pdf]" }
      },
      { id: "doc-nomenclature", texte: "nomenclature_gaines_R2.xlsx", quand: "30/10", meta: "Déposé par Marc Dubois · Lots fluides", cible: { type: "message", convId: "g-fluides", sujetId: null, texte: "[fichier : nomenclature_gaines_R2.xlsx]" } },
      {
        id: "doc-archi", texte: "archi-V3.1.ifc", quand: "28/10", meta: "Déposé par Claire Martin · Maquette V3 : retours",
        cible: { type: "message", convId: "claire", sujetId: "c3", texte: "V3.1 déposée. [fichier : archi-V3.1.ifc] Tu peux relancer le contrôle ?" }
      }
    ]
  },
  {
    id: "collisions", zone: "coll", type: "compteurs", titre: "Collisions suivies", phrase: "Compte mes collisions par statut",
    items: [
      // Pas de valeur ici : l'effectif de chaque compteur est calcule a l'affichage (compterSuivies, src/collisionsFavoris.js) a partir des favoris enregistres et du statut des collisions.
      // Un clic ouvre la page Collision filtree sur les collisions suivies de ce statut (cible type « collisions », filtre = identifiant de FILTRES_COLLISIONS).
      { id: "compteur-nouvelles", libelle: "Nouvelles", cible: { type: "collisions", filtre: "nouvelles" } },
      { id: "compteur-en-cours", libelle: "En cours", cible: { type: "collisions", filtre: "en-cours" } },
      { id: "compteur-urgentes", libelle: "Urgentes", urgent: true, cible: { type: "collisions", filtre: "urgentes" } },
      { id: "compteur-resolues", libelle: "Résolues", cible: { type: "collisions", filtre: "resolues" } }
    ]
  }
];
