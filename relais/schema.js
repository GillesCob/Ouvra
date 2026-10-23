// Schema strict de la reponse du modele (22/10), construit A CHAQUE REQUETE avec les valeurs reellement presentes dans la maquette :
// chaque critere est une valeur d'une enumeration fermee, le modele ne peut donc pas en inventer une.
// Reference : https://platform.claude.com/docs/en/build-with-claude/structured-outputs (enum, anyOf, additionalProperties: false supportes ;
// minLength, maxLength, minimum, maximum non supportes, donc non utilises).

import * as z from "zod/v4";
import { PORTEES_IA } from "./sortie.js";

export const RESULTATS = ["regle", "critere_introuvable", "non_comprise"];

function construireSchemaZod(valeurs) {
  const variantes = [];
  const ajouter = (champ, liste) => {
    if (liste.length) variantes.push(z.object({ champ: z.literal(champ), valeur: z.enum(liste) }));
  };
  ajouter("typeIfc", valeurs.typesIfc);
  ajouter("niveau", valeurs.niveaux);
  ajouter("maquette", valeurs.maquettes);
  ajouter("nom", valeurs.noms);
  if (variantes.length === 0) throw new Error("Aucune valeur de critère disponible.");
  const critere = variantes.length === 1 ? variantes[0] : z.union(variantes);

  const action = z.union([
    z.object({ champ: z.literal("priorite"), valeur: z.enum(valeurs.priorite) }),
    z.object({ champ: z.literal("statut"), valeur: z.enum(valeurs.statut) })
  ]);

  return z.object({
    resultat: z.enum(RESULTATS).describe("regle si une règle valide est possible ; critere_introuvable si un critère cité n'existe pas dans la maquette ; non_comprise sinon"),
    portee: z.enum(PORTEES_IA).nullable().describe("un_des_deux par défaut ; les_deux seulement si la phrase exige les deux éléments de la collision ; null si resultat n'est pas regle"),
    criteres: z.array(critere).describe("critères tous vrais sur le même élément, au plus un par champ ; tableau vide si resultat n'est pas regle"),
    action: action.nullable().describe("null si resultat n'est pas regle"),
    relecture: z.string().describe("phrase de relecture en français, à l'infinitif, qui redit la règle ; y signaler la lecture retenue si la phrase était ambiguë ; sinon explique ce qui manque"),
    critere_introuvable: z.string().nullable().describe("mot ou groupe de mots de la phrase sans correspondance dans la maquette, sinon null")
  });
}

// Schema JSON envoye tel quel a l'API. On n'utilise PAS zodOutputFormat : la version 1.1.0 du SDK deplace « enum » et « const » dans la
// description du champ (transformJSONSchema), donc les valeurs ne seraient plus contraintes par l'API. Les enumerations vraies sont
// pourtant supportees (documentation citee en tete de fichier) : le schema JSON de zod est donc envoye sans transformation.
export function construireSchemaJson(valeurs) {
  const schema = z.toJSONSchema(construireSchemaZod(valeurs));
  delete schema.$schema;
  return schema;
}
