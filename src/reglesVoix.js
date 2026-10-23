// Regles de collision en langage naturel : dictee vocale du panneau « IA » (Web Speech API, aucun nouveau fournisseur).
// Logique sans DOM, testee avec une fausse SpeechRecognition (tests/reglesVoix.test.js) : l'ecriture dans le champ et l'etat du bouton passent
// par des rappels. Le texte reconnu remplit le champ (resultat provisoire en cours de dictee) mais ne part JAMAIS tout seul : l'utilisateur relit
// puis appuie sur « Traduire ».
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

// Message pour l'utilisateur, ou null pour un arret volontaire. Jamais d'echec muet.
export function messageErreurVoix(code) {
  switch (code) {
    case "aborted": return null;
    case "not-allowed":
    case "service-not-allowed": return "Le micro est refusé ou indisponible. Autorise le micro pour ce site dans le navigateur puis réessaie, ou tu peux taper la phrase.";
    case "network": return "La dictée n'a pas pu joindre le service de reconnaissance vocale du navigateur (certains navigateurs ne le proposent pas, ou la connexion manque). Tu peux taper la phrase.";
    case "no-speech": return "Je n'ai rien entendu. Appuie sur « Envoyer » pour reprendre l'écoute, ou sur « Annuler » pour revenir au texte.";
    case "audio-capture": return "Aucun micro détecté. Branche un micro ou tu peux taper la phrase.";
    case "language-not-supported": return "Le français n'est pas disponible pour la dictée dans ce navigateur. Tu peux taper la phrase.";
    default: return "La dictée vocale a échoué. Tu peux taper la phrase.";
  }
}

// Contrôleur de dictée.
//   Reconnaissance : constructeur (detecterReconnaissance) ou null ; lire() / ecrire(texte) : champ de saisie ;
//   surEtat("ecoute" | "inactif") ; surErreur(message, codeErreur) ; longueurMax : longueur maximale de la phrase.
export function creerDictee({ Reconnaissance, lire, ecrire, surEtat, surErreur, longueurMax }) {
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
    reco.continuous = false; // une phrase par appui
    reco.maxAlternatives = 1;
    reco.onresult = (e) => {
      if (courante !== reco) return; // resultat tardif d'une dictee abandonnee
      let texte = "";
      for (let i = 0; i < e.results.length; i += 1) texte += " " + e.results[i][0].transcript; // finaux puis provisoire, dans l'ordre
      ecrire(assemblerTexte(base, texte, longueurMax));
    };
    reco.onerror = (e) => {
      if (courante !== reco) return;
      const message = messageErreurVoix(e.error);
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
      surErreur(messageErreurVoix("inconnu"), "inconnu");
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

const MESSAGE_ECOUTE = "Je t'écoute… Parle, puis appuie sur « Envoyer ».";
const MESSAGE_RIEN_RECONNU = "Rien n'a été reconnu : parle, puis appuie sur « Envoyer ». L'écoute reprend.";
const MESSAGE_PHRASE_VIDE = "Écris la règle que tu veux, par exemple « écarte les collisions avec un diffuseur ».";
const MOTIF_SANS_API = "La dictée vocale n'est pas disponible dans ce navigateur : tu peux taper la phrase.";
const nettoyerPhrase = (texte) => String(texte || "").replace(/\s+/g, " ").trim();

// Modes de saisie du panneau « Decrire avec l'IA » : Texte (champ + « Traduire ») et Vocal (ecoute + « Envoyer »).
// Un seul chemin pour envoyer : preparerEnvoi() rend la phrase a envoyer (ou null, avec un message), le panneau envoie ensuite comme pour « Traduire ».
//   surMode("texte" | "vocal") ; surEcoute(bool) ; surMessage(texte, estErreur) ; surIndisponible(motif) : Vocal devient inutilisable, avec explication.
// Rien n'est envoye par la dictee elle-meme. Les modes et l'ecoute ne survivent pas a fermer().
export function creerSaisie({ Reconnaissance, lire, ecrire, surMode, surEcoute, surMessage, surIndisponible, longueurMax }) {
  let mode = "texte";
  let avantVocal = ""; // texte du champ avant l'entree en mode Vocal, restaure a l'annulation
  let motif = Reconnaissance ? null : MOTIF_SANS_API; // non nul : Vocal indisponible
  let messageEcouteAffiche = false;

  const dictee = creerDictee({
    Reconnaissance,
    lire,
    ecrire,
    longueurMax,
    surEtat: (etat) => {
      surEcoute(etat === "ecoute");
      if (etat === "ecoute") { messageEcouteAffiche = true; surMessage(MESSAGE_ECOUTE, false); }
      else if (messageEcouteAffiche) { messageEcouteAffiche = false; surMessage("", false); }
    },
    surErreur: (message, code) => {
      messageEcouteAffiche = false;
      if (code === "no-speech") { surMessage(message, true); return; } // silence : on reste en Vocal, l'utilisateur reprend ou annule
      motif = message; // permission refusee, service injoignable, pas de micro... : retour au mode Texte, Vocal desactive avec la raison
      retourTexte();
      surIndisponible(message);
      surMessage(message, true);
    }
  });

  function retourTexte() {
    dictee.arreter();
    if (mode !== "vocal") return;
    ecrire(avantVocal);
    mode = "texte";
    surMode("texte");
  }

  return {
    mode: () => mode,
    ecoute: dictee.ecoute,
    vocalDisponible: () => !motif,
    motifIndisponible: () => motif,
    // A appeler dans le geste de l'utilisateur (clic sur « Vocal ») : c'est lui qui declenche la demande de permission du micro.
    choisirVocal() {
      if (mode === "vocal" || motif) return;
      avantVocal = lire();
      ecrire("");
      mode = "vocal";
      surMode("vocal");
      dictee.basculer();
    },
    // « Texte » ou « Annuler » : on coupe l'ecoute, rien n'est envoye, le champ retrouve ce qu'il contenait.
    choisirTexte: retourTexte,
    // Phrase a envoyer au relais, ou null (message affiche). En Vocal : coupe l'ecoute et garde le texte affiche, retour au mode Texte.
    preparerEnvoi() {
      if (mode === "vocal") {
        dictee.arreter();
        const phrase = nettoyerPhrase(lire());
        if (!phrase) {
          dictee.basculer(); // rien de reconnu : retour a l'ecoute
          messageEcouteAffiche = false;
          surMessage(MESSAGE_RIEN_RECONNU, true);
          return null;
        }
        mode = "texte";
        surMode("texte");
        return phrase;
      }
      const phrase = nettoyerPhrase(lire());
      if (!phrase) { surMessage(MESSAGE_PHRASE_VIDE, true); return null; }
      return phrase;
    },
    // Panneau ferme, page en arriere-plan : micro coupe, mode Texte, refus oublie (sauf navigateur sans l'API).
    fermer() {
      retourTexte();
      if (Reconnaissance) motif = null;
    }
  };
}
