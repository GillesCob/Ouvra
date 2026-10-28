// Historique des quantitatifs demandes (24/10) : chaque rapport calcule est garde, consultable, rouvrable SANS rappeler l'IA.
// La logique parle a un « depot d'historique » : { lire() -> entrees, ecrire(entrees) -> booleen }, synchrone ou asynchrone. Aujourd'hui le depot
// est le localStorage du navigateur (creerDepotLocal) ; une vraie base plus tard = un autre depot, la logique et la page ne changent pas.
// Bornes : nombre d'entrees, taille totale ; la plus ancienne est purgee la premiere. Le stockage peut manquer ou etre plein (navigation privee,
// donnees bloquees) : rien ne leve d'exception, l'historique renvoie { ok: false, raison } et la page fonctionne sans.

export const CLE_HISTORIQUE = "ouvra-quantitatif-historique";
export const HISTORIQUE_MAX_ENTREES = 30;
export const HISTORIQUE_MAX_OCTETS = 1000000; // ~1 Mo de texte JSON : bien sous les ~5 Mo du localStorage, laisse la place aux autres reglages

// Depot sur un objet de type Storage. `stockage` peut etre null ou lever : tout est protege.
export function creerDepotLocal(stockage = null, cle = CLE_HISTORIQUE) {
  const acces = () => { try { return stockage || globalThis.localStorage || null; } catch { return null; } };
  return {
    lire() {
      try {
        const s = acces();
        const brut = s ? s.getItem(cle) : null;
        const liste = brut ? JSON.parse(brut) : [];
        return Array.isArray(liste) ? liste : [];
      } catch {
        return []; // JSON corrompu ou acces refuse : historique vide plutot qu'une page cassee
      }
    },
    ecrire(entrees) {
      try {
        const s = acces();
        if (!s) return false;
        s.setItem(cle, JSON.stringify(entrees));
        return true;
      } catch {
        return false; // quota depasse, stockage bloque
      }
    }
  };
}

const taille = (entree) => JSON.stringify(entree).length;

export function creerHistorique({ depot, maximum = HISTORIQUE_MAX_ENTREES, maxOctets = HISTORIQUE_MAX_OCTETS }) {
  const entrees = async () => (await depot.lire()).filter((e) => e && typeof e.id === "string" && e.rapport);

  return {
    // Plus recent d'abord. Chaque element : { id, creeLe, rapport } (le rapport complet : voir src/quantitatifRapport.js).
    async lister() {
      return (await entrees()).slice().sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe)));
    },
    async obtenir(id) {
      return (await entrees()).find((e) => e.id === id) || null;
    },
    // Ajoute (ou remplace, meme id : « Recalculer ») un rapport. Rend { ok: true, purgees } ou { ok: false, raison: "trop_volumineux" | "stockage_indisponible" }.
    async ajouter(rapport) {
      const entree = { id: rapport.id, creeLe: rapport.calculeLe, rapport };
      if (taille(entree) > maxOctets) return { ok: false, raison: "trop_volumineux" };
      let liste = (await entrees()).filter((e) => e.id !== entree.id);
      liste.push(entree);
      liste.sort((a, b) => String(a.creeLe).localeCompare(String(b.creeLe))); // plus ancien d'abord
      let purgees = 0;
      while (liste.length > 1 && (liste.length > maximum || taille(liste) > maxOctets)) {
        liste.shift();
        purgees += 1;
      }
      const ecrit = await depot.ecrire(liste);
      return ecrit ? { ok: true, purgees } : { ok: false, raison: "stockage_indisponible" };
    },
    async supprimer(id) {
      const liste = await entrees();
      const reste = liste.filter((e) => e.id !== id);
      return reste.length === liste.length ? false : !!(await depot.ecrire(reste));
    },
    async vider() {
      return !!(await depot.ecrire([]));
    }
  };
}
