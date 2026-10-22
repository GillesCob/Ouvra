// ECHANGES DE DEMONSTRATION DES COLLISIONS DE L'HOPITAL (22/10) : FICTIFS, A RETIRER OU REMPLACER PAR DE VRAIES DONNEES AVANT TOUT USAGE REEL.
//
// Pour chacune des 15 collisions reelles (HOSPITAL_CLASHES), une conversation de chantier et les modifications de priorite / statut
// qui vont avec. Les elements cites (type de cloison, de gaine, de plafond, equipement, niveau) sont ceux de la zone de la collision
// dans clashesHospital.js ; rien d'autre n'est affirme sur les elements. Les personnes sont celles de la messagerie de demonstration
// (src/messagerie/donneesDemo.js, PERSONNES) : memes noms, memes metiers. "Vous" s'affiche "User 1" dans la page Collision.
//
// Forme (celle que la page Collision lit deja) :
// - discussion : { auteur, quand, texte } ;
// - historique : { qui, quand, champ: "priorité" | "statut", de, vers, demo: true }. Le drapeau demo evite que le stockage local
//   (localStorage, cle "ouvra-collisions-etat") ne les recopie : seules les modifications faites par l'utilisateur y sont gardees.
// Le dernier "vers" de chaque champ est la priorite / le statut courant de la collision dans clashesHospital.js.
//
// Les 7 collisions fictives du couple Structure / Mecanique (HOSPITAL_CLASHES_FACTICES) n'ont aucun echange.

const VOUS = "Vous";
const CLAIRE = "Claire Martin";
const KARIM = "Karim Benali";
const SOPHIE = "Sophie Lambert";
const JULIEN = "Julien Roux";
const MARC = "Marc Dubois";
const NADIA = "Nadia Faure";

const msg = (auteur, quand, texte) => ({ auteur, quand, texte });
const modif = (quand, champ, de, vers, qui = "User 1") => ({ qui, quand, champ, de, vers, demo: true });

export const ECHANGES_HOSPITAL = {
  // Level 1 : cloison 123 mm contre gaine ronde (piquage). Haute, nouveau, question en attente.
  "hosp-clash-1": {
    discussion: [
      msg(VOUS, "2026-10-15T09:12:00", "Le piquage de la gaine ronde traverse la cloison 123 mm du niveau 1. Sophie, tu peux confirmer que le tracé est bien celui de l'indice en cours ?"),
      msg(SOPHIE, "2026-10-15T10:40:00", "Le piquage est conforme à nos plans. Je n'avais pas cette cloison dans ma dernière mise à jour de la maquette d'architecture."),
      msg(CLAIRE, "2026-10-15T11:05:00", "La cloison n'a pas bougé depuis l'indice précédent. Si le piquage doit rester là je prévois une réservation dans la cloison."),
      msg(VOUS, "2026-10-16T08:50:00", "Je passe en priorité haute. Sophie, peux-tu regarder s'il existe une variante de tracé avant que Claire ne modifie la cloison ?")
    ],
    historique: [modif("2026-10-15T11:20:00", "priorité", "normale", "haute")]
  },

  // Level 2 : cloison 123 mm contre gaine rectangulaire (coudes et piquages). Urgente, confirme, decision prise.
  "hosp-clash-2": {
    discussion: [
      msg(VOUS, "2026-10-14T14:05:00", "La gaine rectangulaire avec ses coudes et ses piquages traverse la cloison 123 mm du niveau 2. À traiter avec Sophie et Claire."),
      msg(SOPHIE, "2026-10-14T15:10:00", "Confirmé de mon côté. La gaine ne peut pas être raccourcie sans toucher au piquage suivant."),
      msg(CLAIRE, "2026-10-15T09:20:00", "Déplacer la cloison est possible. Je dois d'abord vérifier la surface du local voisin."),
      msg(VOUS, "2026-10-16T10:15:00", "Ça bloque la suite des réseaux de ce niveau. Je passe en urgente."),
      msg(CLAIRE, "2026-10-16T11:30:00", "Surface du local voisin vérifiée, on tient. Je décale la cloison de 15 cm et je dépose la mise à jour demain."),
      msg(SOPHIE, "2026-10-16T11:45:00", "Ok pour moi, la gaine reste en place. Je confirme sur la prochaine mise à jour.")
    ],
    historique: [
      modif("2026-10-14T14:30:00", "statut", "nouveau", "confirme"),
      modif("2026-10-15T09:35:00", "priorité", "normale", "haute"),
      modif("2026-10-16T10:16:00", "priorité", "haute", "urgente")
    ]
  },

  // Level 3 : cloison 183 mm contre gaine rectangulaire. Normale, nouveau, question en attente.
  "hosp-clash-3": {
    discussion: [
      msg(VOUS, "2026-10-19T09:00:00", "La gaine rectangulaire traverse la cloison 183 mm du niveau 3. Marc, tu peux regarder si le conflit est toujours là dans la dernière version ?"),
      msg(MARC, "2026-10-19T10:30:00", "Oui il est toujours là dans la version de ce matin."),
      msg(VOUS, "2026-10-19T11:10:00", "Merci. Sophie, est-ce que le coude peut être déplacé ?")
    ],
    historique: []
  },

  // Level 5 : cloison 183 mm contre gaine rectangulaire. Normale, nouveau.
  "hosp-clash-4": {
    discussion: [
      msg(MARC, "2026-10-20T08:45:00", "Gaine rectangulaire contre la cloison 183 mm du niveau 5. Je n'ai pas de réservation dans la cloison à cet endroit."),
      msg(VOUS, "2026-10-20T09:30:00", "Noté. Claire, je te l'envoie dans la prochaine synthèse ou tu regardes avant ?")
    ],
    historique: []
  },

  // Level 4 : cloison 183 mm contre canalisation. Haute, confirme, reservation demandee.
  "hosp-clash-5": {
    discussion: [
      msg(VOUS, "2026-10-14T16:00:00", "La canalisation traverse la cloison 183 mm du niveau 4. Julien, as-tu déjà des cloisons montées sur ce niveau ?"),
      msg(JULIEN, "2026-10-14T16:40:00", "Pas encore. Le montage commence la semaine prochaine, on peut encore modifier."),
      msg(SOPHIE, "2026-10-15T08:30:00", "Le passage de la canalisation est nécessaire pour le raccordement. Je préfère une réservation dans la cloison plutôt que de dévier."),
      msg(CLAIRE, "2026-10-15T09:40:00", "Ok pour une réservation. Donne-moi la position exacte depuis la maquette et je l'intègre avant le montage."),
      msg(VOUS, "2026-10-16T14:10:00", "Position envoyée. Je laisse ouvert jusqu'à la mise à jour de la maquette d'architecture.")
    ],
    historique: [
      modif("2026-10-14T17:05:00", "statut", "nouveau", "confirme"),
      modif("2026-10-15T09:00:00", "priorité", "normale", "haute")
    ]
  },

  // Level 1 : cloison 123 mm contre canalisation. Haute, nouveau, question en attente.
  "hosp-clash-6": {
    discussion: [
      msg(VOUS, "2026-10-16T09:15:00", "La canalisation traverse la cloison 123 mm du niveau 1. Sophie, c'est une alimentation ou une évacuation ?"),
      msg(SOPHIE, "2026-10-16T10:05:00", "Une évacuation. Je ne peux pas la dévier sans casser la pente."),
      msg(VOUS, "2026-10-16T10:40:00", "Alors c'est la cloison qui doit bouger. Claire, peux-tu regarder ?"),
      msg(CLAIRE, "2026-10-19T09:10:00", "Je regarde cette semaine. Je préfère attendre la prochaine mise à jour de Sophie pour ne pas modifier deux fois.")
    ],
    historique: [modif("2026-10-16T10:20:00", "priorité", "normale", "haute")]
  },

  // Level 2 : faux plafond 600 x 600 contre diffuseur de soufflage. Basse, ecarte.
  "hosp-clash-7": {
    discussion: [
      msg(VOUS, "2026-10-14T10:00:00", "Le diffuseur de soufflage est posé dans le faux plafond 600 x 600 du niveau 2. Je pense que c'est voulu mais je préfère confirmer."),
      msg(CLAIRE, "2026-10-14T10:25:00", "Oui c'est la pose normale d'un diffuseur dans une dalle de faux plafond. Rien à corriger côté architecture."),
      msg(VOUS, "2026-10-14T10:45:00", "Je l'écarte. Je regarde les autres diffuseurs et grilles posés dans les plafonds.")
    ],
    historique: [
      modif("2026-10-14T10:40:00", "statut", "nouveau", "ecarte"),
      modif("2026-10-14T10:41:00", "priorité", "normale", "basse")
    ]
  },

  // Level 4 : faux plafond en plaque de platre contre grille d'extraction. Basse, ecarte.
  "hosp-clash-8": {
    discussion: [
      msg(VOUS, "2026-10-15T11:00:00", "Même cas que le diffuseur du niveau 2. La grille d'extraction est posée dans le faux plafond en plaque de plâtre. Je l'écarte."),
      msg(SOPHIE, "2026-10-15T11:20:00", "D'accord. La grille est bien hébergée dans le plafond.")
    ],
    historique: [
      modif("2026-10-15T11:05:00", "statut", "nouveau", "ecarte"),
      modif("2026-10-15T11:06:00", "priorité", "normale", "basse")
    ]
  },

  // Level 1 : faux plafond 600 x 600 contre diffuseur de reprise. Normale, nouveau, a verifier avant d'ecarter.
  "hosp-clash-9": {
    discussion: [
      msg(VOUS, "2026-10-19T14:00:00", "Le diffuseur de reprise est posé dans le faux plafond 600 x 600 du niveau 1. Même famille que ceux des niveaux 2 et 4 qu'on a écartés."),
      msg(MARC, "2026-10-19T14:35:00", "Il est hébergé lui aussi. Je vérifie qu'il est bien centré sur la trame du plafond avant de l'écarter."),
      msg(VOUS, "2026-10-19T15:10:00", "Ok. Dis-moi ce que tu trouves.")
    ],
    historique: []
  },

  // Level 3 : cloison 123 mm contre prise de gaz medicaux triple. Urgente, confirme, decalage decide.
  "hosp-clash-10": {
    discussion: [
      msg(VOUS, "2026-10-14T09:30:00", "La prise de gaz médicaux triple traverse la cloison 123 mm du niveau 3. Sophie, c'est ton lot ?"),
      msg(SOPHIE, "2026-10-14T09:50:00", "Oui c'est notre prise. Elle est hébergée par la cloison dans notre maquette. Je regarde sa position."),
      msg(NADIA, "2026-10-14T10:30:00", "Les gaz médicaux sont un point sensible pour la réception. Merci de me tenir informée de la solution retenue."),
      msg(VOUS, "2026-10-15T08:40:00", "Je passe en urgente. Une prise mal placée se voit à la réception."),
      msg(CLAIRE, "2026-10-15T09:15:00", "De mon côté la cloison ne change pas. C'est la prise qui doit se déplacer."),
      msg(SOPHIE, "2026-10-15T10:20:00", "Je décale la prise de 15 cm le long de la cloison et je republie la maquette Mécanique."),
      msg(VOUS, "2026-10-16T08:55:00", "Parfait. Je garde ouvert jusqu'à la prochaine version Mécanique. Nadia, la solution est retenue.")
    ],
    historique: [
      modif("2026-10-14T10:00:00", "statut", "nouveau", "confirme"),
      modif("2026-10-14T10:02:00", "priorité", "normale", "haute"),
      modif("2026-10-15T08:41:00", "priorité", "haute", "urgente")
    ]
  },

  // Level 1 : cloison 123 mm contre caisson VAV (bypass 250 mm). Normale, nouveau, question en attente.
  "hosp-clash-11": {
    discussion: [
      msg(VOUS, "2026-10-20T10:00:00", "Le caisson VAV avec son bypass 250 mm touche la cloison 123 mm du niveau 1. Sophie, il y a de la marge pour le reculer ?"),
      msg(SOPHIE, "2026-10-20T10:45:00", "Pas beaucoup. Le caisson est calé sur la gaine principale. Je regarde ce qu'on peut faire."),
      msg(JULIEN, "2026-10-20T11:20:00", "Dites-moi vite si ça bouge. J'ai besoin de savoir avant de lancer les cloisons de ce niveau."),
      msg(VOUS, "2026-10-20T11:35:00", "Je relance Sophie demain matin avec une coupe.")
    ],
    historique: []
  },

  // Level 1 : cloison 123 mm contre piquage rond. Normale, nouveau.
  "hosp-clash-12": {
    discussion: [
      msg(VOUS, "2026-10-20T15:00:00", "Le piquage rond touche la cloison 123 mm du niveau 1. Marc, tu peux regarder sur la maquette ?"),
      msg(MARC, "2026-10-20T16:10:00", "Vu. Le piquage touche bien la cloison. Je prépare une coupe pour Sophie.")
    ],
    historique: []
  },

  // Level 3 : faux plafond 600 x 600 contre vanne a boisseau 25 mm. Normale, nouveau, question en attente.
  "hosp-clash-13": {
    discussion: [
      msg(VOUS, "2026-10-21T08:50:00", "La vanne 25 mm touche le faux plafond 600 x 600 du niveau 3. Sophie, il faut un accès pour la manœuvre ?"),
      msg(SOPHIE, "2026-10-21T09:30:00", "Oui la vanne doit rester accessible. Il faudrait une trappe de visite dans le plafond."),
      msg(VOUS, "2026-10-21T09:50:00", "Claire, tu peux prévoir une trappe dans la trame ? Sinon on regarde pour remonter la vanne.")
    ],
    historique: []
  },

  // Level 4 : mur-rideau Storefront contre gaine rectangulaire. Basse, nouveau, a relancer apres mise a jour.
  "hosp-clash-14": {
    discussion: [
      msg(VOUS, "2026-10-19T16:00:00", "La gaine rectangulaire touche le mur-rideau du niveau 4. Claire, la façade est-elle à jour dans la maquette ?"),
      msg(CLAIRE, "2026-10-19T16:20:00", "La façade a changé au dernier indice. Je republie une version cette semaine."),
      msg(VOUS, "2026-10-19T16:35:00", "Alors je passe en basse en attendant. On revérifie après ta mise à jour."),
      msg(CLAIRE, "2026-10-21T14:00:00", "Mise à jour déposée. Tu peux relancer la détection.")
    ],
    historique: [modif("2026-10-19T16:30:00", "priorité", "normale", "basse")]
  },

  // Level 7A : panneau solaire contre tour de refroidissement. Haute, confirme, decalage du panneau decide.
  "hosp-clash-15": {
    discussion: [
      msg(VOUS, "2026-10-15T14:00:00", "Le panneau solaire est en conflit avec la tour de refroidissement en toiture, niveau 7A. Karim, Claire, vous avez des contraintes de votre côté ?"),
      msg(KARIM, "2026-10-15T14:45:00", "Les appuis de la tour sont dimensionnés pour sa charge. Je ne veux pas les déplacer."),
      msg(SOPHIE, "2026-10-15T15:20:00", "La tour est calée sur les attentes hydrauliques. Si quelqu'un doit bouger c'est le panneau."),
      msg(CLAIRE, "2026-10-16T09:00:00", "Je peux décaler le panneau. Je regarde l'implantation de la toiture et je te dis jusqu'où."),
      msg(CLAIRE, "2026-10-19T10:30:00", "Panneau décalé. Je dépose la mise à jour de l'implantation aujourd'hui."),
      msg(VOUS, "2026-10-19T11:00:00", "Merci Claire. Je relance la détection dès que la version est déposée.")
    ],
    historique: [
      modif("2026-10-15T14:10:00", "statut", "nouveau", "confirme"),
      modif("2026-10-16T08:30:00", "priorité", "normale", "haute")
    ]
  }
};
