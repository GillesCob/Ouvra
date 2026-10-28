// Discussions par commande IA (24/10) : les actions du registre (src/discussionsIARegistre.js). Une action = un objet ; en ajouter une ne demande
// aucune autre modification (schema, validation, consigne et affichage lisent le registre).
//
// selectionner(parametres, index, contexte) rend :
//   { messages: [entree], mis: Set(mk), scores: Map(mk -> note) | null, termes: [terme], voisins: Set(mk), erreur?: string }
//   messages : tout ce qui est retenu (pour un classement par l'IA : la preselection locale) ; mis : les messages a mettre en evidence ;
//   voisins : messages gardes seulement pour le contexte (reponse a un message qui porte le mot), jamais mis en evidence.
// index : src/discussionsIAIndex.js ; contexte : { maintenant: ms }.

import { filImplique } from "./discussionsIAIndex.js";
import { classer, construireTermes } from "./discussionsIATexte.js";
import { periodeEnMs } from "./reglesCollision.js";
import { STATUTS_SUJET } from "./discussionsIARegistre.js";

export const MAX_CLASSEMENT = 30; // messages envoyes a l'IA pour retrouver un echange
export const MAX_RAPPORT = 40; // messages envoyes a l'IA pour un rapport (contexte compris)
const GRAINES_RAPPORT = 24; // messages les plus pertinents autour desquels on ajoute le contexte

const vide = (extra = {}) => ({ messages: [], mis: new Set(), scores: null, termes: [], voisins: new Set(), ...extra });

const personneParNom = (index, nom) => index.personnes.find((p) => p.nom === nom) || null;

// Filtre de periode ({ type: "depuis" | "depuis_le" | "avant" | "entre", ... } ou null = pas de filtre) -> predicat sur une entree.
function dansPeriode(periode, contexte) {
  if (!periode) return () => true;
  const { debut, fin } = periodeEnMs(periode, contexte.maintenant);
  return (entree) => entree.quand >= debut && entree.quand <= fin;
}

// Messages ecrits par la personne, ou qui la mentionnent, ou posts dans un 1 a 1 avec elle ou un sujet auquel elle est taguee.
function concernePersonne(index, id) {
  return (entree) => {
    const fil = index.filParCle.get(entree.filCle);
    return entree.auteur === id || entree.mentions.includes(id) || fil.interlocuteur === id || fil.tagues.includes(id);
  };
}

// Preselection locale par mots, commune a la recherche par sujet et au rapport.
function preselectionnerParMots(p, index, contexte, { max, avecVoisins }) {
  const termes = construireTermes([p.sujet, ...(p.mots || [])]);
  if (!termes.length) return vide({ erreur: "Le sujet ne contient aucun mot exploitable. Précise-le un peu." });
  const dans = dansPeriode(p.periode, contexte);
  let id = null;
  if (p.personne) {
    const trouvee = personneParNom(index, p.personne);
    if (!trouvee) return vide({ erreur: "Personne inconnue : " + p.personne + "." });
    id = trouvee.id;
  }
  const concerne = id ? concernePersonne(index, id) : () => true;
  const pool = index.messages.filter((m) => dans(m) && concerne(m));
  const classes = classer(pool, termes);
  const retenus = classes.slice(0, avecVoisins ? GRAINES_RAPPORT : max);
  const scores = new Map(classes.map((c) => [c.entree.mk, c.score]));
  const mis = new Set(retenus.map((c) => c.entree.mk));
  const voisins = new Set();
  const gardes = new Map(retenus.map((c) => [c.entree.mk, c.entree]));
  if (avecVoisins) {
    // Contexte : le message qui precede chaque message retenu (la question a laquelle il repond), puis celui qui suit, tant qu'il reste de la place.
    for (const { entree } of retenus) {
      const fil = index.filParCle.get(entree.filCle);
      const i = fil.messages.indexOf(entree);
      for (const voisin of [fil.messages[i - 1], fil.messages[i + 1]]) {
        if (voisin && gardes.size < max && !gardes.has(voisin.mk) && dans(voisin)) { gardes.set(voisin.mk, voisin); voisins.add(voisin.mk); }
      }
    }
  }
  return { messages: Array.from(gardes.values()), mis, scores, termes, voisins };
}

const PARAM_SUJET = { nom: "sujet", genre: "texte", obligatoire: true, description: "le sujet cherché, en quelques mots (« cloison coupe-feu », « accès grue »)" };
const PARAM_MOTS = { nom: "mots", genre: "mots", description: "jusqu'à 6 mots ou synonymes proches du sujet, tels qu'on les écrirait dans un message de chantier (« EI60 », « incendie » pour « coupe-feu ») ; tableau vide si rien à ajouter" };
const PARAM_PERSONNE_FILTRE = { nom: "personne", genre: "personne", description: "seulement si la phrase limite la recherche à une personne ; null sinon" };
const PARAM_PERIODE = { nom: "periode", genre: "periode", description: "seulement si la phrase limite la recherche à une période ; null sinon" };

export const ACTIONS = [
  {
    nom: "echanges_avec",
    description: "Tous les échanges avec UNE personne (« montre-moi mes échanges avec Sophie », « tout ce que Karim a écrit »).",
    sortie: "liste",
    ia: false,
    parametres: [{ nom: "personne", genre: "personne", obligatoire: true, description: "la personne dont on veut les échanges" }, PARAM_PERIODE],
    selectionner(p, index, contexte) {
      const personne = personneParNom(index, p.personne);
      if (!personne) return vide({ erreur: "Personne inconnue : " + p.personne + "." });
      const dans = dansPeriode(p.periode, contexte);
      const messages = [];
      const mis = new Set();
      for (const fil of index.fils) {
        // Dans un 1 a 1 avec elle ou un sujet auquel elle est taguee, tout le fil est un echange avec elle ; ailleurs, seulement ses messages et ses mentions.
        const echange = fil.interlocuteur === personne.id || fil.tagues.includes(personne.id);
        for (const m of fil.messages) {
          if (!dans(m)) continue;
          const parle = m.auteur === personne.id || m.mentions.includes(personne.id);
          if (parle) { mis.add(m.mk); messages.push(m); } else if (echange) messages.push(m);
        }
      }
      return vide({ messages, mis });
    },
    relecture: (p) => "Afficher les échanges avec " + p.personne + "."
  },
  {
    nom: "retrouver_echange",
    description: "Retrouver le ou les échanges où l'on a parlé d'un SUJET (« trouve-moi l'échange où on a parlé de la grue »). Résultat : une liste de messages.",
    sortie: "liste",
    ia: true,
    parametres: [PARAM_SUJET, PARAM_MOTS, PARAM_PERSONNE_FILTRE, PARAM_PERIODE],
    selectionner: (p, index, contexte) => preselectionnerParMots(p, index, contexte, { max: MAX_CLASSEMENT, avecVoisins: false }),
    relecture: (p) => "Retrouver l'échange sur « " + p.sujet + " »."
  },
  {
    nom: "rapport",
    description: "Un RAPPORT, une synthèse de ce qui a été dit sur une problématique (« fais-moi un rapport sur », « qu'est-ce qui s'est dit sur », « qui a dit quoi sur »). Résultat : un texte structuré avec ses sources.",
    sortie: "rapport",
    ia: true,
    parametres: [PARAM_SUJET, PARAM_MOTS, PARAM_PERSONNE_FILTRE, PARAM_PERIODE],
    selectionner: (p, index, contexte) => preselectionnerParMots(p, index, contexte, { max: MAX_RAPPORT, avecVoisins: true }),
    relecture: (p) => "Faire un rapport sur « " + p.sujet + " »."
  },
  {
    nom: "etat_discussions",
    description: "Les discussions selon leur ÉTAT : non lues (« retard de lecture », « pas encore lu », « messages en attente de lecture », « ce que je n'ai pas lu »), non clôturées (ouvert, en cours, en attente), clôturées, urgentes (« les discussions non lues », « les sujets pas encore clos »).",
    sortie: "liste",
    ia: false,
    parametres: [
      { nom: "statuts", genre: "statuts", description: "statuts de sujet voulus ; « non clôturé » = ouvert, encours, attente ; tableau vide si la phrase n'en parle pas" },
      { nom: "nonLus", genre: "booleen", description: "vrai si la phrase demande les discussions non lues, y compris « retard de lecture », « pas encore lu », « messages en attente de lecture »" },
      { nom: "urgent", genre: "booleen", description: "vrai si la phrase demande les sujets urgents" },
      PARAM_PERSONNE_FILTRE
    ],
    verifier: (p) => (!(p.statuts && p.statuts.length) && !p.nonLus && !p.urgent ? "Précise l'état voulu : non lues, non clôturées, urgentes..." : null),
    selectionner(p, index) {
      const personne = p.personne ? personneParNom(index, p.personne) : null;
      if (p.personne && !personne) return vide({ erreur: "Personne inconnue : " + p.personne + "." });
      const messages = [];
      const mis = new Set();
      for (const fil of index.fils) {
        if (p.statuts && p.statuts.length && !(fil.statut && p.statuts.includes(fil.statut))) continue;
        if (p.nonLus && !(fil.nonLus > 0)) continue;
        if (p.urgent && !fil.urgent) continue;
        if (personne && !filImplique(fil, personne.id)) continue;
        fil.messages.forEach((m, i) => {
          messages.push(m);
          if (p.nonLus && i >= fil.messages.length - fil.nonLus) mis.add(m.mk); // les derniers messages recus sont les non lus
        });
      }
      return vide({ messages, mis });
    },
    relecture: (p) => "Afficher les discussions " + [p.nonLus ? "non lues" : "", p.urgent ? "urgentes" : "", (p.statuts || []).length ? "au statut " + p.statuts.join(" ou ") : ""].filter(Boolean).join(", ") + "."
  },
  {
    nom: "activite_periode",
    description: "Ce qui s'est dit sur une PÉRIODE, sans sujet précis (« ce qui s'est dit cette semaine », « les messages depuis le 20 octobre »), éventuellement pour une personne.",
    sortie: "liste",
    ia: false,
    parametres: [{ nom: "periode", genre: "periode", obligatoire: true, description: "la période demandée" }, PARAM_PERSONNE_FILTRE],
    selectionner(p, index, contexte) {
      const personne = p.personne ? personneParNom(index, p.personne) : null;
      if (p.personne && !personne) return vide({ erreur: "Personne inconnue : " + p.personne + "." });
      const dans = dansPeriode(p.periode, contexte);
      const concerne = personne ? concernePersonne(index, personne.id) : () => true;
      const messages = index.messages.filter((m) => dans(m) && concerne(m));
      return vide({ messages, mis: new Set(messages.map((m) => m.mk)) });
    },
    relecture: () => "Afficher ce qui s'est dit sur la période."
  }
];

export { STATUTS_SUJET };
