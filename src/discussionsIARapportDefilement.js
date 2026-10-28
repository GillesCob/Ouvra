// Rapport de discussions sur mobile (28/10, retours de recette) : deux gestes de defilement, sans DOM pour la partie calcul (testable sous Node).
//
// 1. defilementVersTitre : ouvrir un menu deroulant (« Intervenants », « Sources ») ferme les autres (meme `name`). Comportement voulu par Gilles (28/10) : la page
//    defile pour que le TITRE du menu ouvert soit en haut de la zone visible du rapport, le contenu deplie dessous. Safari iPhone n'ancre pas le defilement : le calcul
//    part donc de la position reelle du titre apres l'ouverture. Si le contenu restant est trop court pour amener le titre en haut (menu en fin de rapport), un
//    rembourrage en bas du rapport le permet (retire a la fermeture).
// 2. Verrou de l'arriere-plan : tant que le rapport (page pleine ecran) est ouvert, rien ne defile derriere lui. Mecanisme commun : src/verrouDefilement.js (classe CLASSE_VERROU).

export const CLASSE_VERROU = "disc-rapport-ouvert";
const MARGE_TITRE_PX = 8;

// Positions en pixels dans la fenetre (getBoundingClientRect) : haut = haut du titre apres l'ouverture, zoneHaut = haut visible de la zone qui defile ;
// scrollTop / scrollMax = defilement actuel et maximal de cette zone (rembourrage deja retire). Rend la position cible et le rembourrage necessaire pour l'atteindre.
export function defilementVersTitre({ haut, zoneHaut, scrollTop, scrollMax }) {
  if (![haut, zoneHaut, scrollTop, scrollMax].every(Number.isFinite)) return { top: 0, rembourrage: 0 };
  const voulu = Math.max(0, scrollTop + (haut - zoneHaut) - MARGE_TITRE_PX);
  return { top: voulu, rembourrage: Math.max(0, Math.ceil(voulu - Math.max(0, scrollMax))) };
}
