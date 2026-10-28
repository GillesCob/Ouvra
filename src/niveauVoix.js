// Niveau sonore de la voix (28/10) : fait reagir le halo du grand micro de la modale de saisie IA (src/iaSaisie.js) au VRAI volume de la voix.
// Logique et constantes du mockup « halo reactif » (Projets/Ouvra/mockups/micro-voix-visuel.html). Module sans dependance au DOM : le navigateur est passe en parametres.
//  - niveauRMS(echantillons) : volume instantane 0 a 1 d'un tampon d'octets AnalyserNode.getByteTimeDomainData (silence = 128).
//  - creerNormaliseur() : gain adaptatif (plancher de bruit, pic recent, courbe en racine) ; lisserNiveau(precedent, brut) : attaque rapide, retombee nette.
//  - demarrerNiveauVoix({...}) : ouvre un SECOND flux micro, JAMAIS bloquant pour la dictee (src/reglesVoix.js) : un echec ou un refus ne leve rien
//    et ne fait que signaler le repli (surEchec) sur le halo a rythme fixe. fermer() libere tout, a toute sortie d'ecoute.

// Diagnostic du 28/10 (test reel dans Chrome : « halo trop timide ») : la parole normale sur un micro d'ordinateur portable pese un RMS de 0,01 a 0,1 (typiquement 0,02 a 0,05).
// L'ancien gain FIXE x4 donnait 0,04 a 0,4 (typiquement 0,08 a 0,2) : le niveau atteignait rarement 0,2, soit un halo de 3 px sur 14. Le niveau est donc normalise entre un plancher de bruit
// ambiant et un pic recent (gain adaptatif), puis passe par une courbe en racine carree.
const ATTAQUE = 0.85; // part de l'ecart rattrapee a chaque image quand le volume monte : quasi instantane
const RETOMBEE = 0.2; // idem quand il descend : retombee nette en une demi-seconde, sans claquer
const CALIBRAGE_MS = 300; // premieres centaines de ms d'ecoute : le plancher de bruit suit le minimum observe
const PLANCHER_MONTEE_MS = 20000; // constante de temps de la remontee du plancher (bruit ambiant qui augmente lentement)
const PIC_RETOMBEE_MS = 4000; // constante de temps de la retombee du pic vers le plancher
const PLAGE_MIN = 0.02; // plage RMS minimale entre plancher et pic : sans elle, le silence serait amplifie
const PART_PIC = 0.6; // la voix courante se compare a 60 % de la plage plancher-pic : la parole normale atteint couramment 0,7 a 1
const SEUIL_SILENCE = 0.2; // part de plage sous laquelle le niveau vaut 0 (souffle, bruit de fond)

const borner = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

// RMS brut 0 a 1 d'un tampon d'octets AnalyserNode.getByteTimeDomainData (silence = 128). Plus de gain fixe : la normalisation est creerNormaliseur.
export function niveauRMS(echantillons) {
  if (!echantillons || !echantillons.length) return 0;
  let somme = 0;
  for (let i = 0; i < echantillons.length; i += 1) {
    const v = (echantillons[i] - 128) / 128;
    somme += v * v;
  }
  return borner(Math.sqrt(somme / echantillons.length));
}

// Normaliseur a gain adaptatif : pousser(rms, dtMs) -> niveau 0 a 1 (avant lissage).
export function creerNormaliseur() {
  let plancher = null;
  let pic = 0;
  let ecoule = 0;
  return {
    pousser(rms, dtMs = 1000 / 60) {
      const r = borner(rms);
      const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
      ecoule += dt;
      if (plancher === null || r < plancher) plancher = r; // le plancher descend aussitot
      else if (ecoule > CALIBRAGE_MS) plancher += (r - plancher) * Math.min(1, dt / PLANCHER_MONTEE_MS); // et ne remonte que lentement
      pic = Math.max(pic, r);
      pic = Math.max(plancher, pic - (pic - plancher) * Math.min(1, dt / PIC_RETOMBEE_MS));
      const plage = Math.max((pic - plancher) * PART_PIC, PLAGE_MIN);
      const x = (r - plancher) / plage;
      if (x <= SEUIL_SILENCE) return 0;
      return borner(Math.sqrt(borner((x - SEUIL_SILENCE) / (1 - SEUIL_SILENCE))));
    }
  };
}

export function lisserNiveau(precedent, brut) {
  const p = borner(precedent);
  const b = borner(brut);
  const n = borner(p + (b - p) * (b > p ? ATTAQUE : RETOMBEE));
  return n < 0.02 && b === 0 ? 0 : n; // le halo retombe vraiment a zero
}

// Dependances (toutes injectables pour les tests) :
//   mediaDevices (navigator.mediaDevices), creerContexte() -> AudioContext, planifier(fn) -> id (requestAnimationFrame), annuler(id),
//   surNiveau(n) : appele a chaque image avec le niveau lisse ; surOuvert() : flux et boucle en place ; surEchec() : repli sur le halo fixe.
export function demarrerNiveauVoix({ mediaDevices, creerContexte, planifier, annuler, surNiveau, surOuvert, surEchec } = {}) {
  let ferme = false;
  let flux = null;
  let contexte = null;
  let boucle = 0;

  const appeler = (f, ...args) => { try { if (f) f(...args); } catch { /* un rappel defaillant ne casse jamais la dictee */ } };

  function liberer() {
    if (boucle && annuler) appeler(annuler, boucle);
    boucle = 0;
    if (flux) appeler(() => flux.getTracks().forEach((piste) => piste.stop()));
    flux = null;
    if (contexte && contexte.close) appeler(() => { const r = contexte.close(); if (r && r.catch) r.catch(() => {}); });
    contexte = null;
  }

  function echec() {
    liberer();
    if (!ferme) appeler(surEchec);
  }

  if (!mediaDevices || !mediaDevices.getUserMedia || !creerContexte || !planifier) {
    appeler(surEchec);
    return { fermer() {} };
  }

  let demande;
  try { demande = Promise.resolve(mediaDevices.getUserMedia({ audio: true })); } catch { demande = Promise.reject(new Error("getUserMedia")); }
  demande.then((obtenu) => {
    flux = obtenu;
    if (ferme) { liberer(); return; } // sortie d'ecoute pendant l'ouverture : la piste obtenue est aussitot rendue
    try {
      contexte = creerContexte();
      if (contexte.resume) { const r = contexte.resume(); if (r && r.catch) r.catch(() => {}); }
      const analyseur = contexte.createAnalyser();
      analyseur.fftSize = 256;
      analyseur.smoothingTimeConstant = 0.75;
      contexte.createMediaStreamSource(flux).connect(analyseur);
      const tampon = new Uint8Array(analyseur.fftSize);
      const normaliseur = creerNormaliseur();
      let lisse = 0;
      let dernier = 0;
      const image = () => {
        if (ferme) return;
        boucle = planifier(image);
        analyseur.getByteTimeDomainData(tampon);
        const maintenant = typeof performance !== "undefined" && performance.now ? performance.now() : 0;
        const dt = dernier && maintenant > dernier ? Math.min(100, maintenant - dernier) : 1000 / 60;
        dernier = maintenant;
        lisse = lisserNiveau(lisse, normaliseur.pousser(niveauRMS(tampon), dt));
        appeler(surNiveau, lisse);
      };
      boucle = planifier(image);
    } catch {
      echec();
      return;
    }
    appeler(surOuvert);
  }).catch(echec);

  return {
    fermer() {
      if (ferme) return;
      ferme = true;
      liberer();
    }
  };
}
