// Schemas stricts des reponses du modele pour POST /api/discussions (24/10), construits A CHAQUE REQUETE avec les valeurs reellement presentes :
//  - comprendre : une variante par action du REGISTRE (src/discussionsIARegistre.js) ; les personnes sont une enumeration fermee des noms de la
//    messagerie, les statuts une enumeration fermee ; une action ajoutee au registre entre toute seule dans le schema ;
//  - analyser : les numeros de messages cites sont une enumeration fermee des numeros REELLEMENT envoyes (M1..Mn), le modele ne peut pas en inventer.
// Memes contraintes que relais/schema.js (enum, anyOf, additionalProperties: false supportes ; bornes non supportees, donc retirees) :
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs

import * as z from "zod/v4";
import { UNITES } from "../src/reglesCollision.js";
import { REGISTRE, PERTINENCES } from "../src/discussionsIAMoteur.js";
import { STATUTS_SUJET } from "../src/discussionsIARegistre.js";
import { STATUTS_DECISION } from "../src/discussionsIARapportNormaliser.js";

export const RESULTATS_COMPRENDRE = ["commande", "critere_introuvable", "non_comprise"];

// SCHEMA PLAT, jamais d'union imbriquee (25/10) : la premiere version (une union de variantes d'action, chacune avec une periode elle-meme union de 4
// variantes) etait refusee par l'API en 400 « The compiled grammar is too large ». Les sorties structurees compilent le schema en grammaire : chaque
// union multiplie sa taille. Ici un seul objet : « action » est une enumeration fermee des actions du registre, les parametres de TOUTES les actions sont a
// plat a la racine, nuls quand l'action choisie ne s'en sert pas ; le moteur (validerCommande) verifie ensuite ceux qu'elle exige. Une action ajoutee
// au registre entre toute seule : son nom dans l'enumeration, ses parametres a la racine.

// La periode a plat : { type, nombre, unite, date, du, au }, chaque champ nul s'il ne sert pas au type choisi.
const PERIODE_TYPES = ["depuis", "depuis_le", "avant", "entre"];
const periodeZod = () => z.object({
  type: z.enum(PERIODE_TYPES).nullable(),
  nombre: z.number().int().nullable().describe("depuis : nombre de jours, semaines ou mois"),
  unite: z.enum(UNITES).nullable(),
  date: z.string().nullable().describe("depuis_le et avant : jour AAAA-MM-JJ"),
  du: z.string().nullable().describe("entre : premier jour AAAA-MM-JJ"),
  au: z.string().nullable().describe("entre : dernier jour AAAA-MM-JJ")
}).describe("depuis : les N derniers jours, semaines ou mois jusqu'à aujourd'hui ; depuis_le : du jour indiqué inclus jusqu'à aujourd'hui ; avant : avant le jour indiqué ; entre : du premier au dernier jour inclus ; type null et tous les champs null si la phrase ne parle pas de période");

// Periode a plat -> periode du moteur (src/reglesCollision.js), ou null. Les champs inutiles au type sont ignores.
export function periodeDepuisPlat(plat) {
  if (!plat || typeof plat !== "object" || !plat.type) return null;
  if (plat.type === "depuis") return { type: "depuis", nombre: plat.nombre, unite: plat.unite };
  if (plat.type === "depuis_le" || plat.type === "avant") return { type: plat.type, date: plat.date };
  if (plat.type === "entre") return { type: "entre", du: plat.du, au: plat.au };
  return { type: plat.type };
}

// Parametres de tous les actions du registre, fusionnes par nom (meme nom = meme genre ; la premiere description gagne).
function parametresFusionnes(registre) {
  const parNom = new Map();
  for (const action of registre.toutes()) {
    for (const def of action.parametres) {
      const deja = parNom.get(def.nom);
      if (deja && deja.genre !== def.genre) throw new Error("Le paramètre « " + def.nom + " » a deux genres différents dans le registre.");
      if (!deja) parNom.set(def.nom, def);
    }
  }
  return Array.from(parNom.values());
}

function champDe(def, noms) {
  let champ;
  if (def.genre === "personne") champ = noms.length ? z.enum(noms).nullable() : null;
  else if (def.genre === "texte") champ = z.string().nullable();
  else if (def.genre === "mots") champ = z.array(z.string());
  else if (def.genre === "periode") champ = periodeZod();
  else if (def.genre === "statuts") champ = z.array(z.enum(STATUTS_SUJET));
  else champ = z.boolean();
  return champ && def.description && def.genre !== "periode" ? champ.describe(def.description) : champ;
}

function construireComprendreZod(valeurs, registre) {
  // Sans aucune personne connue, une action qui exige une personne est inutilisable : elle n'entre pas dans l'enumeration.
  const sansPersonne = valeurs.personnes.length === 0;
  const actions = registre.toutes().filter((a) => !(sansPersonne && a.parametres.some((p) => p.obligatoire && p.genre === "personne")));
  if (!actions.length) throw new Error("Aucune action disponible.");
  const champs = {
    resultat: z.enum(RESULTATS_COMPRENDRE).describe("commande si une commande valide est possible ; critere_introuvable si une personne citée n'existe pas dans la messagerie ; non_comprise sinon"),
    action: z.enum(actions.map((a) => a.nom)).nullable().describe("l'action choisie ; null si resultat n'est pas commande. Les paramètres ci-dessous ne servent qu'à l'action choisie : les autres restent null, tableau vide ou faux")
  };
  for (const def of parametresFusionnes({ toutes: () => actions })) {
    const champ = champDe(def, valeurs.personnes);
    if (champ) champs[def.nom] = champ;
  }
  champs.relecture = z.string().describe("phrase de relecture en français, à l'infinitif, qui redit la demande ; y signaler la lecture retenue si la phrase était ambiguë ; sinon explique ce qui manque");
  champs.element_introuvable = z.string().nullable().describe("nom ou groupe de mots de la phrase sans correspondance dans la messagerie, sinon null");
  return z.object(champs);
}

// Mots-cles que zod ajoute (bornes d'un entier) et que la sortie structuree ne supporte pas.
const MOTS_CLES_NON_SUPPORTES = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern", "minItems", "maxItems"];
function retirerMotsClesNonSupportes(noeud) {
  if (Array.isArray(noeud)) { noeud.forEach(retirerMotsClesNonSupportes); return; }
  if (!noeud || typeof noeud !== "object") return;
  MOTS_CLES_NON_SUPPORTES.forEach((mot) => { delete noeud[mot]; });
  Object.values(noeud).forEach(retirerMotsClesNonSupportes);
}

// Schema JSON envoye tel quel a l'API (pas de zodOutputFormat : meme raison que relais/schema.js, le SDK deplacerait les enum dans la description).
function versJson(schemaZod) {
  const schema = z.toJSONSchema(schemaZod);
  delete schema.$schema;
  retirerMotsClesNonSupportes(schema);
  return schema;
}

export const construireSchemaComprendreJson = (valeurs, registre = REGISTRE) => versJson(construireComprendreZod(valeurs, registre));

// ids : les numeros reellement envoyes. auteurs : les noms reels des auteurs de ces messages (enumeration fermee, utilisee seulement pour le rapport).
// sortie : "liste" (classement) ou "rapport" (synthese au FORMAT FIXE du 26/10 : titre, contexte, intervenants, desaccords, decision), lue dans le registre.
// Schema plat sans union d'objets (voir plus haut) : des objets et des tableaux imbriques seulement.
export function construireSchemaAnalyseJson(sortie, ids, auteurs = []) {
  if (!ids.length) throw new Error("Aucun extrait.");
  const id = z.enum(ids);
  if (sortie === "liste") {
    return versJson(z.object({
      resultats: z.array(z.object({ id, pertinence: z.enum(PERTINENCES) })).describe("messages qui parlent vraiment du sujet, du plus au moins pertinent ; tableau vide si aucun")
    }));
  }
  if (!auteurs.length) throw new Error("Aucun auteur.");
  const auteur = z.enum(auteurs);
  return versJson(z.object({
    rien_a_dire: z.boolean().describe("vrai si aucun message ne dit quoi que ce soit sur le sujet ; alors les autres champs restent vides"),
    titre: z.string().describe("titre court du sujet traité (une ligne), qui reprend le sujet demandé"),
    contexte: z.object({
      texte: z.string().describe("explication du contexte en deux ou trois phrases, UNIQUEMENT ce que disent les messages cités"),
      sources: z.array(id).describe("numéros des messages qui disent ce contexte ; au moins un")
    }),
    intervenants: z.array(auteur).describe("les personnes qui ont réellement pris part à l'échange sur ce sujet"),
    desaccords: z.array(z.object({
      opposants: z.array(auteur).describe("qui s'oppose"),
      objet: z.string().describe("à quoi chacun s'oppose, une ou deux phrases, au présent"),
      sources: z.array(id).describe("numéros des messages qui expriment ce désaccord ; au moins un")
    })).describe("désaccords exprimés dans les messages ; tableau vide s'il n'y en a aucun"),
    decision: z.object({
      statut: z.enum(STATUTS_DECISION).describe("prise : décision énoncée clairement ; rapportee : décision rapportée de seconde main ; incertaine : décision envisagée ou ambiguë ; aucune : aucune décision exprimée"),
      texte: z.string().describe("la décision finale telle qu'écrite dans les messages ; chaîne vide si statut aucune"),
      sources: z.array(id).describe("numéros des messages qui disent la décision ; vide si statut aucune")
    })
  }));
}
