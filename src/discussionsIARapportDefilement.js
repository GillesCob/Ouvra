// Rapport de discussions sur mobile (28/10, retours de recette) : deux gestes de defilement, sans DOM pour la partie calcul (testable sous Node).
//
// 1. ajustementOuverture : ouvrir un menu deroulant (« Intervenants », « Sources ») ferme les autres (meme `name`). Safari iPhone n'ancre pas le defilement
//    (overflow-anchor non gere) : le bloc au-dessus qui se replie fait remonter le titre du menu ouvert tout en haut de la page. On remet donc le titre ou il etait,
//    puis, seulement si le contenu deplie depasse du bas visible, on defile du minimum pour le montrer, sans jamais pousser le titre hors de la zone visible.
// 2. verrouillerArrierePlan : tant que le rapport (page pleine ecran) est ouvert, rien ne defile derriere lui. Le corps de la page est fige par CSS
//    (classe CLASSE_VERROU) ; sur iPhone, `overflow: hidden` ne suffit pas, les glissements hors de la zone defilante du rapport sont donc annules.

export const CLASSE_VERROU = "disc-rapport-ouvert";
const MARGE_TITRE_PX = 8;

// Positions en pixels dans la fenetre (getBoundingClientRect) : hautAvant = haut du titre avant l'ouverture, haut / bas = titre et bas du menu apres,
// zoneHaut / zoneBas = limites visibles de la zone qui defile. Rend le nombre de pixels a ajouter au scrollTop (positif = vers le bas).
export function ajustementOuverture({ hautAvant, haut, bas, zoneHaut, zoneBas }) {
  const nombres = [hautAvant, haut, bas, zoneHaut, zoneBas];
  if (!nombres.every(Number.isFinite)) return 0;
  const retour = haut - hautAvant;
  const depasse = (bas - retour) - zoneBas;
  if (depasse <= 0) return retour;
  const margeTitre = Math.max(0, (hautAvant - zoneHaut) - MARGE_TITRE_PX);
  return retour + Math.min(depasse, margeTitre);
}

// Un glissement vertical n'a le droit de passer que s'il se fait dans une zone qui peut vraiment defiler dans ce sens.
function peutDefiler(zone, versLeBas) {
  if (zone.scrollHeight <= zone.clientHeight + 1) return false;
  return versLeBas ? zone.scrollTop + zone.clientHeight < zone.scrollHeight - 1 : zone.scrollTop > 0;
}

// fond : l'element plein ecran du rapport, zoneDefilante() : l'element qui defile (la carte sur mobile, le corps sur grand ecran). Rend { verrouiller, deverrouiller } (idempotents).
export function verrouillerArrierePlan(fond, zoneDefilante, doc = document) {
  let y0 = 0;
  const debut = (e) => { y0 = e.touches[0].clientY; };
  const mouvement = (e) => {
    if (e.touches.length !== 1) return;
    const zone = zoneDefilante();
    const versLeBas = e.touches[0].clientY < y0; // le doigt monte : le contenu defile vers le bas
    if (!zone.contains(e.target) || !peutDefiler(zone, versLeBas)) e.preventDefault();
  };
  let actif = false;
  return {
    verrouiller() {
      if (actif) return;
      actif = true;
      doc.body.classList.add(CLASSE_VERROU);
      fond.addEventListener("touchstart", debut, { passive: true });
      fond.addEventListener("touchmove", mouvement, { passive: false });
    },
    deverrouiller() {
      if (!actif) return;
      actif = false;
      doc.body.classList.remove(CLASSE_VERROU);
      fond.removeEventListener("touchstart", debut);
      fond.removeEventListener("touchmove", mouvement);
    }
  };
}
