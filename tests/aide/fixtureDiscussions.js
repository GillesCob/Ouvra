// Aide de test : un petit jeu de conversations, a la main, aux resultats previsibles (les VRAIES donnees de demonstration sont dans demoMessagerie.js).
import { creerFil } from "../../src/messagerie/messagerieDonnees.js";

export const MAINTENANT = new Date("2026-10-24T12:00:00").getTime();
const il_y_a = (jours, heure = 10, minute = 0) => {
  const d = new Date(MAINTENANT);
  d.setDate(d.getDate() - jours);
  d.setHours(heure, minute, 0, 0);
  return d;
};
const msg = (auteur, jours, heure, texte, extra = {}) => ({ auteur, quand: il_y_a(jours, heure), texte, ...extra });

export const PERSONNES = {
  me: { nom: "Vous" },
  ana: { nom: "Ana Roux" },
  bob: { nom: "Bob Lenoir" }
};

export function fixture() {
  const sujetCloison = Object.assign(creerFil([
    msg("me", 5, 9, "La cloison du local technique est en CF 1h dans la maquette, le programme dit CF 2h."),
    msg("ana", 5, 10, "Je confirme CF 2h, je corrige la cloison dans la V4."),
    msg("me", 4, 8, "Merci, et la porte passe en EI2 120 aussi.")
  ], 0, 0), { id: "s1", titre: "Cloison coupe-feu", tagues: ["ana"], statut: "encours", urgent: false });
  const sujetGrue = Object.assign(creerFil([
    msg("bob", 2, 14, "L'accès grue est bloqué mardi, le levage des groupes est décalé. @Ana Roux tu peux prévenir ?", { mentions: ["ana"] }),
    msg("me", 2, 15, "Je décale le planning de levage.")
  ], 1, 0), { id: "s2", titre: "Accès grue semaine 44", tagues: ["bob"], statut: "ouvert", urgent: true });
  const sujetClos = Object.assign(creerFil([
    msg("me", 12, 9, "Peux-tu valider la nomenclature des portes ?"),
    msg("bob", 12, 11, "Validée, tu peux la diffuser.")
  ], 0, 0), { id: "s3", titre: "Nomenclature des portes", tagues: ["bob"], statut: "clos", urgent: false });
  sujetClos.messages.push({ systeme: true, genre: "cloture", auteur: "bob", quand: il_y_a(12, 12) });

  const conversations = [
    {
      id: "ana", type: "individuel", nom: "Ana Roux", membres: ["me", "ana"], sousTitre: "Architecte",
      principal: creerFil([msg("ana", 9, 16, "Bonjour, le plan de repérage est prêt."), msg("me", 9, 17, "Parfait, merci.")], 0, 0), sujets: [sujetCloison]
    },
    {
      id: "g", type: "groupe", nom: "Groupe chantier", membres: ["me", "ana", "bob"], sousTitre: "3 participants",
      principal: creerFil([msg("bob", 3, 10, "Visite de chantier demain, rendez-vous à 8h."), msg("ana", 3, 11, "J'y serai.")], 2, 0), sujets: [sujetGrue, sujetClos]
    }
  ];
  return { conversations, personnes: PERSONNES };
}
