// Verrou de defilement de l'arriere-plan (28/10), commun a la page du rapport de discussions et a la modale de saisie IA (src/iaSaisie.js).
// Pas de `position: fixed` sur le corps (il provoque un saut de page a l'ouverture et a la fermeture) : le corps est fige par CSS (classe posee ici, avec
// `overflow: hidden` et `overscroll-behavior: none`), et sur iPhone, ou `overflow: hidden` ne suffit pas, les glissements qui ne se font pas dans une zone
// reellement defilante sont annules (touchmove non passif).

// Un glissement vertical n'a le droit de passer que s'il se fait dans une zone qui peut vraiment defiler dans ce sens.
export function peutDefiler(zone, versLeBas) {
  if (!zone || zone.scrollHeight <= zone.clientHeight + 1) return false;
  return versLeBas ? zone.scrollTop + zone.clientHeight < zone.scrollHeight - 1 : zone.scrollTop > 0;
}

// Parmi les zones defilantes autorisees, celle qui contient la cible du geste (ou null).
export function zoneDuGeste(zones, cible) {
  return [].concat(zones).find((zone) => zone && zone.contains(cible)) || null;
}

// fond : l'element plein ecran qui recouvre la page ; zonesDefilantes() : l'element (ou la liste d'elements) qui defile a l'interieur ; classe : posee sur le corps.
// Rend { verrouiller, deverrouiller } (idempotents).
export function verrouillerArrierePlan(fond, zonesDefilantes, classe, doc = document) {
  let y0 = 0;
  const debut = (e) => { y0 = e.touches[0].clientY; };
  const mouvement = (e) => {
    if (e.touches.length !== 1) return;
    const versLeBas = e.touches[0].clientY < y0; // le doigt monte : le contenu defile vers le bas
    if (!peutDefiler(zoneDuGeste(zonesDefilantes(), e.target), versLeBas)) e.preventDefault();
  };
  let actif = false;
  return {
    verrouiller() {
      if (actif) return;
      actif = true;
      doc.body.classList.add(classe);
      fond.addEventListener("touchstart", debut, { passive: true });
      fond.addEventListener("touchmove", mouvement, { passive: false });
    },
    deverrouiller() {
      if (!actif) return;
      actif = false;
      doc.body.classList.remove(classe);
      fond.removeEventListener("touchstart", debut);
      fond.removeEventListener("touchmove", mouvement);
    }
  };
}
