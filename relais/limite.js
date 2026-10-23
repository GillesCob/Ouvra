// Limiteur de requetes par visiteur, a fenetre glissante, en memoire (22/10).
// Sur Vercel chaque instance de fonction a sa propre memoire : la limite est donc APPROXIMATIVE (elle freine une boucle ou un abus
// depuis un meme visiteur, elle ne remplace pas le plafond de depense de la console Anthropic, qui est le vrai garde-fou).
// Un refus ne consomme pas de place : insister ne prolonge pas l'attente.

export function creerLimiteur({ max, fenetreMs, maintenant = Date.now, visiteursMax = 5000 }) {
  const parVisiteur = new Map(); // cle -> horodatages des requetes acceptees

  function purger(t) {
    for (const [cle, dates] of parVisiteur) {
      while (dates.length && t - dates[0] >= fenetreMs) dates.shift();
      if (!dates.length) parVisiteur.delete(cle);
    }
  }

  return {
    autoriser(cle) {
      const t = maintenant();
      if (parVisiteur.size >= visiteursMax) purger(t);
      const dates = parVisiteur.get(cle) || [];
      while (dates.length && t - dates[0] >= fenetreMs) dates.shift();
      if (dates.length >= max) { parVisiteur.set(cle, dates); return false; }
      dates.push(t);
      parVisiteur.delete(cle); // reinsere en dernier : le plus recemment actif est le dernier oublie
      parVisiteur.set(cle, dates);
      while (parVisiteur.size > visiteursMax) parVisiteur.delete(parVisiteur.keys().next().value);
      return true;
    },
    // Millisecondes avant qu'une place se libere pour ce visiteur (0 : il peut envoyer maintenant).
    attente(cle) {
      const t = maintenant();
      const dates = (parVisiteur.get(cle) || []).filter((d) => t - d < fenetreMs);
      return dates.length < max ? 0 : dates[dates.length - max] + fenetreMs - t;
    },
    taille: () => parVisiteur.size
  };
}
