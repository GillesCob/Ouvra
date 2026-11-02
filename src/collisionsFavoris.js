// Favoris et filtres de la liste des collisions (02/11). Module pur (sans DOM, testable sous Node) : predicats Nouvelles / En cours / Urgentes /
// Resolues / Favoris, compteurs de Mon espace, et gestion des favoris. La page (main.js) ne fait que l'affichage et la lecture/ecriture du depot (creerDepotLocal, cle propre).
// « En cours » = statut confirme : la recommandation est faite, Gilles n'a pas encore repondu.
// Persistance : une liste de choix { id, favori } plutot qu'une liste d'identifiants. Un favori prerempli retire reste un choix explicite (favori: false) ;
// sans cela, rien ne distinguerait « jamais touche » (defaut applique) de « tout retire » (liste vide).

export const CLE_FAVORIS = "ouvra-collisions-favoris";

// Les 13 collisions actives de l'hopital prefavorites (ids hosp-clash-N, cf clashesHospital.js) : 9 « Nouveau » (n° 1, 3, 4, 6, 9, 11, 12, 13, 14) et 4 « En cours » (n° 2, 5, 10, 15).
// Les 2 ecartees (n° 7 et 8) ne sont pas suivies.
export const FAVORIS_PAR_DEFAUT = [1, 3, 4, 6, 9, 11, 12, 13, 14, 2, 5, 10, 15].map((n) => "hosp-clash-" + n);

const statutEst = (statut) => (clash) => !!clash && clash.statut === statut;

export const estNouvelle = statutEst("nouveau");
export const estEnCours = statutEst("confirme");
export const estResolue = statutEst("resolu");
export const estUrgente = (clash) => !!clash && clash.priorite === "urgente";
export const estFavori = (clash, favoris) => !!clash && !!favoris && favoris.has(clash.id);

export const FILTRES_COLLISIONS = [
  { id: "nouvelles", libelle: "Nouvelles", garde: estNouvelle },
  { id: "en-cours", libelle: "En cours", garde: estEnCours },
  { id: "urgentes", libelle: "Urgentes", garde: estUrgente },
  { id: "resolues", libelle: "Résolues", garde: estResolue },
  { id: "favoris", libelle: "Favoris", garde: estFavori }
];

export const filtreValide = (id) => FILTRES_COLLISIONS.some((f) => f.id === id);

// Sans filtre (null) ou filtre inconnu : la liste entiere. Un filtre de statut ou de priorite ne garde que les collisions SUIVIES (intersection avec les favoris) :
// c'est le sens des compteurs de « Collisions suivies » de Mon espace.
export function filtrerCollisions(clashes, filtreId, favoris) {
  const liste = Array.isArray(clashes) ? clashes : [];
  const filtre = FILTRES_COLLISIONS.find((f) => f.id === filtreId);
  return filtre ? liste.filter((c) => filtre.garde(c, favoris) && estFavori(c, favoris)) : liste.slice();
}

// Effectif de chaque filtre de statut parmi les collisions suivies : source unique des compteurs de Mon espace, jamais de valeur recopiee.
export function compterSuivies(clashes, favoris) {
  const effectifs = {};
  FILTRES_COLLISIONS.filter((f) => f.id !== "favoris").forEach((f) => { effectifs[f.id] = filtrerCollisions(clashes, f.id, favoris).length; });
  return effectifs;
}

// Ensemble des identifiants favoris : le defaut, recouvert par les choix enregistres (entrees invalides ignorees).
export function resoudreFavoris(choix) {
  const favoris = new Set(FAVORIS_PAR_DEFAUT);
  (Array.isArray(choix) ? choix : []).forEach((e) => {
    if (!e || typeof e.id !== "string" || !e.id || typeof e.favori !== "boolean") return;
    if (e.favori) favoris.add(e.id);
    else favoris.delete(e.id);
  });
  return favoris;
}

// Nouveau tableau de choix avec l'etat de la collision inverse (jamais de mutation).
export function basculerFavori(choix, id) {
  if (typeof id !== "string" || !id) return Array.isArray(choix) ? choix.slice() : [];
  const autres = (Array.isArray(choix) ? choix : []).filter((e) => e && e.id !== id);
  return autres.concat({ id, favori: !resoudreFavoris(choix).has(id) });
}
