// Historique des syntheses de conversation (28/10) : chaque rapport produit par l'IA et affiche (jamais « Voir un exemple de rapport ») est garde avec son
// nom (le titre du rapport) et sa date, puis rouvrable d'un clic SANS rappeler l'IA. Persistance : localStorage du navigateur (cle CLE_SYNTHESES).
// Premiere utilisation (cle absente) : deux syntheses de demonstration, construites a la demande sur les vrais messages de la demo (champ `demo`, pas de rapport stocke).
// Le stockage peut manquer ou etre plein (navigation privee) : rien ne leve d'exception, l'historique de la session reste affiche.
// Pur (ni DOM ni reseau) : le stockage est injecte (objet de type Storage), ce qui permet de le tester sous Node.

import { dateJJMMAAAA } from "./discussionsIARapportFormat.js";

export const CLE_SYNTHESES = "ouvra-discussions-syntheses";
export const SYNTHESES_MAX = 20;
export const DEMOS_SYNTHESES = { collision: "collision", coupeFeu: "coupe-feu" };
const JOUR_MS = 86400000;

const stockageParDefaut = () => { try { return globalThis.localStorage || null; } catch { return null; } };

// Les deux syntheses de demonstration : titres identiques a ceux des rapports modeles (src/discussionsIARapportModele.js).
function entreesDemo(maintenant) {
  return [
    { id: "demo-coupe-feu", nom: "Cloison coupe-feu du local technique R+2, 1h ou 2h", creeLe: maintenant - 2 * JOUR_MS, demo: DEMOS_SYNTHESES.coupeFeu },
    { id: "demo-collision", nom: "Collision entre la gaine rectangulaire et la cloison, couloir R+2", creeLe: maintenant - 5 * JOUR_MS, demo: DEMOS_SYNTHESES.collision }
  ];
}

const valide = (e) => !!e && typeof e.id === "string" && typeof e.nom === "string" && Number.isFinite(e.creeLe) && (!!e.rapport || !!e.recherche || typeof e.demo === "string");
const parRecent = (a, b) => b.creeLe - a.creeLe;

function ecrire(stockage, entrees) {
  try {
    if (!stockage) return false;
    stockage.setItem(CLE_SYNTHESES, JSON.stringify(entrees));
    return true;
  } catch {
    return false; // quota depasse ou stockage bloque
  }
}

// Plus recent d'abord. Cle absente (premiere utilisation) : les deux syntheses de demonstration, enregistrees. JSON corrompu : liste vide.
export function listerSyntheses({ stockage = stockageParDefaut(), maintenant = Date.now() } = {}) {
  let brut = null;
  try { brut = stockage ? stockage.getItem(CLE_SYNTHESES) : null; } catch { brut = null; }
  if (brut === null) {
    const demo = entreesDemo(maintenant);
    ecrire(stockage, demo);
    return demo.sort(parRecent);
  }
  try {
    const liste = JSON.parse(brut);
    return (Array.isArray(liste) ? liste : []).filter(valide).sort(parRecent);
  } catch {
    return [];
  }
}

// Ajoute un rapport (jamais un rapport vide ni un modele). Rend la nouvelle liste ; au-dela de SYNTHESES_MAX, les plus anciennes sont retirees.
export function ajouterSynthese(rapport, { stockage = stockageParDefaut(), maintenant = Date.now() } = {}) {
  const liste = listerSyntheses({ stockage, maintenant });
  if (!rapport || rapport.vide || rapport.modele) return liste;
  const entree = { id: "synthese-" + maintenant + "-" + liste.length, nom: rapport.titre, creeLe: maintenant, rapport };
  const suivante = [entree, ...liste].sort(parRecent).slice(0, SYNTHESES_MAX);
  ecrire(stockage, suivante);
  return suivante;
}

// Ajoute une recherche d'echanges validee par « Oui » (30/10) : titre = la reformulation du bandeau, resultat stocke pour rouvrir la liste sans rappeler l'IA.
// Meme demande deja gardee (titre identique, casse et espaces ignores) : pas de doublon, l'entree est remontee avec la date du jour et le nouveau resultat.
export function ajouterRecherche(retour, { stockage = stockageParDefaut(), maintenant = Date.now() } = {}) {
  const liste = listerSyntheses({ stockage, maintenant });
  const titre = retour && typeof retour.relecture === "string" ? retour.relecture.trim() : "";
  if (!titre || !retour.resultat || !Array.isArray(retour.resultat.fils)) return liste;
  const cle = titre.toLowerCase();
  const recherche = { relecture: titre, resultat: retour.resultat, ...(retour.repli ? { repli: retour.repli } : {}) };
  const entree = { id: "synthese-" + maintenant + "-" + liste.length, nom: titre, creeLe: maintenant, recherche };
  const suivante = [entree, ...liste.filter((e) => !(e.recherche && e.nom.trim().toLowerCase() === cle))].sort(parRecent).slice(0, SYNTHESES_MAX);
  ecrire(stockage, suivante);
  return suivante;
}

export const dateSynthese = (entree) => dateJJMMAAAA(entree.creeLe);

// Type d'une entree (30/10) : « rapport » (rapport stocke ou de demonstration) ou « echanges » (recherche d'echanges) ; null si l'entree n'est ni l'un ni l'autre.
export const LIBELLES_TYPE_ENTREE = { rapport: "Rapport", echanges: "Échanges" };
export function typeEntree(entree) {
  if (!entree) return null;
  if (entree.recherche) return "echanges";
  if (entree.rapport || typeof entree.demo === "string") return "rapport";
  return null;
}
export const libelleTypeEntree = (entree) => LIBELLES_TYPE_ENTREE[typeEntree(entree)] || "";

// Ou s'ouvre une entree (30/10) : « recherche » (liste filtree au centre), « centre » (rapport dans la zone centrale, laptop), « modale » (rapport en plein ecran, mobile) ; null si rien a ouvrir.
export function destinationOuverture(entree, { mobile = false } = {}) {
  const type = typeEntree(entree);
  if (type === "echanges") return "recherche";
  if (type === "rapport") return mobile ? "modale" : "centre";
  return null;
}
