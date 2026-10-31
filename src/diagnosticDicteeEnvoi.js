// Envoi automatique du journal de la dictee par mail (31/10), TEMPORAIRE : quand la dictee echoue, les evenements de la derniere ecoute partent vers
// POST /api/retour (Resend, deja en place) avec le type « diagnostic ». Jamais le texte dit : seulement des evenements, des durees et des comptes.
// Au plus un envoi par minute et 5 par session ; un echec d'envoi ne se voit jamais et ne gene jamais la dictee. A retirer avec le journal une fois la cause trouvee.
import { envoyerRetour, MESSAGE_MAX } from "./retourVisiteur.js";

const MARQUEUR = "--- nouvelle ecoute";
const PAGE = "Dictée IA";

// Corps du retour : motif, navigateur, puis les dernieres lignes de la DERNIERE ecoute, bornes a MESSAGE_MAX caracteres (les plus recentes gardees).
export function corpsDiagnostic({ lignes, motif, navigateur }) {
  const debut = lignes.map((l, i) => (String(l).startsWith(MARQUEUR) ? i : -1)).filter((i) => i >= 0).pop();
  const derniere = debut === undefined ? lignes : lignes.slice(debut);
  const entete = "Motif : " + motif + "\nNavigateur : " + String(navigateur || "inconnu").slice(0, 160) + "\n";
  let reste = MESSAGE_MAX - entete.length;
  const gardees = [];
  for (let i = derniere.length - 1; i >= 0 && reste > 0; i -= 1) {
    const ligne = String(derniere[i]);
    if (ligne.length + 1 > reste) break;
    gardees.unshift(ligne);
    reste -= ligne.length + 1;
  }
  return { type: "diagnostic", message: (entete + gardees.join("\n")).slice(0, MESSAGE_MAX), contact: "", page: PAGE, site: "" };
}

// Compteur UNIQUE pour toute la session (les panneaux IA sont plusieurs) : limites partagees.
export function creerEnvoiDiagnostic({ envoyer = envoyerRetour, maintenant = Date.now, navigateur = () => (typeof navigator !== "undefined" ? navigator.userAgent : "") } = {}) {
  let dernier = -Infinity;
  let total = 0;
  return {
    async signaler({ lignes, motif }) {
      if (!lignes || !lignes.length || total >= 5 || maintenant() - dernier < 60000) return;
      dernier = maintenant();
      total += 1;
      try { await envoyer(corpsDiagnostic({ lignes, motif, navigateur: navigateur() })); } catch { /* le diagnostic ne doit jamais gener la dictee */ }
    }
  };
}

export const envoiDiagnosticSession = creerEnvoiDiagnostic();
