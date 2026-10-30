// Discussions par commande IA (24/10) : le pipeline d'une demande, de la phrase au resultat affichable. Sans DOM ni reseau : les appels au relais
// (comprendre, analyser) et la lecture de la messagerie sont injectes, les tests passent des faux.
//
//   phrase -> exemple reconnu en local OU comprendre (IA) -> validerCommande -> selectionner (local)
//          -> [actions ia] preparerAnalyse -> analyser (IA) -> conclure (sources verifiees) -> resultat
//
// traiter(phrase) ne rejette jamais. Il rend :
//   { ok: true, type: "liste", commande, relecture, resultat, repli? }      resultat : voir construireResultat du moteur ; repli : l'analyse a echoue, classement local
//   { ok: true, type: "rapport", commande, relecture, resultat (discussions citees), rapport }
//   { ok: false, message }                                                   rien n'est applique, le message s'affiche dans la saisie
// Une action qui n'a aucun message candidat n'appelle PAS l'IA (aucun cout) : « Aucun ... » pour une liste, « Rien n'a ete dit... » pour un rapport.

import { REGISTRE, validerCommande, selectionner, resultatLocal, construireResultat, preparerAnalyse, conclureClassement, conclureRapport, resultatClasse, MESSAGE_RIEN } from "./discussionsIAMoteur.js";
import { reconnaitreExemple, EXEMPLES_DISCUSSIONS } from "./discussionsIAExemples.js";
import { normaliser } from "./reglesCollision.js";
import { messageRefus } from "./iaSaisieLogique.js";

const MESSAGE_INDEX_VIDE = "Il n'y a encore aucune discussion à explorer.";
const MESSAGE_ANALYSE = "L'analyse par l'IA a échoué.";

export function creerPipeline({ lireIndex, comprendre, analyser, maintenant = Date.now, registre = REGISTRE, exemples = EXEMPLES_DISCUSSIONS }) {
  async function obtenirCommande(phrase, index) {
    const exemple = reconnaitreExemple(phrase, exemples);
    const valeurs = { personnes: index.personnes.map((p) => p.nom) };
    if (exemple) {
      const verdict = validerCommande({ action: exemple.action, parametres: exemple.parametres }, valeurs, registre);
      if (verdict.ok) return { ok: true, commande: verdict.commande, relecture: exemple.relecture, demandeIA: exemple.demandeIA };
    }
    const reponse = await comprendre({ phrase, valeurs });
    if (!reponse.ok) return { ok: false, message: reponse.message };
    if (reponse.resultat !== "commande") return { ok: false, message: messageRefus(reponse.resultat, reponse.message) };
    // La commande du modele est reverifiee ici : rien n'est suppose.
    const verdict = validerCommande(reponse.commande, valeurs, registre);
    if (!verdict.ok) return { ok: false, message: verdict.erreur };
    return { ok: true, commande: verdict.commande, relecture: reponse.relecture || registre.obtenir(verdict.commande.action).relecture(verdict.commande.parametres) };
  }

  async function traiter(phrase) {
    try {
      const index = lireIndex();
      if (!index || !index.messages.length) return { ok: false, message: MESSAGE_INDEX_VIDE };
      const compris = await obtenirCommande(phrase, index);
      if (!compris.ok) return compris;
      const { commande, relecture, demandeIA } = compris;
      const action = registre.obtenir(commande.action);
      const selection = selectionner(commande, index, { maintenant: maintenant() }, registre);
      if (selection.erreur) return { ok: false, message: selection.erreur };

      if (!action.ia) {
        if (!selection.messages.length) return { ok: false, message: "Aucun échange ne correspond à cette demande." };
        return { ok: true, type: "liste", commande, relecture, resultat: resultatLocal(selection, index) };
      }

      if (!selection.messages.length) {
        // Aucun message ne contient un mot du sujet : pas d'appel a l'IA. Un rapport le dit, une recherche s'arrete la.
        if (action.sortie === "rapport") {
          const rapport = conclureRapport({ rien_a_dire: true }, new Map(), index, { sujet: commande.parametres.sujet, maintenant: maintenant() }).rapport;
          return { ok: true, type: "rapport", commande, relecture, resultat: construireResultat([], index), rapport };
        }
        return { ok: false, message: "Aucun message ne parle de « " + commande.parametres.sujet + " »." };
      }

      const { extraits, table } = preparerAnalyse(selection, index);
      const analyse = await analyser({ action: action.nom, phrase, sujet: commande.parametres.sujet, extraits });
      if (action.sortie === "liste") return conclureListe(analyse, { table, selection, index, commande, relecture });
      return conclureEnRapport(analyse, { table, selection, index, commande, relecture, demandeIA });
    } catch {
      // Filet : une erreur inattendue ne doit jamais bloquer la saisie. Le detail n'est pas affiche (il pourrait contenir du texte de message).
      return { ok: false, message: "La demande n'a pas pu être traitée. Réessayer ou choisir une phrase d'exemple." };
    }
  }

  function conclureListe(analyse, { table, selection, index, commande, relecture }) {
    if (!analyse.ok) {
      // Repli : l'analyse a echoue, la preselection locale (deja classee par mots) est montree telle quelle, et dit qu'elle n'est pas affinee.
      const meilleurs = selection.messages.filter((m) => selection.mis.has(m.mk)).slice(0, 10);
      const resultat = construireResultat(meilleurs.map((entree) => ({ entree, mis: true, score: selection.scores.get(entree.mk) })), index, { termes: selection.termes, ordre: "pertinence" });
      return { ok: true, type: "liste", commande, relecture, resultat, repli: (analyse.message || MESSAGE_ANALYSE) + " Résultat par mots seulement, sans l'IA." };
    }
    const verdict = conclureClassement(analyse.sortie, table);
    if (!verdict.ok) return { ok: false, message: "L'IA n'a pas renvoyé de classement exploitable." };
    if (!verdict.classes.length) return { ok: false, message: "Aucun échange ne parle clairement de « " + commande.parametres.sujet + " »." };
    return { ok: true, type: "liste", commande, relecture, resultat: resultatClasse(verdict.classes, index, selection.termes) };
  }

  // Phrase d'exemple a demande attachee (demo du rapport sur les collisions avec les gaines) : quand la decision du rapport attend un metre et que le modele n'a pas (ou a mal) renseigne demande_ia,
  // la demande de l'exemple est jointe, de facon deterministe. Jamais sur un rapport vide, une decision absente ou une decision qui ne parle pas d'un metre.
  function joindreDemande(rapport, demandeIA) {
    if (!demandeIA || rapport.vide || rapport.demandeIA || !rapport.decision || rapport.decision.statut === "aucune") return rapport;
    if (!/\bmetre\b/.test(normaliser(rapport.decision.texte || ""))) return rapport;
    return { ...rapport, demandeIA: { ...demandeIA } };
  }

  function conclureEnRapport(analyse, { table, selection, index, commande, relecture, demandeIA }) {
    if (!analyse.ok) return { ok: false, message: analyse.message || MESSAGE_ANALYSE };
    const verdict = conclureRapport(analyse.sortie, table, index, { sujet: commande.parametres.sujet, termes: selection.termes, maintenant: maintenant() });
    if (!verdict.ok) return { ok: false, message: "L'IA n'a pas renvoyé de rapport exploitable." };
    const citees = verdict.rapport.chronologie.map((s) => ({ entree: table.get(s.id), mis: true, score: 0 }));
    return { ok: true, type: "rapport", commande, relecture, resultat: construireResultat(citees, index, { termes: selection.termes }), rapport: joindreDemande(verdict.rapport, demandeIA) };
  }

  return { traiter };
}

export { MESSAGE_RIEN };
