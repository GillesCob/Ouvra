// Garde-fou (30/10, demo du 3/11) : une phrase « Demande a l'IA » destinee a la zone IA du Quantitatif ne doit JAMAIS etre refusee par celle-ci.
// Regles du Quantitatif (relais/consigneQuantitatif.js) : une seule requete, une seule mesure, aucune action ni detection de collision, « niveau 2 » et non « R+2 ».
// Une phrase de EXEMPLES_QUANTITATIF est toujours acceptee (reconnue sans IA). Sinon controle LOCAL et conservateur : mieux vaut ecarter une phrase douteuse
// (l'encart de la phrase d'exemple prend alors le relais) que proposer une phrase que le Quantitatif refuserait.

import { reconnaitreExemple } from "./quantitatifExemples.js";
import { normaliser } from "./reglesCollision.js";

// Une famille de mesure par ligne : plusieurs familles dans une phrase = plusieurs requetes = refus.
const FAMILLES_MESURE = [/\b(combien|nombre|quantite|liste|compte\w*)\b/, /\b(longueur|lineaire)\b/, /\bsurface\b/, /\bvolume\b/];
const DEMANDES = /\b(compte\w*|combien|donne\w*|liste|calcule\w*|mesure\w*|sors\w*)\b/g;
const ACTIONS = /\b(deposer|depose\w*|refaire|refais|reprendre|reprends|affiche\w*|isole\w*|colore\w*|deplace\w*|modifi\w*|supprim\w*|detect\w*|filtre\w*|trie\w*)\b/;

export function phraseQuantitatifAcceptable(phrase) {
  if (typeof phrase !== "string" || !phrase.trim()) return false;
  if (reconnaitreExemple(phrase)) return true;
  const t = normaliser(phrase);
  if (/collision/.test(t) || /\br\s*\+\s*\d/.test(t)) return false;
  if (ACTIONS.test(t) || (t.match(DEMANDES) || []).length > 1) return false;
  if (FAMILLES_MESURE.filter((re) => re.test(t)).length > 1) return false;
  if ((t.match(/\?/g) || []).length > 1 || /\bet a\b/.test(t)) return false;
  return true;
}
