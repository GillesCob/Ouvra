// Phrases toutes faites du bouton « IA » de la page Discussions (24/10), calquees sur src/commandesExemples.js : une demande en francais naturel +
// la commande au format du moteur (src/discussionsIAMoteur.js), construites sur les VRAIES donnees de demonstration de la messagerie
// (src/messagerie/donneesDemo.js et corpus/*.json) : noms des 6 interlocuteurs, sujets reellement presents (cloison coupe-feu, acces grue,
// collision gaine rectangulaire / cloison, couloir R+2, reservations...).
// Quand l'utilisateur envoie EXACTEMENT une de ces phrases (casse, accents et ponctuation mis a part), la commande est reconnue ici, sans appel a
// l'IA pour la COMPREHENSION : le filtre par personne, les etats et les periodes ne coutent rien et marchent hors ligne. La recherche par sujet et le
// rapport appellent quand meme l'IA pour classer ou synthetiser les messages retenus.
// Un test (tests/discussionsIAExemples.test.js) garantit que chaque exemple trouve au moins un resultat sur les donnees de demonstration.
// Pour changer un exemple, il suffit d'editer ce fichier.

import { normaliser } from "./reglesCollision.js";

export const EXEMPLES_DISCUSSIONS = [
  {
    demande: "Fais-moi un rapport sur les collisions avec les gaines au R+2",
    relecture: "Faire un rapport sur les collisions avec les gaines au R+2.",
    commande: { action: "rapport", parametres: { sujet: "collisions avec les gaines au R+2", mots: ["gaine rectangulaire", "gaines", "cloison", "R+2"] } }
  },
  {
    demande: "Sors-moi toutes les conversations qui parlent de gaines en R+2",
    relecture: "Retrouver les conversations qui parlent de gaines au R+2.",
    commande: { action: "retrouver_echange", parametres: { sujet: "gaines R+2", mots: ["gaine rectangulaire", "cloison", "R+2"] } }
  },
  {
    demande: "Fais-moi un rapport sur la collision entre la gaine et la cloison",
    relecture: "Faire un rapport sur la collision entre la gaine et la cloison.",
    commande: { action: "rapport", parametres: { sujet: "collision gaine cloison", mots: ["gaine rectangulaire", "123 mm", "R+2"] } }
  },
  {
    demande: "Montre-moi tous les échanges avec Sophie Lambert",
    relecture: "Afficher tous les échanges avec Sophie Lambert.",
    commande: { action: "echanges_avec", parametres: { personne: "Sophie Lambert" } }
  },
  {
    demande: "Montre-moi mes échanges avec Karim Benali cette semaine",
    relecture: "Afficher les échanges avec Karim Benali des 7 derniers jours.",
    commande: { action: "echanges_avec", parametres: { personne: "Karim Benali", periode: { type: "depuis", nombre: 7, unite: "jour" } } }
  },
  {
    demande: "Trouve-moi l'échange où on a parlé de la cloison coupe-feu",
    relecture: "Retrouver l'échange sur la cloison coupe-feu.",
    commande: { action: "retrouver_echange", parametres: { sujet: "cloison coupe-feu", mots: ["CF", "EI", "incendie"] } }
  },
  {
    demande: "Trouve l'échange sur l'accès de la grue",
    relecture: "Retrouver l'échange sur l'accès de la grue.",
    commande: { action: "retrouver_echange", parametres: { sujet: "accès grue", mots: ["levage"] } }
  },
  {
    demande: "Fais-moi un rapport sur les réservations",
    relecture: "Faire un rapport sur les réservations.",
    commande: { action: "rapport", parametres: { sujet: "réservations", mots: ["trémie", "percement"] } }
  },
  {
    demande: "Montre-moi les discussions non lues",
    relecture: "Afficher les discussions qui ont des messages non lus.",
    commande: { action: "etat_discussions", parametres: { nonLus: true } }
  },
  {
    demande: "Montre-moi les sujets qui ne sont pas clôturés",
    relecture: "Afficher les sujets ouverts, en cours ou en attente.",
    commande: { action: "etat_discussions", parametres: { statuts: ["ouvert", "encours", "attente"] } }
  }
];

// Forme comparable d'une phrase : sans casse, accents, ponctuation ni espaces en double.
const comparable = (texte) => normaliser(texte).replace(/[^a-z0-9]+/g, " ").trim();

// Commande de l'exemple dont la phrase est exactement celle-ci, ou null. Rend { action, parametres, demande, relecture } comme le fait l'IA.
export function reconnaitreExemple(phrase, exemples = EXEMPLES_DISCUSSIONS) {
  const cherchee = comparable(phrase);
  if (!cherchee) return null;
  const trouve = exemples.find((e) => comparable(e.demande) === cherchee);
  return trouve ? { ...trouve.commande, demande: phrase, relecture: trouve.relecture } : null;
}
