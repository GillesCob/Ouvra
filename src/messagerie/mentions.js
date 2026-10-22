// Mentions « @Nom » dans le composeur de la messagerie : fonctions pures (aucune donnee, aucun DOM).
//
// Une mention est le texte exact « @ » + nom complet de la personne, en debut de mot, non suivi d'une lettre.
// Le message ne garde que cette convention dans son texte ; la liste des personnes notifiees est recalculee a l'envoi.

const sansAccent = (texte) => texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LETTRE = /[\p{L}\p{N}_]/u;

// « @ » en debut de mot juste avant le curseur, suivi de lettres sans espace : { debut (position du @), requete } ou null.
export function requeteMention(texte, curseur) {
  const m = /(^|\s)@([^\s@]*)$/.exec(texte.slice(0, curseur));
  return m ? { debut: m.index + m[1].length, requete: m[2] } : null;
}

// Garde les personnes dont un mot du nom commence par la requete (sans accent ni casse), dans l'ordre d'origine.
export function filtrerPersonnes(ids, nomDe, requete) {
  const q = sansAccent(requete);
  return ids.filter((id) => !q || sansAccent(nomDe(id)).split(/\s+/).some((mot) => mot.startsWith(q)));
}

// Occurrences de « @Nom » dans le texte, dans l'ordre : [{ debut, fin, id }]. entrees : [{ id, nom }].
// Le nom le plus long est essaye en premier (« Marc Dubois » avant « Marc »).
export function occurrences(texte, entrees) {
  const tries = entrees.slice().sort((a, b) => b.nom.length - a.nom.length);
  const trouvees = [];
  let i = 0;
  while (i < texte.length) {
    const at = texte.indexOf("@", i);
    if (at < 0) break;
    let trouve = null;
    if (at === 0 || /\s/.test(texte[at - 1])) {
      for (const e of tries) {
        const fin = at + 1 + e.nom.length;
        if (texte.slice(at + 1, fin) === e.nom && !(fin < texte.length && LETTRE.test(texte[fin]))) {
          trouve = { debut: at, fin, id: e.id };
          break;
        }
      }
    }
    if (trouve) { trouvees.push(trouve); i = trouve.fin; } else i = at + 1;
  }
  return trouvees;
}
