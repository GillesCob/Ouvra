// Point d'entree des regles de collision en langage naturel (22/10, etape 5), refait le 23/10 : le bouton « IA » de la page Collision ouvre un
// petit choix a deux boutons, « Texte » et « Vocal » (meme principe que « Sur une surface » / « Coupe horizontale » de la coupe), puis une modale
// centree, fermee d'un clic autour d'elle.
//  - Texte : le champ et, dessous, « Valider ». Les propositions d'instruction (src/reglesExemples.js) sont tout en bas ; un clic remplit le champ.
//  - Vocal : l'image d'un micro et « Appuyer pour parler ». Un clic demarre l'ecoute (le micro passe au vert), un second clic la termine et envoie
//    (dictee de src/reglesVoix.js, sans bouton « Envoyer »). Les propositions, en bas, ne sont qu'a lire.
//  - Dans les deux cas, apres l'envoi le logo Ouvra tourne pendant que le relais hebergé traduit la phrase (traduire), puis la modale « Regle a
//    valider » s'ouvre (ouvrirRegle). En cas d'echec, la modale revient a sa vue avec le message.
// Sans l'API de dictee ou apres un refus du micro, « Vocal » est desactive avec la raison, affichee sous le choix.
//
// Placement du choix (positionnement fixe, recalcule a partir des rectangles des boutons voisins, sans toucher a leur mise en page) :
//  - ordinateur : en bas a droite de la vue 3D (#collisionViewerSlot), le choix s'ouvre vers le haut et vers la gauche ;
//  - mobile : sur la ligne du bouton « Collisions », juste a sa gauche, en suivant tous ses deplacements (bandeau replie, ouvert, pleine page,
//    glissements et animations de fermeture). Le choix s'ouvre vers le haut.
// Module sans dependance a main.js : tout passe par les parametres de creerReglesIA.
//   parent : element qui porte le bouton (#collisionLeft, masque avec la page Collision)
//   slot : zone 3D (#collisionViewerSlot) ; boutonCollisions : bouton « ☰ Collisions » (mobile)
//   masquerSurMobile() : vrai quand le bouton ne doit pas etre affiche sur mobile (bandeau de collision en pleine page)
//   observes : elements dont un changement de style / classe peut deplacer les boutons voisins
//   exemples : [{ demande }] (src/reglesExemples.js) ; ouvrirRegle(regle) : valide la regle et ouvre la modale « Regle a valider »
//   traduire(phrase) : promesse de { ok: true, resultat: "regle", regle } | { ok: true, resultat: "critere_introuvable" | "non_comprise", message }
//     | { ok: false, code, message } (src/reglesIAClient.js) ; ne rejette jamais
//   fermerAutres() : ferme les autres menus deroulants de la page ; absorberGeste() : appui hors du choix en clic neutre (mobile)

import "./reglesIA.css";
import { creerDictee, detecterReconnaissance, motifSansAPI, nettoyerPhrase, MESSAGE_PHRASE_VIDE, MESSAGE_RIEN_RECONNU } from "./reglesVoix.js";

const MOBILE = "(max-width: 768px)";
const LARGEUR_MOBILE = 44;
const ECART = 8;
const MARGE = 16;
const IMAGES_CALMES = 24; // images sans mouvement des boutons voisins avant d'arreter le suivi
const DELAI_ARRET_MS = 2500; // attente des derniers resultats apres le second appui sur le micro, avant d'envoyer ce qui est reconnu

export const PHRASE_MAX = 200; // meme plafond que le relais (relais/entree.js)
const ICONE_MICRO = '<svg viewBox="0 0 24 24" width="40" height="40" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const PLACEHOLDER_TEXTE = "Ex. : écarte les collisions avec un diffuseur";
const LEGENDE_MICRO = "Appuyer pour parler";
const LEGENDE_ECOUTE = "Cliquer sur le micro une fois terminé";
const LEGENDE_CHARGEMENT = "Prise en compte de ton instruction par l'IA…";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerReglesIA({ parent, slot, boutonCollisions, masquerSurMobile, observes, exemples, ouvrirRegle, traduire, fermerAutres, absorberGeste }) {
  const racine = creer("div");
  racine.id = "reglesIA";
  const bouton = creer("button", null, "IA");
  bouton.type = "button";
  bouton.id = "reglesIABtn";
  bouton.setAttribute("aria-label", "Règles par l'IA");
  bouton.setAttribute("aria-haspopup", "dialog");
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-controls", "reglesIAChoix");
  bouton.title = "Règles par l'IA";
  racine.appendChild(bouton);

  const Reconnaissance = detecterReconnaissance(window);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let motifVocal = Reconnaissance ? null : motifSansAPI(ios); // non nul : « Vocal » inutilisable
  let demandeEnCours = 0; // numero de la derniere demande : une reponse d'une demande abandonnee est ignoree
  let vue = null; // "texte" | "vocal" | "chargement" quand la modale est ouverte, sinon null
  let vueAvantChargement = "texte";
  let texteVocal = ""; // phrase reconnue pendant la dictee
  let envoiApresArret = false; // second appui sur le micro : on envoie des que l'ecoute est terminee
  let minuteurArret = 0;

  // ---------- Choix Texte / Vocal ----------
  const choix = creer("div");
  choix.id = "reglesIAChoix";
  choix.setAttribute("role", "group");
  choix.setAttribute("aria-label", "Mode de saisie");
  choix.hidden = true;
  const rangee = creer("div", "regles-ia-choix-rangee");
  const choixTexte = creer("button", null, "Texte");
  choixTexte.type = "button";
  const choixVocal = creer("button", null, "Vocal");
  choixVocal.type = "button";
  choixVocal.setAttribute("aria-describedby", "reglesIANoteVocal");
  const noteVocal = creer("p", "regles-ia-etat");
  noteVocal.id = "reglesIANoteVocal";
  noteVocal.hidden = true;
  rangee.append(choixTexte, choixVocal);
  choix.append(rangee, noteVocal);

  // ---------- Modale ----------
  const fond = creer("div", "regles-ia-fond");
  fond.id = "reglesIAFond";
  fond.hidden = true;
  const carte = creer("div", "regles-ia-carte");
  carte.setAttribute("role", "dialog");
  carte.setAttribute("aria-modal", "true");
  carte.setAttribute("aria-label", "Règle par l'IA");
  fond.appendChild(carte);

  // Vue Texte : champ, « Valider », message d'erreur.
  const formulaire = creer("form", "regles-ia-vue regles-ia-vue-texte");
  formulaire.noValidate = true;
  const champ = creer("input");
  champ.type = "text";
  champ.id = "reglesIAChamp";
  champ.maxLength = PHRASE_MAX;
  champ.autocomplete = "off";
  champ.enterKeyHint = "go";
  champ.placeholder = PLACEHOLDER_TEXTE;
  champ.setAttribute("aria-label", "Ta règle, en une phrase");
  const valider = creer("button", "regles-ia-valider", "Valider");
  valider.type = "submit";
  formulaire.append(champ, valider);

  // Vue Vocal : micro, legende, annonce pour lecteur d'ecran.
  const vocal = creer("div", "regles-ia-vue regles-ia-vue-vocal");
  const micro = creer("button", "regles-ia-micro");
  micro.type = "button";
  micro.id = "reglesIAMicro";
  micro.setAttribute("aria-label", LEGENDE_MICRO);
  micro.innerHTML = ICONE_MICRO;
  const legende = creer("p", "regles-ia-legende", LEGENDE_MICRO);
  legende.id = "reglesIALegende";
  const annonce = creer("span", "regles-ia-sr");
  annonce.setAttribute("role", "status");
  vocal.append(micro, legende, annonce);

  // Vue chargement : le logo Ouvra qui tourne (meme SVG que l'ecran de chargement des maquettes).
  const chargement = creer("div", "regles-ia-vue regles-ia-vue-chargement");
  const logoSource = document.querySelector("#loadingOverlay .logo-spin");
  if (logoSource) chargement.appendChild(logoSource.cloneNode(true));
  const legendeChargement = creer("p", "regles-ia-legende", LEGENDE_CHARGEMENT);
  legendeChargement.setAttribute("role", "status");
  chargement.appendChild(legendeChargement);

  // Message de la derniere demande (erreur, critere introuvable, rien reconnu).
  const etat = creer("p", "regles-ia-etat erreur");
  etat.id = "reglesIAEtat";
  etat.setAttribute("role", "status");
  etat.hidden = true;

  // Propositions d'instruction, tout en bas : cliquables en mode Texte (elles remplissent le champ), a lire seulement en mode Vocal.
  const propositions = creer("section", "regles-ia-propositions");
  const titreProps = creer("h3", null, "Proposition d'instruction");
  titreProps.id = "reglesIATitreProps";
  const liste = creer("ul");
  liste.setAttribute("aria-labelledby", "reglesIATitreProps");
  exemples.forEach((regle) => {
    const li = creer("li");
    const choisie = creer("button", "regles-ia-exemple", regle.demande);
    choisie.type = "button";
    choisie.addEventListener("click", () => { champ.value = regle.demande.slice(0, PHRASE_MAX); afficherEtat("", false); champ.focus({ preventScroll: true }); });
    const lue = creer("span", "regles-ia-exemple-lu", "« " + regle.demande + " »");
    li.append(choisie, lue);
    liste.appendChild(li);
  });
  propositions.append(titreProps, liste);

  carte.append(formulaire, vocal, chargement, etat, propositions);
  document.body.appendChild(fond);
  document.body.appendChild(choix);
  parent.appendChild(racine);

  const mobile = () => window.matchMedia(MOBILE).matches;
  const choixOuvert = () => !choix.hidden;
  const modaleOuverte = () => !fond.hidden;
  const ouvert = () => choixOuvert() || modaleOuverte();

  // Dictee : le texte reconnu reste en memoire (texteVocal), il ne part qu'au second appui sur le micro.
  const dictee = creerDictee({
    Reconnaissance,
    lire: () => texteVocal,
    ecrire: (texte) => { texteVocal = texte; },
    surEtat: (etatDictee) => {
      const ecoute = etatDictee === "ecoute";
      micro.classList.toggle("ecoute", ecoute);
      micro.setAttribute("aria-pressed", String(ecoute));
      legende.textContent = ecoute ? LEGENDE_ECOUTE : LEGENDE_MICRO;
      annonce.textContent = ecoute ? "Écoute en cours" : "";
      if (!ecoute) finDEcoute();
    },
    surErreur: (message, code) => {
      afficherEtat(message, true);
      if (code !== "no-speech") { motifVocal = message; micro.disabled = true; } // refus du micro, service injoignable... : « Vocal » desactive jusqu'a la fermeture
    },
    longueurMax: PHRASE_MAX,
    ios,
    continu: true
  });

  // Arret sans envoi (fermeture, page quittee) : ce qui a ete reconnu est jete avant que l'etat « inactif » ne declenche finDEcoute.
  function abandonnerDictee() {
    texteVocal = "";
    dictee.arreter();
  }

  function majChoixVocal() {
    choixVocal.disabled = !!motifVocal;
    micro.disabled = !!motifVocal;
    noteVocal.textContent = motifVocal || "";
    noteVocal.hidden = !motifVocal;
  }

  function afficherEtat(texte, erreur) {
    etat.textContent = texte || "";
    etat.hidden = !texte;
    etat.classList.toggle("erreur", erreur !== false);
  }

  // ---------- Vues de la modale ----------
  function montrerVue(nom) {
    vue = nom;
    formulaire.hidden = nom !== "texte";
    vocal.hidden = nom !== "vocal";
    chargement.hidden = nom !== "chargement";
    propositions.hidden = nom === "chargement";
    propositions.classList.toggle("lecture", nom === "vocal");
    carte.dataset.vue = nom;
    carte.setAttribute("aria-busy", String(nom === "chargement"));
  }

  function ouvrirModale(nom, phrase) {
    fermerChoix(false);
    afficherEtat("", false);
    texteVocal = "";
    if (typeof phrase === "string") champ.value = phrase;
    fond.hidden = false;
    montrerVue(nom);
    if (nom === "texte") {
      champ.focus({ preventScroll: true });
      champ.setSelectionRange(champ.value.length, champ.value.length);
    } else {
      micro.focus({ preventScroll: true });
    }
  }

  // Fermeture de la modale : l'ecoute est coupee, une demande en cours est abandonnee (sa reponse sera ignoree), le champ est vide.
  function fermerModale(rendreFocus) {
    if (!modaleOuverte()) return;
    demandeEnCours += 1;
    clearTimeout(minuteurArret);
    envoiApresArret = false;
    vue = null;
    abandonnerDictee();
    fond.hidden = true;
    champ.value = "";
    if (Reconnaissance) motifVocal = null; // un refus est oublie, comme un navigateur sans l'API reste sans Vocal
    majChoixVocal();
    if (rendreFocus) bouton.focus({ preventScroll: true });
  }

  // ---------- Envoi ----------
  async function envoyer(phrase) {
    const numero = ++demandeEnCours;
    vueAvantChargement = vue === "vocal" ? "vocal" : "texte";
    afficherEtat("", false);
    montrerVue("chargement");
    const reponse = await traduire(phrase);
    // Modale fermee ou autre demande depuis : le resultat est abandonne, rien ne s'ouvre a l'insu de l'utilisateur.
    if (numero !== demandeEnCours) return;
    if (reponse.ok && reponse.resultat === "regle") {
      fermerModale(true);
      ouvrirRegle({ ...reponse.regle, saisie: true }); // saisie : la modale propose « Reformuler »
      return;
    }
    montrerVue(vueAvantChargement);
    afficherEtat(reponse.ok ? (reponse.resultat === "critere_introuvable" ? "Critère introuvable. " : "") + reponse.message : reponse.message, true);
    if (vueAvantChargement === "texte") champ.focus({ preventScroll: true });
    else micro.focus({ preventScroll: true });
  }

  formulaire.addEventListener("submit", (e) => {
    e.preventDefault();
    const phrase = nettoyerPhrase(champ.value);
    if (!phrase) { afficherEtat(MESSAGE_PHRASE_VIDE, true); champ.focus({ preventScroll: true }); return; }
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

  // Fin de l'ecoute (second appui, fin naturelle ou erreur). Envoi seulement si l'utilisateur a termine ou si le moteur s'est arrete avec du texte.
  function finDEcoute() {
    clearTimeout(minuteurArret);
    const termine = envoiApresArret;
    envoiApresArret = false;
    if (vue !== "vocal") return;
    const phrase = nettoyerPhrase(texteVocal);
    texteVocal = "";
    if (phrase) { envoyer(phrase); return; }
    if (termine) afficherEtat(MESSAGE_RIEN_RECONNU, true);
  }

  // ---------- Ouverture / fermeture du choix ----------
  function ouvrirChoix() {
    fermerAutres();
    majChoixVocal();
    choix.hidden = false;
    bouton.setAttribute("aria-expanded", "true");
    placer();
    choixTexte.focus({ preventScroll: true });
    reveiller();
  }

  function fermerChoix(rendreFocus) {
    if (!choixOuvert()) return;
    choix.hidden = true;
    bouton.setAttribute("aria-expanded", "false");
    if (rendreFocus) bouton.focus({ preventScroll: true });
  }

  bouton.addEventListener("click", () => {
    if (modaleOuverte()) return;
    if (choixOuvert()) fermerChoix(true); else ouvrirChoix();
  });
  choixTexte.addEventListener("click", () => ouvrirModale("texte"));
  choixVocal.addEventListener("click", () => { if (!motifVocal) ouvrirModale("vocal"); });
  // Les clics du choix et du bouton ne remontent pas : xeokit annule l'action par defaut d'un clic tant que le pointeur est reste sur le canevas 3D.
  racine.addEventListener("click", (e) => e.stopPropagation());
  choix.addEventListener("click", (e) => e.stopPropagation());
  // Clic sur le fond autour de la carte : fermeture (annule aussi une demande en cours).
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerModale(true); });

  // Appui en dehors du choix (phase de capture : le canevas 3D capte les gestes avant le document) : il se ferme, et sur mobile l'appui ne
  // declenche rien dessous (meme mecanisme que le hamburger et le menu « Conflit seul »).
  document.addEventListener("pointerdown", (e) => {
    if (!choixOuvert() || choix.contains(e.target) || racine.contains(e.target)) return;
    fermerChoix(false);
    absorberGeste();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ouvert()) {
      e.preventDefault();
      e.stopPropagation();
      if (modaleOuverte()) fermerModale(true); else fermerChoix(true);
      return;
    }
    if (e.key === "Tab" && modaleOuverte()) boucleFocus(e);
  }, true);

  // Tabulation gardee dans la modale (elle est modale : le reste de la page n'est pas atteignable au clavier).
  function boucleFocus(e) {
    const cibles = [...carte.querySelectorAll("button, input")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!cibles.length) return;
    const premier = cibles[0];
    const dernier = cibles[cibles.length - 1];
    if (e.shiftKey && (document.activeElement === premier || !carte.contains(document.activeElement))) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  // Page en arriere-plan ou quittee : le micro ne reste jamais ouvert.
  document.addEventListener("visibilitychange", () => { if (document.hidden) abandonnerDictee(); });
  window.addEventListener("pagehide", abandonnerDictee);

  // ---------- Placement ----------
  // Ordinateur : coin bas droite de la zone 3D. Mobile : a gauche de « ☰ Collisions », centre sur sa ligne. Rend une signature de la position.
  function placer() {
    const petit = mobile();
    const cible = (petit ? boutonCollisions : slot).getBoundingClientRect();
    if (!cible.width || !cible.height || (petit && masquerSurMobile())) { racine.style.visibility = "hidden"; fermerChoix(false); return "cache"; }
    racine.style.visibility = "";
    let gauche;
    let haut;
    let largeur;
    let hauteur;
    if (petit) {
      largeur = LARGEUR_MOBILE;
      hauteur = cible.height; // meme hauteur que « ☰ Collisions », quel que soit son etat (jamais une valeur fixe plus haute que ses voisins)
      gauche = cible.left - ECART - largeur;
      haut = cible.top + (cible.height - hauteur) / 2;
    } else {
      largeur = bouton.offsetWidth;
      hauteur = bouton.offsetHeight;
      gauche = cible.right - MARGE - largeur;
      haut = cible.bottom - MARGE - hauteur;
    }
    racine.style.left = gauche + "px";
    racine.style.top = haut + "px";
    racine.style.width = largeur + "px";
    racine.style.height = hauteur + "px";
    if (choixOuvert()) placerChoix(gauche, haut, largeur, hauteur);
    return [gauche, haut, largeur, hauteur, choixOuvert()].map((v) => Math.round(v * 10) / 10).join("/");
  }

  // Choix fixe au-dessus du bouton (mobile : aligne a droite de l'ecran) ou a sa gauche (ordinateur), borne a l'ecran.
  function placerChoix(gauche, haut, largeur, hauteur) {
    const vw = document.documentElement.clientWidth;
    choix.style.left = "auto";
    choix.style.top = "auto";
    if (mobile()) {
      choix.style.right = MARGE + "px";
      choix.style.bottom = (window.innerHeight - haut + 6) + "px";
    } else {
      choix.style.right = Math.max(MARGE, vw - gauche + ECART) + "px";
      choix.style.bottom = (window.innerHeight - (haut + hauteur)) + "px";
    }
  }

  // ---------- Suivi des boutons voisins ----------
  // Le bouton « Collisions » et la zone 3D bougent par des transformations et des animations pilotees ailleurs (doigt, Web Animations) : on lit
  // leur rectangle a chaque image tant qu'ils bougent (une image calme = aucune ecriture), puis le suivi s'arrete.
  let raf = 0;
  let derniere = "";
  let calmes = 0;
  function boucle() {
    raf = 0;
    const signature = placer();
    if (signature !== derniere) { derniere = signature; calmes = 0; } else calmes += 1;
    if (calmes < IMAGES_CALMES) raf = requestAnimationFrame(boucle);
  }
  function reveiller() {
    calmes = 0;
    if (!raf) raf = requestAnimationFrame(boucle);
  }
  const observateur = new MutationObserver(reveiller);
  observes.forEach((el) => { if (el) observateur.observe(el, { attributes: true, attributeFilter: ["style", "class", "hidden"] }); });
  if (typeof ResizeObserver !== "undefined") {
    const tailles = new ResizeObserver(reveiller);
    [slot, boutonCollisions, parent].forEach((el) => { if (el) tailles.observe(el); });
  }
  window.addEventListener("resize", reveiller);
  // Fin d'un geste ou d'un clic : une animation a pu demarrer sans changement d'attribut.
  ["pointerup", "touchend", "click", "transitionend"].forEach((type) => document.addEventListener(type, reveiller, { capture: true, passive: true }));
  reveiller();
  majChoixVocal();
  montrerVue("texte");

  // « Reformuler » de la modale « Regle a valider » : la modale Texte se rouvre avec la phrase envoyee, curseur a la fin.
  function reformuler(phrase) {
    ouvrirModale("texte", phrase);
  }

  return { fermer: () => { fermerChoix(false); fermerModale(false); }, ouvert, reformuler };
}
