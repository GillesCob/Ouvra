// Point d'entree des regles de collision en langage naturel (22/10, etape 5), refait le 24/10 : le bouton « IA » de la page Collision ouvre DIRECTEMENT la
// modale de saisie COMMUNE (src/iaSaisie.js) en mode vocal, gros micro pret (un clic sur le micro demarre l'ecoute, un second la termine et envoie) ; un
// bouton « Ecrire ma demande » bascule la meme modale en texte, « Utiliser le micro » revient. Sans dictee disponible, elle s'ouvre en texte avec la raison.
// Il n'y a plus de choix « Texte / Vocal » intermediaire : un clic de moins. Apres l'envoi le logo Ouvra tourne pendant que le relais heberge traduit la
// phrase (traduire), puis la modale « Regle a valider » s'ouvre (ouvrirRegle). Les propositions d'instruction (src/reglesExemples.js) sont dans un menu
// deroulant ferme, en bas de la modale.
//
// Placement du bouton « IA » (positionnement fixe, recalcule a partir des rectangles des boutons voisins, sans toucher a leur mise en page) :
//  - ordinateur : en bas a droite de la vue 3D (#collisionViewerSlot) ;
//  - mobile : sur la ligne du bouton « Collisions », juste a sa gauche, en suivant tous ses deplacements (bandeau replie, ouvert, pleine page,
//    glissements et animations de fermeture).
// Module sans dependance a main.js : tout passe par les parametres de creerReglesIA.
//   parent : element qui porte le bouton (#collisionLeft, masque avec la page Collision)
//   slot : zone 3D (#collisionViewerSlot) ; boutonCollisions : bouton « ☰ Collisions » (mobile)
//   masquerSurMobile() : vrai quand le bouton ne doit pas etre affiche sur mobile (bandeau de collision en pleine page)
//   observes : elements dont un changement de style / classe peut deplacer les boutons voisins
//   exemples : [{ demande }] (src/reglesExemples.js) ; ouvrirRegle(regle) : valide la regle et ouvre la modale « Regle a valider »
//   traduire(phrase) : promesse de { ok: true, resultat: "regle", regle } | { ok: true, resultat: "critere_introuvable" | "non_comprise", message }
//     | { ok: false, code, message } (src/reglesIAClient.js) ; ne rejette jamais
//   fermerAutres() : ferme les autres menus deroulants de la page

import "./reglesIA.css";
import { MESSAGE_PHRASE_VIDE } from "./reglesVoix.js";
import { creerIASaisie } from "./iaSaisie.js";
import { messageRefus } from "./iaSaisieLogique.js";

const MOBILE = "(max-width: 768px)";
const LARGEUR_MOBILE = 44;
const ECART = 8;
const MARGE = 16;
const IMAGES_CALMES = 24; // images sans mouvement des boutons voisins avant d'arreter le suivi

const PLACEHOLDER_TEXTE = "Ex. : écarter les diffuseurs";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerReglesIA({ parent, slot, boutonCollisions, masquerSurMobile, observes, exemples, ouvrirRegle, traduire, fermerAutres }) {
  const racine = creer("div");
  racine.id = "reglesIA";
  const bouton = creer("button", null, "IA");
  bouton.type = "button";
  bouton.id = "reglesIABtn";
  bouton.setAttribute("aria-label", "Règles par l'IA");
  bouton.setAttribute("aria-haspopup", "dialog");
  bouton.title = "Règles par l'IA";
  racine.appendChild(bouton);

  // La saisie (vocal d'abord, bascule texte, dictee, phrases toutes faites) est la modale COMMUNE de src/iaSaisie.js : un clic sur « IA » l'ouvre directement.
  const saisie = creerIASaisie({
    exemples,
    libelle: "Règle par l'IA",
    placeholder: PLACEHOLDER_TEXTE,
    messageVide: MESSAGE_PHRASE_VIDE,
    retourFocus: bouton,
    async surEnvoi(phrase, { annule }) {
      const reponse = await traduire(phrase);
      if (annule()) return { ok: false }; // modale fermee depuis l'envoi : rien ne s'ouvre a l'insu de l'utilisateur
      if (reponse.ok && reponse.resultat === "regle") {
        saisie.fermer(true); // le focus revient au bouton « IA » avant la modale « Regle a valider », qui s'en souviendra
        ouvrirRegle({ ...reponse.regle, saisie: true }); // saisie : la modale propose « Reformuler »
        return { ok: true };
      }
      return { ok: false, message: reponse.ok ? messageRefus(reponse.resultat, reponse.message) : reponse.message };
    }
  });

  // Les clics du bouton ne remontent pas : xeokit annule l'action par defaut d'un clic tant que le pointeur est reste sur le canevas 3D.
  bouton.addEventListener("click", (e) => {
    e.stopPropagation();
    fermerAutres();
    if (saisie.ouvert()) saisie.fermer(true); else saisie.ouvrir();
  });

  // Le bouton « IA » vit dans la zone de la page Collision (masque avec elle) ; sans cette ligne il n'est jamais dans la page.
  parent.appendChild(racine);

  // ---------- Placement ----------
  const mobile = () => window.matchMedia(MOBILE).matches;
  // Ordinateur : coin bas droite de la zone 3D. Mobile : a gauche de « ☰ Collisions », centre sur sa ligne. Rend une signature de la position.
  function placer() {
    const petit = mobile();
    const cible = (petit ? boutonCollisions : slot).getBoundingClientRect();
    if (!cible.width || !cible.height || (petit && masquerSurMobile())) { racine.style.visibility = "hidden"; return "cache"; }
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
    return [gauche, haut, largeur, hauteur].map((v) => Math.round(v * 10) / 10).join("/");
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
  // « Reformuler » de la modale « Regle a valider » : la saisie se rouvre en mode texte avec la phrase envoyee, curseur a la fin.
  return { fermer: () => saisie.fermer(false), ouvert: saisie.ouvert, reformuler: saisie.reformuler };
}
