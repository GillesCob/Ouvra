// Niveau sonore de la voix (28/10) : fait reagir le halo du grand micro de la modale de saisie IA (src/iaSaisie.js) au VRAI volume de la voix.
// Logique et constantes du mockup « halo reactif » (Projets/Ouvra/mockups/micro-voix-visuel.html). Module sans dependance au DOM : le navigateur est passe en parametres.
//  - niveauRMS(echantillons) : volume instantane 0 a 1 d'un tampon d'octets AnalyserNode.getByteTimeDomainData (silence = 128).
//  - lisserNiveau(precedent, brut) : attaque rapide, retombee lente.
//  - demarrerNiveauVoix({...}) : ouvre un SECOND flux micro, JAMAIS bloquant pour la dictee (src/reglesVoix.js) : un echec ou un refus ne leve rien
//    et ne fait que signaler le repli (surEchec) sur le halo a rythme fixe. fermer() libere tout, a toute sortie d'ecoute.

const GAIN_RMS = 4; // la voix normale pese peu en RMS : amplifiee avant le bornage a 1
const ATTAQUE = 0.5; // part de l'ecart rattrapee a chaque image quand le volume monte
const RETOMBEE = 0.12; // idem quand il descend : le halo retombe doucement

const borner = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function niveauRMS(echantillons) {
  if (!echantillons || !echantillons.length) return 0;
  let somme = 0;
  for (let i = 0; i < echantillons.length; i += 1) {
    const v = (echantillons[i] - 128) / 128;
    somme += v * v;
  }
  return borner(Math.sqrt(somme / echantillons.length) * GAIN_RMS);
}

export function lisserNiveau(precedent, brut) {
  const p = borner(precedent);
  const b = borner(brut);
  return borner(p + (b - p) * (b > p ? ATTAQUE : RETOMBEE));
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
      let lisse = 0;
      const image = () => {
        if (ferme) return;
        boucle = planifier(image);
        analyseur.getByteTimeDomainData(tampon);
        lisse = lisserNiveau(lisse, niveauRMS(tampon));
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
