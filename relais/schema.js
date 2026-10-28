// Schema strict de la reponse du modele (22/10), construit A CHAQUE REQUETE avec les valeurs reellement presentes dans la maquette :
// chaque critere est une valeur d'une enumeration fermee, le modele ne peut donc pas en inventer une.
// Reference : https://platform.claude.com/docs/en/build-with-claude/structured-outputs (enum, anyOf, additionalProperties: false supportes ;
// minLength, maxLength, minimum, maximum non supportes, donc non utilises).

import * as z from "zod/v4";
import { PORTEES_IA } from "./sortie.js";
import { EVENEMENTS, PRESENCES, UNITES } from "../src/reglesCollision.js";

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
    z.object({ champ: z.literal("statut"), valeur: z.enum(valeurs.statut) }),
    z.object({ champ: z.literal("afficher") })
  ]);

  // Filtre sur la collision elle-meme : priorite et statut actuels (null = pas de filtre sur ce champ).
  const etat = z.object({
    priorite: z.enum(valeurs.priorite).nullable(),
    statut: z.enum(valeurs.statut).nullable()
  });

  // Filtre sur les echanges de la collision : messages (message), changements de priorite ou de statut (modification), ou les deux (activite).
  const periode = z.union([
    z.object({ type: z.literal("depuis"), nombre: z.number().int(), unite: z.enum(UNITES) }),
    z.object({ type: z.literal("depuis_le"), date: z.string() }),
    z.object({ type: z.literal("avant"), date: z.string() }),
    z.object({ type: z.literal("entre"), du: z.string(), au: z.string() })
  ]);
  const critereDate = z.object({
    evenement: z.enum(EVENEMENTS),
    presence: z.enum(PRESENCES).describe("au_moins_un : au moins un événement dans la période ; aucun : aucun événement dans la période (« sans réponse depuis 3 jours »)"),
    periode
  });

  // Numeros affiches des collisions reelles de la detection : enumeration fermee, le modele n'en invente aucun. Sans collision, tout entier est
  // accepte par le schema, mais convertirSortie refuse ensuite tout numero absent de valeurs.numeros.
  const numeros = valeurs.numeros && valeurs.numeros.length ? z.literal(valeurs.numeros) : z.number().int();

  return z.object({
    resultat: z.enum(RESULTATS).describe("regle si une règle valide est possible ; critere_introuvable si un critère cité n'existe pas dans la maquette ; non_comprise sinon"),
    portee: z.enum(PORTEES_IA).nullable().describe("un_des_deux par défaut ; les_deux seulement si la phrase exige les deux éléments de la collision ; null si resultat n'est pas regle"),
    criteres: z.array(critere).describe("critères sur les éléments, tous vrais sur le même élément, au plus un par champ ; tableau vide si la phrase ne cite aucun élément ou si resultat n'est pas regle"),
    numeros: z.array(numeros).describe("numéros affichés des collisions visées (« la collision 2 », « n°2 », « les collisions 2 et 5 ») ; tableau vide si la phrase ne cite aucun numéro"),
    etat: etat.nullable().describe("filtre sur la priorité et le statut actuels de la collision ; null si la phrase n'en parle pas"),
    dates: z.array(critereDate).describe("filtres de date sur les messages et modifications de la collision ; tableau vide si la phrase n'en parle pas"),
    action: action.nullable().describe("null si resultat n'est pas regle ; afficher quand la phrase demande seulement de voir, lister ou montrer des collisions"),
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
  retirerMotsClesNonSupportes(schema);
  return schema;
}

// Mots-cles que zod ajoute (bornes d'un entier) et que la sortie structuree ne supporte pas (liste de la documentation citee en tete de fichier).
// La borne reelle du nombre de jours est verifiee apres coup par le moteur (validerCritereDate), pas par le schema.
const MOTS_CLES_NON_SUPPORTES = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern", "minItems", "maxItems"];
function retirerMotsClesNonSupportes(noeud) {
  if (Array.isArray(noeud)) { noeud.forEach(retirerMotsClesNonSupportes); return; }
  if (!noeud || typeof noeud !== "object") return;
  MOTS_CLES_NON_SUPPORTES.forEach((mot) => { delete noeud[mot]; });
  Object.values(noeud).forEach(retirerMotsClesNonSupportes);
}
