// Routage des deux pages « Idees d'evolution » (#idees, onglet de la barre) et « Mon espace » (#espace, sans onglet), 02/11.
// « Mon espace » n'a pas d'onglet : on y arrive par le lien de la derniere frise de la page Idees, et son fil d'Ariane ramene aux idees.
// Tant qu'on est sur « Mon espace », l'onglet « Idees d'evolution » reste allume (comme dans le mockup ouvra-mon-espace.html).
export const VUE_IDEES = "idees";
export const VUE_ESPACE = "espace";

// Vue sans onglet propre -> onglet qui reste actif pendant qu'elle est affichee.
const ONGLET_PARENT = { [VUE_ESPACE]: VUE_IDEES };

export const ongletDeVue = (vue) => ONGLET_PARENT[vue] || vue;
// Vues atteignables par le hash ou la valeur memorisee sans etre un onglet de la barre.
export const VUES_SANS_ONGLET = [VUE_ESPACE];
export const estVueIdees = (vue) => vue === VUE_IDEES || vue === VUE_ESPACE;
