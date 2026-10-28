// Modale de saisie IA COMMUNE (24/10) : vocal d'abord, bascule texte, dictee de src/reglesVoix.js. Meme markup et memes classes que les modales des autres
// IA d'Ouvra (regles-ia-* de src/reglesIA.css) : une seule apparence, un seul comportement.
//  - ouvrir() ouvre DIRECTEMENT en mode vocal : gros micro, phrase d'aide, bouton « Écrire ma demande ». Un clic sur le micro demarre l'ecoute (jamais toute
//    seule), un second la termine et envoie. Le menu deroulant des phrases toutes faites est en bas (a lire en vocal, cliquable en texte).
//  - « Ecrire ma demande » bascule la MEME modale en texte (champ + Valider) ; « Utiliser le micro » revient, sans perdre la phrase.
//  - Dictee indisponible : ouverture directe en texte, avec la raison affichee.
//  - Apres l'envoi le logo Ouvra tourne pendant surEnvoi ; { ok: true } ferme la modale, { ok: false, message } revient a la vue avec le message.
// Module sans dependance a main.js ni a une page.
//   creerIASaisie({ exemples, libelle, placeholder, messageVide, retourFocus, surEnvoi })
//     exemples : [{ demande }] ; libelle : nom accessible de la modale ; placeholder : exemple du champ ; messageVide : message d'une phrase vide ;
//     retourFocus : element qui reprend le focus a la fermeture ;
//     lienBas : { libelle, surClic } facultatif (28/10) : un lien en bas de la modale, sous les propositions ; un clic ferme la modale puis appelle surClic() ;
//     surEnvoi(phrase, { annule }) : promesse de { ok: true } | { ok: false, message } ; annule() est vrai si la modale a ete fermee depuis l'envoi
//     (la reponse est alors ignoree : n'applique rien a l'insu de l'utilisateur) ; ne doit pas rejeter (une exception est rattrapee).
//   rend { ouvrir({ phraseInitiale, modeInitial }), fermer(), ouvert(), reformuler(phrase) }  (reformuler = ouvrir en texte, phrase ecrite)

import "./reglesIA.css";
import "./iaSaisie.css";
import { creerDictee, detecterReconnaissance, motifDicteeIndisponible, nettoyerPhrase, MESSAGE_RIEN_RECONNU } from "./reglesVoix.js";
import { demarrerNiveauVoix } from "./niveauVoix.js";
import { modeOuverture, modeApresBascule, annonceMode, aideVocal, suiteFinEcoute } from "./iaSaisieLogique.js";

export const PHRASE_MAX = 200; // meme plafond que les relais (relais/entree.js)
const DELAI_ARRET_MS = 2500; // attente des derniers resultats apres le second appui sur le micro, avant d'envoyer ce qui est reconnu
const ICONE_MICRO = '<svg viewBox="0 0 24 24" width="40" height="40" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const LEGENDE_CHARGEMENT = "Prise en compte de la demande par l'IA…";
const MESSAGE_ECHEC = "Cette demande n'a pas pu être traitée. Réessayer ou choisir une phrase d'exemple.";
const MESSAGE_VIDE_DEFAUT = "Écrire la demande, par exemple « combien de portes au niveau 2 ? ».";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerIASaisie({ exemples = [], libelle = "Demande par l'IA", placeholder = "", messageVide = MESSAGE_VIDE_DEFAUT, retourFocus = null, surEnvoi, lienBas = null }) {
  const Reconnaissance = detecterReconnaissance(window);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const dicteeDisponible = !!Reconnaissance;
  let motifVocal = dicteeDisponible ? null : motifDicteeIndisponible(window, ios); // non nul : le vocal est inutilisable
  let demandeEnCours = 0; // numero de la derniere demande : une reponse d'une demande abandonnee est ignoree
  let vue = null; // "texte" | "vocal" | "chargement" quand la modale est ouverte, sinon null
  let vueAvantChargement = "texte";
  let texteVocal = ""; // phrase reconnue pendant la dictee
  let envoiApresArret = false; // second appui sur le micro : on envoie des que l'ecoute est terminee
  let minuteurArret = 0;

  // ---------- Modale (markup identique aux autres IA) ----------
  const fond = creer("div", "regles-ia-fond regles-ia-fond-saisie");
  fond.hidden = true;
  const carte = creer("div", "regles-ia-carte");
  carte.setAttribute("role", "dialog");
  carte.setAttribute("aria-modal", "true");
  carte.setAttribute("aria-label", libelle);
  fond.appendChild(carte);

  const formulaire = creer("form", "regles-ia-vue regles-ia-vue-texte");
  formulaire.noValidate = true;
  const champ = creer("textarea"); // zone de texte a hauteur automatique : la phrase longue passe a la ligne et reste visible en entier (jamais de saut de ligne saisi)
  champ.rows = 1;
  champ.spellcheck = false;
  champ.maxLength = PHRASE_MAX;
  champ.autocomplete = "off";
  champ.enterKeyHint = "go";
  champ.placeholder = placeholder;
  champ.setAttribute("aria-label", "La demande, en une phrase");
  const valider = creer("button", "regles-ia-valider", "Valider");
  valider.type = "submit";
  const retourMicro = creer("button", "regles-ia-bascule", "Utiliser le micro");
  retourMicro.type = "button";
  formulaire.append(champ, valider, retourMicro);

  const vocal = creer("div", "regles-ia-vue regles-ia-vue-vocal");
  const micro = creer("button", "regles-ia-micro");
  micro.type = "button";
  micro.innerHTML = ICONE_MICRO;
  const legende = creer("p", "regles-ia-legende", aideVocal(false));
  const ecrire = creer("button", "regles-ia-bascule", "Écrire ma demande");
  ecrire.type = "button";
  const annonce = creer("span", "regles-ia-sr");
  annonce.setAttribute("role", "status");
  vocal.append(micro, legende, ecrire, annonce);

  const chargement = creer("div", "regles-ia-vue regles-ia-vue-chargement");
  const logoSource = document.querySelector("#loadingOverlay .logo-spin");
  if (logoSource) chargement.appendChild(logoSource.cloneNode(true));
  const legendeChargement = creer("p", "regles-ia-legende", LEGENDE_CHARGEMENT);
  legendeChargement.setAttribute("role", "status");
  chargement.appendChild(legendeChargement);

  const etat = creer("p", "regles-ia-etat erreur");
  etat.setAttribute("role", "status");
  etat.hidden = true;

  // Phrases toutes faites, en bas, dans un menu deroulant ferme : cliquables en texte comme en vocal (elles remplissent le champ ; en vocal elles basculent d'abord en texte).
  const propositions = creer("details", "regles-ia-propositions");
  const liste = creer("ul");
  exemples.forEach((exemple) => {
    const li = creer("li");
    const choisie = creer("button", "regles-ia-exemple", exemple.demande);
    choisie.type = "button";
    choisie.addEventListener("click", () => {
      if (vue === "vocal") { envoiApresArret = false; clearTimeout(minuteurArret); abandonnerDictee(); montrerVue("texte", { annoncer: true }); } // meme bascule que « Ecrire ma demande »
      champ.value = exemple.demande.slice(0, PHRASE_MAX); // rempli, jamais envoye : « Valider » reste a l'utilisateur
      propositions.open = false;
      afficherEtat("", false);
      ajusterChamp();
      focusVue("texte");
    });
    li.appendChild(choisie);
    liste.appendChild(li);
  });
  propositions.append(creer("summary", null, "Proposition d'instruction"), liste);
  propositions.hidden = exemples.length === 0;
  // Un appui en dehors de la liste la referme, sauf sur le lien du bas : la liste qui se replie decalerait le lien sous le doigt et le clic le manquerait.
  carte.addEventListener("pointerdown", (e) => { if (propositions.open && !propositions.contains(e.target) && !e.target.closest(".regles-ia-lien")) propositions.open = false; });

  carte.append(formulaire, vocal, chargement, etat, propositions);
  if (lienBas) {
    const lien = creer("button", "regles-ia-lien", lienBas.libelle);
    lien.type = "button";
    lien.addEventListener("click", () => { fermer(false); lienBas.surClic(); }); // la modale se ferme sans rendre le focus : le contenu ouvert prend le relais
    carte.appendChild(lien);
  }
  document.body.appendChild(fond);

  const ouvert = () => !fond.hidden;

  // Hauteur du champ = hauteur du texte (plafond de 5 lignes pose en CSS, au-dela le champ defile en interne). Appelee a chaque saisie, remplissage et affichage.
  function ajusterChamp() {
    if (formulaire.hidden || fond.hidden) return;
    champ.style.height = "auto";
    champ.style.height = `${champ.scrollHeight + champ.offsetHeight - champ.clientHeight}px`; // scrollHeight exclut la bordure (border-box)
    ajusterListe(); // le champ a change de taille : la liste des propositions se recalcule
  }
  champ.addEventListener("input", () => {
    if (/[\r\n]/.test(champ.value)) { const debut = champ.selectionStart; champ.value = champ.value.replace(/[\r\n]/g, " "); champ.setSelectionRange(debut, debut); } // collage multiligne : espaces, longueur inchangee
    ajusterChamp();
  });
  champ.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault(); // Entree valide comme avant, jamais de saut de ligne
    valider.click();
  });

  // Hauteur maximale de la liste des propositions : place libre dans le fond (zone visible, padding retire) moins le reste de la carte. Elle seule defile.
  function ajusterListe() {
    if (fond.hidden || !propositions.open || propositions.hidden) { fond.style.removeProperty("--ia-liste-max"); return; }
    fond.style.setProperty("--ia-liste-max", "none");
    const style = getComputedStyle(fond);
    const libre = fond.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const reste = carte.getBoundingClientRect().height - liste.getBoundingClientRect().height;
    fond.style.setProperty("--ia-liste-max", `${Math.max(44, Math.floor(libre - reste))}px`);
  }
  propositions.addEventListener("toggle", ajusterListe);
  window.addEventListener("resize", () => { ajusterChamp(); ajusterListe(); }); // largeur changee : le retour a la ligne change

  // Halo du micro qui suit le vrai volume de la voix (28/10) : un SECOND flux micro, ouvert quand l'ecoute demarre et libere a toute sortie d'ecoute (surEtat « inactif » :
  // second appui, fermeture, abandon, page quittee, erreur). Jamais sur iOS ni en mouvement reduit ; refus ou echec : on garde le halo a rythme fixe, sans message.
  const mouvementReduit = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let niveauVoix = null;
  function arreterNiveau() {
    if (niveauVoix) niveauVoix.fermer();
    niveauVoix = null;
    micro.classList.remove("niveau");
    micro.style.removeProperty("--ia-niveau");
  }
  function lancerNiveau() {
    arreterNiveau();
    if (ios || mouvementReduit.matches) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const suivi = demarrerNiveauVoix({
      mediaDevices: navigator.mediaDevices,
      creerContexte: () => new AudioCtx(),
      planifier: (f) => requestAnimationFrame(f),
      annuler: (id) => cancelAnimationFrame(id),
      surNiveau: (n) => micro.style.setProperty("--ia-niveau", n.toFixed(3)),
      surOuvert: () => { if (niveauVoix === suivi) micro.classList.add("niveau"); }, // le halo reactif remplace le halo fixe
      surEchec: () => { if (niveauVoix === suivi) arreterNiveau(); }
    });
    niveauVoix = suivi;
  }

  // Dictee : le texte reconnu reste en memoire (texteVocal), il ne part qu'au second appui sur le micro.
  const dictee = creerDictee({
    Reconnaissance,
    lire: () => texteVocal,
    ecrire: (texte) => { texteVocal = texte; },
    surEtat: (etatDictee) => {
      const ecoute = etatDictee === "ecoute";
      micro.classList.toggle("ecoute", ecoute);
      micro.setAttribute("aria-pressed", String(ecoute));
      micro.setAttribute("aria-label", ecoute ? "Micro : appuyer pour terminer et envoyer" : "Micro : appuyer pour parler");
      legende.textContent = aideVocal(ecoute);
      annonce.textContent = ecoute ? "Écoute en cours" : "";
      if (ecoute) lancerNiveau(); else arreterNiveau();
      if (!ecoute) finDEcoute();
    },
    surErreur: (message, code) => {
      afficherEtat(message, true);
      if (code !== "no-speech") { motifVocal = message; micro.disabled = true; } // refus du micro, service injoignable... : vocal desactive jusqu'a la fermeture
    },
    longueurMax: PHRASE_MAX,
    ios,
    continu: true
  });
  micro.setAttribute("aria-label", "Micro : appuyer pour parler");

  // Arret sans envoi (fermeture, page quittee) : ce qui a ete reconnu est jete avant que l'etat « inactif » ne declenche finDEcoute.
  function abandonnerDictee() {
    texteVocal = "";
    dictee.arreter();
  }

  function afficherEtat(texte, erreur) {
    etat.textContent = texte || "";
    etat.hidden = !texte;
    etat.classList.toggle("erreur", erreur !== false);
    ajusterListe();
  }

  // ---------- Vues ----------
  function montrerVue(nom, { annoncer = false } = {}) {
    vue = nom;
    formulaire.hidden = nom !== "texte";
    vocal.hidden = nom !== "vocal";
    chargement.hidden = nom !== "chargement";
    propositions.hidden = nom === "chargement" || exemples.length === 0;
    propositions.classList.toggle("lecture", nom === "vocal");
    retourMicro.hidden = !dicteeDisponible || !!motifVocal;
    carte.dataset.vue = nom;
    ajusterChamp();
    ajusterListe();
    carte.setAttribute("aria-busy", String(nom === "chargement"));
    if (annoncer && nom !== "chargement") annonce.textContent = annonceMode(nom);
  }

  function focusVue(nom) {
    if (nom === "texte") {
      champ.focus({ preventScroll: true });
      champ.setSelectionRange(champ.value.length, champ.value.length);
    } else {
      micro.focus({ preventScroll: true });
    }
  }

  // modeInitial : "vocal" | "texte" (defaut : vocal si la dictee existe, sinon texte avec la raison).
  function ouvrir({ phraseInitiale = "", modeInitial = null } = {}) {
    afficherEtat("", false);
    texteVocal = "";
    propositions.open = false;
    champ.value = String(phraseInitiale || "").slice(0, PHRASE_MAX);
    const ouverture = modeOuverture({ dicteeDisponible: dicteeDisponible && !motifVocal, motifIndisponible: motifVocal });
    const nom = modeInitial === "texte" ? "texte" : ouverture.mode;
    fond.hidden = false;
    suivreZoneVisible();
    montrerVue(nom);
    if (nom === "texte" && ouverture.raison && modeInitial !== "texte") afficherEtat(ouverture.raison, false);
    focusVue(nom);
  }

  // Fermeture : l'ecoute est coupee, une demande en cours est abandonnee (sa reponse sera ignoree), le champ est vide.
  function fermer(rendreFocus = true) {
    demandeEnCours += 1; // jeton de generation : toute reponse en route est ignoree, meme si la modale etait deja fermee
    if (!ouvert()) return;
    clearTimeout(minuteurArret);
    envoiApresArret = false;
    vue = null;
    abandonnerDictee();
    fond.hidden = true;
    champ.value = "";
    if (dicteeDisponible) motifVocal = null; // un refus est oublie, comme un navigateur sans l'API reste sans vocal
    if (rendreFocus && retourFocus) retourFocus.focus({ preventScroll: true });
  }

  // ---------- Envoi ----------
  async function envoyer(phrase) {
    const numero = ++demandeEnCours;
    vueAvantChargement = vue === "vocal" ? "vocal" : "texte";
    afficherEtat("", false);
    montrerVue("chargement");
    let message;
    try {
      const reponse = await surEnvoi(phrase, { annule: () => numero !== demandeEnCours });
      if (numero !== demandeEnCours) return; // modale fermee ou autre demande depuis : rien ne s'applique a l'insu de l'utilisateur
      if (reponse && reponse.ok) { fermer(false); return; }
      message = (reponse && reponse.message) || MESSAGE_ECHEC;
    } catch {
      if (numero !== demandeEnCours) return;
      message = MESSAGE_ECHEC; // une exception ne laisse jamais la modale bloquee sur « chargement »
    }
    montrerVue(vueAvantChargement);
    afficherEtat(message, true);
    focusVue(vueAvantChargement);
  }

  formulaire.addEventListener("submit", (e) => {
    e.preventDefault();
    const phrase = nettoyerPhrase(champ.value);
    if (!phrase) { afficherEtat(messageVide, true); champ.focus({ preventScroll: true }); return; }
    envoyer(phrase);
  });

  // Micro : un appui demarre l'ecoute (dans le geste de l'utilisateur, ce qui declenche la permission du micro), le suivant la termine et envoie.
  micro.addEventListener("click", () => {
    if (!dictee.disponible) return;
    if (dictee.ecoute()) {
      envoiApresArret = true;
      dictee.basculer(); // stop : les derniers resultats arrivent encore, puis l'etat devient « inactif » (finDEcoute)
      minuteurArret = setTimeout(() => dictee.arreter(), DELAI_ARRET_MS); // filet : le service ne signale jamais la fin
      return;
    }
    texteVocal = "";
    afficherEtat("", false);
    dictee.basculer();
  });

  // Bascules : la phrase reconnue ou ecrite n'est jamais perdue.
  ecrire.addEventListener("click", () => {
    const reconnue = nettoyerPhrase(texteVocal);
    if (reconnue) champ.value = reconnue;
    envoiApresArret = false;
    clearTimeout(minuteurArret);
    abandonnerDictee();
    afficherEtat("", false);
    montrerVue(modeApresBascule("vocal", { dicteeDisponible }), { annoncer: true });
    focusVue("texte");
  });
  retourMicro.addEventListener("click", () => {
    afficherEtat("", false);
    montrerVue(modeApresBascule("texte", { dicteeDisponible: dicteeDisponible && !motifVocal }), { annoncer: true });
    focusVue(vue);
  });

  // Fin de l'ecoute (second appui, fin naturelle ou erreur).
  function finDEcoute() {
    clearTimeout(minuteurArret);
    const termine = envoiApresArret;
    envoiApresArret = false;
    if (vue !== "vocal") return;
    const phrase = nettoyerPhrase(texteVocal);
    texteVocal = "";
    const suite = suiteFinEcoute({ termineParUtilisateur: termine, phrase });
    if (suite === "envoyer") envoyer(phrase);
    else if (suite === "texte") { champ.value = phrase; montrerVue("texte", { annoncer: true }); focusVue("texte"); } // arret spontane avec une phrase : a verifier, rien ne part tout seul
    else if (termine) afficherEtat(MESSAGE_RIEN_RECONNU, true);
  }

  // Mobile : le clavier virtuel d'iOS ne reduit pas la page, seulement la partie visible (visualViewport). Le fond suit cette zone visible (haut et hauteur),
  // la carte se plafonne dedans et defile en interne : champ, propositions et « Valider » restent atteignables clavier ouvert.
  const vv = window.visualViewport;
  const ecranEtroit = window.matchMedia ? window.matchMedia("(max-width: 768px)") : { matches: false };
  const suivreZoneVisible = () => {
    const actif = ecranEtroit.matches && vv && !fond.hidden;
    fond.style.setProperty("--ia-vv-haut", actif ? `${Math.round(vv.offsetTop)}px` : "0px");
    fond.style.setProperty("--ia-vv-hauteur", actif ? `${Math.round(vv.height)}px` : "100%");
    fond.classList.toggle("zone-reduite", !!actif && window.innerHeight - vv.height > 120); // clavier ouvert : la carte se cale en haut
    ajusterListe();
  };
  if (vv) { vv.addEventListener("resize", suivreZoneVisible); vv.addEventListener("scroll", suivreZoneVisible); }

  // Clic sur le fond autour de la carte : fermeture (annule aussi une demande en cours).
  fond.addEventListener("click", (e) => { if (e.target === fond) fermer(true); });
  document.addEventListener("keydown", (e) => {
    if (!ouvert()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(true); return; }
    if (e.key === "Tab") boucleFocus(e);
  }, true);

  // Tabulation gardee dans la modale (elle est modale : le reste de la page n'est pas atteignable au clavier).
  function boucleFocus(e) {
    const cibles = [...carte.querySelectorAll("button, textarea, summary")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!cibles.length) return;
    const premier = cibles[0];
    const dernier = cibles[cibles.length - 1];
    if (e.shiftKey && (document.activeElement === premier || !carte.contains(document.activeElement))) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  // Page en arriere-plan ou quittee : le micro ne reste jamais ouvert.
  document.addEventListener("visibilitychange", () => { if (document.hidden) abandonnerDictee(); });
  window.addEventListener("pagehide", () => { abandonnerDictee(); arreterNiveau(); });

  montrerVue("texte");

  return { ouvrir, fermer, ouvert, reformuler: (phrase) => ouvrir({ phraseInitiale: phrase, modeInitial: "texte" }) };
}
