// Page « Idees d'evolution » (02/11) : quatre frises-scenarios. Le HTML vient de src/ideesEvolutionRendu.js (donnees : src/ideesEvolutionDonnees.js),
// le CSS de src/ideesEvolution.css (importe par main.js : ce module reste importable sous Node). Comportements repris du mockup :
//  - chaque frise est une section pleine page (--ide-hauteur, posee ici d'apres la hauteur de #view-idees) et un point d'accroche du defilement (classe ide-accroche sur #view-idees,
//    posee seulement tant que la page est affichee, retiree des qu'on la quitte) ; seule la frise qui franchit le milieu de l'ecran est animee (IntersectionObserver, classe ide-vu),
//    les autres reviennent a l'etat initial et l'animation se rejoue quand elles redeviennent centrales ; tout est deroule d'emblee, sans accroche, si le systeme demande moins d'animations ;
//  - a partir de 900 px, quand une frise passe a la ligne, le premier rond de chaque nouvelle ligne perd sa fleche d'entree (classe ide-debut) ;
//  - le lien de la derniere frise est une navigation interne (aller("espace")), jamais un fichier .html.
import { htmlPage } from "./ideesEvolutionRendu.js";
import { VUE_IDEES } from "./vuesIdees.js";

export const LARGEUR_FRISE_HORIZONTALE = 900; // meme seuil que le CSS : en dessous, les frises sont verticales et aucune fleche n'est retiree

// positions : offsetTop de chaque rond d'une frise, dans l'ordre. Un rond dont le haut depasse de plus de 2 px celui du precedent ouvre une nouvelle ligne.
export function indicesDebutDeLigne(positions) {
  const debuts = [];
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] > positions[i - 1] + 2) debuts.push(i);
  }
  return debuts;
}

// Bande d'observation : le dixieme central de la hauteur de la page (40 % retires en haut et en bas). Une frise est « centrale » des qu'elle la franchit,
// ce qui marche aussi pour une frise verticale plus haute que l'ecran (mobile), ou aucun seuil de visibilite ne serait atteint.
export const MARGE_FRISE_CENTRALE = "-40% 0px -40% 0px";

// entrees : IntersectionObserverEntry (ou objet equivalent). Une frise qui entre dans la bande s'anime, une qui en sort revient a l'etat initial.
// Entre deux frises (aucune dans la bande), rien ne change : la derniere reste allumee jusqu'a ce que la suivante prenne le relais.
export function appliquerFriseCentrale(entrees) {
  entrees.forEach((e) => e.target.classList.toggle("ide-vu", Boolean(e.isIntersecting)));
}

export function creerIdeesEvolution({ racine, aller, fenetre = window }) {
  racine.innerHTML = htmlPage();
  const scenarios = Array.from(racine.querySelectorAll(".ide-scn"));
  const chaines = Array.from(racine.querySelectorAll(".ide-chaine"));
  const conteneur = racine.parentElement; // #view-idees : c'est lui qui defile

  function marquerDebuts() {
    if (fenetre.innerWidth < LARGEUR_FRISE_HORIZONTALE) return;
    chaines.forEach((chaine) => {
      const ronds = Array.from(chaine.children);
      ronds.forEach((n) => n.classList.remove("ide-debut"));
      indicesDebutDeLigne(ronds.map((n) => n.offsetTop)).forEach((i) => ronds[i].classList.add("ide-debut"));
    });
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(marquerDebuts).observe(racine); // aussi a l'affichage de la page (elle est masquee tant qu'on n'y est pas)
  else fenetre.addEventListener("resize", marquerDebuts);
  marquerDebuts();

  function ajusterHauteur() {
    if (!conteneur || conteneur.clientHeight <= 0) return; // page masquee : on garde les dernieres valeurs
    racine.style.setProperty("--ide-hauteur", conteneur.clientHeight + "px");
  }
  if (typeof ResizeObserver === "function" && conteneur) { const obs = new ResizeObserver(ajusterHauteur); obs.observe(conteneur); obs.observe(racine); }
  else fenetre.addEventListener("resize", ajusterHauteur);
  ajusterHauteur();

  const toutDerouler = () => scenarios.forEach((s) => s.classList.add("ide-vu"));
  const reduit = fenetre.matchMedia && fenetre.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduit || typeof IntersectionObserver !== "function") toutDerouler();
  else {
    const observateur = new IntersectionObserver(appliquerFriseCentrale, { root: conteneur || null, rootMargin: MARGE_FRISE_CENTRALE, threshold: 0 });
    scenarios.forEach((s) => observateur.observe(s));
  }

  racine.querySelectorAll("a[data-vue]").forEach((lien) => {
    lien.addEventListener("click", (e) => {
      e.preventDefault();
      aller(lien.dataset.vue);
    });
  });

  return {
    // Appelee a chaque changement de vue : la page s'ouvre toujours en haut.
    surVueActivee(vue) {
      if (conteneur) conteneur.classList.toggle("ide-accroche", vue === VUE_IDEES && !reduit); // l'accroche ne vit que sur #idees (« Mon espace » a son propre conteneur)
      if (vue !== VUE_IDEES) return;
      ajusterHauteur(); // avant le retour en haut : le navigateur raccroche au point voulu seulement si la marge d'accroche est deja posee
      if (conteneur) conteneur.scrollTop = 0;
      marquerDebuts();
    }
  };
}
