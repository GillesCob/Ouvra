// Traduction d'une phrase en commande du Viewer (24/10), POST /api/commande. Meme orchestration que relais/traduire.js (modele, effort, delai, codes
// d'erreur stables : tout est repris de ce module, aucun reglage en double) avec le schema, la consigne et la revalidation propres aux commandes.
// Le client est injecte : les tests passent un faux client, le relais reel un Anthropic() cree a la demande (api/commande.js).

import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { MODELE, MAX_JETONS, DELAI_MS, codeDeErreur } from "./traduire.js";
import { construireSchemaCommandeJson } from "./schemaCommande.js";
import { CONSIGNE_COMMANDE, messageCommande } from "./consigneCommande.js";
import { convertirSortieCommande } from "./sortieCommande.js";

const echec = (code) => ({ ok: false, code });

export async function traduireCommande({ phrase, valeurs, etat = null }, { client }) {
  const aucuneValeur = !(valeurs.typesIfc.length || valeurs.niveaux.length || valeurs.maquettes.length || valeurs.noms.length || (valeurs.zones || []).length);
  if (aucuneValeur) {
    return { ok: true, resultat: "critere_introuvable", message: "Aucune maquette chargée ne permet de définir un critère pour le moment." };
  }
  if (!client) return echec("ia_indisponible");

  let reponse;
  try {
    reponse = await client.messages.parse(
      {
        model: MODELE,
        max_tokens: MAX_JETONS,
        system: CONSIGNE_COMMANDE,
        messages: [{ role: "user", content: messageCommande(phrase, valeurs, etat) }],
        thinking: { type: "between_tools" },
        output_config: { effort: "low", format: jsonSchemaOutputFormat(construireSchemaCommandeJson(valeurs), { transform: false }) }
      },
      { timeout: DELAI_MS, maxRetries: 1 }
    );
  } catch (erreur) {
    // Seul le statut est journalise : ni le message brut, ni la phrase, ni la cle.
    console.error("[ia-commandes] appel impossible, statut " + (erreur && erreur.status ? erreur.status : "reseau"));
    return echec(codeDeErreur(erreur));
  }

  if (reponse.stop_reason === "refusal") return echec("refus");
  if (reponse.stop_reason === "max_tokens" || !reponse.parsed_output) return echec("sortie_invalide");

  const resultat = convertirSortieCommande(reponse.parsed_output, valeurs, phrase);
  const usage = reponse.usage ? { entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens } : undefined;
  return { ...resultat, usage };
}
