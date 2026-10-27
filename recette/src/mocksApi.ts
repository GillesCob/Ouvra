import type { TReponseApi, TSimulateurApi } from "./types.js";

/**
 * Reponses simulees des relais IA. Elles remplacent le modele : le harnais verifie ce que l'APPLICATION fait d'une reponse donnee (relecture, filtre,
 * affichage, annulation), jamais la qualite de comprehension du modele (voir recette-automatique.md, section « Hors perimetre : IA payante »).
 */

const phraseDe = (corps: Record<string, unknown>): string => (typeof corps["phrase"] === "string" ? corps["phrase"].toLowerCase() : "");

const inconnue = (corps: Record<string, unknown>): TReponseApi => ({
  ok: true,
  resultat: "non_comprise",
  message: `Simulateur du harnais : phrase non prevue (${String(corps["phrase"])}).`
});

export const commandeViewer = (parametres: Record<string, unknown>): TReponseApi => ({
  ok: true,
  resultat: "commande",
  commande: { action: "afficher", parametres }
});

/** POST /api/commande (IA du Viewer). Le message d'un « critere_introuvable » est celui du relais (la relecture du modele) : le client y ajoute lui-meme « Critère introuvable. » (commandesIA.js). */
export const simulateurCommandeViewer: TSimulateurApi = (corps) => {
  const f = phraseDe(corps);
  if (f.includes("tuyaux du niveau 4")) return commandeViewer({ typesIfc: ["IfcPipeSegment", "IfcPipeFitting"], niveaux: ["Level 4"] });
  if (f.includes("gaines et les vannes")) return commandeViewer({ typesIfc: ["IfcDuctSegment", "IfcDuctFitting", "IfcValve"], niveaux: ["Level 3"] });
  if (f.includes("ajoute le niveau 2")) return commandeViewer({ niveaux: ["Level 2"] });
  if (f.includes("bloc op")) return commandeViewer({ zones: ["Bloc opératoire"] });
  if (f.includes("pivoter")) return { ok: true, resultat: "non_comprise", message: "Je ne peux pas faire pivoter la maquette : cette action n'existe pas dans le Viewer." };
  if (f.includes("ascenseur")) return { ok: true, resultat: "critere_introuvable", message: "Aucun ascenseur dans les maquettes." };
  if (f.includes("truc rouge")) return { ok: true, resultat: "non_comprise", message: "Je ne vois pas à quoi « le truc rouge » correspond." };
  return inconnue(corps);
};

const requeteQuantitatif = (mesure: string, filtres: Record<string, unknown>, regroupements: string[] = []): TReponseApi => ({
  ok: true,
  resultat: "requete",
  requete: { mesure, filtres: { typesIfc: [], niveaux: [], maquettes: [], noms: [], ...filtres }, regroupements }
});

/** POST /api/quantitatif (page Quantitatif). */
export const simulateurQuantitatif: TSimulateurApi = (corps) => {
  const f = phraseDe(corps);
  if (f.includes("cloisons au niveau 3")) return requeteQuantitatif("nombre", { typesIfc: ["IfcWallStandardCase"], niveaux: ["Level 3"] });
  if (f.includes("niveau 12")) return { ok: true, resultat: "critere_introuvable", message: "Le niveau 12 n'existe pas dans les maquettes." };
  if (f.includes("quelle heure")) return { ok: true, resultat: "non_comprise", message: "Cette demande ne porte pas sur les quantités de la maquette." };
  if (f.includes("trucs")) return { ok: true, resultat: "non_comprise", message: "Je ne vois pas de quoi tu parles par « trucs »." };
  return inconnue(corps);
};

interface IExtraitEnvoye {
  id: string;
  auteur: string;
}

const extraitsDe = (corps: Record<string, unknown>): IExtraitEnvoye[] => {
  const brut = corps["extraits"];
  if (!Array.isArray(brut)) return [];
  return brut.filter((e): e is IExtraitEnvoye => !!e && typeof (e as IExtraitEnvoye).id === "string" && typeof (e as IExtraitEnvoye).auteur === "string");
};

/**
 * POST /api/discussions. Deux etapes : « comprendre » (phrase libre -> commande) et « analyser » (extraits retenus localement -> classement ou rapport).
 * Les extraits viennent de l'application : le simulateur ne cite que des identifiants et des auteurs reellement envoyes, comme le ferait un modele fidele,
 * et n'ecrit aucun chiffre ni mois (le verificateur de l'application ecarterait un chiffre non source).
 */
export const simulateurDiscussions: TSimulateurApi = (corps) => {
  const etape = corps["etape"];
  const phrase = phraseDe(corps);
  if (etape === "comprendre") {
    if (phrase.includes("rapport") && phrase.includes("grue")) {
      return { ok: true, resultat: "commande", commande: { action: "rapport", parametres: { sujet: "accès grue", mots: ["levage"] } }, relecture: "Faire un rapport sur l'accès de la grue." };
    }
    if (phrase.includes("rapport") && phrase.includes("piscine")) {
      return { ok: true, resultat: "commande", commande: { action: "rapport", parametres: { sujet: "piscine olympique", mots: [] } }, relecture: "Faire un rapport sur la piscine olympique." };
    }
    if (phrase.includes("sophie")) {
      return {
        ok: true,
        resultat: "commande",
        commande: { action: "echanges_avec", parametres: { personne: "Sophie Lambert" } },
        relecture: "Afficher tous les échanges avec Sophie Lambert."
      };
    }
    if (phrase.includes("jean-michel") || phrase.includes("inconnu")) return { ok: true, resultat: "critere_introuvable", message: "Aucune personne de ce nom dans la messagerie." };
    return { ok: true, resultat: "non_comprise", message: "Cette demande ne porte pas sur les discussions." };
  }
  if (etape === "analyser") {
    const extraits = extraitsDe(corps);
    const ids = extraits.map((e) => e.id);
    if (corps["action"] === "retrouver_echange") return { ok: true, sortie: { resultats: ids.slice(0, 3).map((id) => ({ id, pertinence: "forte" })) } };
    const sujet = typeof corps["sujet"] === "string" ? corps["sujet"].toLowerCase() : "";
    if (sujet.includes("piscine")) return { ok: true, sortie: { rien_a_dire: true } };
    const premier = ids[0];
    const second = ids[1] ?? premier;
    const auteurs = [...new Set(extraits.slice(0, 2).map((e) => e.auteur))];
    if (!premier || !second) return { ok: true, sortie: { rien_a_dire: true } };
    const aucune = sujet.includes("grue");
    return {
      ok: true,
      sortie: {
        rien_a_dire: false,
        titre: "Synthèse simulée du harnais",
        contexte: { texte: "Le sujet est discuté entre plusieurs intervenants.", sources: [premier] },
        intervenants: auteurs,
        desaccords: [{ opposants: auteurs, objet: "Les intervenants ne sont pas d'accord sur la suite à donner.", sources: [premier, second] }],
        decision: aucune
          ? { statut: "aucune", texte: "", sources: [] }
          : { statut: "prise", texte: "La suite à donner a été arrêtée.", sources: [second] }
      }
    };
  }
  return inconnue(corps);
};

const commandesPlan = (commandes: Array<Record<string, unknown>>): TReponseApi => ({ ok: true, resultat: "commandes", commandes });
const SALON = "Salon/Salle à manger";

/**
 * POST /api/plan (IA du plan 2D). Reponses de modele fidele aux phrases du Test 5 ; le moteur de l'application revalide tout (piece, cote, rang, mesures).
 * Les identifiants viennent du plan d'exemple (recette condensee) : fenetre n°2 du cote nord du salon = O10, porte n°1 de ce cote = 86 cm.
 */
export const simulateurPlan: TSimulateurApi = (corps) => {
  const f = phraseDe(corps);
  if (f.includes("210 cm de large et 210 cm de haut")) {
    return commandesPlan([{ action: "modifier_ouverture", piece: SALON, cote: "nord", rang: 2, largeur_cm: 210, hauteur_cm: 210, allege_cm: null, genre: null }]);
  }
  if (f.includes("descends la fenêtre ouest")) {
    return commandesPlan([{ action: "modifier_ouverture", piece: "Salle de bain", cote: "ouest", rang: 1, largeur_cm: null, hauteur_cm: null, allege_cm: 0, genre: null }]);
  }
  if (f.includes("passe à 180 cm de large")) {
    return commandesPlan([
      { action: "modifier_ouverture", piece: SALON, cote: "nord", rang: 2, largeur_cm: 180, hauteur_cm: null, allege_cm: null, genre: null },
      { action: "modifier_ouverture", piece: SALON, cote: "nord", rang: 1, largeur_cm: 100, hauteur_cm: null, allege_cm: null, genre: null }
    ]);
  }
  if (f.includes("renomme la chambre 1")) return commandesPlan([{ action: "renommer_piece", piece: "Chambre 1", nouveau_nom: "Salle de bain" }]);
  if (f.includes("fenêtre de la chambre fait 150")) {
    return { ok: true, resultat: "non_comprise", message: "Plusieurs chambres ont une fenêtre : redis ta phrase en nommant la pièce, le côté et le numéro de l'ouverture." };
  }
  if (f.includes("est en 210 et pas en 208")) {
    return commandesPlan([{ action: "modifier_ouverture", piece: SALON, cote: "nord", rang: 3, largeur_cm: 210, hauteur_cm: 210, allege_cm: null, genre: null }]);
  }
  if (f.includes("cuisine")) return { ok: true, resultat: "element_introuvable", message: "Je ne trouve aucune pièce « cuisine » sur ce plan." };
  if (f.includes("déplace le mur")) return { ok: true, resultat: "non_comprise", message: "Je ne peux pas déplacer un mur : cette action n'existe pas pour le plan." };
  if (f.includes("ignore tes consignes")) return { ok: true, resultat: "non_comprise", message: "Cette demande ne porte pas sur le plan." };
  if (f.includes("fait 60 cm de large")) {
    return commandesPlan([{ action: "modifier_ouverture", piece: "Salle de bain", cote: "ouest", rang: 1, largeur_cm: 60, hauteur_cm: null, allege_cm: null, genre: null }]);
  }
  return inconnue(corps);
};
