// Depot des images de plan des projets (IndexedDB), au format attendu par creerProjets (src/plan3d/projets.js).
// Un plan (PNG, JPEG ou rendu d'un PDF) pese vite plusieurs Mo : trop pour le localStorage, d'ou IndexedDB. Aucune erreur n'est levee :
// IndexedDB absent (navigation privee de certains navigateurs, donnees bloquees) = lire rend null, ecrire et supprimer rendent false.

const BASE = "ouvra-plan3d";
const MAGASIN = "images";

export function creerDepotImagesIdb(fabrique = globalThis.indexedDB) {
  let ouverture = null;
  const ouvrir = () => {
    if (!fabrique) return Promise.resolve(null);
    if (!ouverture) {
      ouverture = new Promise((resolve) => {
        try {
          const req = fabrique.open(BASE, 1);
          req.onupgradeneeded = () => { req.result.createObjectStore(MAGASIN); };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch { resolve(null); }
      });
    }
    return ouverture;
  };
  const demander = async (mode, action) => {
    const db = await ouvrir();
    if (!db) return { ok: false, valeur: null };
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(MAGASIN, mode);
        const req = action(tx.objectStore(MAGASIN));
        tx.oncomplete = () => resolve({ ok: true, valeur: req && "result" in req ? req.result : null });
        tx.onerror = () => resolve({ ok: false, valeur: null });
        tx.onabort = () => resolve({ ok: false, valeur: null }); // quota depasse
      } catch { resolve({ ok: false, valeur: null }); }
    });
  };
  return {
    // Le Blob est garde sous forme d'ArrayBuffer + type : certains WebKit refusent d'ecrire un Blob dans IndexedDB.
    async lire(id) {
      const r = await demander("readonly", (m) => m.get(id));
      return r.ok && r.valeur && r.valeur.donnees ? new Blob([r.valeur.donnees], { type: r.valeur.type || "" }) : null;
    },
    async ecrire(id, blob) {
      try {
        const donnees = await blob.arrayBuffer();
        return (await demander("readwrite", (m) => m.put({ type: blob.type, donnees }, id))).ok;
      } catch { return false; }
    },
    async supprimer(id) { return (await demander("readwrite", (m) => m.delete(id))).ok; }
  };
}
