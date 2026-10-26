// Recapitulatif de Discussions (26/10) : ce que la fenetre, la copie en texte et le PDF partagent. Pur (ni DOM ni reseau).
// Format FIXE, toujours dans cet ordre : titre, contexte, intervenants, desaccords exprimes, decision finale, puis les sources.
// Le rapport est celui de conclureRapport (src/discussionsIAMoteur.js) :
//   { titre, sujet, date, vide, message?, contexte: { texte, confirme, sources }, intervenants, desaccords: [{ opposants, objet, confirme, sources }],
//     decision: { statut, texte, confirme, sources }, chronologie, analyses }
// Les sources sont les messages (objets { id, auteurNom, quandLibelle, discussion, extrait: { texte } }) ; chronologie = les sources citees, triees par date.

export const MESSAGE_AUCUNE_DECISION = "Aucune décision prise";
export const MESSAGE_AUCUN_DESACCORD = "Aucun désaccord exprimé.";
export const MESSAGE_CONTEXTE_ABSENT = "Le contexte n'est pas établi par les messages.";
export const MENTION_NON_CONFIRME = "non confirmé";

export const LIBELLES_DECISION = {
  prise: "Décision prise",
  rapportee: "Décision rapportée de seconde main",
  incertaine: "Décision incertaine",
  aucune: MESSAGE_AUCUNE_DECISION
};

export const libelleDecision = (decision) => LIBELLES_DECISION[decision && decision.statut] || MESSAGE_AUCUNE_DECISION;

const deux = (n) => String(n).padStart(2, "0");
export const dateJJMMAAAA = (ms) => {
  const d = new Date(ms);
  return deux(d.getDate()) + "/" + deux(d.getMonth() + 1) + "/" + d.getFullYear();
};

const pluriel = (n, un, plusieurs) => n + " " + (n > 1 ? plusieurs : un);

// « 6 messages analysés, 2 messages cités dans 1 discussion, du 20/10/2026 au 24/10/2026 » : le perimetre exact du rapport.
export function perimetreDe(rapport) {
  const cites = rapport.chronologie || [];
  const parties = [pluriel(rapport.analyses || 0, "message analysé", "messages analysés")];
  if (cites.length) {
    const discussions = new Set(cites.map((s) => s.discussion)).size;
    parties.push(pluriel(cites.length, "message cité", "messages cités") + " dans " + pluriel(discussions, "discussion", "discussions"));
    const premier = dateJJMMAAAA(cites[0].quand);
    const dernier = dateJJMMAAAA(cites[cites.length - 1].quand);
    parties.push(premier === dernier ? "le " + premier : "du " + premier + " au " + dernier);
  }
  return parties.join(", ");
}

export const dateDuRapport = (rapport) => "Rapport du " + dateJJMMAAAA(rapport.date);

// Phrase d'opposants : « Ana Roux et Bob Lenoir », « Ana Roux, Bob Lenoir et Vous ».
export function nomsEnPhrase(noms) {
  if (noms.length <= 1) return noms.join("");
  return noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1];
}

// Numeros de sources dans la chronologie : [1, 3]. Un message cite par plusieurs blocs garde le meme numero.
export function numerosDesSources(rapport, sources) {
  const rang = new Map((rapport.chronologie || []).map((s, i) => [s.id, i + 1]));
  return sources.map((s) => rang.get(s.id)).filter(Boolean).sort((a, b) => a - b);
}
export const refsDe = (rapport, sources) => {
  const n = numerosDesSources(rapport, sources);
  return n.length ? " [" + n.join(", ") + "]" : "";
};

// Version texte (bouton « Copier »), dans le meme ordre que la fenetre.
export function rapportEnTexte(rapport) {
  const lignes = [rapport.titre, dateDuRapport(rapport) + (rapport.vide ? "" : " · " + perimetreDe(rapport)), ""];
  if (rapport.vide) { lignes.push(rapport.message); return lignes.join("\n"); }
  const marque = (confirme) => (confirme ? "" : " (" + MENTION_NON_CONFIRME + ")");

  lignes.push("CONTEXTE");
  lignes.push(rapport.contexte.texte ? rapport.contexte.texte + marque(rapport.contexte.confirme) + refsDe(rapport, rapport.contexte.sources) : MESSAGE_CONTEXTE_ABSENT, "");

  lignes.push("INTERVENANTS");
  for (const nom of rapport.intervenants) lignes.push("- " + nom);
  lignes.push("");

  lignes.push("DÉSACCORDS EXPRIMÉS");
  if (!rapport.desaccords.length) lignes.push(MESSAGE_AUCUN_DESACCORD);
  for (const d of rapport.desaccords) lignes.push("- " + (d.opposants.length ? nomsEnPhrase(d.opposants) + " : " : "") + d.objet + marque(d.confirme) + refsDe(rapport, d.sources));
  lignes.push("");

  lignes.push("DÉCISION FINALE");
  const decision = rapport.decision;
  lignes.push(decision.statut === "aucune" ? MESSAGE_AUCUNE_DECISION : libelleDecision(decision) + " : " + decision.texte + (decision.statut === "prise" ? marque(decision.confirme) : "") + refsDe(rapport, decision.sources), "");

  lignes.push("SOURCES");
  rapport.chronologie.forEach((c, i) => lignes.push((i + 1) + ". " + c.quandLibelle + ", " + c.auteurNom + " (" + c.discussion + ") : " + c.extrait.texte));
  return lignes.join("\n");
}
