// Viewer par commande (24/10) : ce que la page envoie au relais POST /api/commande. Seuls des MOTS partent vers l'IA (types IFC, niveaux, maquettes,
// quelques noms d'elements proches de la phrase), lus sur les maquettes chargees : jamais la geometrie. Reutilise la lecture des maquettes des
// regles de collision (src/reglesValeurs.js) ; fonction pure, la scene et les maquettes sont passees en parametre.

import { valeursPourIA, NOMS_MAX } from "./reglesValeurs.js";
import { normaliser } from "./reglesCollision.js";
import { canoniqueNiveau } from "./commandesViewer.js";

// Mots d'ordre de la phrase, sans rapport avec le nom d'un element (« affiche », « moi »...) : retires avant la recherche des noms proches.
const MOTS_DE_COMMANDE = new Set([
  "affiche", "afficher", "affichez", "montre", "montrer", "montrez", "isole", "isoler", "isolez", "garde", "garder", "gardez", "vois", "voir", "fais", "faire",
  "moi", "uniquement", "seul", "seule", "seuls", "seules", "seulement", "tout", "toute", "toutes", "tous", "reaffiche", "reafficher", "remets", "remettre",
  "evidence", "mets", "mettre", "met", "surligne", "surligner", "repere", "reperer", "zoome", "zoomer", "cadre", "cadrer", "sur", "les", "des", "une", "dans",
  "avec", "pour", "que", "qui", "niveau", "niveaux", "etage", "etages", "maquette", "maquettes"
]);

export function retirerMotsDeCommande(phrase) {
  return normaliser(phrase).split(/[^a-z0-9]+/).filter((mot) => mot && !MOTS_DE_COMMANDE.has(mot)).join(" ");
}

// Niveaux regroupes comme dans le drawer du Viewer (« Level 2 Ceiling » et « Level 2 TOS » sont « Level 2 »), sans doublon.
export function niveauxCanoniques(niveaux) {
  const vus = new Set((niveaux || []).map(canoniqueNiveau).filter(Boolean));
  return Array.from(vus).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
}

// Noms COMPLETS (avec le numero Revit final, que les noms proches n'ont pas) des elements dont le numero est cite dans la phrase : « la vanne 1165462 ».
// Seuls les nombres de 4 chiffres ou plus comptent, au plus ELEMENTS_PAR_NUMERO_MAX noms au total.
const ELEMENTS_PAR_NUMERO_MAX = 4;

export function nomsParNumero(metaScene, phrase) {
  const numeros = new Set((String(phrase || "").match(/\d{4,}/g) || []));
  if (!numeros.size || !metaScene || !metaScene.metaObjects) return [];
  const trouves = [];
  for (const meta of Object.values(metaScene.metaObjects)) {
    const nom = meta && meta.name;
    const fin = typeof nom === "string" ? /:(\d{4,})$/.exec(nom) : null;
    if (fin && numeros.has(fin[1]) && nom.length <= 160 && !trouves.includes(nom)) {
      trouves.push(nom);
      if (trouves.length >= ELEMENTS_PAR_NUMERO_MAX) break;
    }
  }
  return trouves;
}

// Bornes du relais (relais/entree.js et relais/entreeCommande.js) : au-dela, le serveur refuse TOUTE la requete avec un message trompeur. On les respecte
// ici, en gardant les premieres valeurs ; une valeur trop longue est ecartee (la tronquer en ferait une valeur inconnue). A garder alignees sur le relais.
const BORNES = {
  typesIfc: { liste: 40, element: 80 },
  niveaux: { liste: 40, element: 80 },
  maquettes: { liste: 40, element: 80 },
  noms: { liste: NOMS_MAX, element: 160 },
  zones: { liste: 30, element: 60 }
};

export function borner(valeurs) {
  const borne = {};
  for (const [nom, { liste, element }] of Object.entries(BORNES)) {
    borne[nom] = (Array.isArray(valeurs[nom]) ? valeurs[nom] : []).filter((v) => typeof v === "string" && v.length <= element).slice(0, liste);
  }
  return borne;
}

export function valeursPourCommande(metaScene, maquettes, phrase, zones = []) {
  const v = valeursPourIA(metaScene, maquettes, retirerMotsDeCommande(phrase), { priorite: [], statut: [] });
  const precis = nomsParNumero(metaScene, phrase);
  const noms = [...precis, ...v.noms.filter((n) => !precis.includes(n))].slice(0, NOMS_MAX);
  return borner({ typesIfc: v.typesIfc, niveaux: niveauxCanoniques(v.niveaux), maquettes: v.maquettes, noms, zones: Array.from(zones) });
}
