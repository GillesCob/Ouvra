// Page « Idees d'evolution » (02/11) : quatre frises-scenarios, legende. Le HTML vient de src/ideesEvolutionRendu.js (donnees : src/ideesEvolutionDonnees.js),
// le CSS de src/ideesEvolution.css (importe par main.js : ce module reste importable sous Node). Comportements repris du mockup :
//  - chaque frise ne se deroule qu'a son entree a l'ecran (IntersectionObserver, classe ide-vu) ; tout est deroule d'emblee si le systeme demande moins d'animations ;
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

  const toutDerouler = () => scenarios.forEach((s) => s.classList.add("ide-vu"));
  const reduit = fenetre.matchMedia && fenetre.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduit || typeof IntersectionObserver !== "function") toutDerouler();
  else {
    const observateur = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ide-vu"); observateur.unobserve(e.target); } });
    }, { threshold: 0.2 });
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
      if (vue !== VUE_IDEES) return;
      if (conteneur) conteneur.scrollTop = 0;
      marquerDebuts();
    }
  };
}
