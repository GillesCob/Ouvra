// Fonction Vercel du relais IA du Viewer par commande (24/10) : POST /api/commande. Meme signature, meme couche HTTP (relais/http.js : methode,
// limite par visiteur, taille, JSON) et meme cle que api/regle.js ; seuls la validation d'entree et la traduction changent.
// La cle ANTHROPIC_API_KEY est une variable d'environnement de l'hebergeur : jamais dans le navigateur, jamais dans le depot.

import Anthropic from "@anthropic-ai/sdk";
import { creerGestionnaire } from "../relais/http.js";
import { validerEntreeCommande } from "../relais/entreeCommande.js";
import { traduireCommande } from "../relais/traduireCommande.js";

let client = null;
function clientAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

const gerer = creerGestionnaire({ client: clientAnthropic, valider: validerEntreeCommande, traduire: traduireCommande, etiquette: "ia-commandes" });

export default { fetch: (request) => gerer(request) };
