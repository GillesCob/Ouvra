// Vignettes schematiques des vues de « Mon espace » (02/11) : dessins SVG au trait (coupe de bâtiment ou plan, cadre de caméra en pointillés), jamais une capture ni une photo.
// Le trait gris est le bâtiment, le cadre en pointillés est le cadrage de caméra enregistré, le trait vert est ce que la phrase du Viewer fait ressortir. Couleurs : monEspace.css.
const COUPE = '<rect class="esp-vig-bati" x="22" y="8" width="76" height="56" rx="2"/><path class="esp-vig-bati" d="M22 27h76M22 45h76"/>';
const CADRE_NIVEAU_2 = '<rect class="esp-vig-cadre" x="14" y="23" width="92" height="26" rx="3"/>';

export const VIGNETTES = {
  // Gaines du niveau 2 : coupe, cadre sur le niveau 2, gaine et raccords en vert.
  gaines: COUPE + CADRE_NIVEAU_2 + '<path class="esp-vig-accent" d="M30 36h60M52 36v-6h14v6M74 36v6h10v-6"/>',
  // Niveau 2 des maquettes CVC et Architecture : coupe, cadre sur le niveau 2, deux réseaux en vert.
  cvc: COUPE + CADRE_NIVEAU_2 + '<path class="esp-vig-accent" d="M28 31h64M28 41h64"/><path class="esp-vig-bati" d="M40 27v18M70 27v18"/>',
  // Faux plafonds du niveau 1 : plan, alvéoles en vert, cadre sur tout le plan.
  plafonds: '<rect class="esp-vig-bati" x="14" y="8" width="92" height="56" rx="2"/><path class="esp-vig-bati" d="M14 26h92M14 44h92M45 8v56M76 8v56"/><rect class="esp-vig-plein" x="46" y="27" width="29" height="17"/><rect class="esp-vig-plein" x="15" y="9" width="29" height="17"/><rect class="esp-vig-plein" x="77" y="45" width="28" height="18"/><rect class="esp-vig-cadre" x="8" y="3" width="104" height="66" rx="3"/>'
};

export function htmlVignette(nom) {
  const contenu = VIGNETTES[nom];
  if (!contenu) throw new Error(`Vignette inconnue : ${nom}`);
  return `<svg class="esp-vignette" viewBox="0 0 120 72" aria-hidden="true" focusable="false">${contenu}</svg>`;
}
