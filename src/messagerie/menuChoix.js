// Menu deroulant ancre a son champ (28/10, retours de recette mobile) : remplace le <select> natif d'iOS (feuille systeme pleine largeur) dans les dialogues de la messagerie.
// Meme apparence que les menus Priorite / Statut (classes .collision-trigger / .collision-menu*, src/style.css) ; accessible : role listbox / option, fleches, Debut / Fin,
// Echap et appui exterieur ferment. La LARGEUR du menu est celle du champ declencheur ; il s'ouvre vers le bas, ou vers le haut s'il y a plus de place, toujours dans l'ecran.
//   creerMenuChoix({ conteneur, fonds })   conteneur : element qui recoit le menu ; fonds() : elements « fond de dialogue » dont le clic suivant est a absorber (rend [])
//   .ouvrir(declencheur, { titre, options: [{ valeur, libelle }], valeur, surChoix(valeur) })      .fermer(rendreFocus)      .ouvert()      .absorberClic(cible) -> booleen
// positionner() est pure (testee) : place le menu selon le rectangle du declencheur et la taille de la fenetre.

const MARGE = 8;
const ECART = 6;

// Rectangle du declencheur { left, top, bottom, width }, hauteur naturelle du menu, hauteur de la fenetre -> { left, width, top, maxHeight }.
export function positionner(rect, hauteurMenu, hauteurFenetre) {
  const place = (bas) => (bas ? hauteurFenetre - rect.bottom - ECART - MARGE : rect.top - ECART - MARGE);
  const dessous = place(true);
  const dessus = place(false);
  const versLeBas = hauteurMenu <= dessous || dessous >= dessus;
  const maxHeight = Math.max(88, Math.floor(versLeBas ? dessous : dessus));
  const hauteur = Math.min(hauteurMenu, maxHeight);
  const top = versLeBas ? rect.bottom + ECART : rect.top - ECART - hauteur;
  return { left: rect.left, width: rect.width, top: Math.max(MARGE, top), maxHeight };
}

export function creerMenuChoix({ conteneur, fonds = () => [] }) {
  let menu = null;
  let declencheurCourant = null;
  let absorbe = false;

  function fermer(rendreFocus = false) {
    if (!menu) return;
    menu.remove();
    menu = null;
    document.removeEventListener("pointerdown", horsMenu, true);
    document.removeEventListener("keydown", touche, true);
    if (declencheurCourant) {
      declencheurCourant.setAttribute("aria-expanded", "false");
      if (rendreFocus && document.contains(declencheurCourant)) declencheurCourant.focus({ preventScroll: true });
    }
    declencheurCourant = null;
  }

  // Un appui sur le fond d'un dialogue qui ferme le menu ne ferme pas aussi le dialogue : le clic qui suit est absorbe.
  function horsMenu(e) {
    if (!menu || menu.contains(e.target) || (declencheurCourant && declencheurCourant.contains(e.target))) return;
    if (fonds().includes(e.target)) { absorbe = true; setTimeout(() => { absorbe = false; }, 500); }
    fermer();
  }

  function touche(e) {
    if (!menu) return;
    const options = Array.from(menu.querySelectorAll(".collision-menu-option"));
    const i = options.indexOf(document.activeElement);
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); fermer(true); }
    else if (e.key === "Tab") fermer();
    else if (e.key === "ArrowDown") { e.preventDefault(); options[(i + 1) % options.length].focus({ preventScroll: true }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); options[(i <= 0 ? options.length : i) - 1].focus({ preventScroll: true }); }
    else if (e.key === "Home") { e.preventDefault(); options[0].focus({ preventScroll: true }); }
    else if (e.key === "End") { e.preventDefault(); options[options.length - 1].focus({ preventScroll: true }); }
  }

  function ouvrir(declencheur, { titre = "", options, valeur = "", surChoix }) {
    if (menu) { const memeDeclencheur = declencheurCourant === declencheur; fermer(); if (memeDeclencheur) return; }
    menu = document.createElement("div");
    menu.className = "collision-menu msg-menu-choix";
    menu.setAttribute("role", "listbox");
    if (titre) menu.setAttribute("aria-label", titre);
    if (titre) { const t = document.createElement("div"); t.className = "collision-menu-titre"; t.textContent = titre; menu.appendChild(t); }
    for (const o of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "collision-menu-option";
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(o.valeur === valeur));
      const texte = document.createElement("span");
      texte.className = "collision-menu-texte";
      texte.textContent = o.libelle;
      const coche = document.createElement("span");
      coche.className = "collision-menu-coche";
      coche.setAttribute("aria-hidden", "true");
      coche.textContent = o.valeur === valeur ? "✓" : "";
      b.append(texte, coche);
      b.addEventListener("click", () => { fermer(true); surChoix(o.valeur); });
      menu.appendChild(b);
    }
    menu.style.visibility = "hidden";
    conteneur.appendChild(menu);
    const r = declencheur.getBoundingClientRect();
    const pos = positionner({ left: r.left, top: r.top, bottom: r.bottom, width: r.width }, menu.offsetHeight, window.innerHeight);
    Object.assign(menu.style, { left: pos.left + "px", top: pos.top + "px", width: pos.width + "px", maxHeight: pos.maxHeight + "px", visibility: "" });
    declencheurCourant = declencheur;
    declencheur.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", horsMenu, true);
    document.addEventListener("keydown", touche, true);
    (menu.querySelector('[aria-selected="true"]') || menu.querySelector(".collision-menu-option"))?.focus({ preventScroll: true });
  }

  // Vrai (une seule fois) si ce clic est la suite d'un appui sur le fond qui vient de fermer le menu.
  function absorberClic(cible) {
    if (absorbe && fonds().includes(cible)) { absorbe = false; return true; }
    return false;
  }

  return { ouvrir, fermer, ouvert: () => !!menu, absorberClic };
}
