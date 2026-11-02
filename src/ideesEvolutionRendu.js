// Rendu de la page « Idees d'evolution » (02/11) : fonctions pures qui transforment src/ideesEvolutionDonnees.js en HTML, sans DOM (testables sous Node).
// Le HTML reproduit celui du mockup ouvra-idees-fonctionnalites.html, classes prefixees ide- (voir src/ideesEvolution.css). Toutes les valeurs passent par echapper().
import { ICONES, SCENARIOS, TYPES_NOEUD } from "./ideesEvolutionDonnees.js";

const PREFIXE_ICONE = "ide-i-";
export const TITRE_PAGE = "Ce qu'on pourrait ajouter";

export function echapper(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

// Sprite des icones, masque : les <use href="#ide-i-..."> des noeuds y renvoient.
export function htmlSprite(icones = ICONES) {
  const symboles = Object.entries(icones).map(([nom, contenu]) => `<symbol id="${PREFIXE_ICONE}${echapper(nom)}" viewBox="0 0 24 24">${contenu}</symbol>`).join("");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${symboles}</defs></svg>`;
}

const svgIcone = (nom, classe) => `<svg ${classe ? `class="${classe}" ` : ""}viewBox="0 0 24 24" aria-hidden="true"><use href="#${PREFIXE_ICONE}${echapper(nom)}"/></svg>`;
const pastilleAuto = () => '<span class="ide-auto-tag">Auto</span>';

export function htmlNoeud(noeud, rang) {
  if (!TYPES_NOEUD.includes(noeud.type)) throw new Error(`Type de noeud inconnu : ${noeud.type}`);
  const classe = noeud.type === "humain" ? "ide-node" : `ide-node ide-${noeud.type}`;
  const pastille = noeud.type === "auto" ? pastilleAuto() : noeud.type === "ia" ? '<span class="ide-ia-tag">IA</span>' : "";
  const onde = noeud.type === "ia" ? '<i class="ide-onde" aria-hidden="true"></i>' : ""; // second anneau des bulles IA
  const rond = `<span class="ide-rond">${svgIcone(noeud.icone, "ide-ico")}${pastille}${onde}</span>`;
  const impulsion = rang > 0 ? '<i class="ide-impulsion" aria-hidden="true"></i>' : ""; // point lumineux qui parcourt la fleche d'entree
  let lab;
  if (noeud.srSeul) lab = `<span class="ide-sr">${echapper(noeud.srSeul)}</span>`;
  else lab = echapper(noeud.label) + (noeud.sub ? `<span class="ide-sub">${echapper(noeud.sub)}</span>` : "");
  return `<li class="${classe}" style="--n:${rang}">${impulsion}${rond}<span class="ide-lab">${lab}</span></li>`;
}

export function htmlScenario(scenario, indice) {
  const id = `ide-scn${indice + 1}`;
  const tete = `<header class="ide-scn-tete"><img class="ide-bat-img" src="/images/idees/${echapper(scenario.batiment)}" alt=""><h3 id="${id}">${echapper(scenario.titre)}</h3><div class="ide-s3-trait"></div></header>`;
  const chaine = `<ol class="ide-chaine">${scenario.noeuds.map(htmlNoeud).join("")}</ol>`;
  const lien = scenario.lien ? `<p class="ide-voir-page"><a href="#${echapper(scenario.lien.vue)}" data-vue="${echapper(scenario.lien.vue)}">${echapper(scenario.lien.texte)}</a></p>` : "";
  return `<section class="ide-scn" aria-labelledby="${id}">${tete}${chaine}${lien}</section>`;
}

export function htmlPage(scenarios = SCENARIOS) {
  return htmlSprite()
    + '<main class="ide-page">'
    + `<h2 class="ide-sr">${TITRE_PAGE}</h2>`
    + scenarios.map(htmlScenario).join("")
    + "</main>";
}
