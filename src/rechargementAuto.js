// Rechargement automatique apres un deploiement (31/10) : un onglet reste ouvert, puis un nouveau deploiement supprime les anciens fichiers charges a la demande
// (page 2D -> 3D, export PDF...) : leur chargement echoue. Vite emet alors `vite:preloadError` (https://vite.dev/guide/build#load-error-handling) ; on recharge la page
// UNE fois (garde de DELAI_GARDE_MS dans le stockage de session contre toute boucle). Deuxieme echec dans le delai : l'erreur remonte, la page affiche son message.
export const DELAI_GARDE_MS = 10000;
const CLE = "ouvra-rechargement-auto";

export function installerRechargementAuto({ fenetre, stockage, maintenant = Date.now }) {
  fenetre.addEventListener("vite:preloadError", (evenement) => {
    try {
      const dernier = Number(stockage.getItem(CLE));
      if (dernier && maintenant() - dernier < DELAI_GARDE_MS) return; // deja recharge a l'instant : pas de boucle
      stockage.setItem(CLE, String(maintenant()));
      evenement.preventDefault();
      fenetre.location.reload();
    } catch { /* stockage indisponible : impossible de garder la garde, on ne recharge pas */ }
  });
}
