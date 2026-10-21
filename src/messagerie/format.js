// Aides de mise en forme de la messagerie : echappement HTML, dates et heures en francais.

const ECHAPPEMENTS = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c]);
}

const deuxChiffres = (n) => (n < 10 ? "0" + n : String(n));
export function heureMinute(d) {
  return deuxChiffres(d.getHours()) + ":" + deuxChiffres(d.getMinutes());
}
export function cleJour(d) {
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}

// Ecart en jours calendaires entre aujourd'hui et la date donnee.
function ecartJours(d, maintenant) {
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const ce = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((aujourdhui - ce) / 86400000);
}

// Separateur de jour dans le fil.
export function libelleJour(d, maintenant) {
  const ecart = ecartJours(d, maintenant);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// Heure courte de la liste des conversations.
export function heureCourte(d, maintenant) {
  const ecart = ecartJours(d, maintenant);
  if (ecart === 0) return heureMinute(d);
  if (ecart === 1) return "Hier";
  if (ecart < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function dateHeure(d) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " à " + heureMinute(d);
}

export function initiales(nom) {
  return nom.split(/\s+/).map((mot) => mot.charAt(0)).join("").slice(0, 2).toUpperCase();
}

export function prenom(nom) {
  return nom.split(" ")[0];
}
