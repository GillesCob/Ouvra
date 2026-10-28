// Fonction Vercel des retours de visiteurs (28/10) : POST /api/retour. Meme signature que les relais IA (api/regle.js). Variables d'environnement de l'hebergeur
// (jamais dans le navigateur ni dans le depot) : RESEND_API_KEY, RETOUR_DESTINATAIRE (adresse qui recoit les retours), RETOUR_EXPEDITEUR (« Ouvra <retours@...> »,
// sur un domaine verifie chez Resend). Absentes, la route repond 503 (relais/httpRetour.js).

import { creerGestionnaireRetour } from "../relais/httpRetour.js";

const gerer = creerGestionnaireRetour({ env: process.env });

export default { fetch: (request) => gerer(request) };
