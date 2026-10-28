// Seuil mobile unique de l'application (768 px) : source des matchMedia en JavaScript. Les media queries CSS gardent leur valeur litterale (max-width: 768px), a garder identique.
export const REQUETE_MOBILE = "(max-width: 768px)";
export const estMobile = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(REQUETE_MOBILE).matches;
