// Menu deroulant ancre a son champ (28/10, retours de recette mobile) : remplace le <select> natif d'iOS (feuille systeme pleine largeur) dans les dialogues de la messagerie.
// Meme apparence que les menus Priorite / Statut (classes .collision-trigger / .collision-menu*, src/style.css) ; accessible : role listbox / option, fleches, Debut / Fin,
// Echap et appui exterieur ferment. La LARGEUR du menu est celle du champ declencheur ; il s'ouvre vers le bas, ou vers le haut s'il y a plus de place, toujours dans l'ecran.
//   creerMenuChoix({ conteneur, fonds })   conteneur : element qui recoit le menu ; fonds() : elements « fond de dialogue » dont le clic suivant est a absorber (rend [])
//   .ouvrir(declencheur, { titre, options: [{ valeur, libelle }], valeur, surChoix(valeur), id, largeurAuto, fermerAuDefilement })
//   id : id du menu (aria-controls du declencheur) ; largeurAuto : largeur naturelle, au moins celle du declencheur (menu d'actions) au lieu de la largeur du champ ;
//   fermerAuDefilement : le menu se ferme au defilement ou au redimensionnement (ecouteurs retires a la fermeture).
//   Structure : <div.collision-menu> [titre] <div role="listbox"> options </div></div> (le titre n'est pas un enfant du listbox : ARIA valide).      .fermer(rendreFocus)      .ouvert()      .absorberClic(cible) -> booleen
// positionner() est pure (testee) : place le menu selon le rectangle du declencheur et la taille de la fenetre.

const MARGE = 8;
const ECART = 6;

// Rectangle du declencheur { left, top, bottom, width }, hauteur naturelle du menu, hauteur de la fenetre -> { left, width, top, maxHeight }.
// largeurFenetre et largeurAuto (facultatifs) : menu de largeur naturelle, au moins celle du declencheur, decale pour rester dans l'ecran.
export function positionner(rect, hauteurMenu, hauteurFenetre, { largeurAuto = 0, largeurFenetre = 0 } = {}) {
  const place = (bas) => (bas ? hauteurFenetre - rect.bottom - ECART - MARGE : rect.top - ECART - MARGE);
  const dessous = place(true);
  const dessus = place(false);
  const versLeBas = hauteurMenu <= dessous || dessous >= dessus;
  const maxHeight = Math.max(88, Math.floor(versLeBas ? dessous : dessus));
  const hauteur = Math.min(hauteurMenu, maxHeight);
  const top = versLeBas ? rect.bottom + ECART : rect.top - ECART - hauteur;
  if (largeurAuto) {
    const largeur = Math.max(largeurAuto, rect.width);
    return { left: Math.max(MARGE, Math.min(rect.left, largeurFenetre - largeur - MARGE)), width: 0, minWidth: largeur, top: Math.max(MARGE, top), maxHeight };
  }
  return { left: rect.left, width: rect.width, minWidth: 0, top: Math.max(MARGE, top), maxHeight };
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
    window.removeEventListener("resize", fermerSansFocus);
    window.removeEventListener("scroll", fermerSansFocus, true);
    if (declencheurCourant) {
      declencheurCourant.setAttribute("aria-expanded", "false");
      if (rendreFocus && document.contains(declencheurCourant)) declencheurCourant.focus({ preventScroll: true });
    }
    declencheurCourant = null;
  }

  function fermerSansFocus(e) {
    if (e && menu && e.target && e.target.nodeType === 1 && menu.contains(e.target)) return; // le defilement du menu lui-meme ne le ferme pas
    fermer();
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
    if (!options.length && e.key !== "Escape" && e.key !== "Tab") return; // menu sans option : rien a parcourir
    const i = options.indexOf(document.activeElement);
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); fermer(true); }
    else if (e.key === "Tab") fermer();
    else if (e.key === "ArrowDown") { e.preventDefault(); options[(i + 1) % options.length].focus({ preventScroll: true }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); options[(i <= 0 ? options.length : i) - 1].focus({ preventScroll: true }); }
    else if (e.key === "Home") { e.preventDefault(); options[0].focus({ preventScroll: true }); }
    else if (e.key === "End") { e.preventDefault(); options[options.length - 1].focus({ preventScroll: true }); }
  }

  function ouvrir(declencheur, { titre = "", options, valeur = "", surChoix, id = "", largeurAuto = false, fermerAuDefilement = false }) {
    if (menu) { const memeDeclencheur = declencheurCourant === declencheur; fermer(); if (memeDeclencheur) return; }
    menu = document.createElement("div");
    menu.className = "collision-menu msg-menu-choix";
    if (id) menu.id = id;
    if (titre) { const t = document.createElement("div"); t.className = "collision-menu-titre"; t.textContent = titre; menu.appendChild(t); }
    const liste = document.createElement("div");
    liste.setAttribute("role", "listbox");
    if (titre) liste.setAttribute("aria-label", titre);
    menu.appendChild(liste);
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
      liste.appendChild(b);
    }
    menu.style.visibility = "hidden";
    conteneur.appendChild(menu);
    const r = declencheur.getBoundingClientRect();
    const pos = positionner({ left: r.left, top: r.top, bottom: r.bottom, width: r.width }, menu.offsetHeight, window.innerHeight,
      { largeurAuto: largeurAuto ? menu.offsetWidth : 0, largeurFenetre: window.innerWidth });
    Object.assign(menu.style, { left: pos.left + "px", top: pos.top + "px", maxHeight: pos.maxHeight + "px", visibility: "" });
    if (largeurAuto) menu.style.minWidth = pos.minWidth + "px"; else menu.style.width = pos.width + "px";
    declencheurCourant = declencheur;
    declencheur.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", horsMenu, true);
    document.addEventListener("keydown", touche, true);
    if (fermerAuDefilement) { window.addEventListener("resize", fermerSansFocus); window.addEventListener("scroll", fermerSansFocus, true); }
    (menu.querySelector('[aria-selected="true"]') || menu.querySelector(".collision-menu-option"))?.focus({ preventScroll: true });
  }

  // Vrai (une seule fois) si ce clic est la suite d'un appui sur le fond qui vient de fermer le menu.
  function absorberClic(cible) {
    if (absorbe && fonds().includes(cible)) { absorbe = false; return true; }
    return false;
  }

  return { ouvrir, fermer, ouvert: () => !!menu, absorberClic };
}

// Options { valeur, libelle } d'un <select> (ou de tout objet qui expose .options avec value et textContent). Les options desactivees (placeholder) sont ecartees.
export function optionsDuSelect(select) {
  return Array.from(select.options || []).filter((o) => !o.disabled).map((o) => ({ valeur: o.value, libelle: o.textContent }));
}

// Libelle de l'option choisie, ou le repli si rien ne correspond.
export function libelleChoisi(options, valeur, repli = "") {
  const o = options.find((x) => x.valeur === valeur);
  return o ? o.libelle : repli;
}

// Mobile (retour 32, 28/10) : double un <select> natif d'un bouton declencheur qui ouvre le menu commun, ancre au champ. Le <select> reste la source de verite (valeur, evenement
// « change », code existant intact). Le bouton est masque par defaut et ne s'affiche que sous (max-width: 768px), ou le <select> est masque (style.css) : le laptop garde son <select> natif.
// Le bouton suit le <select> (options, valeur, attribut hidden) par un MutationObserver.
export function habillerSelect(select, menu, { titre = "" } = {}) {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "collision-trigger msg-choix-trigger select-declencheur";
  bouton.setAttribute("aria-haspopup", "listbox");
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-label", select.getAttribute("aria-label") || titre);
  const val = document.createElement("span");
  val.className = "collision-trigger-val";
  const chevron = document.createElement("span");
  chevron.className = "collision-trigger-chevron";
  chevron.setAttribute("aria-hidden", "true");
  bouton.append(val, chevron);
  select.classList.add("select-habille");
  const synchroniser = () => {
    const placeholder = Array.from(select.options || []).find((o) => o.disabled);
    val.textContent = libelleChoisi(optionsDuSelect(select), select.value, placeholder ? placeholder.textContent : "");
    bouton.hidden = select.hidden;
  };
  bouton.addEventListener("click", () => {
    menu.ouvrir(bouton, {
      titre,
      options: optionsDuSelect(select),
      valeur: select.value,
      surChoix: (valeur) => { select.value = valeur; select.dispatchEvent(new Event("change", { bubbles: true })); synchroniser(); },
    });
  });
  new MutationObserver(synchroniser).observe(select, { childList: true, attributes: true, attributeFilter: ["hidden"] });
  select.addEventListener("change", synchroniser);
  select.after(bouton);
  synchroniser();
  return bouton;
}
