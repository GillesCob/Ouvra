// Rapport MODELE de la demo (28/10) : le recapitulatif de la collision gaine rectangulaire / cloison (couloir R+2), affiche SANS appel a l'IA quand
// Gilles clique « Voir un exemple de rapport » (plan B sans internet, et exemple de ce que donne le rapport genere en direct).
// Il passe par les memes etapes que le rapport de l'IA : selection locale des messages, puis conclureRapport (src/discussionsIAMoteur.js), qui reverifie
// chaque source, chaque chiffre et chaque nom. Seule la « reponse du modele » est ecrite a l'avance (SORTIE_MODELE), a partir des vrais messages de la
// conversation de Sophie Lambert (src/messagerie/donneesDemo.js). Les messages de demonstration sont dates par rapport au jour d'ouverture : les sources
// sont donc retrouvees par le DEBUT DE LEUR TEXTE (REPERES), jamais par un numero ou une date figes. Un repere introuvable = pas de rapport (rien d'invente).
// Pur (ni DOM ni reseau). Le rapport rendu porte modele: true (bandeau « Modèle de rapport » dans src/discussionsIARapportVue.js).

import { EXEMPLES_DISCUSSIONS } from "./discussionsIAExemples.js";
import { validerCommande, selectionner, preparerAnalyse, conclureRapport } from "./discussionsIAMoteur.js";

export const PHRASE_MODELE = "Fais-moi un rapport sur la collision entre la gaine et la cloison";

// Debut du texte de chaque message cite.
const REPERES = {
  signalement: "Gilles, j'ai une collision. La gaine rectangulaire",
  cloisonAbsente: "Cette cloison n'était pas dans la maquette d'architecture que j'avais importée",
  detection: "@sophie collision détectée au niveau 2",
  preferenceB: "Je suis moins à l'aise avec C.",
  objection: "Sauf que la réservation, c'est Claire qui l'accepte",
  metre: "Sur la collision de la gaine rectangulaire et de la cloison au R+2, je propose de ne pas trancher",
  accord: "D'accord. Je donne le tracé de travail à Marc"
};

// La « reponse du modele » ecrite a l'avance : memes champs que le schema de relais/schemaDiscussions.js, sources designees par leur repere.
const SORTIE_MODELE = {
  rien_a_dire: false,
  titre: "Collision entre la gaine rectangulaire et la cloison, couloir R+2",
  contexte: {
    texte: "Sophie Lambert a signalé que la gaine rectangulaire, avec ses coudes et ses piquages, traverse la cloison de 123 mm au R+2. Cette cloison n'était pas dans la maquette d'architecture qu'elle avait importée. La collision a été passée en urgente.",
    sources: ["signalement", "cloisonAbsente", "detection"]
  },
  intervenants: ["Sophie Lambert", "Vous"],
  desaccords: [{
    opposants: ["Vous", "Sophie Lambert"],
    objet: "Option B, une réservation dans la cloison avec un renfort : préférée pour garder la cloison et la hauteur sous faux plafond. Sophie Lambert doute qu'une seule réservation suffise avec des coudes et des piquages si proches de la cloison, et rappelle que Claire doit l'accepter, avec un contrôle du coupe-feu en plus si la cloison a une exigence.",
    sources: ["preferenceB", "objection"]
  }],
  decision: {
    statut: "prise",
    texte: "Ne pas trancher sans métré. Un tableau doit chiffrer les gaines et les raccords à reprendre, le faux plafond à déposer et à refaire, et le linéaire de cloison touchée. Sophie Lambert est d'accord et donne le tracé de travail à Marc pour sortir les quantités de la maquette.",
    sources: ["metre", "accord"]
  }
};

// index : celui de src/discussionsIAIndex.js ; rend { ok: true, rapport } ou { ok: false, erreur }.
export function construireRapportModele(index, { maintenant = Date.now() } = {}) {
  const exemple = EXEMPLES_DISCUSSIONS.find((e) => e.demande === PHRASE_MODELE);
  if (!exemple || !index || !index.messages || !index.messages.length) return { ok: false, erreur: "Messages de démonstration absents." };
  const verdict = validerCommande(exemple.commande, { personnes: index.personnes.map((p) => p.nom) });
  if (!verdict.ok) return { ok: false, erreur: verdict.erreur };
  const selection = selectionner(verdict.commande, index, { maintenant });
  if (selection.erreur) return { ok: false, erreur: selection.erreur };
  const { table } = preparerAnalyse(selection, index);

  const idDe = new Map();
  for (const [nom, debut] of Object.entries(REPERES)) {
    const trouve = Array.from(table.entries()).find(([, entree]) => typeof entree.texte === "string" && entree.texte.startsWith(debut));
    if (!trouve) return { ok: false, erreur: "Message de démonstration introuvable : " + nom + "." };
    idDe.set(nom, trouve[0]);
  }
  const ids = (noms) => noms.map((n) => idDe.get(n));
  const sortie = {
    ...SORTIE_MODELE,
    contexte: { ...SORTIE_MODELE.contexte, sources: ids(SORTIE_MODELE.contexte.sources) },
    desaccords: SORTIE_MODELE.desaccords.map((d) => ({ ...d, sources: ids(d.sources) })),
    decision: { ...SORTIE_MODELE.decision, sources: ids(SORTIE_MODELE.decision.sources) }
  };
  const verdictRapport = conclureRapport(sortie, table, index, { sujet: verdict.commande.parametres.sujet, termes: selection.termes, maintenant });
  if (!verdictRapport.ok || verdictRapport.rapport.vide) return { ok: false, erreur: "Le rapport modèle n'a pas pu être vérifié." };
  return { ok: true, rapport: { ...verdictRapport.rapport, modele: true } };
}
