// Recapitulatif de Discussions au FORMAT FIXE (26/10, decision de Gilles) : titre, contexte, intervenants, desaccords, decision finale.
// Normalisation de la reponse du modele, PURE, commune au relais (relais/sortieDiscussions.js) et a la page (conclureRapport du moteur) : les deux
// reverifient la meme chose avec le meme code, rien n'est suppose.
//
// Reponse du modele (schema de relais/schemaDiscussions.js) :
//   { rien_a_dire, titre, contexte: { texte, sources }, intervenants: [nom], desaccords: [{ opposants: [nom], objet, sources }],
//     decision: { statut: prise | rapportee | incertaine | aucune, texte, sources } }
// Regle absolue : aucune information non sourcee, et JAMAIS de decision inventee.
//  - une source qui n'existe pas est retiree ; un desaccord sans source valide ou sans objet est ecarte ;
//  - une decision sans texte ou sans source valide devient « aucune » (texte vide) : mieux vaut « Aucune décision prise » qu'une decision douteuse ;
//  - une decision rapportee de seconde main ou incertaine garde son statut et n'est jamais confirmee ;
//  - un chiffre ou un mois qui ne figure dans aucun message cite rend le bloc « non confirmé » (confirme: false).
// Les noms d'intervenants sont limites aux auteurs reels des messages fournis.

export const STATUTS_DECISION = ["prise", "rapportee", "incertaine", "aucune"];
export const TITRE_MAX = 120;
export const CONTEXTE_MAX = 800;
export const TEXTE_BLOC_MAX = 500;
export const DESACCORDS_MAX = 8;
export const OPPOSANTS_MAX = 6;
export const INTERVENANTS_MAX = 12;
export const SOURCES_PAR_BLOC_MAX = 5;

// ---------- Verification des chiffres et des dates ----------
// Un bloc ne doit contenir aucun nombre ni nom de mois qui ne figure pas dans l'un de ses messages cites (ou dans leur date, que le modele voit).
export const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const sansAccent = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nombresEtMois = (texte) => {
  const bas = sansAccent(texte);
  return new Set([...(bas.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", ".")), ...MOIS.filter((m) => new RegExp("\\b" + m + "\\b").test(bas))]);
};
export function chiffresSourcesTrouves(texteDuPoint, textesSources) {
  const permis = new Set();
  textesSources.forEach((t) => nombresEtMois(t).forEach((x) => permis.add(x)));
  return Array.from(nombresEtMois(texteDuPoint)).every((x) => permis.has(x));
}

// ---------- Outils ----------
const nettoyer = (valeur) => (typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "");
const estObjet = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// Coupe a la limite, a une fin de mot, avec « … » (la limite inclut le point de suspension).
function borner(texte, max) {
  if (texte.length <= max) return texte;
  const coupe = texte.lastIndexOf(" ", max - 1);
  return texte.slice(0, coupe > max / 2 ? coupe : max - 1).trimEnd() + "…";
}

const sansDoublon = (liste) => Array.from(new Set(liste));

// ids valides, sans doublon, plafonnes. texteDe(id) rend le texte du message ou null s'il n'existe pas.
const sourcesValides = (ids, texteDe) => sansDoublon(Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && texteDe(id) != null) : []).slice(0, SOURCES_PAR_BLOC_MAX);

const verifie = (texte, sources, texteDe) => sources.length > 0 && chiffresSourcesTrouves(texte, sources.map(texteDe));

// options : { auteurs: Set<string> des noms reels, texteDe(id) -> texte complet (avec date) ou null, auteurDe?(id) -> nom ou null }.
// Rend null si la forme est inexploitable, sinon :
//   { vide, titre, contexte: { texte, sources, confirme }, intervenants, desaccords: [{ opposants, objet, sources, confirme }], decision: { statut, texte, sources, confirme } }
// (les sources sont des numeros M1..Mn, a la page de les transformer en messages.)
export function normaliserRapport(sortie, { auteurs, texteDe, auteurDe = () => null }) {
  if (!estObjet(sortie) || typeof sortie.rien_a_dire !== "boolean") return null;
  const vide = { vide: true, titre: "", contexte: { texte: "", sources: [], confirme: false }, intervenants: [], desaccords: [], decision: { statut: "aucune", texte: "", sources: [], confirme: false } };
  if (sortie.rien_a_dire) return vide;
  if (!estObjet(sortie.contexte)) return null;

  // Contexte : sans texte ou sans source valide, le bloc reste vide (le rapport ne l'invente pas).
  const texteContexte = borner(nettoyer(sortie.contexte.texte), CONTEXTE_MAX);
  const sourcesContexte = sourcesValides(sortie.contexte.sources, texteDe);
  const contexte = texteContexte && sourcesContexte.length
    ? { texte: texteContexte, sources: sourcesContexte, confirme: verifie(texteContexte, sourcesContexte, texteDe) }
    : { texte: "", sources: [], confirme: false };

  const nomsReels = (liste, max) => sansDoublon((Array.isArray(liste) ? liste : []).filter((n) => typeof n === "string" && auteurs.has(n))).slice(0, max);

  const desaccords = [];
  for (const d of Array.isArray(sortie.desaccords) ? sortie.desaccords : []) {
    if (!estObjet(d) || desaccords.length >= DESACCORDS_MAX) continue;
    const objet = borner(nettoyer(d.objet), TEXTE_BLOC_MAX);
    const sources = sourcesValides(d.sources, texteDe);
    if (!objet || !sources.length) continue;
    desaccords.push({ opposants: nomsReels(d.opposants, OPPOSANTS_MAX), objet, sources, confirme: verifie(objet, sources, texteDe) });
  }

  // Decision : jamais inventee.
  const decision = { statut: "aucune", texte: "", sources: [], confirme: false };
  if (estObjet(sortie.decision) && STATUTS_DECISION.includes(sortie.decision.statut) && sortie.decision.statut !== "aucune") {
    const texte = borner(nettoyer(sortie.decision.texte), TEXTE_BLOC_MAX);
    const sources = sourcesValides(sortie.decision.sources, texteDe);
    if (texte && sources.length) {
      decision.statut = sortie.decision.statut;
      decision.texte = texte;
      decision.sources = sources;
      decision.confirme = decision.statut === "prise" && verifie(texte, sources, texteDe);
    }
  }

  // Intervenants : ceux du modele (auteurs reels), puis les opposants, puis, a defaut, les auteurs des messages cites.
  let intervenants = sansDoublon([...nomsReels(sortie.intervenants, INTERVENANTS_MAX), ...desaccords.flatMap((d) => d.opposants)]);
  if (!intervenants.length) {
    const cites = [...contexte.sources, ...desaccords.flatMap((d) => d.sources), ...decision.sources];
    intervenants = sansDoublon(cites.map(auteurDe).filter((n) => typeof n === "string" && auteurs.has(n)));
  }
  intervenants = intervenants.slice(0, INTERVENANTS_MAX);

  const titre = borner(nettoyer(sortie.titre), TITRE_MAX);
  const exploitable = contexte.texte !== "" || desaccords.length > 0 || decision.statut !== "aucune";
  return { vide: !exploitable, titre, contexte, intervenants, desaccords, decision };
}
