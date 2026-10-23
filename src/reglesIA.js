// Point d'entree des regles de collision en langage naturel (22/10, etape 5) : le bouton « IA » de la page Collision et son petit panneau a
// deux entrees. « Decrire avec l'IA » (champ et bouton « Traduire » : la phrase part vers le relais hebergé par traduire(phrase), la regle
// proposee ouvre la modale « Regle a valider », jamais d'application directe) et « Choisir un filtre » (phrases d'exemple de
// src/reglesExemples.js, sans IA : repli quand le budget est epuise ou que le reseau echoue, un clic ouvre la meme modale par ouvrirRegle).
// Deux modes de saisie, « Texte » (defaut : champ + « Traduire ») et « Vocal » (dictee par la Web Speech API, src/reglesVoix.js : un clic sur
// « Vocal » demarre l'ecoute, le texte reconnu s'affiche dans le champ, « Envoyer » arrete l'ecoute et envoie la phrase par le meme chemin que
// « Traduire », « Annuler » ou Echap abandonnent sans rien envoyer). Sans l'API ou apres un refus du micro, « Vocal » est desactive avec la raison.
//
// Placement (positionnement fixe, recalcule a partir des rectangles des boutons voisins, sans toucher a leur mise en page) :
//  - ordinateur : en bas a droite de la vue 3D (#collisionViewerSlot), le panneau s'ouvre vers le haut et vers la gauche ;
//  - mobile : sur la ligne du bouton « Collisions », juste a sa gauche, en suivant tous ses deplacements (bandeau replie, ouvert, pleine page,
//    glissements et animations de fermeture). Le panneau s'ouvre vers le haut.
// Module sans dependance a main.js : tout passe par les parametres de creerReglesIA.
//   parent : element qui porte le bouton (#collisionLeft, masque avec la page Collision)
//   slot : zone 3D (#collisionViewerSlot) ; boutonCollisions : bouton « ☰ Collisions » (mobile)
//   masquerSurMobile() : vrai quand le bouton ne doit pas etre affiche sur mobile (bandeau de collision en pleine page)
//   observes : elements dont un changement de style / classe peut deplacer les boutons voisins
//   exemples : [{ demande, filtre, action }] ; ouvrirRegle(regle) : valide la regle et ouvre la modale
//   traduire(phrase) : promesse de { ok: true, resultat: "regle", regle } | { ok: true, resultat: "critere_introuvable" | "non_comprise", message }
//     | { ok: false, code, message } (src/reglesIAClient.js) ; ne rejette jamais
//   fermerAutres() : ferme les autres menus deroulants de la page ; absorberGeste() : appui hors du panneau en clic neutre (mobile)

import "./reglesIA.css";
import { creerSaisie, detecterReconnaissance } from "./reglesVoix.js";

const MOBILE = "(max-width: 768px)";
const LARGEUR_MOBILE = 44;
const ECART = 8;
const MARGE = 16;
const IMAGES_CALMES = 24; // images sans mouvement des boutons voisins avant d'arreter le suivi

export const PHRASE_MAX = 200; // meme plafond que le relais (relais/entree.js)
const PLACEHOLDER_TEXTE = "Ex. : écarte les collisions avec un diffuseur";
const PLACEHOLDER_VOCAL = "Le texte reconnu s'affiche ici";

export function creerReglesIA({ parent, slot, boutonCollisions, masquerSurMobile, observes, exemples, ouvrirRegle, traduire, fermerAutres, absorberGeste }) {
  const racine = document.createElement("div");
  racine.id = "reglesIA";
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.id = "reglesIABtn";
  bouton.textContent = "IA";
  bouton.setAttribute("aria-label", "Règles par l'IA");
  bouton.setAttribute("aria-haspopup", "dialog");
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-controls", "reglesIAPanneau");
  bouton.title = "Règles par l'IA";
  racine.appendChild(bouton);

  let champ;
  let boutonTraduire;
  let etat;
  let saisie;
  let boutonTexte;
  let boutonVocal;
  let annulerVocal;
  let noteVocal;
  let demandeEnCours = 0; // numero de la derniere demande : une reponse d'une demande abandonnee est ignoree

  const panneau = document.createElement("div");
  panneau.id = "reglesIAPanneau";
  panneau.setAttribute("role", "dialog");
  panneau.setAttribute("aria-label", "Règles par l'IA");
  panneau.hidden = true;
  panneau.appendChild(creerSectionDecrire());
  panneau.appendChild(creerSectionExemples());
  document.body.appendChild(panneau);
  parent.appendChild(racine);

  const mobile = () => window.matchMedia(MOBILE).matches;
  const ouvert = () => !panneau.hidden;

  function creerSectionDecrire() {
    const section = document.createElement("section");
    section.className = "regles-ia-section";
    const titre = document.createElement("h3");
    titre.id = "reglesIATitreDecrire";
    titre.textContent = "Décrire avec l'IA";
    saisie = creerSaisie({
      Reconnaissance: detecterReconnaissance(window),
      lire: () => champ.value,
      ecrire: (texte) => { champ.value = texte; },
      surMode: appliquerMode,
      surEcoute: (ecoute) => etat.classList.toggle("ecoute", ecoute),
      surMessage: afficherEtat,
      surIndisponible: majVocal,
      longueurMax: PHRASE_MAX
    });

    // Choix du mode : deux boutons a bascule (un seul actif), role et etat annonces par aria-pressed, clavier natif (Tab, Entree, Espace).
    const modes = document.createElement("div");
    modes.className = "tabs";
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "Mode de saisie");
    boutonTexte = creerBoutonMode("Texte", () => saisie.choisirTexte());
    boutonTexte.setAttribute("aria-pressed", "true"); // mode par defaut
    boutonVocal = creerBoutonMode("Vocal", () => saisie.choisirVocal());
    boutonVocal.id = "reglesIAVocal";
    boutonVocal.setAttribute("aria-describedby", "reglesIANoteVocal");
    modes.append(boutonTexte, boutonVocal);
    noteVocal = document.createElement("p");
    noteVocal.id = "reglesIANoteVocal";
    noteVocal.className = "regles-ia-etat";
    noteVocal.hidden = true;

    const ligne = document.createElement("form");
    ligne.className = "regles-ia-saisie";
    ligne.noValidate = true;
    champ = document.createElement("input");
    champ.type = "text";
    champ.id = "reglesIAChamp";
    champ.maxLength = PHRASE_MAX;
    champ.autocomplete = "off";
    champ.enterKeyHint = "go";
    champ.placeholder = PLACEHOLDER_TEXTE;
    champ.setAttribute("aria-labelledby", "reglesIATitreDecrire");
    champ.setAttribute("aria-describedby", "reglesIAEtat");
    boutonTraduire = document.createElement("button");
    boutonTraduire.type = "submit";
    boutonTraduire.id = "reglesIATraduire";
    boutonTraduire.textContent = "Traduire";
    annulerVocal = document.createElement("button");
    annulerVocal.type = "button";
    annulerVocal.id = "reglesIAAnnulerVocal";
    annulerVocal.className = "regles-ia-annuler";
    annulerVocal.textContent = "Annuler";
    annulerVocal.hidden = true;
    annulerVocal.addEventListener("click", () => saisie.choisirTexte());
    ligne.append(champ, boutonTraduire, annulerVocal);
    // Message de la derniere demande (ecoute, chargement, critere introuvable, repli). Annonce aux lecteurs d'ecran par role="status".
    etat = document.createElement("p");
    etat.id = "reglesIAEtat";
    etat.className = "regles-ia-etat";
    etat.setAttribute("role", "status");
    etat.hidden = true;
    ligne.addEventListener("submit", (e) => { e.preventDefault(); envoyer(); });
    section.append(titre, modes, noteVocal, ligne, etat);
    majVocal();
    return section;
  }

  function creerBoutonMode(libelle, action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.textContent = libelle;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", action);
    return b;
  }

  // « Vocal » inutilisable (navigateur sans l'API, micro refuse, service injoignable) : bouton desactive et raison affichee sous le choix du mode.
  function majVocal() {
    const motif = saisie.motifIndisponible();
    boutonVocal.disabled = !!motif || boutonTraduire.disabled;
    noteVocal.textContent = motif || "";
    noteVocal.hidden = !motif;
  }

  // Apparence des deux modes : le champ affiche le texte reconnu en lecture seule en Vocal, le bouton d'envoi devient « Envoyer ».
  function appliquerMode(mode) {
    const vocal = mode === "vocal";
    boutonTexte.setAttribute("aria-pressed", String(!vocal));
    boutonVocal.setAttribute("aria-pressed", String(vocal));
    champ.readOnly = vocal;
    champ.placeholder = vocal ? PLACEHOLDER_VOCAL : PLACEHOLDER_TEXTE;
    boutonTraduire.textContent = vocal ? "Envoyer" : "Traduire";
    annulerVocal.hidden = !vocal;
    if (!vocal && ouvert()) champ.focus({ preventScroll: true });
  }

  function afficherEtat(texte, erreur) {
    etat.textContent = texte || "";
    etat.hidden = !texte;
    etat.classList.toggle("erreur", !!erreur);
  }

  function occupe(oui) {
    const vocal = saisie.mode() === "vocal";
    boutonTraduire.disabled = oui;
    boutonTexte.disabled = oui;
    boutonVocal.disabled = oui || !!saisie.motifIndisponible();
    annulerVocal.disabled = oui;
    champ.readOnly = oui || vocal;
    boutonTraduire.textContent = oui ? "Traduction…" : vocal ? "Envoyer" : "Traduire";
    champ.setAttribute("aria-busy", String(oui));
  }

  async function envoyer() {
    if (boutonTraduire.disabled) return;
    // Meme chemin pour « Traduire » et « Envoyer » : en Vocal l'ecoute s'arrete et la phrase reconnue (celle du champ) part ; rien de reconnu = aucun envoi.
    const phrase = saisie.preparerEnvoi();
    if (!phrase) { if (saisie.mode() === "texte") champ.focus({ preventScroll: true }); return; }
    const numero = ++demandeEnCours;
    occupe(true);
    afficherEtat("L'IA lit la phrase…", false);
    const reponse = await traduire(phrase);
    // Panneau ferme ou autre demande depuis : le resultat est abandonne, rien ne s'ouvre a l'insu de l'utilisateur.
    if (numero !== demandeEnCours) return;
    occupe(false);
    if (reponse.ok && reponse.resultat === "regle") {
      afficherEtat("", false);
      champ.value = "";
      fermer(true);
      ouvrirRegle({ ...reponse.regle, saisie: true }); // saisie : la modale propose « Reformuler »
      return;
    }
    if (reponse.ok) {
      afficherEtat((reponse.resultat === "critere_introuvable" ? "Critère introuvable. " : "") + reponse.message, true);
    } else {
      afficherEtat(reponse.message, true);
    }
    champ.focus({ preventScroll: true });
  }

  function creerSectionExemples() {
    const section = document.createElement("section");
    section.className = "regles-ia-section";
    const titre = document.createElement("h3");
    titre.id = "reglesIATitreFiltre";
    titre.textContent = "Choisir un filtre";
    const liste = document.createElement("ul");
    liste.setAttribute("aria-labelledby", "reglesIATitreFiltre");
    exemples.forEach((regle) => {
      const li = document.createElement("li");
      const choix = document.createElement("button");
      choix.type = "button";
      choix.className = "regles-ia-exemple";
      choix.textContent = regle.demande;
      choix.addEventListener("click", () => choisir(regle));
      li.appendChild(choix);
      liste.appendChild(li);
    });
    section.append(titre, liste);
    return section;
  }

  // ---------- Ouverture / fermeture ----------
  function ouvrir() {
    fermerAutres();
    if (!boutonTraduire.disabled) afficherEtat("", false);
    panneau.hidden = false;
    bouton.setAttribute("aria-expanded", "true");
    placer();
    const premier = panneau.querySelector(".regles-ia-exemple");
    if (premier) premier.focus({ preventScroll: true });
    reveiller();
  }

  function fermer(rendreFocus) {
    if (!ouvert()) return;
    panneau.hidden = true;
    saisie.fermer(); // micro coupe, mode Texte, champ restaure ; ni les modes ni l'ecoute ne survivent a la fermeture
    majVocal();
    if (boutonTraduire.disabled) { demandeEnCours += 1; occupe(false); afficherEtat("", false); }
    bouton.setAttribute("aria-expanded", "false");
    if (rendreFocus) bouton.focus({ preventScroll: true });
  }

  // Un clic sur une phrase ferme le panneau (le focus revient au bouton, qui redevient le declencheur de la modale) puis ouvre la modale.
  function choisir(regle) {
    fermer(true);
    ouvrirRegle(regle);
  }

  bouton.addEventListener("click", () => { if (ouvert()) fermer(true); else ouvrir(); });
  // Les clics du panneau et du bouton ne remontent pas : xeokit annule l'action par defaut d'un clic tant que le pointeur est reste sur le canevas 3D.
  racine.addEventListener("click", (e) => e.stopPropagation());
  panneau.addEventListener("click", (e) => e.stopPropagation());

  // Appui en dehors du panneau (phase de capture : le canevas 3D capte les gestes avant le document) : il se ferme, et sur mobile l'appui ne
  // declenche rien dessous (meme mecanisme que le hamburger et le menu « Conflit seul »).
  document.addEventListener("pointerdown", (e) => {
    if (!ouvert() || panneau.contains(e.target) || racine.contains(e.target)) return;
    fermer(false);
    absorberGeste();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !ouvert()) return;
    e.preventDefault();
    e.stopPropagation();
    if (saisie.mode() === "vocal") saisie.choisirTexte(); // Echap pendant la dictee : on abandonne la dictee, un second Echap ferme le panneau
    else fermer(true);
  }, true);
  // Page en arriere-plan ou quittee : le micro ne reste jamais ouvert.
  document.addEventListener("visibilitychange", () => { if (document.hidden) { saisie.fermer(); majVocal(); } });
  window.addEventListener("pagehide", () => saisie.fermer());

  // ---------- Placement ----------
  // Ordinateur : coin bas droite de la zone 3D. Mobile : a gauche de « ☰ Collisions », centre sur sa ligne. Rend une signature de la position.
  function placer() {
    const petit = mobile();
    const cible = (petit ? boutonCollisions : slot).getBoundingClientRect();
    if (!cible.width || !cible.height || (petit && masquerSurMobile())) { racine.style.visibility = "hidden"; fermer(false); return "cache"; }
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
    if (ouvert()) placerPanneau(gauche, haut, largeur, hauteur, cible);
    return [gauche, haut, largeur, hauteur, ouvert()].map((v) => Math.round(v * 10) / 10).join("/");
  }

  // Panneau fixe au-dessus (mobile) ou a gauche et vers le haut (ordinateur) du bouton, borne a l'ecran.
  function placerPanneau(gauche, haut, largeur, hauteur, cible) {
    const vw = document.documentElement.clientWidth;
    const bas = haut + hauteur;
    panneau.style.maxHeight = "";
    if (mobile()) {
      const w = Math.min(360, vw - 2 * MARGE);
      panneau.style.width = w + "px";
      panneau.style.left = Math.max(MARGE, vw - MARGE - w) + "px";
      panneau.style.right = "auto";
      panneau.style.top = "auto";
      panneau.style.bottom = (window.innerHeight - haut + 6) + "px";
      panneau.style.maxHeight = Math.max(160, haut - 6 - 60) + "px"; // sous la barre du haut (52 px) et son bandeau de retour eventuel
    } else {
      // A gauche du bouton s'il y a la place (cas normal), sinon (bouton pose sur la vignette de la pleine page) a sa droite.
      const aGauche = gauche - ECART - MARGE >= 300;
      const w = aGauche ? Math.min(360, gauche - ECART - MARGE) : Math.min(360, vw - (gauche + largeur + ECART) - MARGE);
      panneau.style.width = w + "px";
      panneau.style.left = (aGauche ? gauche - ECART - w : gauche + largeur + ECART) + "px";
      panneau.style.right = "auto";
      panneau.style.top = "auto";
      panneau.style.bottom = (window.innerHeight - bas) + "px";
      panneau.style.maxHeight = Math.max(160, bas - (aGauche ? cible.top : 60) - MARGE) + "px";
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

  // « Reformuler » de la modale « Regle a valider » : le panneau se rouvre avec la phrase envoyee, champ actif, curseur a la fin.
  function reformuler(phrase) {
    ouvrir();
    champ.value = phrase;
    champ.focus({ preventScroll: true });
    champ.setSelectionRange(phrase.length, phrase.length);
  }

  return { fermer: () => fermer(false), ouvert, reformuler };
}
