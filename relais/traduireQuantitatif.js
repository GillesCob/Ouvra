// Traduction d'une phrase en requete de quantitatif (24/10), POST /api/quantitatif. Meme orchestration que relais/traduireCommande.js (modele, effort,
// delai, codes d'erreur stables : tout est repris de relais/traduire.js, aucun reglage en double) avec le schema, la consigne et la revalidation propres.
// Le client est injecte : les tests passent un faux client, le relais reel un Anthropic() cree a la demande (api/quantitatif.js).

import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { MODELE, MAX_JETONS, DELAI_MS, codeDeErreur } from "./traduire.js";
import { construireSchemaQuantitatifJson } from "./schemaQuantitatif.js";
import { CONSIGNE_QUANTITATIF, messageQuantitatif } from "./consigneQuantitatif.js";
import { convertirSortieQuantitatif } from "./sortieQuantitatif.js";

const echec = (code) => ({ ok: false, code });

export async function traduireQuantitatif({ phrase, valeurs }, { client }) {
  const aucuneValeur = !(valeurs.typesIfc.length || valeurs.niveaux.length || valeurs.maquettes.length || valeurs.noms.length);
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
        system: CONSIGNE_QUANTITATIF,
        messages: [{ role: "user", content: messageQuantitatif(phrase, valeurs) }],
        thinking: { type: "between_tools" },
        output_config: { effort: "low", format: jsonSchemaOutputFormat(construireSchemaQuantitatifJson(valeurs), { transform: false }) }
      },
      { timeout: DELAI_MS, maxRetries: 1 }
    );
  } catch (erreur) {
    // Seul le statut est journalise : ni le message brut, ni la phrase, ni la cle.
    console.error("[ia-quantitatif] appel impossible, statut " + (erreur && erreur.status ? erreur.status : "reseau"));
    return echec(codeDeErreur(erreur));
  }

  if (reponse.stop_reason === "refusal") return echec("refus");
  if (reponse.stop_reason === "max_tokens" || !reponse.parsed_output) return echec("sortie_invalide");

  const resultat = convertirSortieQuantitatif(reponse.parsed_output, valeurs);
  const usage = reponse.usage ? { entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens } : undefined;
  return { ...resultat, usage };
}
