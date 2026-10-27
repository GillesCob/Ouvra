// Regles de collision en langage naturel : dictee vocale du panneau « IA » (Web Speech API, aucun nouveau fournisseur).
// Logique sans DOM, testee avec une fausse SpeechRecognition (tests/reglesVoix.test.js) : l'ecriture dans le champ et l'etat du bouton passent
// par des rappels. Le texte reconnu remplit le champ (resultat provisoire en cours de dictee) mais ne part JAMAIS tout seul : l'appelant decide
// de l'envoi.
// Sources : MDN SpeechRecognition (reconnaissance parfois via un service distant, lang, interimResults, continuous) et specification Web Speech
// API (erreurs not-allowed, service-not-allowed, network, no-speech, audio-capture, language-not-supported, aborted ; interface SecureContext).

export const LANGUE_DICTEE = "fr-FR";

// Constructeur de reconnaissance disponible (standard, ou prefixe webkit sur Safari et Chrome), ou null : navigateur sans l'API, ou contexte
// non securise (http hors localhost).
export function detecterReconnaissance(fenetre) {
  if (!fenetre || fenetre.isSecureContext === false) return null;
  return fenetre.SpeechRecognition || fenetre.webkitSpeechRecognition || null;
}

// Texte deja saisi + texte reconnu, espaces propres, borne a la longueur maximale du champ.
export function assemblerTexte(base, transcription, longueurMax) {
  return [base, transcription].map((t) => String(t || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ").slice(0, longueurMax);
}

// Messages affiches a l'utilisateur : deux phrases au plus, tutoiement, sans jargon ni code d'erreur.
// Chrome et Safari sont les deux navigateurs nommes (choix de Gilles du 23/10). Chrome : prise en charge confirmee sans reglage (MDN browser-compat-data :
// SpeechRecognition des Chrome 33 avec le prefixe webkit, sans prefixe des Chrome 139 ; caniuse : Chrome partiel des 25). Safari : prise en charge avec le
// prefixe webkit, mais elle depend de la dictee ou de Siri activee dans le systeme (WebKit Bugzilla 225298). Firefox n'a la reconnaissance que derriere un
// reglage ou en version de test (caniuse : « disabled by default », MDN : « preview ») : pas nomme. Sur iPhone et iPad tous les navigateurs utilisent WebKit :
// le message dedie renvoie aux reglages de l'appareil, jamais a un autre navigateur.
const MESSAGE_NAVIGATEUR = "Ce navigateur n'accepte pas la dictée vocale.\nOuvre Ouvra dans Chrome ou Safari pour l'utiliser."; // deux lignes : le retour est rendu par white-space: pre-line (reglesIA.css)
const MESSAGE_APPAREIL_IOS = "La dictée vocale n'est pas disponible. Vérifie qu'elle est activée dans les réglages de l'appareil.";

// Message pour l'utilisateur, ou null pour un arret volontaire. Jamais d'echec muet.
export function messageErreurVoix(code, { ios = false } = {}) {
  const indisponible = ios ? MESSAGE_APPAREIL_IOS : MESSAGE_NAVIGATEUR;
  switch (code) {
    case "aborted": return null;
    case "not-allowed": return "Le micro est refusé. Autorise-le pour ce site dans le navigateur."; // changer de navigateur n'y changerait rien
    case "service-not-allowed":
    case "network": return indisponible; // service de reconnaissance absent ou injoignable (Brave, hors ligne, dictee systeme desactivee)
    case "no-speech": return "Je n'ai rien entendu. Appuie sur le micro puis parle.";
    case "audio-capture": return "Aucun micro détecté. Branche un micro pour dicter.";
    case "language-not-supported": return "La dictée vocale en français n'est pas disponible ici. Tu peux taper la phrase.";
    default: return "La dictée vocale a échoué. Tu peux taper la phrase.";
  }
}

// Contrôleur de dictée.
//   Reconnaissance : constructeur (detecterReconnaissance) ou null ; lire() / ecrire(texte) : champ de saisie ;
//   surEtat("ecoute" | "inactif") ; surErreur(message, codeErreur) ; longueurMax : longueur maximale de la phrase ;
//   continu : l'ecoute ne s'arrete pas d'elle-meme apres une pause (defaut faux).
export function creerDictee({ Reconnaissance, lire, ecrire, surEtat, surErreur, longueurMax, ios = false, continu = false }) {
  let courante = null; // reconnaissance en cours (null : aucune, ou abandonnee)

  function terminer(reco) {
    if (courante !== reco) return;
    courante = null;
    surEtat("inactif");
  }

  function demarrer() {
    const reco = new Reconnaissance();
    const base = lire();
    reco.lang = LANGUE_DICTEE;
    reco.interimResults = true; // texte provisoire affiche pendant que l'on parle
    reco.continuous = continu; // faux : une phrase par appui ; vrai : l'ecoute dure jusqu'au second appui (modale Vocal)
    reco.maxAlternatives = 1;
    reco.onresult = (e) => {
      if (courante !== reco) return; // resultat tardif d'une dictee abandonnee
      let texte = "";
      for (let i = 0; i < e.results.length; i += 1) texte += " " + e.results[i][0].transcript; // finaux puis provisoire, dans l'ordre
      ecrire(assemblerTexte(base, texte, longueurMax));
    };
    reco.onerror = (e) => {
      if (courante !== reco) return;
      const message = messageErreurVoix(e.error, { ios });
      if (message) surErreur(message, e.error);
    };
    reco.onend = () => terminer(reco);
    courante = reco;
    surEtat("ecoute");
    try {
      reco.start();
    } catch {
      courante = null;
      surEtat("inactif");
      surErreur(messageErreurVoix("inconnu", { ios }), "inconnu");
    }
  }

  return {
    disponible: !!Reconnaissance,
    ecoute: () => courante !== null,
    // Un appui demarre, le suivant arrete (les resultats finaux arrivent encore avant la fin).
    basculer() {
      if (!Reconnaissance) return;
      if (courante) courante.stop();
      else demarrer();
    },
    // Panneau ferme, envoi de la phrase : on coupe sans message et on ignore ce qui arrive ensuite.
    arreter() {
      const reco = courante;
      if (!reco) return;
      courante = null;
      surEtat("inactif");
      try { reco.abort(); } catch { /* deja arretee */ }
    }
  };
}

export const MESSAGE_RIEN_RECONNU = "Rien n'a été reconnu. Appuie sur le micro puis parle.";
export const MESSAGE_PHRASE_VIDE = "Écris la règle que tu veux, par exemple « écarte les collisions avec un diffuseur ».";
export const nettoyerPhrase = (texte) => String(texte || "").replace(/\s+/g, " ").trim();

// Raison pour laquelle « Vocal » est inutilisable quand le navigateur n'a pas l'API de reconnaissance (meme message que le code d'erreur « network »).
export const motifSansAPI = (ios = false) => messageErreurVoix("network", { ios });

// Raison exacte quand la dictee est indisponible AVANT tout clic : contexte non securise (http sur une IP locale, interface SecureContext) ou API absente.
export const MESSAGE_CONTEXTE_NON_SECURISE = "La dictée demande une connexion sécurisée (HTTPS). Écris ta demande ici.";
export const motifDicteeIndisponible = (fenetre, ios = false) => (fenetre && fenetre.isSecureContext === false ? MESSAGE_CONTEXTE_NON_SECURISE : motifSansAPI(ios));
