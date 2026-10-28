// Empreinte de version des maquettes et regle d'obsolescence d'un rapport de quantitatif (24/10). Fonctions pures, le reseau (fetch) est injecte.
//
// CE QUE L'APPLICATION SAIT REELLEMENT de la version d'une maquette : rien d'explicite. Les maquettes sont des fichiers statiques (.xkt) servis a une URL fixe
// (src/main.js : PROJECTS) ; aucun numero de version, aucune revision. Ce qui change quand un fichier est remplace, c'est ce que le serveur annonce :
//   - ETag (empreinte de contenu ou de fichier calculee par l'hebergeur : Vercel, Vite en dev) : le meilleur signal ;
//   - sinon Last-Modified + Content-Length ensemble.
// Une requete HEAD (en-tetes seuls, quelques octets, jamais le fichier de plusieurs dizaines de Mo) suffit : peu couteux, aucun hash a calculer cote navigateur.
// Sans aucun de ces en-tetes (hebergeur qui les retire), l'empreinte est ABSENTE (null) : la version est alors « inconnue », jamais declaree a jour.
// Limite assumee : un ETag peut changer sans que le contenu ait change (nouveau deploiement) : on prefere un faux « obsolete » (recalcul d'une seconde)
// a un metre perime non signale.

// entetes : objet de type Headers (get). Rend une chaine stable ou null.
export function empreinteDepuisEntetes(entetes) {
  if (!entetes || typeof entetes.get !== "function") return null;
  const etag = entetes.get("etag");
  if (etag) return "etag:" + etag;
  const modifie = entetes.get("last-modified");
  const taille = entetes.get("content-length");
  return modifie && taille ? "lm:" + modifie + "|len:" + taille : null;
}

export async function lireEmpreinte(url, { fetch: appel = (...a) => globalThis.fetch(...a) } = {}) {
  try {
    const reponse = await appel(url, { method: "HEAD", cache: "no-cache" });
    return reponse && reponse.ok ? empreinteDepuisEntetes(reponse.headers) : null;
  } catch {
    return null;
  }
}

// maquettes : [{ id, label, src }]. Rend un tableau [{ id, label, url, empreinte }] (empreinte null si inconnue). Ne rejette jamais.
export async function lireEmpreintes(maquettes, options = {}) {
  return Promise.all((maquettes || []).map(async (m) => ({ id: m.id, label: m.label, url: m.src, empreinte: m.src ? await lireEmpreinte(m.src, options) : null })));
}

// Comparaison pure. enregistrees : [{ id, label, empreinte }] (SEULEMENT les maquettes concernees par la requete) ; actuelles : [{ id, label, empreinte }].
//   a_jour   : toutes les maquettes concernees ont la meme empreinte qu'au calcul ;
//   obsolete : au moins une maquette concernee a une empreinte differente (changees : leurs libelles) ; une maquette hors requete n'y change rien ;
//   inconnue : aucune n'a change de facon certaine, mais au moins une empreinte manque (au calcul, ou maintenant) ou la maquette a disparu (inconnues : libelles).
export function comparerVersions(enregistrees, actuelles) {
  const courantes = new Map((actuelles || []).map((m) => [m.id, m]));
  const changees = [];
  const inconnues = [];
  for (const m of enregistrees || []) {
    const maintenant = courantes.get(m.id);
    if (!m.empreinte || !maintenant || !maintenant.empreinte) inconnues.push(m.label);
    else if (m.empreinte !== maintenant.empreinte) changees.push(m.label);
  }
  const etat = changees.length ? "obsolete" : inconnues.length || !(enregistrees || []).length ? "inconnue" : "a_jour";
  return { etat, changees, inconnues };
}

// Texte du statut, en toutes lettres (tableau, PDF, Excel).
export function libelleStatut(statut) {
  const liste = (noms) => noms.join(", ");
  if (statut.etat === "obsolete") return "OBSOLÈTE : " + (statut.changees.length > 1 ? "les maquettes " : "la maquette ") + liste(statut.changees) + (statut.changees.length > 1 ? " ont été mises à jour" : " a été mise à jour") + " depuis le calcul. Recalcule avant d'utiliser ces quantités.";
  if (statut.etat === "inconnue") return "Version des maquettes inconnue" + (statut.inconnues.length ? " (" + liste(statut.inconnues) + ")" : "") + " : impossible de dire si ces quantités sont à jour.";
  return "À jour : les maquettes concernées n'ont pas changé depuis le calcul.";
}
