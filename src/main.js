import { Viewer, AnnotationsPlugin, WebIFCLoaderPlugin, XKTLoaderPlugin, SectionPlanesPlugin, TransformControl, Mesh, ReadableGeometry, PhongMaterial, buildSphereGeometry } from "@xeokit/xeokit-sdk";
import * as WebIFC from "web-ifc";
import { HOSPITAL_DETECTIONS, HOSPITAL_CLASHES } from "./clashesHospital.js";

// ============================================================================
// INTERRUPTEURS DE MASQUAGE : base propre du 19/10
// ----------------------------------------------------------------------------
// Etat de base du 19/10 : seules 3 pages sont accessibles (Viewer, Collision,
// Discussions), sur la seule maquette de l'hopital, sans profils. Rien n'a
// ete supprime : code, donnees, CSS, HTML et fichiers de maquette sont
// conserves, simplement rendus inaccessibles (attribut "hidden", garde dans le
// JS). Pour reactiver une fonction : passer son interrupteur a false (et
// suivre la consigne indiquee ci-dessous quand il y en a une).
//
// PRESENTATION_MASQUEE
//   Page Presentation (onglet retire de la navbar, bouton de la landing
//   masque, activateView renvoie vers le Viewer). Reactiver : false, remettre
//   l'onglet data-view="presentation" dans la navbar (index.html) et retirer
//   "hidden" du bouton #landingPresentationBtn de la landing.
//
// MASQUE_SELECTEUR_PROJET
//   Selecteur de projet #projectSelect cache et valeur forcee sur l'hopital
//   au demarrage : la maquette de demo (STR, TOITURE, CEA), ses 10 collisions
//   IfcClash et ses discussions ne sont plus joignables. Reactiver : false
//   (le selecteur reapparait, la demo recharge ses collisions et discussions).
//
// MASQUE_PROFILS
//   Tout ce qui concerne les profils : bouton "Activer les profils", selecteur
//   de persona, ecrans profils-intro et persona-intro, filtrage data-persona
//   (persona forcee sur "presentation-globale", valeur memorisee ignoree).
//   Reactiver : false.
//
// MASQUE_TODO_ADMIN
//   Onglets Todo (Projeteur) et Admin caches ; activateView renvoie vers le
//   Viewer pour ces vues, hash et localStorage compris. Reactiver : false
//   (ils restent soumis au filtrage par profil, donc visibles seulement si
//   MASQUE_PROFILS est aussi a false).
//
// MASQUE_ANCIENNE_LANDING
//   Ancienne landing #view-landing (hero, parties 1 et 2, bouton "Acceder a
//   la demo") masquee au profit de la nouvelle page d'accueil #view-accueil
//   (issue du mockup ouvra-v2-accueil, 19/10). Toute demande d'activer la vue
//   "landing" (bouton OUVRA, hash #landing, valeur memorisee) redirige vers
//   "accueil". Tant que l'interrupteur est a true, la valeur memorisee
//   "chantier-active-view" n'est plus lue au chargement : l'arrivee est
//   toujours l'accueil (sauf hash valide). Reactiver l'ancienne landing :
//   false (l'arrivee par defaut reste alors "accueil" tant que le code de
//   savedView n'est pas rebascule sur "landing").
// - MASQUE_MAQUETTES_LOURDES : Alarme incendie, Plomberie et Sprinklers de
//   l'hopital (19/10) ne sont ni chargees ni listees : leurs ~23 500 petits
//   objets (tuyaux, raccords, capteurs) rendent la navigation saccadee et
//   lente. Les fichiers restent dans public/models/hospital/ et dans
//   PROJECTS. Les reactiver : false (l'idee suivante est un chargement a la
//   demande, a la case cochee).
// - MASQUE_FICHE_DANS_DRAWER : l'ancienne section "Info selection" du drawer
//   (#section-fiche, ids ficheContent/ficheDocs/fichePlaceholder) est masquee
//   (attribut hidden) : l'info de selection s'affiche dans la carte
//   independante #ficheCard (ordinateur) ou la feuille du bas #ficheSheet
//   (mobile), qui n'existent visuellement que pendant une selection. Le
//   code et les elements restent, la section continue d'etre alimentee.
//   Reactiver l'ancienne section : false.
// - MASQUE_FICHE_COLLISION_DANS_DRAWER (19/10) : meme principe pour la page
//   Collision. La section "Info selection" du drawer de collision
//   (#section-collision-fiche, ids collisionFicheContent/collisionFicheDocs/
//   collisionFichePlaceholder) est masquee (hidden) : la fiche s'affiche dans
//   la carte independante #collisionFicheCard (ordinateur, bas a gauche de
//   la zone 3D) ou la feuille du bas #ficheSheet (mobile). La section reste
//   dans le DOM et continue d'etre alimentee. Reactiver : false.
// - COLLISIONS_HOPITAL_ECHANTILLON (19/10) : la page Collision de l'hopital
//   affiche un echantillon de 15 collisions reelles Architecture/Mecanique
//   choisies a la main dans les 3 504 d'un run IfcClash (src/clashesHospital.js
//   : criteres de choix, source et GlobalId documentes). Avec une seule paire
//   de maquettes, la page s'ouvre directement sur la liste (pas de vue
//   "Interactions entre maquettes", pas de bouton retour). Couper : false
//   (pages Collision vide comme avant, vue recapitulative inchangee).
// - MASQUE_LISTE_MAQUETTES_COLLISION (19/10) : la liste des maquettes du
//   drawer de la page Collision (#section-collision-maquettes, ul
//   #collisionMaquettesList) est masquee (hidden) : trop de place pour 2
//   maquettes. Sa fonction (masquer/afficher chaque maquette de la paire) est
//   assuree par 2 boutons a bascule en haut a gauche de la 3D
//   (#collisionMaquetteToggles). La liste reste dans le DOM et alimentee.
//   Reactiver la liste : false (les boutons restent).
// - COLLISION_REVELATION (19/10, ajout, portee depuis IES) : page Collision,
//   a la selection d'une collision les elements qui masquent le point de
//   collision (Architecture, plus Structure si affichee) passent a 35 %
//   d'opacite ; des 2 elements colores le plus petit est a 85 %, le plus grand
//   a 35 %. false = comportement d'avant (aucune transparence). Sans effet
//   (redondant) quand COLLISION_ISOLATION est true.
// - COLLISION_ISOLATION (19/10, ajout) : page Collision, tant qu'une collision
//   est selectionnee, tous les autres objets des maquettes affichees (paire,
//   plus le Contexte s'il est allume) passent en fantome via le X-ray natif de
//   xeokit (materiau xrayMaterial regle pendant l'isolation seulement, valeurs
//   d'origine restaurees a la sortie) et non cliquables ; les 2 elements du
//   conflit restent pleins, colores, cliquables. Le conflit reste lisible sous
//   tout angle. false = comportement d'avant (revelation par opacite).
// - COLLISION_CONTEXTE (19/10, ajout) : bouton a bascule "Contexte" a cote des
//   boutons Architecture / Mecanique. Allume : les maquettes hors paire
//   (Structure, Electricite) sont affichees en fantome (opacite
//   COLLISION_CONTEXTE_OPACITY) et non cliquables. false = pas de bouton, les
//   maquettes hors paire restent masquees comme avant.
// - COLLISION_CONTEXTE_NIVEAUX (19/10, ajout) : remplace le bouton "Contexte"
//   par un selecteur segmente a 3 niveaux (Isole / Proche / Etage), actif
//   seulement avec COLLISION_ISOLATION. Isole = isolation seule, Structure et
//   Electricite masquees. Proche (defaut, retenu pour la session) : en plus,
//   les elements du meme etage que le conflit situes a moins de
//   COLLISION_CONTEXTE_RAYON metres du point de collision passent a
//   COLLISION_CONTEXTE_NIVEAU_OPACITE avec leurs vraies couleurs, non
//   cliquables ; Structure et Electricite sont affichees. Etage : tout l'etage
//   du conflit (nom canonique, toutes maquettes) au meme traitement. Le reste
//   reste en fantome xray. Index id -> etage construit une fois par maquette
//   (chaine IfcBuildingStorey), aucune boite lue hors etage. false = ancien
//   bouton Contexte tout ou rien.
// - COLLISION_PASTILLES (19/10, ajout) : page Collision, une pastille ronde
//   numerotee (meme numero que la liste) accrochee au point de chaque
//   collision, toujours visible a travers la geometrie (non occultable),
//   coloree par statut, cliquable (= clic sur la ligne de la liste). Ajoutee
//   aux spheres translucides, qui restent. false = comportement d'avant.
// - COLLISION_BULLES_SURIMPRESSION (19/10, ajout) : page Collision, un disque
//   jaune translucide cercle par collision, dessine sur un canvas 2D par-dessus
//   la vue 3D a la position projetee du point de collision : jamais masque par
//   la geometrie. Meme rayon monde (COLLISION_BULLE_RAYON, metres) pour toutes,
//   converti en pixels selon la distance camera (borne par MIN_PX / MAX_PX).
//   La collision selectionnee recoit un anneau exterieur, sans changer la
//   taille. Quand actif, les spheres 3D prennent le meme rayon (actif ou non)
//   et deviennent plus discretes. false = comportement d'avant.
// ============================================================================
const COLLISION_BULLES_SURIMPRESSION = true;
const COLLISION_BULLE_RAYON = 0.25;
const COLLISION_BULLE_MIN_PX = 10;
const COLLISION_BULLE_MAX_PX = 160;
const COLLISION_PASTILLES = false;
// MASQUE_OEIL_COLLISION (19/10) : retire l'oeil a gauche de chaque ligne de la
// liste des collisions (il masquait/affichait la bulle 3D de cette collision).
// false = l'oeil revient.
const MASQUE_OEIL_COLLISION = true;
// COLLISION_LISTE_SIMPLE (19/10) : chaque ligne de la liste des collisions ne
// montre que le numero, les identifiants des 2 elements, le niveau et le statut
// (le nom complet reste en infobulle et dans la fiche). false = lignes d'avant.
const COLLISION_LISTE_SIMPLE = true;
// COLLISION_LISTE_CARTE (19/10) : carte a deux lignes (pastille du numero, types
// en francais, identifiants et niveau, point de statut). Necessite
// COLLISION_LISTE_SIMPLE. false = la ligne simple (numero et identifiants).
const COLLISION_LISTE_CARTE = true;
// COLLISION_PRIORITES (19/10) : priorite (Urgente / Haute / Normale / Basse)
// separee du statut. Liste groupee par urgence, liseré de la carte = priorite,
// selecteurs Priorite et Statut dans la zone de commentaires, historique
// ("User 1 a change ...") melange aux messages, etat garde dans localStorage
// (cle "ouvra-collisions-etat", propre au navigateur, non partage ; pour
// reinitialiser, supprimer cette cle). false = comportement d'avant.
const COLLISION_PRIORITES = true;
// COLLISION_BANDEAU (19/10) : zone de commentaires de la page Collision (hopital)
// en bandeau d'une ligne (chevron, titre court "n° 5 · Cloison ↔ Tuyau · Niveau 4",
// selecteurs Priorite et Statut a droite) et chronologie unique (commentaires et
// changements melanges, plus recent en bas, filtre Tout / Commentaires /
// Modifications). Necessite COLLISION_PRIORITES. Discussions inchange.
// false = comportement d'avant.
const COLLISION_BANDEAU = true;
// COLLISION_ECHANGES_GRAND (19/10) : bouton "agrandir" dans le bandeau de la page
// Collision (collisions de l'hopital). La zone d'echange couvre toute la zone de la 3D
// (en superposition, liste des collisions de droite toujours utilisable ; mobile :
// plein ecran). Fermeture : meme bouton, Echap, ou sortie de la page Collision.
// Necessite COLLISION_BANDEAU. false = comportement d'avant.
const COLLISION_ECHANGES_GRAND = true;
// COLLISION_POINT_VERIFIE (19/10) : le point de collision IfcClash converti n'est
// retenu que s'il tombe dans les boites englobantes des 2 elements (tolerance
// 1,5 m) ; sinon, centre du chevauchement des 2 boites. false = comportement
// d'avant (point IFC converti sans verification).
const COLLISION_POINT_VERIFIE = true;
const COLLISION_POINT_TOLERANCE = 1.5;
// COLLISION_CADRAGE_VOLUME (19/10) : nouvelle regle de cadrage du vol vers une
// collision (page Collision uniquement). Exigence : le VOLUME de la collision
// (boite de chevauchement des boites englobantes des 2 elements, repli : +-1 m
// autour de la bulle) entierement visible, a 2 m minimum de la bulle jaune.
// Chaque etendue du volume est plafonnee a COLLISION_CADRAGE_VOLUME_MAX m, la
// fenetre plafonnee etant centree sur la bulle : une longue gaine ne fait plus
// reculer la camera. Le plus petit element n'a plus a etre 100 % dans le
// cadre. false = comportement d'avant (ancien code conserve).
const COLLISION_CADRAGE_VOLUME = true;
const COLLISION_CADRAGE_VOLUME_MAX = 6;
const COLLISION_CADRAGE_DISTANCE_MIN = 2;
const COLLISION_REVELATION = true;
const COLLISION_ISOLATION = false; // coupe le 19/10 (gel de la page) ; remettre a true pour retester
const COLLISION_ISOLATION_FILL_ALPHA = 0.06;
// Opacite des 2 elements en conflit au niveau de contexte "Isole" (1 = opaque).
const COLLISION_ELEMENT_ISOLE_OPACITE = 0.3;
// Arêtes du fantome coupees (0) le 19/10 : ~74 000 objets avec arêtes gelaient le navigateur (avant : 0.25).
const COLLISION_ISOLATION_EDGE_ALPHA = 0;
const COLLISION_ISOLATION_COLOR = [0.8, 0.8, 0.8];
const COLLISION_CONTEXTE = true;
// COLLISION_ECHANGES_GRAND : etat de l'agrandissement. Declare ICI (haut du
// fichier) car activateView() s'execute au demarrage, avant le bloc plus bas :
// une declaration tardive (let) provoquait une erreur et bloquait toute l'app.
// COLLISION_ISOLATION_ETAGE (19/10) : l'isolation ne met en fantome QUE les objets de
// l'etage de la collision ; le reste de l'hopital est ecarte du rendu (etat
// "culled" de xeokit, independant de la visibilite). ~74 000 objets en fantome
// gelaient le navigateur. false = tout l'hopital en fantome comme avant.
const COLLISION_ISOLATION_ETAGE = true;
// COLLISION_CADRAGE_ETAGE (19/10) : la recherche des elements voisins du cadrage
// de camera ne parcourt que l'etage de la collision (boites en cache) au lieu
// de toute la scene. false = comportement d'avant (gel observe).
const COLLISION_CADRAGE_ETAGE = true;
// HOPITAL_MAQUETTES_LEGERES (19/10, test mobile : chargement trop long) : Architecture
// et Mecanique viennent des XKT du depot xeokit (26,5 Mo, ~25 000 objets, metadonnees
// en JSON a part) au lieu des conversions d'Ouvra (45,7 Mo, ~75 000 objets). Les
// identifiants des collisions correspondent, sauf la n° 14 (mur-rideau absent de
// l'architecture allegee), ecartee ici. false = maquettes d'origine, 15 collisions.
// Reglages commutables par l'adresse (tests sur telephone, 19/10) :
// ?legere=0 (maquettes d'origine), ?aretes=1 (aretes sur mobile), ?webifc=1
// (initialise web-ifc), ?progressif=0 (ancien chargement). Sans parametre :
// les valeurs par defaut ci-dessous.
const PARAMS_URL = new URLSearchParams(location.search);
const reglageUrl = (nom, defaut) => (PARAMS_URL.has(nom) ? PARAMS_URL.get(nom) !== "0" : defaut);
// Maquettes allegees (XKT version 2) : ILLISIBLES sur iPhone (0 entite creee, constate
// le 19/10), alors qu'elles se lisent sur ordinateur. Desactivees par defaut ; ?legere=1 pour les tester.
const HOPITAL_MAQUETTES_LEGERES = reglageUrl("legere", false);
// Structure reconvertie en XKT version 12 (IFC d'Auckland converti avec xeokit-convert, 19/10) : lisible
// sur iPhone, memes identifiants que l'ancienne (2 826 sur 2 846). ?structv12=0 pour l'ancien fichier (version 2).
const HOPITAL_STRUCTURE_V12 = reglageUrl("structv12", true);
// CHARGEMENT_PROGRESSIF (19/10, test mobile : attente trop longue) : le Viewer s'affiche
// des que la PREMIERE maquette est chargee (les suivantes continuent en
// arriere-plan, avec un indicateur discret et le temps de chaque lot), l'ordre
// de chargement met la Mecanique en dernier, et le telechargement demarre sans
// attendre l'initialisation de web-ifc (WASM inutile pour les XKT).
// false = comportement d'avant (ecran de chargement jusqu'a la derniere maquette).
// 20/10 (demande de Gilles) : desactive par defaut, la maquette n'apparait qu'une fois TOUT charge,
// avec l'etat de chaque maquette sous le logo. ?progressif=1 pour retrouver l'affichage des la premiere.
const CHARGEMENT_PROGRESSIF = reglageUrl("progressif", false);
// CHARGEMENT_SANS_ATTENDRE_WEBIFC (19/10) : demarrer le telechargement des XKT en meme
// temps que l'initialisation de web-ifc. Coupe le 19/10 : l'iPhone n'arrivait
// plus a charger (memoire de l'onglet). true = demarrage immediat (ordinateur seulement).
const CHARGEMENT_SANS_ATTENDRE_WEBIFC = false;
// HOPITAL_SANS_WEBIFC (19/10) : l'hopital n'est fait que de XKT, web-ifc (lecteur d'IFC, WASM
// qui reserve de la memoire) n'est donc pas initialise du tout. Test iPhone :
// l'onglet etait tue par iOS (memoire) pendant le chargement de la 2e maquette.
// false = web-ifc initialise comme avant.
const HOPITAL_SANS_WEBIFC = !reglageUrl("webifc", false);
// MOBILE_SANS_ARETES (19/10) : sur telephone, les maquettes sont chargees sans les
// aretes (contours noirs) qui doublent la geometrie en memoire graphique. Test
// iPhone : la maquette apparaissait puis disparaissait (contexte WebGL perdu).
// false = aretes partout.
const MOBILE_SANS_ARETES = !reglageUrl("aretes", false);
const APPAREIL_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia("(max-width: 768px)").matches;
// Architecture et mecanique de l'hopital reconverties en XKT v12 avec buffers compresses (20/10, IFC d'origine de
// Chantier/public/models/hospital, xeokit-convert -b) : memes objets et memes identifiants IFC, 3,9 et 3,0 Mo au lieu
// de 26 et 20 Mo. Contenu identique (memes tailles une fois decompresse, memes nombres d'elements). Mesure sur
// iPhone le 20/10 : aucun gain (16,5 s contre 16,7 s), desactive par defaut. ?v12=1 pour les essayer.
const HOPITAL_V12_LEGER = reglageUrl("v12", false);
const HOPITAL_CLASHES_ABSENTS_LEGERES = new Set(["hosp-clash-14"]);
// COLLISION_TRANSITION_VERROUILLEE (19/10) : pendant le vol de camera vers une
// collision, on ne peut pas en selectionner une autre (liste et bulles), et le
// calcul lourd de l'isolation n'est fait qu'APRES l'arret de la camera (l'animation
// tourne ainsi sur une scene legere). false = comportement d'avant.
const COLLISION_TRANSITION_VERROUILLEE = false; // coupe le 19/10 (boutons bloques)
let collisionTransitionEnCours = false;
let collisionTransitionTimer = null;
let collisionCulledIds = [];
let echangesGrandOuvert = false;
let echangesGrandEtaitReplie = false;
let echangesGrandBtn = null;
const COLLISION_CONTEXTE_OPACITY = 0.2;
const COLLISION_CONTEXTE_NIVEAUX = true;
const COLLISION_CONTEXTE_RAYON = 8;
const COLLISION_CONTEXTE_NIVEAU_OPACITE = 0.3;
const CLASH_REVEAL_OPACITY = 0.35;
const CLASH_ELEMENT_OPACITY = 0.85;
// Etat de la transparence de la page Collision, declare ici (et non pres des
// fonctions) car activateView le lit des le chargement initial.
let collisionContexteOn = false;
let collisionActiveClash = null;
let collisionOpacityTouched = [];
let collisionIsolationIds = [];
let collisionIsolationSavedMaterial = null;
let collisionSubsetMaquettes = [];
let collisionContexteBtn = null;
let collisionContexteNiveau = "isole"; // niveau par defaut a l'arrivee (19/10, demande de Gilles) ; avant : "proche"
let collisionNiveauBtns = [];
let collisionContextePickIds = [];
const MASQUE_FICHE_DANS_DRAWER = true;
const MASQUE_LISTE_MAQUETTES_COLLISION = true;
const MASQUE_FICHE_COLLISION_DANS_DRAWER = true;
const PRESENTATION_MASQUEE = true;
const MASQUE_SELECTEUR_PROJET = true;
const MASQUE_PROFILS = true;
const MASQUE_TODO_ADMIN = true;
const MASQUE_ANCIENNE_LANDING = true;
const MASQUE_MAQUETTES_LOURDES = true;
const COLLISIONS_HOPITAL_ECHANTILLON = true;
// Electricite ajoutee le 19/10 (test mobile : navigation lente, soupcon sur cette maquette) ; retirer "hosp-elec" pour la reafficher.
const MAQUETTES_LOURDES_IDS = ["hosp-alarm", "hosp-plomb", "hosp-spr", "hosp-elec"];

const loadingOverlay = document.getElementById("loadingOverlay");
// Ecran de chargement : le logo Ouvra en rotation simple (19/10, remplace l'ancien
// spinner a points). Remis a chaque chargement, car l'overlay est vide en cas
// d'erreur (texte d'erreur a la place du logo).
const LOADING_LOGO_HTML = '<div class="logo-zoom"><div class="logo-spin"><svg xmlns="http://www.w3.org/2000/svg" viewBox="94 10 146 146" width="64" height="64" role="img" aria-label="Chargement en cours"><path fill="#f4f2ed" d="M168.95 12.88 A70.32 70.32 0 1 0 168.95 153.42 L168.95 137.72 A55.22 55.22 0 1 1 168.95 27.3 Z"/><path fill="#f4f2ed" d="M213.65 40.22 A60.75 60.75 0 0 1 213.65 138 L213.65 115.96 A44.78 44.78 0 0 0 213.65 62.67 Z"/><path fill="#6d806f" d="M182.04 26.18 L211.04 38.67 L211.04 121.6 L182.04 137.46 Z"/></svg></div></div>';
// Revelation de la maquette (20/10) : le "O" du logo grossit depuis le centre de son anneau jusqu'a ce que
// son ouverture depasse l'ecran, pendant que l'ecran de chargement s'efface. Transform et opacite
// seulement (compositeur), fondu simple si l'utilisateur reduit les animations.
// Anneau du logo (viewBox 94 10 146 146) : centre (168.95, 83.15), rayon interieur 55,22.
function reveleMaquette() {
  if (loadingOverlay.classList.contains("error")) return;
  const finir = () => {
    loadingOverlay.classList.add("hidden");
    loadingOverlay.getAnimations().forEach((a) => a.cancel());
  };
  // Ecran masque (accueil affiche pendant le chargement) : rien a animer.
  if (getComputedStyle(loadingOverlay).display === "none") { finir(); return; }
  const zoom = loadingOverlay.querySelector(".logo-zoom");
  const spin = loadingOverlay.querySelector(".logo-spin");
  if (!zoom || !spin || !zoom.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (loadingOverlay.animate) loadingOverlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).onfinish = finir;
    else finir();
    return;
  }
  spin.style.animationPlayState = "paused";
  const r = zoom.getBoundingClientRect();
  const cx = r.left + r.width * ((168.95 - 94) / 146);
  const cy = r.top + r.height * ((83.15 - 10) / 146);
  const o = loadingOverlay.getBoundingClientRect();
  const loin = Math.max(
    Math.hypot(cx - o.left, cy - o.top), Math.hypot(cx - o.right, cy - o.top),
    Math.hypot(cx - o.left, cy - o.bottom), Math.hypot(cx - o.right, cy - o.bottom)
  );
  const echelle = (loin / (r.width * (55.22 / 146))) * 1.1;
  const duree = 900;
  loadingOverlay.querySelectorAll(".loading-titre, .loading-etats").forEach((el) => {
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
  });
  zoom.animate([{ transform: "scale(1)" }, { transform: "scale(" + echelle + ")" }], { duration: duree, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" });
  loadingOverlay.animate(
    [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 1 }],
    { duration: duree, fill: "forwards" }
  ).onfinish = finir;
}
const viewerCanvas = document.getElementById("viewerCanvas");
const niveauxList = document.getElementById("niveauxList");
const maquettesList = document.getElementById("maquettesList");
const fichePlaceholder = document.getElementById("fichePlaceholder");
const ficheContent = document.getElementById("ficheContent");
const recenterBtn = document.getElementById("recenterBtn");
const projectSelect = document.getElementById("projectSelect");
const niveauxResetBtn = document.getElementById("niveauxResetBtn");
const maquettesResetBtn = document.getElementById("maquettesResetBtn");
const coupeToolbar = document.getElementById("coupeToolbar");
const coupeSliderWrap = document.getElementById("coupeSliderWrap");
const coupeChoixBar = document.getElementById("coupeChoixBar");
const coupeChoixSurface = document.getElementById("coupeChoixSurface");
const coupeChoixHoriz = document.getElementById("coupeChoixHoriz");
const coupeSlider = document.getElementById("coupeSlider");
const coupeBtn = document.getElementById("coupeBtn");
const coupeToggleVisibilityBtn = document.getElementById("coupeToggleVisibilityBtn");
const coupeInvertBtn = document.getElementById("coupeInvertBtn");
const cameraSpeedControl = document.getElementById("cameraSpeedControl");
const cameraSpeedToggle = document.getElementById("cameraSpeedToggle");
const cameraSpeedPanel = document.getElementById("cameraSpeedPanel");
const cameraSpeedSlider = document.getElementById("cameraSpeedSlider");
const cameraSpeedValue = document.getElementById("cameraSpeedValue");
const ficheDocs = document.getElementById("ficheDocs");
const ficheSheet = document.getElementById("ficheSheet");
const ficheSheetClose = document.getElementById("ficheSheetClose");
const ficheSheetContent = document.getElementById("ficheSheetContent");
const ficheSheetDocs = document.getElementById("ficheSheetDocs");
const collisionFichePlaceholder = document.getElementById("collisionFichePlaceholder");
const collisionFicheContent = document.getElementById("collisionFicheContent");
const collisionFicheDocs = document.getElementById("collisionFicheDocs");
const docModalOverlay = document.getElementById("docModalOverlay");
const docModalClose = document.getElementById("docModalClose");
const docModalName = document.getElementById("docModalName");
const docModalVersion = document.getElementById("docModalVersion");
const docModalLot = document.getElementById("docModalLot");
const docModalType = document.getElementById("docModalType");
const docModalDownload = document.getElementById("docModalDownload");
const downloadModalOverlay = document.getElementById("downloadModalOverlay");
const downloadModalOk = document.getElementById("downloadModalOk");
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const navbarLinksEl = document.getElementById("navbarLinks");
const navbarEl = document.getElementById("navbar");
const adminFrame = document.getElementById("adminFrame");
const personaSelect = document.getElementById("personaSelect");
const activateProfilesBtn = document.getElementById("activateProfilesBtn");
const profilsActivateBtn = document.getElementById("profilsActivateBtn");
const personaIntroContent = document.getElementById("personaIntroContent");
const personaIntroContinueBtn = document.getElementById("personaIntroContinueBtn");
const navbarToggle = document.getElementById("navbarToggle");
const presentationSectionsList = document.getElementById("presentationSectionsList");
const presentationContent = document.getElementById("presentationContent");
const presentationSidebar = document.getElementById("presentationSidebar");
const presentationSidebarToggle = document.getElementById("presentationSidebarToggle");
const presentationSidebarBackdrop = document.getElementById("presentationSidebarBackdrop");
const navbarBrand = document.getElementById("navbarBrand");
const landingPresentationBtn = document.getElementById("landingPresentationBtn");
const landingDemoBtn = document.getElementById("landingDemoBtn");

navbarBrand.addEventListener("click", () => {
  activateView("landing");
  document.getElementById("view-landing").scrollTop = 0;
  const viewAccueilTop = document.getElementById("view-accueil");
  if (viewAccueilTop) viewAccueilTop.scrollTop = 0;
});
landingPresentationBtn.addEventListener("click", () => {
  activateView("presentation");
  activatePresentationSection("constat");
});
landingDemoBtn.addEventListener("click", () => activateView("viewer"));

// Parallax du hero landing : background-position-y plutot que
// background-attachment:fixed (peu fiable sur mobile Safari dans un
// conteneur qui scroll lui-meme, cf #view-landing overflow-y:auto). Deplace
// l'image plus lentement que le scroll, s'arrete une fois le hero sorti de
// l'ecran (au-dela, plus besoin de recalculer).
const viewLandingEl = document.getElementById("view-landing");
const landingHeroEl = document.getElementById("landingHero");
viewLandingEl.addEventListener(
  "scroll",
  () => {
    const heroHeight = landingHeroEl.offsetHeight;
    const scrollTop = viewLandingEl.scrollTop;
    if (scrollTop > heroHeight) return;
    landingHeroEl.style.backgroundPositionY = `calc(50% + ${scrollTop * 0.35}px)`;
  },
  { passive: true }
);

const viewerWrap = document.getElementById("viewerWrap");
const viewViewer = document.getElementById("view-viewer");
const infoPanel = document.getElementById("infoPanel");
const infoPanelToggle = document.getElementById("infoPanelToggle");
const infoPanelBackdrop = document.getElementById("infoPanelBackdrop");
const collisionRecap = document.getElementById("collisionRecap");
const collisionDetail = document.getElementById("collisionDetail");
const collisionLeft = document.getElementById("collisionLeft");
const collisionViewerSlot = document.getElementById("collisionViewerSlot");
const collisionDiscussion = document.getElementById("collisionDiscussion");
const discussionMessages = document.getElementById("discussionMessages");
const detectionsList = document.getElementById("detectionsList");
const detectionsEmpty = document.getElementById("detectionsEmpty");
const collisionMaquettesList = document.getElementById("collisionMaquettesList");
const collisionMaquetteToggles = document.getElementById("collisionMaquetteToggles");
const sectionCollisionMaquettes = document.getElementById("section-collision-maquettes");
if (MASQUE_LISTE_MAQUETTES_COLLISION && sectionCollisionMaquettes) sectionCollisionMaquettes.hidden = true;
const collisionsList = document.getElementById("collisionsList");
const collisionBackBtn = document.getElementById("collisionBackBtn");
const collisionInfoPanelToggle = document.getElementById("collisionInfoPanelToggle");
const collisionInfoPanelBackdrop = document.getElementById("collisionInfoPanelBackdrop");
const collisionInfoPanel = document.getElementById("collisionInfoPanel");
const discussionReplyForm = document.getElementById("discussionReplyForm");
const discussionReplyInput = document.getElementById("discussionReplyInput");
const discussionsThreadsList = document.getElementById("discussionsThreadsList");
const discussionsThreadsEmpty = document.getElementById("discussionsThreadsEmpty");
const projeteurThreadsList = document.getElementById("projeteurThreadsList");
const projeteurThreadsEmpty = document.getElementById("projeteurThreadsEmpty");
const discussionsListPane = document.getElementById("discussionsListPane");
const discussionsDetailPane = document.getElementById("discussionsDetailPane");
const collisionDiscussionTitle = document.getElementById("collisionDiscussionTitle");
const collisionDiscussionToggle = document.getElementById("collisionDiscussionToggle");
const threadAssignedBadge = document.getElementById("threadAssignedBadge");
const createInstructionBtn = document.getElementById("createInstructionBtn");
const discussionsBackBtn = document.getElementById("discussionsBackBtn");
const threadSnapshotPane = document.getElementById("threadSnapshotPane");
const threadViewerPane = document.getElementById("threadViewerPane");
const threadToggleBtns = Array.from(document.querySelectorAll("#threadVisualToggle .thread-toggle-btn"));
const newDiscussionBtn = document.getElementById("newDiscussionBtn");
const newDiscussionModalOverlay = document.getElementById("newDiscussionModalOverlay");
const newDiscussionClose = document.getElementById("newDiscussionClose");
const newDiscussionForm = document.getElementById("newDiscussionForm");
const newDiscussionZone = document.getElementById("newDiscussionZone");
const newDiscussionComment = document.getElementById("newDiscussionComment");
const newDiscussionRecipients = document.getElementById("newDiscussionRecipients");

// Contenu porte depuis le mockup vault Projets/Chantier/mockups/cdc-dashboard.html
// (reference de contenu), adapte : renvois "carte N du suivi" retires (plus
// de sens hors vault), boutons vers les vrais onglets Viewer/Collision/
// Discussions a la place, et 6e section "Cette demo precisement" ajoutee
// pour regrouper toutes les notes demo vs vision reelle accumulees pendant
// la construction du POC (cf MOC-chantier.md).
// 10 paires constat/reponse affichees en cartes retournables (flip) dans la
// section "01 - Constat & reponse" : cliquer une carte affiche sa reponse.
// Icone posee en bas a droite de la face avant d'une carte retournable
// (Constat & reponse, Fonctionnalites) : simple indice visuel "ca se
// retourne", pas un bouton (pointer-events: none, cf CSS), le clic reste
// gere par la carte entiere.
const FLIP_HINT_ICON = `<svg class="flip-hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>`;

const EYE_OPEN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

const CONSTAT_REPONSE = [
  {
    num: "01",
    title: "Manipulation complexe",
    probleme: "Les outils de visualisation existants demandent une prise en main lourde, inadaptée à un usage occasionnel : il faut installer le bon logiciel, dans la bonne version, puis savoir où trouver le fichier de la maquette et le charger. Difficile d'embarquer de nouveaux utilisateurs avec autant de barrières avant même de pouvoir manipuler la maquette.",
    reponse: "On a la main sur le design et sur les fonctionnalités mises à disposition. Ce n'est pas un logiciel figé imposé par un éditeur."
  },
  {
    num: "02",
    title: "Maquettes pas à jour",
    probleme: "Les dernières versions des maquettes ne sont pas toujours celles qui sont consultées, avec le risque de travailler sur des données obsolètes.",
    reponse: "Les dernières maquettes sont chargées par le BIM Manager ou automatiquement, les utilisateurs eux n'ont pas à s'en occuper et consulteront toujours les dernières versions à jour."
  },
  {
    num: "03",
    title: "Documents pas à jour",
    probleme: "Aucun lien n'existe aujourd'hui entre les documents de la GED et la maquette : impossible de retrouver facilement, en consultant un élément dans le viewer, les documents qui s'y rapportent.",
    reponse: "Les documents de la GED sont rattachés directement aux éléments cliqués dans la maquette. On consulte ainsi toujours les versions à jour."
  },
  {
    num: "04",
    title: "Coût et complexité",
    probleme: "Les licences des outils de consultation des maquettes (Navisworks, Solibri, ...) sont payables au nombre d'utilisateurs, pensées pour un usage intensif quotidien, pas pour un usage ponctuel.",
    reponse: "Avec un outil développé en interne, il n'y a aucune licence par utilisateur, aucune limite. Des coûts réels demeurent cependant (serveurs, stockage, maintenance, ajout de fonctionnalités), mais ils sont maîtrisés et pilotés en interne plutôt qu'imposés par l'abonnement d'un éditeur."
  },
  {
    num: "05",
    title: "Peu utilisable sur chantier",
    probleme: "Les logiciels actuels ne sont pas tous pensés pour une consultation rapide en mobilité, sur site (Dalux fait exception).",
    reponse: "L'application proposée sera légère, accessible en ligne depuis un simple navigateur, sans installation."
  },
  {
    num: "06",
    title: "Connectivité chantier limitée",
    probleme: "Le réseau est souvent instable ou absent sur site : un outil qui dépend d'une connexion permanente est un frein réel.",
    reponse: "Un fonctionnement en local devient envisageable puisque l'outil nous appartient, sans dépendance imposée par un éditeur tiers."
  },
  {
    num: "07",
    title: "Verrouillage éditeur",
    probleme: "Chaque outil impose son format propriétaire (Revit, Navisworks, Solibri, Dalux, BIM 360), sans fédération simple entre maquettes de disciplines différentes.",
    reponse: "Tout est en IFC, un format ouvert standard : peu importe l'outil de modélisation utilisé par chaque discipline (Revit, Blender ou un autre), tant qu'il exporte de l'IFC, l'outil fonctionne en aval, sans rien lui imposer. Ça ne remplace ni la GED du chantier ni les outils de conception : ça vise à remplacer les outils de coordination BIM propriétaires (Solibri, Navisworks, BIM 360, Dalux...), avec un usage plus simple et un coût plus maîtrisé."
  },
  {
    num: "08",
    title: "Traçabilité perdue",
    probleme: "Les décisions prises en réunion ou par mail ne sont jamais rattachées à un point précis de la maquette. Les décisions sont invérifiables a posteriori.",
    reponse: "Chaque échange est rattaché à un point précis de la maquette et horodaté : elle devient le référentiel central du projet, géométrie et échanges compris."
  },
  {
    num: "09",
    title: "Boucle terrain vers la maquette absente",
    probleme: "Sur site, qu'il s'agisse de remonter un écart (réalisé vs prévu) ou simplement de poser une question ciblée à la bonne personne ou au bon lot, rien ne relie ça à la maquette : ça repart en réunion ou par mail, comme les autres décisions perdues.",
    reponse: "Une annotation ou une photo prise sur site est rattachée directement à un point de la maquette, et remonte immédiatement à l'interlocuteur choisi."
  },
  {
    num: "10",
    title: "Fonctionnalités jamais utilisées",
    probleme: "Les suites propriétaires embarquent de nombreuses fonctionnalités jamais utilisées sur le chantier, ni même par les études, mais facturées quand même.",
    reponse: "On ne développe que ce dont on a vraiment besoin, à notre rythme, pas à celui d'un éditeur. Ce POC en est la preuve concrète, posé en un weekend pour donner une idée de la puissance d'un outil réalisé en interne."
  }
];

const PRESENTATION_SECTIONS = [
  {
    id: "constat",
    tag: "01 · Constat & réponse",
    body: `
      <p class="pres-hint">Cliquer sur la carte pour afficher la solution proposée.</p>
      <div class="constat-grid">${CONSTAT_REPONSE.map((item) => `
        <div class="flip-card" tabindex="0" role="button" aria-label="${item.title}, cliquer pour voir la réponse">
          <div class="flip-card-inner">
            <div class="flip-card-face flip-card-front constat-card">
              <span class="constat-num">${item.num}</span>
              <h3>${item.title}</h3>
              <p>${item.probleme}</p>
              <span class="flip-card-footer">Constat</span>
              ${FLIP_HINT_ICON}
            </div>
            <div class="flip-card-face flip-card-back constat-card is-demo">
              <span class="constat-num">${item.num}</span>
              <h3>${item.title}</h3>
              <p>${item.reponse}</p>
              <span class="flip-card-footer">Solution</span>
            </div>
          </div>
        </div>`).join("")}
      </div>
      <div class="constat-highlight">Ces blocages freinent aujourd'hui l'adoption et l'usage de la maquette sur le chantier. L'outil que je propose n'est pas un viewer de plus : chaque fonctionnalité répond à un problème vraiment rencontré sur le terrain, sur Mareterra ou ailleurs.</div>
      <div class="pres-card">
        <h3>Un usage majoritairement occasionnel des outils actuels</h3>
        <div class="table-scroll">
          <table class="pres-table">
            <tr><th>Corps de métier</th><th>Fréquence</th><th>Besoin réel</th></tr>
            <tr><td>Client / MOA</td><td>Ponctuel</td><td>Vue d'ensemble simple, avancement visuel, zéro jargon BIM</td></tr>
            <tr><td>Architecte / MOE</td><td>Fréquent</td><td>Comparaison prévu/réalisé, annotation de remarques de conception</td></tr>
            <tr><td>Bureau d'études (structure, fluides, élec...)</td><td>Intensif</td><td>Vue détaillée de sa discipline + interfaces avec les autres corps d'état</td></tr>
            <tr><td>Coordinateur / BIM manager</td><td>Quotidien</td><td>Outil pivot. Détection de conflits, versions, contrôle qualité des maquettes</td></tr>
            <tr><td>Conducteur de travaux / chef de chantier</td><td>Quotidien, terrain</td><td>Consultation rapide en mobilité, annotation liée à un point précis</td></tr>
            <tr><td>Artisans / compagnons</td><td>Ponctuel, ciblé</td><td>"Qu'est-ce qui est prévu ici" en lecture, zéro formation possible</td></tr>
            <tr><td>Bureau de contrôle</td><td>Ponctuel</td><td>Consultation pour ses propres vérifications réglementaires</td></tr>
          </table>
        </div>
        <p class="muted">Ces besoins sont trop hétérogènes pour un outil unique et figé. Un outil développé en interne peut au contraire proposer des fonctionnalités différentes selon les acteurs, sans imposer la même interface à tout le monde.</p>
      </div>
    `
  },
  {
    id: "propositions",
    tag: "02 · Fonctionnalités construites ou prévues",
    body: `
      <p class="pres-hint">Le catalogue des fonctionnalités : ce qui est déjà démontrable dans ce POC (en vert, cliquer pour voir le raccourci pris dans cette démo) et ce qui est envisagé pour une vraie première version (en rouge). Dans quel ordre les construire, et pour qui, c'est l'objet de la section 03.</p>
      <div class="constat-grid">
        <div class="flip-card" tabindex="0" role="button" aria-label="Partage et consultation IFC, cliquer pour voir le raccourci pris dans cette démo">
          <div class="flip-card-inner">
            <div class="flip-card-face flip-card-front constat-card is-demo"><span class="constat-num">01</span><h3>Partage &amp; consultation IFC</h3><p>On affiche la maquette IFC directement dans le navigateur, sans installation, avec un accès partagé entre intervenants.</p>${FLIP_HINT_ICON}</div>
            <div class="flip-card-face flip-card-back constat-card"><span class="constat-num">01</span><h3>Partage &amp; consultation IFC</h3><p>Les maquettes utilisées sont des ressources pédagogiques eduscol en libre accès, pas de vraies maquettes de chantier, chargées directement sans conversion grâce à leur poids réduit. Pour une maquette plus lourde, la conversion en format compressé (.xkt) a été testée dans ce POC (visible sous le nom Maquette CEA) : le fichier passe de 27 Mo à 8,6 Mo.</p><span class="flip-card-footer">Raccourci pris dans cette démo</span></div>
          </div>
        </div>
        <div class="constat-card is-demo"><span class="constat-num">02</span><h3>Documents sur éléments</h3><p>Un document sur la GED peut être rattaché à un élément précis de la maquette : un élément, un niveau, une pièce...</p></div>
        <div class="flip-card" tabindex="0" role="button" aria-label="Détection de conflits, cliquer pour voir le raccourci pris dans cette démo">
          <div class="flip-card-inner">
            <div class="flip-card-face flip-card-front constat-card is-demo"><span class="constat-num">03</span><h3>Détection de conflits</h3><p>La détection de collisions entre maquettes (structure contre toiture métallique dans cette démo) est suivie via des statuts, posés manuellement pour l'instant.</p>${FLIP_HINT_ICON}</div>
            <div class="flip-card-face flip-card-back constat-card"><span class="constat-num">03</span><h3>Détection de conflits</h3><p>Les statuts (nouveau/confirmé/écarté) sont posés à la main sur 2 à 3 clashs simulés, pas de vrai moteur de détection géométrique. L'organisation de la page (liste des comparaisons entre maquettes, puis détail par conflit) reste aussi à confirmer avec le besoin réel, pas figée par cette démo.</p><span class="flip-card-footer">Raccourci pris dans cette démo</span></div>
          </div>
        </div>
        <div class="flip-card" tabindex="0" role="button" aria-label="Commentaires collaboratifs, cliquer pour voir le raccourci pris dans cette démo">
          <div class="flip-card-inner">
            <div class="flip-card-face flip-card-front constat-card is-demo"><span class="constat-num">04</span><h3>Commentaires collaboratifs</h3><p>On peut commenter la maquette à un endroit précis via le format BCF, aussi bien pour les échanges de conception que pour les remarques remontées du terrain. Le point est repéré par sa position exacte dans l'espace, avec une tentative de retrouver l'élément le plus proche si la maquette a changé.</p>${FLIP_HINT_ICON}</div>
            <div class="flip-card-face flip-card-back constat-card"><span class="constat-num">04</span><h3>Commentaires collaboratifs</h3><p>La page Discussions est filtrée sur un utilisateur simulé fixe, sans vraie gestion de comptes ni authentification. L'image "Avant" d'un fil est un texte de remplacement pour l'instant, pas une vraie capture, faute d'historique réel sur des fils simulés.</p><span class="flip-card-footer">Raccourci pris dans cette démo</span></div>
          </div>
        </div>
        <div class="constat-card is-missing"><span class="constat-num">05</span><h3>Fonctionnalités et rapports adaptés au métier</h3><p>Des rapports (respect des conventions de modélisation, avancée des collisions sur une semaine...) sont envoyés automatiquement aux bons interlocuteurs selon le métier ou le lot concerné. D'autres fonctionnalités avancées, propres à un métier ou un lot, peuvent être développées sans les imposer à tout le monde.</p></div>
        <div class="constat-card is-missing"><span class="constat-num">06</span><h3>Application multiprojets</h3><p>L'application développée pourra être déployée sur plusieurs chantiers en parallèle, plutôt que de rester un outil à usage unique lié à un seul projet.</p></div>
        <div class="constat-card is-missing"><span class="constat-num">07</span><h3>Compte utilisateur</h3><p>Chaque intervenant a son propre compte, avec ses informations personnelles et ses échanges rattachés à la maquette.</p></div>
        <div class="constat-card is-missing"><span class="constat-num">08</span><h3>Droits d'accès</h3><p>Un admin de projet gère qui a accès à quoi : qui a le droit de commenter, l'appartenance à tel ou tel groupe. Pas construit dans ce POC.</p></div>
        <div class="constat-card is-missing"><span class="constat-num">09</span><h3>Connexion directe à la GED</h3><p>Une connexion directe à la GED met les maquettes à jour automatiquement et garde les derniers documents accessibles, sans manipulation manuelle (évolution de la fonctionnalité 02). Dans ce POC, la maquette de référence est fixe : en réel, ça reste le rôle du BIM Manager de la tenir à jour, ou une future connexion GED pourrait le faire automatiquement.</p></div>
        <div class="constat-card is-missing"><span class="constat-num">10</span><h3>Détection de collision automatisée</h3><p>La détection de collisions devient automatique, via des outils open source ou de l'IA, pour trier les conflits avant une revue humaine, au lieu d'une saisie et revue 100% manuelle (évolution de la fonctionnalité 03).</p></div>
        <div class="constat-card is-missing"><span class="constat-num">11</span><h3>Zones sans documentation</h3><p>Les éléments de la GED non rattachés à un élément de la maquette sont repérés, et inversement les zones de la maquette sans document associé. Ça permet de repérer les trous de documentation avant qu'ils ne posent problème sur le terrain, plutôt que de les découvrir au moment où quelqu'un en a besoin. Pas construit dans ce POC, la façon de le faire n'est pas encore tranchée.</p></div>
      </div>
      <div class="constat-highlight"><strong>Limites générales de ce POC.</strong> Affichage mobile : un usage sur chantier suppose une consultation sur mobile ou tablette. L'adaptation à ces écrans reste volontairement basique dans ce POC, le temps de valider le reste ; elle serait bien plus poussée sur une vraie version mise en prod. Coupes : seule la coupe par surface sélectionnée est codée. D'autres façons de couper (par rapport aux files du projet A, B, C..., ou parallèlement à un niveau) sont envisagées, mais pas construites ici.</div>
    `
  },
  {
    id: "roadmap",
    tag: "03 · Étapes pour développer l'outil",
    body: `
      <p class="pres-hint">Pas le catalogue des fonctionnalités (cf section 02), mais le processus : dans quel ordre les construire, et pour qui à chaque étape. Le plan proposé n'est pas figé : l'ordre et le contenu de chaque étape restent à discuter selon les priorités d'IES. L'objectif ici est de rendre visible tout le chemin entre ce POC et un outil utilisé par un chantier entier.</p>
      <div class="constat-grid">
        <div class="constat-card"><span class="constat-num">01</span><h3>Un outil complet, pour le BIM Manager seul</h3><p>On construit une vraie version de l'outil (comptes, sauvegarde fiable des données), réservée à un seul utilisateur : le BIM Manager. Objectif : vérifier qu'il remplace vraiment Solibri ou Navisworks au quotidien, avant d'ouvrir l'outil à qui que ce soit d'autre.</p></div>
        <div class="constat-card"><span class="constat-num">02</span><h3>Une vue commune pour tous les acteurs</h3><p>Les autres intervenants (architecte, BE, bureau de contrôle...) consultent une version de la maquette toujours à jour, sans avoir à redemander un export au BIM Manager à chaque fois : c'est le gros intérêt de cette étape. Pas encore de commentaire ni de statut à ce stade, juste la consulter.</p></div>
        <div class="constat-card"><span class="constat-num">03</span><h3>Ouvrir les échanges autour de la maquette</h3><p>Chacun peut désormais commenter directement sur la maquette (une remarque de conception, un écart constaté sur le terrain), avec son propre compte. À ce stade, tout le monde peut encore commenter partout, sans distinction de métier.</p></div>
        <div class="constat-card"><span class="constat-num">04</span><h3>Des droits différents selon le métier</h3><p>Chaque intervenant n'a accès qu'à ce qui le concerne : consulter, commenter, ou utiliser l'outil au quotidien selon son métier ou son lot. Un administrateur du projet gère qui a accès à quoi.</p></div>
        <div class="constat-card"><span class="constat-num">05</span><h3>Automatiser et équiper plusieurs chantiers</h3><p>La détection de conflits devient automatique (plus seulement une saisie manuelle), la maquette se connecte directement à la GED, et l'outil peut équiper plusieurs chantiers en parallèle plutôt qu'un seul.</p></div>
      </div>
      <div class="constat-highlight">Chaque étape ajoute une vraie brique de travail (comptes, droits, automatisation...), pas juste un ajustement visuel. Le but de cette liste est de partir sur une vision commune du chemin à parcourir, avant de décider ensemble par où commencer.</div>
    `
  }
];

// Sous-onglet actif retenu au rechargement (meme principe que l'onglet
// principal, cf plus bas "chantier-active-view") : le hash #presentation/<id>
// prime une fois (lien direct), sinon le dernier consulte en localStorage.
function getInitialPresentationSectionId() {
  const hashParts = location.hash.replace("#", "").split("/");
  if (hashParts[0] === "presentation" && hashParts[1] && PRESENTATION_SECTIONS.some((s) => s.id === hashParts[1])) {
    return hashParts[1];
  }
  try {
    const saved = localStorage.getItem("chantier-presentation-section");
    if (saved && PRESENTATION_SECTIONS.some((s) => s.id === saved)) {
      return saved;
    }
  } catch (e) {
    // localStorage indisponible, on reste sur la 1ere section par defaut.
  }
  return PRESENTATION_SECTIONS[0].id;
}

// Active une section (bouton du tiroir, ou bouton "suivant" mobile en bas de
// page) : facteur commun aux deux entrees, jamais duplique.
function activatePresentationSection(sectionId) {
  document.querySelectorAll(".pres-section-item").forEach((b) => b.classList.toggle("active", b.dataset.id === sectionId));
  document.querySelectorAll(".pres-panel").forEach((p) => p.classList.toggle("active", p.dataset.id === sectionId));
  presentationContent.scrollTop = 0;
  closePresentationSidebar();
  try {
    localStorage.setItem("chantier-presentation-section", sectionId);
  } catch (e) {
    // localStorage indisponible, pas bloquant.
  }
  if (history.replaceState) {
    history.replaceState(null, "", "#presentation/" + sectionId);
  }
}

function renderPresentation() {
  presentationSectionsList.innerHTML = "";
  presentationContent.innerHTML = "";

  const initialSectionId = getInitialPresentationSectionId();

  PRESENTATION_SECTIONS.forEach((section, i) => {
    const isActive = section.id === initialSectionId;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pres-section-item" + (isActive ? " active" : "");
    btn.dataset.id = section.id;
    btn.textContent = section.tag;
    btn.addEventListener("click", () => activatePresentationSection(section.id));
    li.appendChild(btn);
    presentationSectionsList.appendChild(li);

    const panel = document.createElement("div");
    panel.className = "pres-panel" + (isActive ? " active" : "");
    panel.dataset.id = section.id;
    panel.innerHTML = `
      <h2>${section.tag}</h2>
      ${section.body}
    `;

    // Bouton "section suivante", mobile uniquement (cf media query) : sur la
    // derniere section, mene au Viewer plutot qu'a une section inexistante.
    const nextSection = PRESENTATION_SECTIONS[i + 1];
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pres-next-btn";
    nextBtn.textContent = nextSection ? "Suivant →" : "Voir le Viewer";
    nextBtn.addEventListener("click", () => {
      if (nextSection) {
        activatePresentationSection(nextSection.id);
      } else {
        restoreAllModelsVisible();
        activateView("viewer");
      }
    });
    panel.appendChild(nextBtn);

    const panelFooter = document.createElement("a");
    panelFooter.className = "footer-credit pres-panel-footer";
    panelFooter.href = "https://gillescobigo.com";
    panelFooter.target = "_blank";
    panelFooter.rel = "noopener noreferrer";
    panelFooter.innerHTML = `
      <img src="/images/logo-gc-white.png" alt="">
      <span>Réalisé par <span class="footer-credit-name">Gilles Cobigo</span></span>
    `;
    panel.appendChild(panelFooter);

    presentationContent.appendChild(panel);
  });
}

renderPresentation();

// Cartes retournables (section Constat & reponse) : clic ou clavier
// (Entree/Espace) bascule la classe "flipped", qui declenche la rotation
// CSS (transition sur .flip-card-inner). Delegue sur tout le panneau
// Presentation pour ne pas re-attacher un listener par carte.
presentationContent.addEventListener("click", (e) => {
  const card = e.target.closest(".flip-card");
  if (card) card.classList.toggle("flipped");
});
presentationContent.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".flip-card");
  if (!card) return;
  e.preventDefault();
  card.classList.toggle("flipped");
});

// Petite animation au chargement, sur la 1ere carte seulement (elle se
// retourne brievement) pour signaler que les cartes sont cliquables, une
// seule fois : la classe "peek" est retiree des qu'elle a joue.
const firstFlipCard = document.querySelector("#view-presentation .flip-card");
if (firstFlipCard) {
  const inner = firstFlipCard.querySelector(".flip-card-inner");
  firstFlipCard.classList.add("peek");
  inner.addEventListener("animationend", () => firstFlipCard.classList.remove("peek"), { once: true });
}

// Point de vue vise par "Recentrer" : par defaut la position initiale exacte
// de la camera, mais reoriente vers le point de vue d'un clash/fil de
// discussion des qu'on en consulte un (contexte porte par le meme bouton,
// deplace avec viewerWrap).
// Declare ici (avant activateView, pas a cote de "const viewer" plus bas) :
// un rechargement direct sur l'onglet Viewer appelle activateView("viewer")
// des le chargement, avant que le reste du fichier ne soit execute. Y
// referencer recenterTarget avant son "let" leve une ReferenceError qui
// interrompt tout le script (plus rien ne s'initialise, meme Collision et
// Discussions).
let recenterTarget = null;
let initialCameraState = null;
// Maquettes affichees/masquees dans le Viewer (20/10) : memorisees en quittant le Viewer par la navbar,
// reappliquees au retour (Collision et Discussions repartent d'un etat propre, pas le Viewer).
let memoMaquettesViewer = null;

// Vue par defaut figee (05/09), valeurs relevees via la console DevTools sur
// une orientation validee par Gilles : plus fiable qu'un fit automatique sur
// la scene, qui peut legerement varier (angle par defaut de xeokit).
const DEFAULT_CAMERA_STATE = {
  eye: [1.3697083864615462, 16.764731675931436, 55.512816283417536],
  look: [30.30047599811991, -1.1681965485168886, -12.349389746978844],
  up: [0.09263274774816085, 0.971702521543951, -0.21728640930751625]
};

// Vue de depart trouvee a la main par Gilles cote IES (cf log camera
// console) pour la maquette WestRiverSide Hospital, reprise telle quelle
// puisque ce sont les memes fichiers XKT (porte le 16/09). Meme mecanisme
// que DEFAULT_CAMERA_STATE : reprise par "Recentrer" via initialCameraState,
// posee au chargement du projet dans loadProject().
const HOSPITAL_CAMERA_STATE = {
  eye: [-2.7967908715118392, 213.746590826589, -18.16663837590921],
  look: [16.417593652723575, 190.59284595235331, -48.73506981454827],
  up: [0.28727404199819645, 0.8417831004071789, -0.45702826680949976]
};

// Page Presentation masquee (19/10) : l'interrupteur PRESENTATION_MASQUEE est
// desormais dans le bloc d'interrupteurs en tete de fichier.

// Vues rendues inaccessibles par les interrupteurs MASQUE_* du bloc de tete :
// renvoient vers le Viewer, quelle que soit l'origine (hash, localStorage,
// bouton).
function redirectMaskedView(viewName) {
  if (MASQUE_TODO_ADMIN && (viewName === "projeteur" || viewName === "admin")) return "viewer";
  if (MASQUE_PROFILS && (viewName === "profils-intro" || viewName === "persona-intro")) return "viewer";
  return viewName;
}

function activateView(viewName) {
  if (viewName !== "collision") fermerEchangesGrand(false);
  if (PRESENTATION_MASQUEE && viewName === "presentation") viewName = "viewer";
  if (MASQUE_ANCIENNE_LANDING && viewName === "landing") viewName = "accueil";
  viewName = redirectMaskedView(viewName);
  // Quitter la page Collision : plus aucune transparence ni fantome.
  if (viewName !== "collision" && (collisionContexteOn || collisionActiveClash || collisionOpacityTouched.length > 0)) {
    resetCollisionOpacityState();
  }
  // Accueil : navbar de l'app masquee par CSS (body.acc-actif).
  document.body.classList.toggle("acc-actif", viewName === "accueil");
  // La vue est choisie : le logo de demarrage (#splashLogo) peut s'effacer.
  document.documentElement.classList.remove("demarrage");
  navLinks.forEach((l) => l.classList.toggle("active", l.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== "view-" + viewName;
  });
  if (viewName !== "viewer") {
    closeFicheCard();
    closeFicheSheet();
  }
  if (viewName === "viewer") {
    viewViewer.insertBefore(viewerWrap, infoPanel);
    window.dispatchEvent(new Event("resize"));
    recenterTarget = null;
    // Externe sans compte : consultation seule, jamais d'action d'edition
    // meme en revenant sur Viewer via la navbar (pas seulement via le
    // selecteur de profil, cf applyPersona).
    const isExterne = personaSelect.value === "externe";
    newDiscussionBtn.hidden = isExterne;
    coupeBtn.hidden = isExterne;
    coupeToolbar.hidden = isExterne;
  }
  // "persona-intro" jamais persiste : c'est un ecran intermediaire dont le
  // contenu n'est reconstruit qu'au clic sur le selecteur de profil (cf
  // buildPersonaIntroContent). Le persister ferait revenir sur un ecran vide
  // au rechargement de page ; on garde alors la derniere vue interactive
  // reelle deja enregistree.
  if (viewName !== "persona-intro") {
    try {
      localStorage.setItem("chantier-active-view", viewName);
    } catch (e) {
      // localStorage indisponible (navigation privee...), pas bloquant.
    }
  }

  // replaceState plutot que location.hash= pour ne pas empiler une entree
  // d'historique a chaque clic (meme pattern que Boutiques/suivi.html dans
  // le vault) : permet un lien direct depuis le CDC vers un onglet precis
  // (#collision, #discussions) ouvert dans un nouvel onglet.
  if (history.replaceState) {
    history.replaceState(null, "", "#" + viewName);
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    fermerEchangesGrand(false);
    // Avant que restoreAllModelsVisible() ne remette tout visible : on retient le choix du Viewer.
    if (!viewViewer.hidden) memoMaquettesViewer = new Map(MAQUETTES.map((m) => [m.id, m.shown]));
    // Repart d'un etat sain si on quitte directement (sans passer par un
    // bouton retour) une detection ou un fil qui masquait certaines
    // maquettes (ex. Maquette CEA hors sujet). "restoreAllModelsVisible"
    // n'est appelee qu'au clic, jamais au chargement initial : MAQUETTES
    // n'existe pas encore a ce moment-la plus bas dans le fichier.
    restoreAllModelsVisible();
    // Idem pour une detection restee ouverte : sinon revenir sur Collision
    // via la navbar (au lieu du bouton retour) rouvre la meme detection,
    // mais viewerWrap a entre-temps ete deplace ailleurs (ex. onglet
    // Viewer) : canvas vide, page noire.
    if (!collisionDetail.hidden) {
      collisionDetail.hidden = true;
      collisionRecap.hidden = false;
      clearClashMarkers();
      clearClashElementColors();
      deselectEntity();
    }
    // Meme chose pour un fil de discussion reste ouvert : sinon revenir sur
    // Discussions via la navbar rouvre le meme fil au lieu de la liste.
    if (!discussionsDetailPane.hidden) {
      discussionsDetailPane.hidden = true;
      discussionsListPane.hidden = false;
    }
    activateView(link.dataset.view);
    if (link.dataset.view === "collision") openSoleDetectionIfAlone();
    // Revenir sur Viewer doit repartir d'un etat "neutre" et previsible :
    // equivalent a cliquer "Recentrer" (camera) et "Tout afficher" (niveaux,
    // les maquettes le sont deja via restoreAllModelsVisible ci-dessus).
    if (link.dataset.view === "viewer") {
      if (memoMaquettesViewer) {
        MAQUETTES.forEach((m) => { if (memoMaquettesViewer.has(m.id)) m.shown = memoMaquettesViewer.get(m.id); });
        renderMaquetteRows(maquettesList, MAQUETTES);
      }
      niveauxState.forEach((n) => {
        n.checked = true;
        if (n.checkboxEl) n.checkboxEl.checked = true;
      });
      applyVisibility();
      viewer.cameraFlight.flyTo(initialCameraState || DEFAULT_CAMERA_STATE);
    }
    // Admin (porte depuis IES le 16/09) : la liste des maquettes ne doit
    // montrer que celles du projet actuellement charge, jamais les 2
    // melangees. Le mockup est un iframe statique, donc le projet lui est
    // passe en query string ; src reaffecte a chaque clic pour refleter le
    // projet courant.
    if (link.dataset.view === "admin" && !MASQUE_TODO_ADMIN) {
      adminFrame.src = "/personas/admin-groupes.html?project=" + encodeURIComponent(projectSelect.value);
    }
    navbarLinksEl.classList.remove("open");
  });
});

// Menu navbar mobile (hamburger) : cache/affiche la liste des onglets sur
// petit ecran, sans rien changer sur desktop (bouton invisible au-dela du
// breakpoint, cf media query).
navbarToggle.addEventListener("click", () => {
  navbarLinksEl.classList.toggle("open");
});

// Clic en dehors du menu ouvert (sur le reste de la page) : le referme,
// meme logique que les tiroirs "☰ Infos"/"☰ Sections" mais sans voile
// dedie (le menu ne masque pas le contenu, un simple clic ailleurs suffit).
// "pointerdown" en phase de capture : Safari iOS n'emet pas "click" sur une
// zone non cliquable, et le canvas 3D capte les gestes avant le document.
document.addEventListener("pointerdown", (e) => {
  if (!navbarLinksEl.classList.contains("open")) return;
  if (navbarLinksEl.contains(e.target) || navbarToggle.contains(e.target)) return;
  navbarLinksEl.classList.remove("open");
}, true);

// Tiroir "Sections" de la page Presentation, mobile uniquement : masque par
// defaut (cf media query), un bouton dedie l'affiche en overlay par-dessus
// le contenu plutot que de partager la largeur avec lui.
presentationSidebarToggle.addEventListener("click", () => {
  presentationSidebar.classList.add("open");
  presentationSidebarBackdrop.hidden = false;
});
function closePresentationSidebar() {
  presentationSidebar.classList.remove("open");
  presentationSidebarBackdrop.hidden = true;
}
presentationSidebarBackdrop.addEventListener("click", closePresentationSidebar);

// Meme principe pour le panneau Niveaux/Maquettes/Info selection du Viewer,
// mobile uniquement (cf media query) : masque par defaut pour laisser la
// maquette prendre toute la page, ouvert en overlay via ce bouton.
infoPanelToggle.addEventListener("click", () => {
  infoPanel.classList.add("open");
  infoPanelBackdrop.hidden = false;
});
function closeInfoPanelDrawer() {
  infoPanel.classList.remove("open");
  infoPanelBackdrop.hidden = true;
}
infoPanelBackdrop.addEventListener("click", closeInfoPanelDrawer);
const infoPanelCloseBtn = document.getElementById("infoPanelClose");
if (infoPanelCloseBtn) infoPanelCloseBtn.addEventListener("click", closeInfoPanelDrawer);
// Toucher la maquette ferme la feuille "Afficher" (mobile, 20/10). "pointerdown" en capture : le canvas 3D capte
// les gestes avant le reste ; le geste continue ensuite normalement (la selection ou la rotation se font).
document.addEventListener("pointerdown", (e) => {
  if (e.target !== viewerCanvas || !infoPanel.classList.contains("open")) return;
  if (window.matchMedia("(max-width: 768px)").matches) closeInfoPanelDrawer();
}, true);

// Ordinateur uniquement (bouton masque sur mobile, cf style.css) : reduit le
// panneau a une fine bande. Le canvas est redimensionne une fois la
// transition de largeur terminee, meme mecanisme que les autres changements
// de mise en page (evenement resize).
// Etat memorise comme le reste de l'appli (localStorage, prefixe chantier-).
const infoPanelCollapse = document.getElementById("infoPanelCollapse");
const INFO_PANEL_COLLAPSED_KEY = "chantier-info-panel-collapsed";
function setInfoPanelCollapsed(collapsed) {
  infoPanel.classList.toggle("collapsed", collapsed);
  infoPanelCollapse.textContent = collapsed ? "‹" : "›";
  infoPanelCollapse.setAttribute("aria-expanded", String(!collapsed));
  const label = collapsed ? "Afficher le panneau" : "Réduire le panneau";
  infoPanelCollapse.setAttribute("aria-label", label);
  infoPanelCollapse.title = label;
}
// Replie a chaque arrivee sur le Viewer (19/10, demande de Gilles) : la
// valeur memorisee n'est plus lue au chargement (elle reste ecrite au clic
// ci-dessous). Applique avant le premier rendu, sans transition : pas de
// transitionend, le canvas est donc redimensionne ici directement.
setInfoPanelCollapsed(true);
window.dispatchEvent(new Event("resize"));
infoPanelCollapse.addEventListener("click", () => {
  const collapsed = !infoPanel.classList.contains("collapsed");
  setInfoPanelCollapsed(collapsed);
  try {
    localStorage.setItem(INFO_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch (e) {
    // localStorage indisponible : l'etat ne survit pas au rechargement.
  }
});
infoPanel.addEventListener("transitionend", (e) => {
  if (e.target === infoPanel && e.propertyName === "flex-basis") {
    window.dispatchEvent(new Event("resize"));
  }
});

// Masque l'ancienne section "Info selection" du drawer (cf interrupteur).
const sectionFicheDrawer = document.getElementById("section-fiche");
if (MASQUE_FICHE_DANS_DRAWER && sectionFicheDrawer) sectionFicheDrawer.hidden = true;

// Idem pour la page Collision (cf interrupteur).
const sectionFicheCollisionDrawer = document.getElementById("section-collision-fiche");
if (MASQUE_FICHE_COLLISION_DANS_DRAWER && sectionFicheCollisionDrawer) sectionFicheCollisionDrawer.hidden = true;
const collisionFicheCardCloseBtn = document.getElementById("collisionFicheCardClose");
if (collisionFicheCardCloseBtn) {
  collisionFicheCardCloseBtn.addEventListener("click", () => deselectEntity());
}

// Carte Info selection : le bouton fermer desélectionne (ferme aussi la
// feuille mobile via clearFiche).
const ficheCardCloseBtn = document.getElementById("ficheCardClose");
if (ficheCardCloseBtn) {
  ficheCardCloseBtn.addEventListener("click", () => deselectEntity());
}

// Onglets du drawer du Viewer (Niveaux / Maquettes), motif WAI-ARIA tabs :
// un seul panneau visible, fleches gauche/droite entre onglets.
const infoTabs = Array.from(document.querySelectorAll('#infoPanel [role="tab"]'));
function selectInfoTab(tab) {
  infoTabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute("aria-controls"));
    if (panel) panel.hidden = !on;
  });
}
infoTabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectInfoTab(tab));
  tab.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = infoTabs[(i + step + infoTabs.length) % infoTabs.length];
    selectInfoTab(next);
    next.focus();
    e.preventDefault();
  });
});

// Page d'accueil (#view-accueil) : boutons/cartes [data-go] vers une vue de
// l'app, logo vers le haut de l'accueil, revelation douce au scroll. Chaque
// element est garde (null) : rien ne plante s'il n'est pas dans le DOM.
const viewAccueil = document.getElementById("view-accueil");
if (viewAccueil) {
  viewAccueil.querySelectorAll("[data-go]").forEach((el) => {
    el.addEventListener("click", () => {
      const target = el.dataset.go;
      // Passe par le clic sur l'onglet de navbar correspondant : meme remise
      // a zero (camera, niveaux, detail ouvert) que depuis la navbar.
      const navLink = navLinks.find((l) => l.dataset.view === target);
      if (navLink) navLink.click();
      else activateView(target);
    });
  });
  const accueilLogoLink = document.getElementById("accueilLogoLink");
  if (accueilLogoLink) {
    accueilLogoLink.addEventListener("click", (e) => {
      e.preventDefault();
      activateView("accueil");
      viewAccueil.scrollTop = 0;
    });
  }
  // Revelation au scroll : root = la vue elle-meme (c'est elle qui defile).
  // Tant que la vue est masquee (display none), rien n'intersecte : les
  // elements ne sont reveles qu'une fois l'accueil visible.
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = viewAccueil.querySelectorAll(".acc-reveal");
  if (!reduceMotion && "IntersectionObserver" in window && revealItems.length) {
    viewAccueil.classList.add("acc-js");
    const accueilObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            accueilObserver.unobserve(entry.target);
          }
        });
      },
      { root: viewAccueil, threshold: 0.12 }
    );
    revealItems.forEach((el) => accueilObserver.observe(el));
  }
}

// Capture avant qu'activateView() ne le reecrive (replaceState) : necessaire
// plus bas pour retrouver un fil precis (#discussions/<id>) au chargement.
const initialHash = location.hash;

// Le hash d'URL (lien direct depuis le CDC) prime sur le dernier onglet
// visite (localStorage) : un lien explicite doit toujours gagner. Le hash
// peut aussi cibler un fil precis (#discussions/<id>), seule la base avant
// le "/" compte pour choisir l'onglet ici.
const hashView = initialHash.replace("#", "").split("/")[0];
// "landing" n'est pas un nav-link (accessible via le bouton OUVRA),
// ajoute a la liste des vues valides pour le hash/localStorage quand meme.
const validViews = navLinks.map((l) => l.dataset.view).concat(["landing", "accueil"]);

// Arrivee par defaut : la nouvelle page d'accueil.
let savedView = "accueil";
if (validViews.includes(hashView)) {
  savedView = hashView;
} else if (!MASQUE_ANCIENNE_LANDING) {
  try {
    const storedView = localStorage.getItem("chantier-active-view");
    if (validViews.includes(storedView)) savedView = storedView;
  } catch (e) {
    // localStorage indisponible, on reste sur "viewer" par defaut.
  }
}
activateView(savedView);
if (savedView !== "landing") {
  // adminFrame.src n'est normalement fixe que dans le handler de clic des
  // nav-links (cf plus haut) : une restauration directe au rechargement
  // (pas de clic) le laissait vide, page blanche dans l'onglet Admin apres
  // F5 (porte depuis IES le 16/09).
  if (savedView === "admin" && !MASQUE_TODO_ADMIN) {
    adminFrame.src = "/personas/admin-groupes.html?project=" + encodeURIComponent(projectSelect.value);
  }
}

// Cles de projet (portees depuis IES le 16/09, declarees ici plutot qu'a
// cote de PROJECTS plus bas dans le fichier : applyPersona() ci-dessous les
// utilise des l'appel initial, avant que la declaration de PROJECTS ne
// s'execute). DEMO_PROJECT_KEY reste l'option par defaut/premiere du
// selecteur. Projet hopital (WestRiverSide Hospital, jeu de test public,
// memes fichiers XKT que cote IES) : demontre la bascule entre plusieurs
// projets, sans donnees de collision/discussion coherentes dessus, d'ou
// HOSPITAL_VISIBLE_VIEWS qui masque Collision/Discussions/profils sur ce
// projet uniquement (le projet demo garde son comportement normal).
const DEMO_PROJECT_KEY = "demo";
const HOSPITAL_PROJECT_KEY = "hospital-xkt";
// 19/10 : l'hopital devient le projet unique et expose aussi Collision et
// Discussions, qui fonctionnent sans donnees dessus (listes vides, cf
// applyProjectData). Ancienne valeur : ["presentation", "viewer"].
const HOSPITAL_VISIBLE_VIEWS = ["presentation", "viewer", "collision", "discussions"];

// Projet hopital force au demarrage quand le selecteur est masque (aucune
// valeur memorisee n'est relue : l'hopital s'impose a chaque chargement).
if (MASQUE_SELECTEUR_PROJET) {
  projectSelect.hidden = true;
  projectSelect.value = HOSPITAL_PROJECT_KEY;
} else {
  // Le HTML de depart masque le selecteur (etat sans JavaScript) : on le reaffiche ici.
  projectSelect.hidden = false;
}

// Profils fictifs (portes depuis IES le 16/09) : simule le fait que
// l'appli s'adapte au metier/a l'entreprise, en changeant simplement quels
// onglets sont accessibles et vers quelle vue on atterrit par defaut. Pas
// de vraie auth/role dans ce POC : chaque profil reste juste un filtre
// d'affichage sur les nav-links existants (data-persona, liste separee par
// espace, cf index.html).
const PERSONA_DEFAULT_VIEW = {
  "presentation-globale": "viewer",
  "bim-manager": "viewer",
  synthese: "discussions",
  be: "discussions",
  projeteur: "projeteur",
  externe: "viewer"
};

// Activer les profils (porte depuis IES le 16/09) : le dropdown
// #personaSelect ne s'affiche en navbar qu'une fois "active" via l'ecran
// d'explication (view-profils-intro, cf profilsActivateBtn plus bas). Avant
// activation, seul le bouton #activateProfilesBtn est visible. Persiste
// comme le reste (chantier-profiles-activated) pour ne pas redemander
// l'activation a chaque rechargement.
let profilesActivated = false;
try {
  profilesActivated = localStorage.getItem("chantier-profiles-activated") === "1";
} catch (e) {
  // localStorage indisponible, on reste desactive par defaut.
}

function updateProfilesActivationUI() {
  // Projet hopital (porte depuis IES le 16/09) : jeu de test public sans
  // donnees personas dessus, le concept de profil n'a pas de sens ici. Le
  // selecteur de profil lui-meme reste masque, quel que soit l'etat
  // d'activation par ailleurs (retrouve tel quel en revenant sur le projet
  // demo).
  const isHospitalProject = projectSelect.value === HOSPITAL_PROJECT_KEY;
  activateProfilesBtn.hidden = isHospitalProject || profilesActivated;
  personaSelect.hidden = isHospitalProject || !profilesActivated;
  // Profils masques (19/10) : ni bouton d'activation ni selecteur de profil.
  if (MASQUE_PROFILS) {
    activateProfilesBtn.hidden = true;
    personaSelect.hidden = true;
  }
}

function applyPersona(persona, forceNav) {
  const isHospitalProject = projectSelect.value === HOSPITAL_PROJECT_KEY;
  updateProfilesActivationUI();

  navLinks.forEach((link) => {
    // Onglets Todo et Admin masques (19/10), quel que soit le profil/projet.
    if (MASQUE_TODO_ADMIN && (link.dataset.view === "projeteur" || link.dataset.view === "admin")) {
      link.hidden = true;
      return;
    }
    // Projet hopital (porte depuis IES le 16/09) : plus aucun filtrage par
    // profil, juste Presentation + Viewer visibles dans la navbar (demande
    // explicite de Gilles, cote IES comme ici : jeu de test sans donnees
    // personas dessus).
    if (isHospitalProject) {
      link.hidden = !HOSPITAL_VISIBLE_VIEWS.includes(link.dataset.view);
      return;
    }
    const personaAllowed = (link.dataset.persona || "").split(" ").includes(persona);
    link.hidden = !personaAllowed;
  });
  try {
    localStorage.setItem("chantier-persona", persona);
  } catch (e) {
    // localStorage indisponible, pas bloquant.
  }

  const currentView = document.querySelector(".view:not([hidden])");
  const currentViewName = currentView ? currentView.id.replace("view-", "") : null;
  // L'accueil n'est pas un onglet de la navbar : il est toujours autorise (sinon le
  // rechargement de l'accueil basculait d'office sur le Viewer, 19/10).
  const currentViewAllowed = currentViewName === "accueil" || navLinks.some((l) => l.dataset.view === currentViewName && !l.hidden);
  if (forceNav || !currentViewAllowed) {
    activateView(isHospitalProject ? "viewer" : PERSONA_DEFAULT_VIEW[persona]);
  }

  // Externe sans compte : consultation seule, aucune action d'edition
  // (coupe, nouvelle discussion) meme sur l'onglet Viewer. Applique apres
  // activateView() : sa branche "viewer" reaffiche ces boutons par defaut.
  // Non applicable sur le projet hopital (pas de profil actif, cf
  // ci-dessus).
  if (persona === "externe" && !isHospitalProject) {
    coupeBtn.hidden = true;
    coupeToolbar.hidden = true;
    newDiscussionBtn.hidden = true;
  }
}

// Ecran de presentation persona (porte depuis IES le 16/09) : affiche
// systematiquement au changement de profil via le selecteur, avant
// d'atterrir sur la vue interactive par defaut (PERSONA_DEFAULT_VIEW). But :
// comprendre en un coup d'oeil qui a acces a cette vision de l'app, a quoi,
// avec quelles fonctionnalites, sans avoir a explorer. Ne concerne pas
// "presentation-globale" (a deja sa propre page #view-presentation).
// Contenu redige a la main (qui/fonctionnalites/approfondissement/lien),
// mais la liste des onglets accessibles n'est JAMAIS recopiee ici : elle
// est recalculee dynamiquement depuis navLinks a chaque appel, pour ne
// jamais diverger du vrai gating de applyPersona.
//
// Ecart assume par rapport a IES (16/09, mis a jour le meme jour suite a
// validation explicite de Gilles) : le mecanisme d'instruction Bureau
// d'etudes -> Projeteur (badge "Pris en charge par...", bouton "Créer une
// instruction pour le projeteur", onglet Todo dedie) EST porte ici. Reste
// hors perimetre : la page "Réunion de synthèse" elle-meme et son bouton
// "+ Ajouter à la réunion de synthèse", specifiques a une page qu'Ouvra n'a
// pas (propre aux donnees/maquettes du projet client d'IES). Les
// instructions se creent donc directement depuis un fil Collision/
// Discussions ouvert (cf createInstructionBtn plus bas), jamais depuis une
// reunion.
const PERSONA_INTRO_CONTENT = {
  "bim-manager": {
    label: "BIM Manager",
    qui: "Pilote la coordination transverse du projet, interface entre les corps de métier.",
    fonctionnalites: [
      { titre: "Maquette 3D complète", desc: "Explorer librement la maquette 3D complète du projet." },
      { titre: "Collisions et discussions", desc: "Suivre toutes les collisions détectées et tous les fils de discussion." },
      { titre: "Administration des droits", desc: "Gérer les groupes, les entreprises et leur périmètre de lots/bâtiments visibles." },
      { titre: "Gestion des maquettes", desc: "Renommer chaque maquette pour plus de clarté et définir la vue de départ utilisée par tous les acteurs du projet." }
    ],
    approfondissement: "Avec le Responsable Synthèse, c'est le seul profil qui garde Collision/Discussions toujours visibles, pour pouvoir arbitrer sur l'ensemble du projet.",
    lien: "Coordonne tous les autres profils autour d'une même maquette : c'est lui qui garantit que chaque métier retrouve une information fiable et à jour sur l'avancement réel du projet."
  },
  synthese: {
    label: "Responsable Synthèse",
    qui: "Anime le suivi de la coordination, fait le lien entre les points remontés et les décisions actées.",
    fonctionnalites: [
      { titre: "Suivi des fils", desc: "Suivi de l'état de tous les fils de discussion et collisions." }
    ],
    approfondissement: "Voit directement dans la liste des fils le badge \"Pris en charge par Bureau d'études\" dès qu'une instruction a été créée pour un Projeteur, sans avoir à ouvrir chaque fil un par un, pour savoir en un coup d'œil ce qui reste vraiment à son arbitrage.",
    lien: "Fait remonter, dans un cadre commun, ce que chaque métier identifie sur la maquette, pour transformer des remarques éparses en décisions actées et partagées par tous les acteurs du projet."
  },
  be: {
    label: "Bureau d'études",
    qui: "Instruit techniquement les points remontés, jusqu'à leur traduction en tâche concrète pour un Projeteur.",
    fonctionnalites: [
      { titre: "Ouvrir un fil", desc: "Ouvrir n'importe quel fil (collision ou discussion classique) et y répondre." },
      { titre: "Instruction Projeteur", desc: "Déclencher une instruction dédiée pour le Projeteur." }
    ],
    approfondissement: "Le bouton \"Créer une instruction pour le projeteur\" duplique tout le contexte 3D du fil source (caméra, niveaux affichés, maquettes visibles) dans un nouveau fil dédié BE ↔ Projeteur, en laissant une trace visible sur le fil d'origine. Ce bouton apparaît sous le titre du fil ouvert (Collision ou Discussions), tant qu'il ne s'agit pas déjà d'une instruction en cours.",
    lien: "Traduit un point soulevé collectivement sur la maquette en une tâche précise pour le Projeteur, sans perdre le lien avec la discussion d'origine ni le contexte 3D qui l'a fait naître."
  },
  projeteur: {
    label: "Projeteur",
    qui: "Modélisateur qui corrige ou complète la maquette suite aux instructions reçues du Bureau d'études.",
    fonctionnalites: [
      { titre: "Todo dédiée", desc: "Onglet Todo listant uniquement les instructions qui le concernent (badge \"À traiter\" / \"Traité\")." }
    ],
    approfondissement: "Ouvrir une tâche restaure exactement le contexte 3D que le Bureau d'études avait sous les yeux au moment de l'instruction (niveaux, maquettes affichées, caméra), sans avoir à le reconstituer lui-même.",
    lien: "Referme la boucle en intervenant directement sur la maquette à partir d'une tâche héritée d'un échange collectif, avec le contexte exact qui l'a motivée, sans avoir à reconstituer l'historique par lui-même."
  },
  externe: {
    label: "Externe sans compte",
    qui: "Intervenant occasionnel (artisan, client...) sans compte, en consultation seule.",
    fonctionnalites: [
      { titre: "Navigation et consultation", desc: "Naviguer et consulter la maquette 3D." },
      { titre: "Aucune édition", desc: "Aucune action d'édition possible (ni coupe, ni nouvelle discussion)." }
    ],
    approfondissement: "Pensé pour un lien transmis ponctuellement à quelqu'un qui n'a pas à apprendre l'outil, juste à regarder.",
    lien: "Même sans compte ni droit d'édition, garde le même point d'entrée que tous les autres acteurs : la maquette, comme référence commune du projet."
  }
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Construit et injecte le contenu de l'ecran de presentation pour un
// persona donne. La liste des onglets accessibles est lue depuis navLinks
// APRES le filtrage applique par applyPersona (link.hidden), jamais en dur.
function buildPersonaIntroContent(persona) {
  const data = PERSONA_INTRO_CONTENT[persona];
  if (!data) return;

  const accessibleTabs = navLinks
    .filter((l) => !l.hidden)
    .map((l) => `<li>${escapeHtml(l.textContent.trim())}</li>`)
    .join("");

  personaIntroContent.innerHTML = `
    <p class="landing-part-eyebrow">Profil sélectionné</p>
    <h2 id="personaIntroTitle">${escapeHtml(data.label)}</h2>
    <p id="personaIntroWho">${escapeHtml(data.qui)}</p>

    <div class="landing-part">
      <p class="landing-part-eyebrow">À quoi ce profil a accès</p>
      <ul class="info-list">${accessibleTabs}</ul>
    </div>

    <div class="landing-part">
      <p class="landing-part-eyebrow">Fonctionnalités</p>
      <div class="landing-part-grid">
        ${data.fonctionnalites.map((f) => `
          <div class="landing-part-card">
            <h3>${escapeHtml(f.titre)}</h3>
            <p>${escapeHtml(f.desc)}</p>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="landing-part">
      <p class="landing-part-eyebrow">Ce qui distingue ce profil</p>
      <p class="landing-part-lead">${escapeHtml(data.approfondissement)}</p>
    </div>

    <div class="landing-part">
      <p class="landing-part-eyebrow">Son rôle autour de la maquette commune</p>
      <p class="landing-part-lead">${escapeHtml(data.lien)}</p>
    </div>
  `;
}

personaIntroContinueBtn.addEventListener("click", () => {
  activateView(PERSONA_DEFAULT_VIEW[personaSelect.value]);
});

let initialPersona = "presentation-globale";
try {
  initialPersona = localStorage.getItem("chantier-persona") || "presentation-globale";
} catch (e) {
  // localStorage indisponible, on reste sur "presentation-globale" par defaut.
}
// Profils masques (19/10) : la valeur memorisee est ignoree, filtrage par
// profil neutre (onglets Viewer, Collision, Discussions).
if (MASQUE_PROFILS) initialPersona = "presentation-globale";
personaSelect.value = initialPersona;
applyPersona(initialPersona, false);

// Activer les profils : plus de selecteur direct dans la navbar, ce bouton
// mene vers l'ecran d'explication (view-profils-intro).
activateProfilesBtn.addEventListener("click", () => activateView("profils-intro"));

// Confirmation sur l'ecran d'explication : bascule definitivement (persiste)
// le bouton pour le vrai #personaSelect en haut a droite de la navbar, puis
// revient sur la vue par defaut du profil courant (presentation-globale par
// defaut tant qu'aucun profil n'a ete choisi).
profilsActivateBtn.addEventListener("click", () => {
  profilesActivated = true;
  try {
    localStorage.setItem("chantier-profiles-activated", "1");
  } catch (e) {
    // localStorage indisponible, pas bloquant.
  }
  updateProfilesActivationUI();
  activateView(PERSONA_DEFAULT_VIEW[personaSelect.value]);
});

personaSelect.addEventListener("change", () => {
  const persona = personaSelect.value;
  // Comportement navbar/vue par defaut inchange (gating des onglets, etc.).
  applyPersona(persona, true);
  // Ecran de presentation systematique sur un vrai changement de profil
  // metier (pas "presentation-globale", qui a deja sa page Presentation et
  // atterrit normalement sur "landing") : remplace la navigation directe
  // faite juste au-dessus par applyPersona, l'utilisateur y accede via le
  // bouton "Continuer" (cf personaIntroContinueBtn).
  if (persona !== "presentation-globale") {
    buildPersonaIntroContent(persona);
    activateView("persona-intro");
  }
});

// Profils dans le hamburger mobile (porte depuis IES le 16/09) :
// #activateProfilesBtn/#personaSelect se battaient avec le bouton hamburger
// dans le header sur petit ecran. Deplaces dans le tiroir #navbarLinks, a la
// suite des onglets, uniquement sur mobile : purement une reparentation DOM
// au changement de largeur, les listeners restent attaches aux memes
// noeuds, rien a reconnecter. Desktop retrouve exactement son emplacement
// d'origine dans #navbar (inchange).
const navbarMobileQuery = window.matchMedia("(max-width: 768px)");
function applyNavbarResponsiveLayout(isMobile) {
  if (isMobile) {
    navbarLinksEl.appendChild(activateProfilesBtn);
    navbarLinksEl.appendChild(personaSelect);
  } else {
    navbarEl.appendChild(activateProfilesBtn);
    navbarEl.appendChild(personaSelect);
  }
}
applyNavbarResponsiveLayout(navbarMobileQuery.matches);
navbarMobileQuery.addEventListener("change", (e) => applyNavbarResponsiveLayout(e.matches));

// Choisir un profil (bouton d'activation ou select une fois active) referme
// le tiroir mobile, meme reflexe que les nav-link : les 2 vivent desormais
// dedans sur mobile, sans ca le tiroir resterait ouvert par-dessus la vue
// qui vient de s'afficher.
activateProfilesBtn.addEventListener("click", () => navbarLinksEl.classList.remove("open"));
personaSelect.addEventListener("change", () => navbarLinksEl.classList.remove("open"));

// Donnees simulees : ce POC ne branche aucune GED reelle (cf CDC, un doc reste
// un pointeur vers la GED du chantier, jamais une copie). Cles alignees sur les
// noms de niveaux reels de la Maquette_CEA.xkt (Projet_Archi.ifc), devenue la
// source des niveaux (test du 05/09, cf MOC-chantier.md : maquette d'exemple
// eduscol, pas une vraie maquette de chantier, a expliciter dans le CDC).
const DOCS_BY_NIVEAU = {
  "Soubassement": [
    { nom: "Plan fondations.pdf", lot: "Structure", type: "Plan", version: "Indice B" }
  ],
  "R+0": [
    { nom: "Plan structure Niveau 1.pdf", lot: "Structure", type: "Plan", version: "Indice C" },
    { nom: "Plan CVC Niveau 1.pdf", lot: "CVC", type: "Plan", version: "v2.0" }
  ],
  "R+1": [
    { nom: "Plan structure Niveau 2.pdf", lot: "Structure", type: "Plan", version: "Indice C" }
  ]
};

// Docs par element IFC (guid -> docs) : pas encore peuple pour ce POC, un
// element clique n'a donc aujourd'hui jamais de doc associe (comportement
// attendu, cf CDC fonctionnalite 2).
const DOCS_BY_ELEMENT = {};

const viewer = new Viewer({
  canvasId: "viewerCanvas",
  transparent: false
});
// "viewer" est une const de module (invisible depuis la console DevTools),
// exposee ici pour pouvoir inspecter/piloter la camera manuellement.
window.viewer = viewer;

// Fond de la 3D, ambiance vert sourd (19/10, un cran plus vert) ; precedents : [0.067, 0.082, 0.074], anthracite [0.075, 0.08, 0.078],
// vert foret [0.059, 0.086, 0.071],
// d'origine [0.051, 0.055, 0.063].
viewer.scene.canvas.backgroundColor = [0.063, 0.084, 0.072];

// Eclairage de la scene (20/10, a tester) : les lumieres par defaut de xeokit (ambiante 0,7 + deux directionnelles
// 0,7 et 0,9) totalisent environ 1,6 sur une surface bien orientee, donc les murs blancs saturent (blanc pur,
// peu de contraste avec les elements en collision). Toutes les intensites sont multipliees par ce facteur,
// 0,65 ramene le total a environ 1. 1 = comportement d'avant.
const FACTEUR_LUMIERE = 0.65;
Object.values(viewer.scene.lights).forEach((lumiere) => { lumiere.intensity = lumiere.intensity * FACTEUR_LUMIERE; });

// Vitesse de navigation (portee depuis IES le 16/09, etendue a la souris) :
// reglages par defaut du SDK (dragRotationRate/mouseWheelDollyRate/
// touchPanRate/touchDollyRate), trop reactifs pour un debutant (souris) et
// qui envoient la camera beaucoup trop loin au doigt sur mobile. Slider
// #cameraSpeedControl (tous ecrans) en % de ces valeurs par defaut (10 a
// 200 %, au dela de 100 % pour accelerer sur une grande maquette), persiste
// en localStorage. Depart a 30% sur mobile (premiere visite, pas encore de
// preference enregistree) ; 100% sur ordinateur (comportement inchange tant
// que le slider n'est pas touche). Cle de stockage conservee telle quelle
// (preferences deja enregistrees).
const CAMERA_TOUCH_DEFAULTS = { dragRotationRate: 360.0, mouseWheelDollyRate: 100.0, touchPanRate: 1.0, touchDollyRate: 0.2 };
function applyCameraTouchSpeed(percent) {
  const factor = percent / 100;
  viewer.cameraControl.dragRotationRate = CAMERA_TOUCH_DEFAULTS.dragRotationRate * factor;
  viewer.cameraControl.mouseWheelDollyRate = CAMERA_TOUCH_DEFAULTS.mouseWheelDollyRate * factor;
  viewer.cameraControl.touchPanRate = CAMERA_TOUCH_DEFAULTS.touchPanRate * factor;
  viewer.cameraControl.touchDollyRate = CAMERA_TOUCH_DEFAULTS.touchDollyRate * factor;
}
let savedCameraSpeed = null;
try {
  savedCameraSpeed = localStorage.getItem("chantier-camera-touch-speed");
} catch (e) {
  // localStorage indisponible, pas bloquant.
}
const initialCameraSpeed = savedCameraSpeed
  ? Math.min(100, parseInt(savedCameraSpeed, 10))
  : (window.matchMedia("(max-width: 768px)").matches ? 30 : 100);
cameraSpeedSlider.value = String(initialCameraSpeed);
cameraSpeedValue.textContent = initialCameraSpeed + " %";
applyCameraTouchSpeed(initialCameraSpeed);
cameraSpeedSlider.addEventListener("input", () => {
  const value = parseInt(cameraSpeedSlider.value, 10);
  applyCameraTouchSpeed(value);
  cameraSpeedValue.textContent = value + " %";
  try {
    localStorage.setItem("chantier-camera-touch-speed", String(value));
  } catch (e) {
    // localStorage indisponible, pas bloquant.
  }
});

// Replie par defaut : seul le bouton "Vitesse" reste visible tant qu'on n'a
// pas clique dessus, meme reflexe que les autres tiroirs de l'app (backdrop
// en moins, pas necessaire pour un petit panneau qui ne masque pas le reste
// du contenu).
cameraSpeedToggle.addEventListener("click", () => {
  const willOpen = cameraSpeedPanel.hidden;
  cameraSpeedPanel.hidden = !willOpen;
  cameraSpeedToggle.classList.toggle("active", willOpen);
});

// "pointerdown" plutot que "click" (bug deja corrige cote IES avant ce
// portage, cf commit 71a9cc2) : CameraControl de xeokit appelle
// event.preventDefault() sur "touchstart" du canvas
// (TouchPanRotateAndDollyHandler), ce qui supprime le clic synthetique que
// le navigateur genere normalement apres un tap. Un listener "click" ne se
// declencherait donc jamais en touchant la maquette pour fermer ce panneau.
document.addEventListener("pointerdown", (e) => {
  if (cameraSpeedPanel.hidden) return;
  if (cameraSpeedControl.contains(e.target)) return;
  cameraSpeedPanel.hidden = true;
  cameraSpeedToggle.classList.remove("active");
});

// Plan de coupe (20/10, demande de Gilles) : plus de rotation possible (une fausse manoeuvre pouvait ruiner la
// demo). TransformControl n'affiche les arcs de rotation que si on lui fournit onQuaternion : on le retire toujours.
// On ne garde que la fleche bleue (l'axe Z du plan, sa normale) : elle montre de quel cote part la coupe et peut se
// tirer. Les fleches rouge et verte deplacent le plan sur lui-meme, ce qui ne change pas la coupe (un plan est infini).
// Le curseur "Position de la coupe" reste le moyen principal de deplacer le plan.
const setHandlersOrigine = TransformControl.prototype.setHandlers;
TransformControl.prototype.setHandlers = function (handlers) {
  if (!handlers) return setHandlersOrigine.call(this, handlers);
  const resultat = setHandlersOrigine.call(this, Object.assign({}, handlers, { onQuaternion: null }));
  if (this._displayMeshes) {
    this._displayMeshes.x.setPositionActive(false);
    this._displayMeshes.y.setPositionActive(false);
  }
  return resultat;
};

const sectionPlanes = new SectionPlanesPlugin(viewer);

recenterBtn.addEventListener("click", () => {
  if (recenterTarget) {
    recenterTarget();
  } else {
    viewer.cameraFlight.flyTo(initialCameraState || DEFAULT_CAMERA_STATE);
  }
});

// Choix assume du 04/09 : Projet_structure.ifc (2,6 Mo) plutot que
// Projet_Archi.ifc (27 Mo, disponible dans public/models/ si besoin plus
// tard). Rendu deja convaincant visuellement, federe avec la toiture, et
// evite le probleme de temps de chargement sans conversion .xkt. Maquettes
// d'exemple eduscol, pas une vraie maquette de chantier : a expliciter dans
// le CDC envoye au prospect.
// "shown" est la seule source de verite pour "cette maquette doit-elle etre
// visible" (jamais relire model.visible pour ca : xeokit le recalcule a
// partir de la visibilite de ses objets, ce qui cree une boucle avec le
// filtrage par niveau ci-dessous). applyVisibility() est le seul endroit qui
// pousse ces intentions (shown + niveau.checked) vers la scene xeokit.
//
// Selecteur de projet/maquette (porte depuis IES le 16/09, cf #projectSelect,
// DEMO_PROJECT_KEY/HOSPITAL_PROJECT_KEY declares plus haut) : PROJECTS liste
// les maquettes de chaque projet selectionnable, MAQUETTES reste la
// reference stable (const, mutee en place par loadProject() a chaque
// changement) que tout le reste du fichier capture par closure.
const PROJECTS = {
  [DEMO_PROJECT_KEY]: [
    { id: "archi", src: "/models/Projet_structure.ifc", label: "Maquette STR", color: "#c9d1d9", shown: true },
    { id: "toit", src: "/models/Toit_Metal_2.ifc", label: "Maquette TOITURE", color: "#e8935c", colorize: [0.91, 0.58, 0.36], shown: true },
    // Test de conversion IFC -> XKT (cf CDC section 4, item Maquettes) : Projet_Archi.ifc
    // (27 Mo) converti via @xeokit/xeokit-convert en Maquette_CEA.xkt (8.6 Mo), pour
    // comparer le temps de chargement au rechargement face aux 2 IFC bruts ci-dessus.
    { id: "cea", src: "/models/Maquette_CEA.xkt", label: "Maquette CEA", color: "#a371f7", format: "xkt", shown: true }
  ],
  [HOSPITAL_PROJECT_KEY]: [
    { id: "hosp-arch", src: "/models/hospital/architecture.xkt", label: "Architecture", color: "#c9d1d9", format: "xkt", shown: true },
    { id: "hosp-mep", src: "/models/hospital/mechanical.xkt", label: "Mechanical (CVC)", color: "#e8935c", colorize: [0.91, 0.58, 0.36], format: "xkt", shown: true },
    // Disciplines ajoutees le 19/10 (jeu de test West Riverside, Autodesk,
    // depot public xeokit-bim-viewer). XKT d'une version de format plus
    // ancienne (V2) : geometrie seule, metadonnees dans le JSON associe
    // (metaSrc -> metaModelSrc du XKTLoaderPlugin).
    { id: "hosp-struct", src: "/models/hospital/structure.xkt", metaSrc: "/models/hospital/structure.json", label: "Structure", color: "#58a6ff", colorize: [0.35, 0.65, 1], format: "xkt", shown: true },
    { id: "hosp-elec", src: "/models/hospital/electrical.xkt", metaSrc: "/models/hospital/electrical.json", label: "Électricité", color: "#e3b341", colorize: [0.89, 0.70, 0.25], format: "xkt", shown: true },
    { id: "hosp-alarm", src: "/models/hospital/fireAlarms.xkt", metaSrc: "/models/hospital/fireAlarms.json", label: "Alarme incendie", color: "#f85149", colorize: [0.97, 0.32, 0.29], format: "xkt", shown: true },
    { id: "hosp-plomb", src: "/models/hospital/plumbing.xkt", metaSrc: "/models/hospital/plumbing.json", label: "Plomberie", color: "#3fb950", colorize: [0.25, 0.73, 0.31], format: "xkt", shown: true },
    { id: "hosp-spr", src: "/models/hospital/sprinklers.xkt", metaSrc: "/models/hospital/sprinklers.json", label: "Sprinklers", color: "#39c5cf", colorize: [0.22, 0.77, 0.81], format: "xkt", shown: true }
  ].filter((m) => !(MASQUE_MAQUETTES_LOURDES && MAQUETTES_LOURDES_IDS.includes(m.id))).map((m) => {
    if (HOPITAL_STRUCTURE_V12 && m.id === "hosp-struct") {
      const copie = Object.assign({}, m, { src: "/models/hospital/structure-v12.xkt" });
      delete copie.metaSrc;
      return copie;
    }
    return m;
  }).map((m) => {
    if (!HOPITAL_V12_LEGER) return m;
    if (m.id === "hosp-arch" || m.id === "hosp-mep") {
      const copie = Object.assign({}, m, { src: m.id === "hosp-arch" ? "/models/hospital/v12/architecture.xkt" : "/models/hospital/v12/mechanical.xkt" });
      delete copie.metaSrc;
      return copie;
    }
    return m;
  }).map((m) => {
    if (!HOPITAL_MAQUETTES_LEGERES) return m;
    if (m.id === "hosp-arch") return Object.assign({}, m, { src: "/models/hospital/legere/architectural.xkt", metaSrc: "/models/hospital/legere/architectural.json" });
    if (m.id === "hosp-mep") return Object.assign({}, m, { src: "/models/hospital/legere/mechanical.xkt", metaSrc: "/models/hospital/legere/mechanical.json" });
    return m;
  })
};

const MAQUETTES = [];

// Detections + clashs : sortie brute d'un vrai run IfcClash (mode
// "collision", cf tools/clash-test/run_clash.py) sur Projet_structure.ifc
// vs Toit_Metal_2.ifc, rien retouche/invente a la main (11/09, porte depuis
// IES/Chantier ou le meme run a ete fait le 10/09 sur les memes maquettes).
// Chaque entree correspond a un resultat exact du fichier tools/clash-test/
// clashes.json : entityIds = a_global_id/b_global_id, ifcPoint = milieu de
// p1/p2 (le point de contact reel calcule par IfcClash, repris tel quel,
// converti en repere Y-up seulement au moment de l'affichage, cf
// clashCenter/ifcPointToViewer), zone = a_name/b_name reformules en
// francais (contenu deja present dans le fichier, pas une invention),
// statut "nouveau" et auteur "Detection automatique" par defaut car
// IfcClash ne produit ni triage humain ni conversation, uniquement de la
// geometrie.
const DEMO_DETECTIONS = [
  { id: "structure-toiture", modeles: ["archi", "toit"], label: "Structure ↔ Toiture métallique" }
];

const DEMO_CLASHES = [
  {
    id: "clash-1",
    detectionId: "structure-toiture",
    zone: "Dalle béton 160mm ↔ Cornière CAE50x8 (#2409)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 60,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MU9f", "3SWCa1Nkb6shp6EZ_X2trE"],
    ifcPoint: [5.0267, 6.4626, 9.65],
    discussion: []
  },
  {
    id: "clash-2",
    detectionId: "structure-toiture",
    zone: "Dalle béton 160mm ↔ Cornière CAE50x8 (#2327)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 100,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MU9f", "3SWCa1Nkb6shp6EZ_X2tqm"],
    ifcPoint: [5.0576, 1.4626, 9.65],
    discussion: []
  },
  {
    id: "clash-3",
    detectionId: "structure-toiture",
    zone: "Dalle béton 160mm ↔ Cornière CAE50x8 (#2327)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 140,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MU9m", "3SWCa1Nkb6shp6EZ_X2tqm"],
    ifcPoint: [20.6066, 1.4642, 9.65],
    discussion: []
  },
  {
    id: "clash-4",
    detectionId: "structure-toiture",
    zone: "Dalle béton 160mm ↔ Cornière CAE50x8 (#2361)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 180,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MU9m", "3SWCa1Nkb6shp6EZ_X2tqU"],
    ifcPoint: [20.3259, -6.0804, 9.6366],
    discussion: []
  },
  {
    id: "clash-5",
    detectionId: "structure-toiture",
    zone: "Dalle béton 200mm ↔ Cornière CAE50x8 (#2361)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 220,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MU87", "3SWCa1Nkb6shp6EZ_X2tqU"],
    ifcPoint: [20.304, -6.0585, 9.637],
    discussion: []
  },
  {
    id: "clash-6",
    detectionId: "structure-toiture",
    zone: "Voile béton BA16 ↔ Poutrelle IPE80 (#2449)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 260,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MR78", "3SWCa1Nkb6shp6EZ_X2tss"],
    ifcPoint: [6.6909, 9.9855, 10.1142],
    discussion: [],
    assignedTo: "Bureau d'études"
  },
  {
    id: "clash-7",
    detectionId: "structure-toiture",
    zone: "Voile béton BA16 ↔ Poutrelle IPE80 (#2443)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 300,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MR78", "3SWCa1Nkb6shp6EZ_X2tsi"],
    ifcPoint: [15.7545, 9.9387, 10.8167],
    discussion: []
  },
  {
    id: "clash-8",
    detectionId: "structure-toiture",
    zone: "Voile béton BA16 ↔ Poutrelle IPE80 (#2441)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 340,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MR78", "3SWCa1Nkb6shp6EZ_X2tsk"],
    ifcPoint: [12.7842, 9.9055, 11.4448],
    discussion: []
  },
  {
    id: "clash-9",
    detectionId: "structure-toiture",
    zone: "Voile béton BA16 ↔ Poutrelle IPE80 (#2453)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 20,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MR78", "3SWCa1Nkb6shp6EZ_X2tso"],
    ifcPoint: [18.7882, 9.9855, 10.1163],
    discussion: []
  },
  {
    id: "clash-10",
    detectionId: "structure-toiture",
    zone: "Voile béton BA16 ↔ Poutrelle IPE80 (#2447)",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "À qualifier",
    statut: "nouveau",
    angle: 80,
    auteur: "Détection automatique (IfcClash)",
    tagged: [],
    entityIds: ["0w5mREx295pe_ygZN$MR78", "3SWCa1Nkb6shp6EZ_X2tse"],
    ifcPoint: [9.8756, 9.9772, 10.8494],
    discussion: []
  }
];

const STATUT_LABELS = { nouveau: "Nouveau", confirme: "Confirmé", ecarte: "Écarté" };
if (COLLISION_PRIORITES) STATUT_LABELS.resolu = "Résolu";

// ---- COLLISION_PRIORITES : priorites, historique, persistance ----
const PRIORITE_ORDRE = ["urgente", "haute", "normale", "basse"];
const PRIORITE_LABELS = { urgente: "Urgente", haute: "Haute", normale: "Normale", basse: "Basse" };
const PRIORITE_DEFAUT = "normale";
const CLASH_UTILISATEUR_HISTORIQUE = "User 1";
const COLLISIONS_ETAT_CLE = "ouvra-collisions-etat";

function clashPriorite(clash) {
  return PRIORITE_ORDRE.includes(clash.priorite) ? clash.priorite : PRIORITE_DEFAUT;
}

function isHospitalClash(thread) {
  return COLLISION_PRIORITES && HOSPITAL_CLASHES.includes(thread);
}

// Lecture/ecriture tolerantes : localStorage peut etre absent ou refuser.
function lireEtatCollisions() {
  try {
    const raw = window.localStorage.getItem(COLLISIONS_ETAT_CLE);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

function sauverEtatCollisions() {
  try {
    const etat = {};
    HOSPITAL_CLASHES.forEach((c) => {
      etat[c.id] = { priorite: clashPriorite(c), statut: c.statut, historique: c.historique || [] };
    });
    window.localStorage.setItem(COLLISIONS_ETAT_CLE, JSON.stringify(etat));
  } catch (e) {
    /* pas de persistance : l'app continue sans */
  }
}

// Recouvre les valeurs d'origine de l'hopital par l'etat sauvegarde.
function restaurerEtatCollisions() {
  if (!COLLISION_PRIORITES) return;
  const etat = lireEtatCollisions();
  HOSPITAL_CLASHES.forEach((c) => {
    const e = etat[c.id];
    if (!e || typeof e !== "object") return;
    if (PRIORITE_ORDRE.includes(e.priorite)) c.priorite = e.priorite;
    if (typeof e.statut === "string" && STATUT_LABELS[e.statut]) c.statut = e.statut;
    if (Array.isArray(e.historique)) c.historique = e.historique.filter((h) => h && typeof h === "object");
  });
}
restaurerEtatCollisions();

// currentDiscussionThread est declare plus bas (let) : lecture protegee.
function filActifSur() {
  try { return currentDiscussionThread; } catch (e) { return null; }
}

function formatHistoriqueDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

// Utilisateur courant simule (pas de vraie auth dans ce POC, cf MOC-chantier.md).
const CURRENT_USER = "Vous";

// Fils de discussion generaux (pas rattaches a un clash), meme mecanisme que
// la discussion Collision : fil de messages epingle a un point de la
// maquette, avec createur + personnes taggees (cibleIntervenantId/
// cibleGroupeId dans le CDC). disc-3 n'implique pas l'utilisateur courant,
// pour demontrer que le filtre par defaut l'exclut bien.
// "maquettes" fige quelles maquettes etaient actives au moment simule de la
// creation du fil (Maquette CEA n'existant pas encore a cette epoque
// fictive, elle est toujours masquee ici).
const DEMO_DISCUSSIONS = [
  {
    id: "disc-1",
    zone: "Niveau 1, entrée principale",
    auteur: "Vous",
    tagged: ["Julie Martin (BE Structure)"],
    open: true,
    maquettes: [{ id: "archi", visible: true }, { id: "toit", visible: false }, { id: "cea", visible: false }],
    discussion: [
      { auteur: "Vous", texte: "Le passage de gaine ici est bien validé avec le BE ?" },
      { auteur: "Julie Martin (BE Structure)", texte: "Oui, validé la semaine dernière." }
    ]
  },
  {
    id: "disc-2",
    zone: "Niveau 2, local technique",
    auteur: "Sofia Benali (Coordination BIM)",
    tagged: ["Vous"],
    open: true,
    maquettes: [{ id: "archi", visible: true }, { id: "toit", visible: false }, { id: "cea", visible: false }],
    discussion: [
      { auteur: "Sofia Benali (Coordination BIM)", texte: "Peux-tu confirmer l'emplacement du tableau électrique sur ce niveau ?" }
    ],
    assignedTo: "Bureau d'études"
  },
  {
    id: "disc-3",
    zone: "Toiture, zone sud",
    auteur: "Karim Haddad (Charpente)",
    tagged: ["Julie Martin (BE Structure)"],
    open: false,
    maquettes: [{ id: "archi", visible: true }, { id: "toit", visible: true }, { id: "cea", visible: false }],
    discussion: [
      { auteur: "Karim Haddad (Charpente)", texte: "Point réglé lors de la réunion de chantier." }
    ]
  },
  {
    id: "disc-4",
    zone: "Niveau R+2, lits",
    auteur: "Vous",
    tagged: ["Léa Fontaine (BE Architecture)"],
    open: true,
    maquettes: [{ id: "archi", visible: false }, { id: "toit", visible: false }, { id: "cea", visible: true }],
    niveaux: [
      { name: "Soubassement", checked: false },
      { name: "R+0", checked: false },
      { name: "R+1", checked: false },
      { name: "R+2", checked: true },
      { name: "R+3", checked: false }
    ],
    discussion: [
      { auteur: "Vous", texte: "Les lits apparaissent ici, au R+2, mais ne devraient pas y être : ils sont rattachés au mauvais niveau dans la maquette. Peux-tu corriger le rattachement dans le modèle source ?" }
    ],
    assignedTo: "Bureau d'études"
  },
  // Instructions BE -> Projeteur (portees depuis IES le 16/09) : issues de
  // fils/clashs existants (sourceThreadId conserve le lien vers le fil
  // d'origine, meme mecanisme que createInstructionBtn), pour peupler
  // l'onglet Todo du Projeteur au chargement plutot que de dependre d'une
  // creation manuelle en session.
  {
    id: "disc-5",
    zone: "Niveau R+2, lits",
    auteur: "Vous (Bureau d'études)",
    tagged: ["Projeteur"],
    open: true,
    isInstruction: true,
    sourceThreadId: "disc-4",
    maquettes: [{ id: "archi", visible: false }, { id: "toit", visible: false }, { id: "cea", visible: true }],
    niveaux: [
      { name: "Soubassement", checked: false },
      { name: "R+0", checked: false },
      { name: "R+1", checked: false },
      { name: "R+2", checked: true },
      { name: "R+3", checked: false }
    ],
    discussion: [{ auteur: "Vous (Bureau d'études)", texte: "Instruction issue du fil « Niveau R+2, lits » : à traiter." }]
  },
  {
    id: "disc-6",
    zone: "Niveau 2, local technique",
    auteur: "Vous (Bureau d'études)",
    tagged: ["Projeteur"],
    open: true,
    isInstruction: true,
    sourceThreadId: "disc-2",
    maquettes: [{ id: "archi", visible: true }, { id: "toit", visible: false }, { id: "cea", visible: false }],
    discussion: [{ auteur: "Vous (Bureau d'études)", texte: "Instruction issue du fil « Niveau 2, local technique » : à traiter." }]
  },
  {
    id: "disc-7",
    zone: "Voile béton BA16 ↔ Poutrelle IPE80 (#2449)",
    auteur: "Vous (Bureau d'études)",
    tagged: ["Projeteur"],
    open: true,
    isInstruction: true,
    sourceThreadId: "clash-6",
    maquettes: [{ id: "archi", visible: false }, { id: "toit", visible: true }, { id: "cea", visible: false }],
    discussion: [{ auteur: "Vous (Bureau d'études)", texte: "Instruction issue du fil « Voile béton BA16 ↔ Poutrelle IPE80 (#2449) » : à traiter." }]
  }
];

// Donnees actives (19/10) : DEMO_DETECTIONS/DEMO_CLASHES/DEMO_DISCUSSIONS
// ci-dessus sont les donnees du seul projet de demo (ids de maquettes archi,
// toit, cea). Les tableaux DETECTIONS/CLASHES/DISCUSSIONS utilises partout
// dans le fichier sont les tableaux de travail du projet courant : remplis
// avec les donnees de demo (memes objets, donc les reponses postees restent
// partagees) uniquement sur le projet de demo, vides sur les autres projets
// (hopital : Collision et Discussions fonctionnent sans donnees).
const DETECTIONS = [];
const CLASHES = [];
const DISCUSSIONS = [];

function applyProjectData(projectKey) {
  DETECTIONS.length = 0;
  CLASHES.length = 0;
  DISCUSSIONS.length = 0;
  if (projectKey === DEMO_PROJECT_KEY) {
    DETECTIONS.push(...DEMO_DETECTIONS);
    CLASHES.push(...DEMO_CLASHES);
    DISCUSSIONS.push(...DEMO_DISCUSSIONS);
  } else if (COLLISIONS_HOPITAL_ECHANTILLON && projectKey === HOSPITAL_PROJECT_KEY) {
    // Echantillon hopital : detections et clashs seulement. DISCUSSIONS reste
    // vide, et les clashs n'y sont jamais ajoutes (renderDiscussionsPage ne
    // lit que DISCUSSIONS), donc la page Discussions n'est pas affectee.
    DETECTIONS.push(...HOSPITAL_DETECTIONS);
    CLASHES.push(...HOSPITAL_CLASHES.filter((c) => !(HOPITAL_MAQUETTES_LEGERES && HOPITAL_CLASHES_ABSENTS_LEGERES.has(c.id))));
  }
}
applyProjectData(projectSelect.value);

// Pas de vrai annuaire de contacts pour ce POC : liste fixe des personnes
// deja utilisees dans les fils simules.
const KNOWN_PEOPLE = ["Julie Martin (BE Structure)", "Karim Haddad (Charpente)", "Sofia Benali (Coordination BIM)", "Léa Fontaine (BE Architecture)"];

// Un clash EST un fil de discussion (meme mecanisme), pas une copie : on
// garde les references reelles vers CLASHES/DISCUSSIONS pour qu'une reponse
// postee ici reste visible depuis la page Collision, et inversement.
function threadType(thread) {
  return CLASHES.includes(thread) ? "collision" : "discussion";
}

function renderDiscussionsPage() {
  // Clashs retires de cette liste (portee depuis IES le 16/09, demande
  // explicite de Gilles) : seules les vraies discussions y apparaissent,
  // CLASHES volontairement absent de la concatenation ci-dessous (restent
  // consultables via l'onglet Collision). Filtre Tout/Collision/Discussion
  // retire au meme moment (plus d'utilite sans les clashs ici).
  // "mes fils" (cree par moi ou j'y suis tagge) reste le seul filtre.
  const threads = [...DISCUSSIONS]
    .filter((t) => threadType(t) === "collision" || t.auteur === CURRENT_USER || (t.tagged || []).includes(CURRENT_USER));

  discussionsThreadsList.innerHTML = "";
  discussionsThreadsEmpty.hidden = threads.length > 0;

  threads.forEach((thread) => {
    const type = threadType(thread);

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thread-item";
    btn.addEventListener("click", () => openThreadDetail(thread));

    const main = document.createElement("div");
    main.className = "thread-main";
    const titre = document.createElement("span");
    titre.textContent = thread.zone;
    const meta = document.createElement("span");
    meta.className = "thread-meta";
    meta.textContent = "Créé par " + thread.auteur + " · " + thread.discussion.length + " message" + (thread.discussion.length > 1 ? "s" : "");
    main.append(titre, meta);

    // Visible par le Responsable Synthese sans ouvrir le fil (porte depuis
    // IES le 16/09).
    if (thread.assignedTo) {
      const assignedTag = document.createElement("span");
      assignedTag.className = "thread-assigned-tag";
      assignedTag.textContent = "Pris en charge par " + thread.assignedTo;
      main.appendChild(assignedTag);
    }

    const badge = document.createElement("span");
    badge.className = "thread-type-badge " + type;
    badge.textContent = type === "collision" ? "Collision" : "Discussion";

    btn.append(main, badge);
    li.appendChild(btn);
    discussionsThreadsList.appendChild(li);
  });
}

// Vue Todo (persona Projeteur, porte depuis IES le 16/09) : memes fils que
// DISCUSSIONS, filtres sur les instructions creees par le BE et taguees
// "Projeteur" (cf createInstructionBtn). Meme rendu de ligne (.thread-item/
// .thread-main/.thread-meta) que renderDiscussionsPage, mais liste et
// filtre distincts : le Projeteur ne doit voir ici que ce qui lui a ete
// assigne, pas tous ses fils comme dans l'onglet Discussions.
function renderProjeteurList() {
  const threads = DISCUSSIONS.filter((t) => t.isInstruction && (t.tagged || []).includes("Projeteur"));

  projeteurThreadsList.innerHTML = "";
  projeteurThreadsEmpty.hidden = threads.length > 0;

  threads.forEach((thread) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thread-item";
    btn.addEventListener("click", () => openThreadDetail(thread, "projeteur"));

    const main = document.createElement("div");
    main.className = "thread-main";
    const titre = document.createElement("span");
    titre.textContent = thread.zone;
    const meta = document.createElement("span");
    meta.className = "thread-meta";
    meta.textContent = "Instruction de " + thread.auteur;
    main.append(titre, meta);

    const badge = document.createElement("span");
    badge.className = "thread-type-badge discussion";
    badge.textContent = isThreadOpen(thread) ? "À traiter" : "Traité";

    btn.append(main, badge);
    li.appendChild(btn);
    projeteurThreadsList.appendChild(li);
  });
}

function setThreadVisualMode(mode, thread) {
  threadToggleBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));

  if (mode === "avant") {
    threadSnapshotPane.hidden = false;
    threadViewerPane.hidden = true;
    return;
  }

  threadSnapshotPane.hidden = true;
  threadViewerPane.hidden = false;
  threadViewerPane.appendChild(viewerWrap);
  // Vue non actionnable, seule la rotation/le recentrage sont permis :
  // ni "Nouvelle discussion" (on est deja dans une discussion), ni les
  // boutons de coupe (le plan de coupe reste specifique a l'onglet Viewer).
  newDiscussionBtn.hidden = true;
  coupeToolbar.hidden = true;
  window.dispatchEvent(new Event("resize"));

  const goToThreadView = () => {
    if (threadType(thread) === "collision") {
      // Pas de snapshot par clash : la visibilite se deduit des maquettes de
      // la detection a laquelle il appartient (meme regle que dans l'onglet
      // Collision, ex. Maquette CEA masquee hors sujet).
      const detection = DETECTIONS.find((d) => d.id === thread.detectionId);
      if (detection) {
        MAQUETTES.forEach((m) => { m.shown = detection.modeles.includes(m.id); });
        applyVisibility();
        renderMaquetteRows(maquettesList, MAQUETTES);
      }
      flyToClash(thread);
    } else {
      // "thread.maquettes" fige quelles maquettes etaient actives a la
      // creation du fil (captureViewerState pour un vrai fil cree depuis le
      // Viewer, ou fige a la main pour les fils de demo simules).
      if (thread.maquettes) {
        restoreViewerState(thread);
      }
      if (thread.camera) {
        viewer.cameraFlight.flyTo({ eye: thread.camera.eye, look: thread.camera.look, up: thread.camera.up, duration: 1 });
      } else {
        // Sans camera capturee, cadrer sur la scene entiere (viewer.scene)
        // zoome bien trop large des qu'un filtre maquette/niveau ne montre
        // qu'une petite partie du batiment (ex. juste le Niveau R+2) : on
        // cadre plutot sur ce qui est reellement visible a ce moment-la.
        // fitFOV plus grand que le defaut (45) : l'objet remplit une plus
        // grande part du champ de vision a l'arrivee, donc la camera se
        // rapproche davantage.
        viewer.cameraFlight.flyTo({ aabb: viewer.scene.getAABB(viewer.scene.visibleObjectIds), fitFOV: 70 });
      }
    }
  };
  goToThreadView();
  recenterTarget = goToThreadView;
}

threadToggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => setThreadVisualMode(btn.dataset.mode, currentThread));
});

let currentThread = null;
// Onglet a rouvrir au clic sur "← Discussions" (discussionsBackBtn, porte
// depuis IES le 16/09) : le detail d'un fil est un DOM partage
// (discussionsDetailPane, a l'interieur de view-discussions), reutilise tel
// quel pour la vue Todo plutot que duplique (memes toggles avant/apres,
// meme viewer). "discussions" par defaut ; "projeteur" quand le fil est
// ouvert depuis renderProjeteurList.
let discussionsReturnView = "discussions";

function openThreadDetail(thread, returnView) {
  discussionsReturnView = returnView || "discussions";
  // discussionsDetailPane vit dans view-discussions : la basculer visible
  // avant de l'utiliser, meme quand on vient de la vue Todo.
  activateView("discussions");
  discussionsListPane.hidden = true;
  discussionsDetailPane.hidden = false;
  currentThread = thread;
  setThreadVisualMode("apres", thread);

  // Bloc discussion partage avec Collision (cf showThreadDiscussion) :
  // deplace ici avant d'etre rempli, au cas ou il etait reste dans
  // #collisionLeft depuis la derniere detection consultee.
  discussionsDetailPane.appendChild(collisionDiscussion);
  // Dans un fil de Discussions, la zone de commentaires est le contenu principal : toujours depliee.
  collisionDiscussion.classList.remove("collapsed");
  showThreadDiscussion(thread);

  // Hash specifique au fil (#discussions/<id>) pour qu'un rechargement de
  // page reste sur ce fil precis, pas juste sur l'onglet Discussions.
  if (history.replaceState) {
    history.replaceState(null, "", "#discussions/" + thread.id);
  }
}

discussionsBackBtn.addEventListener("click", () => {
  discussionsDetailPane.hidden = true;
  discussionsListPane.hidden = false;
  recenterTarget = null;
  restoreAllModelsVisible();

  // Retour vers la vue Todo (porte depuis IES le 16/09) si le fil a ete
  // ouvert depuis elle, plutot que de retomber systematiquement sur la
  // liste Discussions.
  const returnView = discussionsReturnView;
  discussionsReturnView = "discussions";
  if (returnView === "projeteur") {
    activateView("projeteur");
    renderProjeteurList();
  } else {
    renderDiscussionsPage();
    if (history.replaceState) {
      history.replaceState(null, "", "#discussions");
    }
  }
});

renderDiscussionsPage();
renderProjeteurList();

// Creation d'un nouveau fil depuis le Viewer, a partir du point de vue et de
// l'etat (niveaux/maquettes affiches) mis en place par l'utilisateur.
function captureViewerState() {
  return {
    camera: {
      eye: viewer.camera.eye.slice(),
      look: viewer.camera.look.slice(),
      up: viewer.camera.up.slice()
    },
    niveaux: niveauxState.map((n) => ({ name: n.name, checked: n.checked })),
    maquettes: MAQUETTES.map((m) => ({ id: m.id, visible: m.shown })),
    coupe: activeCoupeId ? capturedCoupeState() : null
  };
}

function capturedCoupeState() {
  const sectionPlane = viewer.scene.sectionPlanes[activeCoupeId];
  return {
    pos: sectionPlane.pos.slice(),
    dir: sectionPlane.dir.slice(),
    active: sectionPlane.active
  };
}

// Restaure tout ou partie d'un snapshot (capture complete via
// captureViewerState, ou juste "maquettes" pour un fil qui ne fige que
// la visibilite sans camera/niveaux/coupe, ex. les fils de demo simules).
function restoreViewerState(snapshot) {
  (snapshot.maquettes || []).forEach(({ id, visible }) => {
    const maquette = MAQUETTES.find((m) => m.id === id);
    if (maquette) maquette.shown = visible;
  });
  (snapshot.niveaux || []).forEach(({ name, checked }) => {
    const niveau = niveauxState.find((n) => n.name === name);
    if (niveau) {
      niveau.checked = checked;
      niveau.checkboxEl.checked = checked;
    }
  });
  applyVisibility();
  renderMaquetteRows(maquettesList, MAQUETTES);

  destroyActiveCoupe();
  if (snapshot.coupe) {
    activeCoupeId = "coupe-surface";
    sectionPlanes.createSectionPlane({ id: activeCoupeId, pos: snapshot.coupe.pos, dir: snapshot.coupe.dir });
    viewer.scene.sectionPlanes[activeCoupeId].active = snapshot.coupe.active;
    orienterPlanDeCoupe(viewer.scene.sectionPlanes[activeCoupeId]);
    ecouterPositionCoupe(viewer.scene.sectionPlanes[activeCoupeId]);
    sectionPlanes.showControl(activeCoupeId);
    coupeBtn.textContent = "Désactiver la coupe";
    coupeBtn.classList.add("active");
    coupeToggleVisibilityBtn.hidden = false;
    coupeToggleVisibilityBtn.textContent = "Masquer le plan de coupe";
    coupeInvertBtn.hidden = false;
    majCoupeSlider();
  }
}

// Repasse toutes les maquettes visibles, quel que soit ce qui les a masquees
// (une detection ou un fil de discussion). Appelee au clic de navbar et aux
// boutons "retour" des detections/fils, jamais depuis un point du script qui
// s'execute avant que MAQUETTES ne soit initialisee plus bas.
function restoreAllModelsVisible() {
  if (collisionContexteOn || collisionActiveClash || collisionOpacityTouched.length > 0) resetCollisionOpacityState();
  MAQUETTES.forEach((m) => { m.shown = true; });
  applyVisibility();
  renderMaquetteRows(maquettesList, MAQUETTES);
}

let pendingSnapshot = null;

newDiscussionRecipients.innerHTML = "";
KNOWN_PEOPLE.forEach((person) => {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = person;
  label.append(checkbox, document.createTextNode(person));
  newDiscussionRecipients.appendChild(label);
});

newDiscussionBtn.addEventListener("click", () => {
  closeFicheSheet();
  pendingSnapshot = captureViewerState();
  newDiscussionForm.reset();
  newDiscussionModalOverlay.hidden = false;
});

function closeNewDiscussionModal() {
  newDiscussionModalOverlay.hidden = true;
  pendingSnapshot = null;
}
newDiscussionClose.addEventListener("click", closeNewDiscussionModal);
newDiscussionModalOverlay.addEventListener("click", (e) => {
  if (e.target === newDiscussionModalOverlay) closeNewDiscussionModal();
});

newDiscussionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!pendingSnapshot) return;

  const tagged = Array.from(newDiscussionRecipients.querySelectorAll("input:checked")).map((el) => el.value);

  const thread = {
    id: "disc-" + Date.now(),
    zone: newDiscussionZone.value.trim(),
    auteur: CURRENT_USER,
    tagged,
    open: true,
    camera: pendingSnapshot.camera,
    niveaux: pendingSnapshot.niveaux,
    maquettes: pendingSnapshot.maquettes,
    coupe: pendingSnapshot.coupe,
    discussion: [{ auteur: CURRENT_USER, texte: newDiscussionComment.value.trim() }]
  };
  DISCUSSIONS.push(thread);

  closeNewDiscussionModal();
  activateView("discussions");
  renderDiscussionsPage();
  openThreadDetail(thread);
});

// Lien direct vers un fil precis (#discussions/<id>), rechargement de page
// inclus : prime sur le simple onglet "discussions" du hash.
{
  const hashParts = initialHash.replace("#", "").split("/");
  if (hashParts[0] === "discussions" && hashParts[1]) {
    const targetThread = [...CLASHES, ...DISCUSSIONS].find((t) => t.id === hashParts[1]);
    if (targetThread) {
      openThreadDetail(targetThread);
    }
  }
}

function renderDetections() {
  detectionsList.innerHTML = "";
  if (DETECTIONS.length === 0) {
    detectionsEmpty.hidden = false;
    return;
  }
  detectionsEmpty.hidden = true;

  DETECTIONS.forEach((detection) => {
    const count = CLASHES.filter((c) => c.detectionId === detection.id).length;

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "detection-item";
    btn.addEventListener("click", () => openDetection(detection));

    const label = document.createElement("span");
    label.textContent = detection.label;

    const badge = document.createElement("span");
    badge.className = "detection-count";
    badge.textContent = count + (count > 1 ? " clashs" : " clash");

    btn.append(label, badge);
    li.appendChild(btn);
    detectionsList.appendChild(li);
  });
}

// Une seule paire de maquettes (donc une seule detection) : la vue
// recapitulative n'a rien a recapituler, la page Collision s'ouvre
// directement sur la liste. Avec plusieurs detections, rien ne change
// (vue recapitulative + bouton "← Interactions").
function openSoleDetectionIfAlone() {
  if (DETECTIONS.length === 1 && collisionDetail.hidden) openDetection(DETECTIONS[0]);
}

function openDetection(detection) {
  collisionRecap.hidden = true;
  collisionDetail.hidden = false;
  collisionBackBtn.hidden = DETECTIONS.length < 2;
  fermerEchangesGrand(false);

  collisionViewerSlot.appendChild(viewerWrap);
  collisionLeft.appendChild(collisionDiscussion);
  // Zone de commentaires reduite par defaut a l'entree dans la page Collision
  // (19/10, demande de Gilles) : seul le bandeau titre est visible, le bouton
  // existant la deplie ; l'etat n'est pas reinitialise entre deux collisions.
  collisionDiscussion.classList.add("collapsed");
  setCollisionPanelCollapsed(false);
  // A l'entree dans la page Collision, le contexte repart sur "Isole".
  collisionContexteNiveau = "isole";
  // Meme logique que dans un fil de discussion : ici on ne fait que
  // consulter une collision, pas de "Nouvelle discussion" ni de coupe.
  newDiscussionBtn.hidden = true;
  coupeToolbar.hidden = true;
  window.dispatchEvent(new Event("resize"));

  // Ouvert par defaut (sans effet visuel sur desktop, le panneau y est deja
  // toujours visible) : sur mobile, arriver ici doit montrer tout de suite
  // la liste des collisions a selectionner, pas un canvas vide avec un
  // bouton "Infos" a chercher.
  // Mobile (<= 768 px) : tiroir ferme par defaut pour ne pas masquer la 3D
  // (decision du 19/10). Ordinateur : le panneau est un volet fixe, toujours ouvert.
  const collisionMobile = window.matchMedia("(max-width: 768px)").matches;
  collisionInfoPanel.classList.toggle("open", !collisionMobile);
  collisionInfoPanelBackdrop.hidden = true;

  // Ne montre que les maquettes de cette detection (ex. Maquette CEA hors
  // sujet d'une comparaison structure/toiture, masquee ici) : avant le rendu
  // des cases a cocher, pour qu'elles refletent l'etat a jour des l'entree.
  const subset = MAQUETTES.filter((m) => detection.modeles.includes(m.id));
  // Nouvelle detection : fantome du contexte et transparence repartent de zero.
  if (collisionContexteOn || collisionActiveClash || collisionOpacityTouched.length > 0) resetCollisionOpacityState();
  MAQUETTES.forEach((m) => { m.shown = detection.modeles.includes(m.id); });
  applyVisibility();
  renderMaquetteRows(collisionMaquettesList, subset);
  renderCollisionMaquetteToggles(subset);

  const detectionClashes = CLASHES.filter((c) => c.detectionId === detection.id);
  renderCollisionsList(detectionClashes);
  renderClashMarkers(detectionClashes);
  clearClashElementColors();
  deselectEntity();

  collisionDiscussion.hidden = true;
  discussionMessages.innerHTML = "";
  discussionReplyForm.hidden = true;
  currentDiscussionThread = null;
  recenterTarget = null;
}

// Boutons a bascule de la page Collision (19/10) : meme effet que la case de
// la liste (maquette.shown + applyVisibility). Etat relu a chaque
// applyVisibility() (refreshCollisionMaquetteToggles), donc synchrone avec la liste.
const COLLISION_TOGGLE_LABELS = { "hosp-arch": "Architecture", "hosp-mep": "Mécanique" };
let collisionToggleEntries = [];
function renderCollisionMaquetteToggles(subset) {
  if (!collisionMaquetteToggles) return;
  collisionMaquetteToggles.innerHTML = "";
  collisionToggleEntries = subset.map((maquette) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collision-maquette-toggle";
    const dot = document.createElement("span");
    dot.className = "collision-maquette-toggle-dot";
    dot.style.background = maquette.color;
    const text = document.createElement("span");
    text.textContent = COLLISION_TOGGLE_LABELS[maquette.id] || maquette.label;
    btn.append(dot, text);
    btn.addEventListener("click", () => {
      maquette.shown = !maquette.shown;
      applyVisibility();
      renderMaquetteRows(collisionMaquettesList, subset);
    });
    collisionMaquetteToggles.appendChild(btn);
    return { maquette, btn };
  });

  // Bouton "Contexte" : maquettes chargees hors paire (Structure, Electricite).
  collisionGhostMaquettes = (COLLISION_CONTEXTE || COLLISION_CONTEXTE_NIVEAUX) ? MAQUETTES.filter((m) => !subset.includes(m)) : [];
  collisionSubsetMaquettes = subset;
  collisionContexteBtn = null;
  collisionNiveauBtns = [];
  if (collisionNiveauxActive() && collisionGhostMaquettes.length > 0) {
    const group = document.createElement("div");
    group.className = "collision-niveau-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Contexte autour du conflit");
    [["isole", "Isolé"], ["proche", "Proche"], ["etage", "Étage"]].forEach(([key, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "collision-niveau-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => setCollisionContexteNiveau(key));
      group.appendChild(btn);
      collisionNiveauBtns.push({ key, btn });
    });
    collisionMaquetteToggles.appendChild(group);
  } else if (collisionGhostMaquettes.length > 0) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collision-maquette-toggle collision-contexte-toggle";
    btn.textContent = "Contexte";
    btn.addEventListener("click", () => {
      setCollisionContexte(!collisionContexteOn);
    });
    collisionMaquetteToggles.appendChild(btn);
    collisionContexteBtn = btn;
  }
  refreshCollisionMaquetteToggles();
}
function refreshCollisionMaquetteToggles() {
  collisionToggleEntries.forEach(({ maquette, btn }) => {
    btn.setAttribute("aria-pressed", String(maquette.shown));
    btn.classList.toggle("off", !maquette.shown);
  });
  collisionNiveauBtns.forEach(({ key, btn }) => {
    btn.setAttribute("aria-pressed", String(key === collisionContexteNiveau));
  });
  if (collisionContexteBtn) {
    collisionContexteBtn.setAttribute("aria-pressed", String(collisionContexteOn));
    collisionContexteBtn.classList.toggle("off", !collisionContexteOn);
  }
}

// Type d'element en francais, deduit du nom Revit (liste des collisions,
// 19/10). Repli : premier segment du nom avant ":".
const COLLISION_TYPES_FR = [
  [/Curtain Wall/i, "Mur-rideau"],
  [/Basic Wall.*Partition/i, "Cloison"],
  [/Basic Wall|Wall/i, "Mur"],
  [/Ceiling/i, "Faux plafond"],
  [/Duct/i, "Gaine"],
  [/Pipe/i, "Tuyau"],
  [/Diffuser/i, "Diffuseur"],
  [/Grill/i, "Grille"],
  [/MedGas/i, "Prise gaz médicaux"],
  [/VAV/i, "Caisson VAV"],
  [/Takeoff/i, "Piquage"],
  [/Valve/i, "Vanne"],
  [/Solar Panel/i, "Panneau solaire"],
  [/Cooling Tower/i, "Tour de refroidissement"]
];
function collisionTypeFr(name) {
  const hit = COLLISION_TYPES_FR.find(([re]) => re.test(name));
  return hit ? hit[1] : name.split(":")[0].trim();
}

function buildCollisionItem(clash) {
  const li = document.createElement("li");
  li.className = "collision-item-row";

  // Affiche/masque le marqueur 3D de ce clash precisement, independamment
  // de la selection (bouton juste a cote) : utile pour ne garder visibles
  // que les zones qui interessent quand on est sur la maquette, sans
  // devoir passer par chaque clash un par un dans la vue 3D.
  let markerShown = true;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "collision-marker-toggle";
  toggle.innerHTML = EYE_OPEN_ICON;
  toggle.title = "Masquer cette zone dans la maquette";
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    markerShown = !markerShown;
    toggle.innerHTML = markerShown ? EYE_OPEN_ICON : EYE_CLOSED_ICON;
    toggle.title = markerShown ? "Masquer cette zone dans la maquette" : "Afficher cette zone dans la maquette";
    const marker = clashMarkers.get(clash.id);
    if (marker) marker.visible = markerShown;
    setClashPastilleShown(clash.id, markerShown);
  });

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "collision-item";
  btn.dataset.clashId = clash.id;
  btn.addEventListener("click", () => activateClash(clash));

  // Numero stable (position dans la liste complete, independante du groupe
  // "Ecartes") pour que Gilles puisse donner des retours par collision (19/10).
  const numero = document.createElement("span");
  numero.className = "collision-numero";
  numero.textContent = "n° " + (CLASHES.indexOf(clash) + 1);

  const zone = document.createElement("span");
  zone.className = "collision-zone";
  zone.textContent = clash.zone;

  const meta = document.createElement("span");
  meta.className = "collision-meta";
  const badge = document.createElement("span");
  badge.className = "status-badge " + clash.statut;
  badge.textContent = STATUT_LABELS[clash.statut] || clash.statut;
  const disciplines = document.createElement("span");
  disciplines.textContent = clash.disciplineA + " / " + clash.disciplineB;
  meta.append(badge, disciplines);

  // Liste simplifiee : "#id element A ↔ #id element B" et le niveau ; le nom
  // complet reste en infobulle (title) et dans la fiche Info selection.
  let carteMode = false;
  if (COLLISION_LISTE_SIMPLE) {
    const ids = (clash.zone.match(/\(#(\d+)\)/g) || []).map((m) => m.slice(1, -1));
    const levelMatch = clash.zone.match(/·\s*([^·]+)$/);
    if (ids.length === 2) {
      zone.textContent = ids[0] + " ↔ " + ids[1];
      btn.title = clash.zone;
      meta.textContent = "";
      const levelEl = document.createElement("span");
      levelEl.textContent = levelMatch ? levelMatch[1].trim() : "";
      meta.append(badge);
      if (levelEl.textContent) meta.append(levelEl);
      if (COLLISION_LISTE_CARTE) {
        // Carte a deux lignes (19/10) : pastille du numero, types en francais,
        // identifiants et niveau, point de statut ; liseré de couleur a gauche.
        const [partA, partB] = clash.zone.split(" ↔ ");
        const typeA = collisionTypeFr(partA || "");
        const typeB = collisionTypeFr((partB || "").split("·")[0]);
        const niveau = (levelMatch ? levelMatch[1].trim() : "").replace(/^Level\s*/i, "Niveau ");

        const badgeNum = document.createElement("span");
        badgeNum.className = "collision-num-badge";
        badgeNum.textContent = String(CLASHES.indexOf(clash) + 1);
        badgeNum.setAttribute("aria-hidden", "true");

        const types = document.createElement("span");
        types.className = "collision-types";
        types.textContent = typeA + " ↔ " + typeB;
        const sub = document.createElement("span");
        sub.className = "collision-sub";
        sub.textContent = ids[0] + " ↔ " + ids[1] + (niveau ? " · " + niveau : "");
        const text = document.createElement("span");
        text.className = "collision-card-text";
        text.append(types, sub);

        const dot = document.createElement("span");
        dot.className = "collision-statut-dot " + clash.statut;
        dot.title = STATUT_LABELS[clash.statut] || clash.statut;
        const dotLabel = document.createElement("span");
        dotLabel.className = "collision-statut-label";
        dotLabel.textContent = STATUT_LABELS[clash.statut] || clash.statut;
        const statut = document.createElement("span");
        statut.className = "collision-statut";
        statut.append(dot, dotLabel);

        btn.classList.add("collision-item-carte", clash.statut);
        btn.setAttribute("aria-label", "Collision n° " + (CLASHES.indexOf(clash) + 1) + " : " + typeA + " et " + typeB + ", " + (STATUT_LABELS[clash.statut] || clash.statut));
        btn.textContent = "";
        btn.append(badgeNum, text, statut);
        carteMode = true;
      }
    }
  }

  if (COLLISION_PRIORITES && carteMode) {
    // Liseré = priorite (le point de statut a droite garde la couleur du statut).
    const prio = clashPriorite(clash);
    btn.classList.add("prio-" + prio);
    btn.setAttribute("aria-label", btn.getAttribute("aria-label") + ", priorité " + PRIORITE_LABELS[prio].toLowerCase());
  }

  if (!carteMode) btn.append(numero, zone, meta);
  if (MASQUE_OEIL_COLLISION) li.append(btn);
  else li.append(toggle, btn);
  return li;
}

function renderCollisionsList(clashes) {
  // Re-rendu apres un changement : garde le defilement et l'etat ouvert des Ecartes.
  const scrollSaves = [];
  if (COLLISION_PRIORITES) {
    for (let el = collisionsList; el; el = el.parentElement) {
      if (el.scrollTop > 0) scrollSaves.push([el, el.scrollTop]);
    }
  }
  const ecartesOuverts = COLLISION_PRIORITES && !!collisionsList.querySelector("details.collision-ecartes[open]");
  collisionsList.innerHTML = "";

  // Titre de la liste (19/10) : la paire de maquettes et le nombre de
  // collisions, a la place du menu de choix de paire (une seule paire).
  const collisionListTitle = document.getElementById("collisionListTitle");
  if (collisionListTitle) {
    const detection = clashes.length ? DETECTIONS.find((d) => d.id === clashes[0].detectionId) : null;
    if (detection) {
      collisionListTitle.textContent = detection.label + " · " + clashes.length + (clashes.length > 1 ? " collisions" : " collision");
      collisionListTitle.hidden = false;
    } else {
      collisionListTitle.hidden = true;
    }
  }

  const actives = clashes.filter((c) => c.statut !== "ecarte");
  const ecartes = clashes.filter((c) => c.statut === "ecarte");

  if (COLLISION_PRIORITES) {
    PRIORITE_ORDRE.forEach((niveau) => {
      const groupe = actives.filter((c) => clashPriorite(c) === niveau);
      if (groupe.length === 0) return;
      const head = document.createElement("li");
      head.className = "collision-groupe-titre prio-" + niveau;
      const dot = document.createElement("span");
      dot.className = "collision-groupe-dot";
      dot.setAttribute("aria-hidden", "true");
      head.append(dot, document.createTextNode(PRIORITE_LABELS[niveau] + " (" + groupe.length + ")"));
      collisionsList.appendChild(head);
      groupe.forEach((clash) => collisionsList.appendChild(buildCollisionItem(clash)));
    });
  } else {
    actives.forEach((clash) => collisionsList.appendChild(buildCollisionItem(clash)));
  }

  if (ecartes.length > 0) {
    const wrapperLi = document.createElement("li");
    wrapperLi.className = "collision-ecartes-wrapper";

    const details = document.createElement("details");
    details.className = "collision-ecartes";
    const summary = document.createElement("summary");
    summary.textContent = "Écartés (" + ecartes.length + ")";
    details.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "info-list";
    ecartes.forEach((clash) => list.appendChild(buildCollisionItem(clash)));
    details.appendChild(list);

    wrapperLi.appendChild(details);
    collisionsList.appendChild(wrapperLi);
    if (COLLISION_PRIORITES && (ecartesOuverts || ecartes.includes(filActifSur()))) details.open = true;
  }

  if (COLLISION_PRIORITES) {
    const fil = filActifSur();
    if (fil && clashes.includes(fil)) {
      collisionsList.querySelectorAll(".collision-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.clashId === fil.id);
      });
    }
    scrollSaves.forEach(([el, top]) => { el.scrollTop = top; });
  }
}

// Le repli "milieu de la zone de chevauchement des AABB" (utilise avant le
// portage du 11/09) s'est revele faux pour des elements longs/diagonaux
// (ex. cornieres de toiture) : l'AABB d'une corniere en diagonale couvre
// une zone bien plus large que sa geometrie reelle, donc son chevauchement
// avec l'AABB d'une grande dalle n'a plus rien a voir avec le point de
// contact reel. Verifie dans le code source de xeokit (WebIFCLoaderPlugin.
// load, package @xeokit/xeokit-sdk) : les positions issues de web-ifc
// (GetVertexArray) sont copiees telles quelles dans le SceneModel, sans
// aucune rotation d'axe appliquee cote xeokit. Comme la maquette s'affiche
// bien debout (toiture en haut), la conversion Z-up (repere natif IFC,
// utilise par ifcopenshell/IfcClash) -> Y-up (convention du viewer) est
// necessairement faite par web-ifc lui-meme au moment de generer la
// geometrie. Conversion standard (rotation -90 deg autour de X) : x
// inchange, y_viewer = z_ifc, z_viewer = -y_ifc.
function ifcPointToViewer(p) {
  return [p[0], p[2], -p[1]];
}

function clashCenter(clash) {
  // Point p1/p2 reel calcule par IfcClash (clashes.json, moyenne stockee
  // dans clash.ifcPoint), converti dans le repere du viewer : le vrai point
  // de contact geometrique, quelle que soit la forme/longueur des 2
  // elements, contrairement a une approximation par boite englobante.
  if (clash.ifcPoint) {
    const converted = ifcPointToViewer(clash.ifcPoint);
    if (!COLLISION_POINT_VERIFIE) return converted;
    const checked = verifiedClashPoint(clash, converted);
    return checked;
  }
  // Repli si jamais un clash n'a pas de point IfcClash precalcule.
  const [aabbA, aabbB] = clash.entityIds.map((id) => viewer.scene.getAABB([id]));
  return [0, 1, 2].map((axis) => {
    const min = Math.max(aabbA[axis], aabbB[axis]);
    const max = Math.min(aabbA[axis + 3], aabbB[axis + 3]);
    return (min + max) / 2;
  });
}

// Verification du point de collision (19/10, retour de Gilles : sur l'hopital,
// la camera et la bulle de plusieurs collisions (n° 2, 3, 5, 9) etaient a un
// autre endroit que les 2 elements en conflit). Le point IFC converti doit
// tomber dans les boites englobantes des 2 elements (tolerance) ; sinon on
// prend le centre de leur chevauchement (ou, sans chevauchement, le milieu de
// leurs deux centres). Resultat mis en cache par collision une fois les 2
// elements charges ; avant leur chargement, le point converti est renvoye tel
// quel (non mis en cache).
const verifiedClashPoints = new Map();
function aabbValid(aabb) {
  return aabb && aabb.length === 6 && aabb.every((v) => Number.isFinite(v)) && aabb[0] <= aabb[3];
}
function pointInAabb(p, aabb, tol) {
  return [0, 1, 2].every((axis) => p[axis] >= aabb[axis] - tol && p[axis] <= aabb[axis + 3] + tol);
}
function verifiedClashPoint(clash, converted) {
  if (verifiedClashPoints.has(clash.id)) return verifiedClashPoints.get(clash.id);
  const loaded = clash.entityIds.every((id) => viewer.scene.objects[id]);
  if (!loaded) return converted;
  const [aabbA, aabbB] = clash.entityIds.map((id) => viewer.scene.getAABB([id]));
  if (!aabbValid(aabbA) || !aabbValid(aabbB)) return converted;
  let result = converted;
  if (!(pointInAabb(converted, aabbA, COLLISION_POINT_TOLERANCE) && pointInAabb(converted, aabbB, COLLISION_POINT_TOLERANCE))) {
    const overlap = [0, 1, 2].map((axis) => {
      const min = Math.max(aabbA[axis], aabbB[axis]);
      const max = Math.min(aabbA[axis + 3], aabbB[axis + 3]);
      return [min, max];
    });
    if (overlap.every(([min, max]) => min <= max)) {
      result = overlap.map(([min, max]) => (min + max) / 2);
    } else {
      result = [0, 1, 2].map((axis) => (aabbA[axis] + aabbA[axis + 3] + aabbB[axis] + aabbB[axis + 3]) / 4);
    }
    const dx = result[0] - converted[0], dy = result[1] - converted[1], dz = result[2] - converted[2];
    console.info("[collision] point IFC hors des elements, corrige : collision n° " + (CLASHES.indexOf(clash) + 1) +
      ", ecart " + Math.hypot(dx, dy, dz).toFixed(1) + " m");
  }
  verifiedClashPoints.set(clash.id, result);
  return result;
}

// Distance de cadrage (portee depuis IES le 16/09, corrige un signalement de
// Gilles : la distance fixe de 2,2m laissait un espace vide excessif autour
// des 2 elements en conflit, ou au contraire les rognait, selon leur taille
// reelle) : utilisee par flyToClash pour determiner le rayon de recherche
// des elements voisins candidats a l'occlusion. Basee sur la diagonale du
// PLUS PETIT des 2 elements ("voir le plus petit element en entier", sinon
// un grand element type dalle imposait un recul excessif meme quand seul le
// petit element interessait la vue), avec un plancher a 2m pour ne pas
// zoomer a l'exces sur un tout petit element (boulon, platine).
function clashFrameDistance(clash) {
  const [idA, idB] = clash.entityIds;
  const aabbA = viewer.scene.getAABB([idA]);
  const aabbB = viewer.scene.getAABB([idB]);
  const diagonalA = Math.hypot(aabbA[3] - aabbA[0], aabbA[4] - aabbA[1], aabbA[5] - aabbA[2]);
  const diagonalB = Math.hypot(aabbB[3] - aabbB[0], aabbB[4] - aabbB[1], aabbB[5] - aabbB[2]);
  const smallerDiagonal = Math.min(diagonalA, diagonalB);
  return Math.max(2, smallerDiagonal * 1.3);
}

// Intersection segment/AABB, methode des "slabs" (portee depuis IES le
// 16/09) : origin + dir avec dir = target - origin, teste si le segment
// [0,1] traverse la boite. Cote CPU, aucun appel GPU (contrairement au
// picking souris du viewer) : reste rapide meme appele des centaines de
// fois par ouverture de clash.
function segmentIntersectsAabb(origin, dir, aabb) {
  let tmin = 0;
  let tmax = 1;
  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = dir[i];
    const min = aabb[i];
    const max = aabb[i + 3];
    if (Math.abs(d) < 1e-9) {
      if (o < min || o > max) return false;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function vecCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Base camera (avant/droite/haut) a partir de la direction camera->centre
// (portee depuis IES le 16/09) : necessaire pour projeter les coins de
// l'element sur les 2 axes ecran et savoir combien de recul est reellement
// necessaire dans CETTE direction precise (cf requiredDistanceForAabb).
function cameraBasisFromDir(dirUnit) {
  const forward = [-dirUnit[0], -dirUnit[1], -dirUnit[2]];
  let right = vecCross(forward, [0, 1, 0]);
  const rightLen = Math.hypot(right[0], right[1], right[2]);
  right = rightLen > 1e-6 ? right.map((v) => v / rightLen) : [1, 0, 0];
  const up = vecCross(right, forward);
  return { forward, right, up };
}

// Marge de securite sous le FOV reel de la camera (portee depuis IES le
// 16/09) : la camera par defaut de xeokit a un FOV de 60deg (demi-angle
// 30deg), on vise un demi-angle plus etroit (25deg) pour garder de la marge
// (bord de canvas, panneaux UI, coins arrondis d'un element non
// parfaitement aligne) plutot que de coller au strict necessaire et
// risquer de rogner un coin.
const CLASH_HALF_FOV_TAN = Math.tan(25 * Math.PI / 180);
const CLASH_FRAME_MARGIN = 1.15;

// Distance de recul necessaire pour que TOUT l'element (ses 8 coins d'AABB)
// tienne dans le cadre en regardant depuis la direction dirUnit (portee
// depuis IES le 16/09, corrige un signalement avec capture d'ecran : une
// poutre longue depassait du cadre a gauche/droite malgre une distance
// suffisante "en moyenne", car l'ancienne formule ignorait l'orientation
// reelle de l'element par rapport a la camera). Projette chaque coin sur
// les axes droite/haut de la camera : garantit une vue complete quelle que
// soit l'orientation de l'element, pas juste une approximation isotrope.
function requiredDistanceForAabb(aabb, center, dirUnit) {
  const { right, up } = cameraBasisFromDir(dirUnit);
  let rightExtent = 0;
  let upExtent = 0;
  for (let i = 0; i < 8; i++) {
    const corner = [
      i & 1 ? aabb[3] : aabb[0],
      i & 2 ? aabb[4] : aabb[1],
      i & 4 ? aabb[5] : aabb[2]
    ];
    const offset = [corner[0] - center[0], corner[1] - center[1], corner[2] - center[2]];
    rightExtent = Math.max(rightExtent, Math.abs(vecDot(offset, right)));
    upExtent = Math.max(upExtent, Math.abs(vecDot(offset, up)));
  }
  return Math.max(2, (Math.max(rightExtent, upExtent) / CLASH_HALF_FOV_TAN) * CLASH_FRAME_MARGIN);
}

function aabbNearPoint(aabb, point, margin) {
  return point[0] >= aabb[0] - margin && point[0] <= aabb[3] + margin &&
    point[1] >= aabb[1] - margin && point[1] <= aabb[4] + margin &&
    point[2] >= aabb[2] - margin && point[2] <= aabb[5] + margin;
}

// Angle de camera qui minimise les elements entre la camera et le clash
// (portee depuis IES le 16/09) : teste plusieurs angles candidats autour du
// point de contact, compte pour chacun combien d'elements locaux (deja
// filtres par clashFrameDistance, jamais le modele entier) sont traverses
// en ligne droite vers le point de contact et les centres des 2 elements
// colores, garde l'angle qui en traverse le moins. Chaque candidat calcule
// sa PROPRE distance via requiredDistanceForAabb, garantissant que le plus
// petit des 2 elements tient entierement dans le cadre quel que soit
// l'angle finalement retenu. Simple test rayon/AABB, pas de picking GPU :
// reste de l'ordre de la milliseconde meme avec des dizaines de
// combinaisons angle/hauteur.
const CLASH_ANGLE_CANDIDATES = 12;
// Hauteurs testees en plus de l'azimut, en degres d'elevation (portee depuis
// IES le 16/09) : sur un grand element plat comme une dalle, une seule
// hauteur fixe pouvait garder la camera quasiment a plat contre la surface.
// Un angle plus eleve donne une vue en 3/4 plus lisible. Inclut des
// elevations NEGATIVES (camera en dessous) : quand le plus grand element
// (ex. une dalle) est au-dessus du plus petit (ex. une poutre), toute
// camera positionnee au-dessus le masque quel que soit l'azimut. Regarder
// par en dessous permet de trouver un angle reellement degage.
const CLASH_ELEVATION_CANDIDATES_DEG = [30, 15, -15, -30];

// Volume de cadrage d'une collision (COLLISION_CADRAGE_VOLUME) : chevauchement
// des AABB des 2 elements (repli +-1 m autour de la bulle), puis fenetre
// plafonnee a COLLISION_CADRAGE_VOLUME_MAX centree sur la bulle. Renvoie la
// boite de cadrage et les dimensions brutes (avant plafond) pour la trace.
function clashCadrageVolume(clash, center) {
  const [idA, idB] = clash.entityIds;
  const aabbA = viewer.scene.getAABB([idA]);
  const aabbB = viewer.scene.getAABB([idB]);
  let raw = null;
  if (aabbValid(aabbA) && aabbValid(aabbB)) {
    const candidate = [0, 1, 2].map((axis) => [
      Math.max(aabbA[axis], aabbB[axis]),
      Math.min(aabbA[axis + 3], aabbB[axis + 3])
    ]);
    if (candidate.every(([min, max]) => Number.isFinite(min) && Number.isFinite(max) && min <= max)) {
      raw = candidate.map(([min, max]) => max - min);
    }
  }
  if (!raw) raw = [2, 2, 2];
  const half = raw.map((size) => Math.min(size, COLLISION_CADRAGE_VOLUME_MAX) / 2);
  const capped = raw.some((size) => size > COLLISION_CADRAGE_VOLUME_MAX);
  const box = [
    center[0] - half[0], center[1] - half[1], center[2] - half[2],
    center[0] + half[0], center[1] + half[1], center[2] + half[2]
  ];
  return { box, raw, capped };
}

function pickBestClashView(clash, center, nearbyAabbs, volume = null) {
  const [idA, idB] = clash.entityIds;
  const aabbA = viewer.scene.getAABB([idA]);
  const aabbB = viewer.scene.getAABB([idB]);
  const diagonalA = Math.hypot(aabbA[3] - aabbA[0], aabbA[4] - aabbA[1], aabbA[5] - aabbA[2]);
  const diagonalB = Math.hypot(aabbB[3] - aabbB[0], aabbB[4] - aabbB[1], aabbB[5] - aabbB[2]);
  // Cadrage garanti sur le PLUS PETIT des 2 elements ("je veux voir le plus
  // petit element en entier").
  const smallerAabb = diagonalA <= diagonalB ? aabbA : aabbB;
  const largerAabb = diagonalA <= diagonalB ? aabbB : aabbA;
  const smallerCentroid = [
    (smallerAabb[0] + smallerAabb[3]) / 2,
    (smallerAabb[1] + smallerAabb[4]) / 2,
    (smallerAabb[2] + smallerAabb[5]) / 2
  ];
  const targets = [
    center,
    [(aabbA[0] + aabbA[3]) / 2, (aabbA[1] + aabbA[4]) / 2, (aabbA[2] + aabbA[5]) / 2],
    [(aabbB[0] + aabbB[3]) / 2, (aabbB[1] + aabbB[4]) / 2, (aabbB[2] + aabbB[5]) / 2]
  ];

  let best = null;
  for (const elevationDeg of CLASH_ELEVATION_CANDIDATES_DEG) {
    const elevRad = elevationDeg * Math.PI / 180;
    for (let i = 0; i < CLASH_ANGLE_CANDIDATES; i++) {
      const azRad = ((360 / CLASH_ANGLE_CANDIDATES) * i) * Math.PI / 180;
      const dirUnit = [
        Math.cos(elevRad) * Math.sin(azRad),
        Math.sin(elevRad),
        Math.cos(elevRad) * Math.cos(azRad)
      ];
      // Ancien cadrage (smallerAabb entier) conserve si COLLISION_CADRAGE_VOLUME
      // est false ou hors page Collision ; sinon volume de collision plafonne.
      const dist = volume
        ? Math.max(COLLISION_CADRAGE_DISTANCE_MIN, requiredDistanceForAabb(volume.box, center, dirUnit))
        : requiredDistanceForAabb(smallerAabb, center, dirUnit);
      const eye = [
        center[0] + dirUnit[0] * dist,
        center[1] + dirUnit[1] * dist,
        center[2] + dirUnit[2] * dist
      ];
      let count = 0;
      // Camera embarquee dans l'un des 2 elements du clash eux-memes
      // (corrige un signalement avec capture d'ecran : l'algo choisissait
      // parfois un angle ou la camera se retrouvait a l'interieur de la
      // dalle, ecran rempli de rouge, l'autre element jamais visible).
      // idA/idB etaient exclus des "nearbyAabbs" testes (ce sont les
      // elements colores eux-memes, pas des occultants), donc rien ne
      // penalisait ce cas. Penalite lourde plutot qu'un filtre : garde
      // toujours un meilleur candidat meme dans un cas extreme.
      if (aabbNearPoint(aabbA, eye, 0) || aabbNearPoint(aabbB, eye, 0)) count += 1000;
      // Le plus GRAND des 2 elements cache le plus petit (corrige un
      // signalement avec l'exemple concret d'un clash ou l'element rouge,
      // plus grand, se retrouvait devant le vert, plus petit, qui
      // disparaissait derriere). idA/idB sont exclus des "nearbyAabbs"
      // testes plus bas (ce sont les 2 elements colores eux-memes, pas des
      // occultants au sens gris/transparence), donc rien ne penalisait un
      // angle ou le grand masque le petit. Test dedie : segment de la
      // camera vers le centre du plus petit element, contre l'AABB du plus
      // grand.
      const dirToSmaller = [smallerCentroid[0] - eye[0], smallerCentroid[1] - eye[1], smallerCentroid[2] - eye[2]];
      if (segmentIntersectsAabb(eye, dirToSmaller, largerAabb)) count += 500;
      for (const target of targets) {
        const dir = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
        for (const aabb of nearbyAabbs) {
          if (segmentIntersectsAabb(eye, dir, aabb)) count++;
        }
      }
      if (!best || count < best.count) {
        best = { eye, count };
      }
    }
  }
  return best.eye;
}

// Cadrage occlusion-aware (portee depuis IES le 16/09, remplace l'ancienne
// distance fixe de 2,2m + angle manuel "clash.angle") : plutot qu'une vue
// generique identique pour tous les clashs (trop large sur un petit
// element, trop serree sur un grand, avec un angle choisi au hasard qui
// pouvait cacher l'un des 2 elements derriere l'autre), calcule la distance
// et l'angle qui montrent exactement ce qui est necessaire aux 2 elements
// en conflit, sans espace vide excessif autour.
// 2e parametre : true uniquement depuis la page Collision (selectClash). Les
// appels de Discussions (goToThreadView) gardent l'ancien cadrage.
function flyToClash(clash, cadrageVolume = false, onDone = undefined) {
  const center = clashCenter(clash);
  const volume = (COLLISION_CADRAGE_VOLUME && cadrageVolume && center.every(Number.isFinite))
    ? clashCadrageVolume(clash, center)
    : null;
  // Elements locaux candidats a l'occlusion : ne teste l'occlusion que sur
  // ce qui peut vraiment se trouver pres du clash, jamais le modele entier.
  // Rayon de recherche large (x3) car chaque angle candidat peut demander
  // plus de recul que cette estimation initiale (element long mal aligne
  // avec le premier angle teste, cf requiredDistanceForAabb).
  // Mode volume : la distance maximale possible est bornee par le plafond
  // (fenetre de 6 m), rayon de recherche borne en consequence.
  const searchRadius = volume ? 14 : clashFrameDistance(clash) * 3;
  const [idA, idB] = clash.entityIds;
  // 19/10 : avant, getAABB([id]) etait appele pour TOUS les objets de la scene
  // (80 000+ sur l'hopital) a chaque selection, ce qui gelait le navigateur.
  // Desormais : candidats = objets du meme etage (index id -> etage) et boites
  // englobantes en cache (collisionAabbOf) ; repli sur toute la scene seulement
  // si l'etage est introuvable.
  const tFly = performance.now();
  const loadedMaquettes = MAQUETTES.filter((m) => m.model);
  const levelSet = COLLISION_CADRAGE_ETAGE ? collisionSameLevelSet(clash, loadedMaquettes) : null;
  const candidateIds = levelSet ? Array.from(levelSet) : viewer.scene.objectIds;
  const nearbyAabbs = [];
  candidateIds.forEach((id) => {
    if (id === idA || id === idB) return;
    const aabb = levelSet ? collisionAabbOf(id) : viewer.scene.getAABB([id]);
    if (aabb && aabbNearPoint(aabb, center, searchRadius)) nearbyAabbs.push(aabb);
  });
  console.info("[collision] recherche des voisins : " + candidateIds.length + " candidats, " + nearbyAabbs.length + " retenus, " + Math.round(performance.now() - tFly) + " ms");

  const eye = pickBestClashView(clash, center, nearbyAabbs, volume);
  if (volume) {
    const dist = Math.hypot(eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]);
    console.info("[collision] cadrage n° " + (CLASHES.indexOf(clash) + 1) + " : volume " +
      volume.raw.map((v) => v.toFixed(1)).join("x") + " m (plafonne : " + (volume.capped ? "oui" : "non") +
      "), distance " + dist.toFixed(1) + " m");
  }

  viewer.cameraFlight.flyTo({ eye, look: center, up: [0, 1, 0], duration: 1.2 }, onDone);
}

// Marqueurs 3D (spheres colorees) aux points de croisement des clashs de la
// detection ouverte. Geometrie/materiau partages (1 seul PhongMaterial gris
// neutre), la couleur par statut est appliquee via `mesh.colorize` par
// instance plutot que de creer un materiau par couleur. Pickable : id
// prefixe CLASH_MARKER_ID_PREFIX, repere dans handleViewerPick pour
// activer le meme clash que dans la liste au clic sur sa bulle.
const CLASH_MARKER_ID_PREFIX = "clash-marker-";
const CLASH_MARKER_COLORS = {
  nouveau: [0.941, 0.533, 0.243], // #f0883e
  confirme: [0.973, 0.318, 0.286], // #f85149
  ecarte: [0.44, 0.47, 0.5] // gris, cf var(--muted)
};
// Interrupteur COLLISION_BULLES_SURIMPRESSION : meme rayon pour toutes les
// spheres 3D et opacite plus discrete (le disque surimprime porte la visibilite).
// Anciennes valeurs si false : 0.18 / 0.32 / 0.2 / 0.55.
const CLASH_MARKER_RADIUS = COLLISION_BULLES_SURIMPRESSION ? COLLISION_BULLE_RAYON : 0.18;
const CLASH_MARKER_RADIUS_ACTIVE = COLLISION_BULLES_SURIMPRESSION ? COLLISION_BULLE_RAYON : 0.32;
const CLASH_MARKER_OPACITY = COLLISION_BULLES_SURIMPRESSION ? 0.1 : 0.2;
const CLASH_MARKER_OPACITY_ACTIVE = COLLISION_BULLES_SURIMPRESSION ? 0.25 : 0.55;

let clashMarkerGeometry = null;
let clashMarkerMaterial = null;
const clashMarkers = new Map(); // clash.id -> Mesh
let activeClashMarkerId = null;

function ensureClashMarkerAssets() {
  if (clashMarkerGeometry) return;
  clashMarkerGeometry = new ReadableGeometry(viewer.scene, buildSphereGeometry({
    radius: 1, heightSegments: 12, widthSegments: 12
  }));
  clashMarkerMaterial = new PhongMaterial(viewer.scene, { diffuse: [1, 1, 1], emissive: [1, 1, 1] });
}

function clearClashMarkers() {
  clashMarkers.forEach((mesh) => mesh.destroy());
  clashMarkers.clear();
  activeClashMarkerId = null;
  clearClashPastilles();
  clearClashBulles();
}

// Bulles surimprimees (COLLISION_BULLES_SURIMPRESSION) : canvas 2D par-dessus
// le canvas xeokit, pointer-events: none (aucun clic capte). Rayon en pixels =
// R * projMatrix[5] * (hauteurPx / 2) / w_clip (w_clip = distance en
// perspective, 1 en orthographique), borne entre MIN_PX et MAX_PX.
let clashBullesCanvas = null;
let clashBullesList = [];
let clashBullesActiveId = null;
let clashBullesRaf = 0;
let clashBullesBound = false;

function clearClashBulles() {
  clashBullesList = [];
  clashBullesActiveId = null;
  if (clashBullesRaf) cancelAnimationFrame(clashBullesRaf);
  clashBullesRaf = 0;
  if (!clashBullesCanvas) return;
  const ctx = clashBullesCanvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, clashBullesCanvas.width, clashBullesCanvas.height);
  clashBullesCanvas.hidden = true;
}

function scheduleClashBulles() {
  if (!COLLISION_BULLES_SURIMPRESSION || clashBullesList.length === 0 || clashBullesRaf) return;
  clashBullesRaf = requestAnimationFrame(() => {
    clashBullesRaf = 0;
    drawClashBulles();
  });
}

function drawClashBulles() {
  if (!clashBullesCanvas || clashBullesList.length === 0) return;
  const glCanvas = viewer.scene.canvas && viewer.scene.canvas.canvas;
  if (!glCanvas) return;
  const w = glCanvas.clientWidth;
  const h = glCanvas.clientHeight;
  if (w === 0 || h === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (clashBullesCanvas.width !== pw || clashBullesCanvas.height !== ph) {
    clashBullesCanvas.width = pw;
    clashBullesCanvas.height = ph;
  }
  clashBullesCanvas.style.left = glCanvas.offsetLeft + "px";
  clashBullesCanvas.style.top = glCanvas.offsetTop + "px";
  clashBullesCanvas.style.width = w + "px";
  clashBullesCanvas.style.height = h + "px";
  const ctx = clashBullesCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cam = viewer.camera;
  const v = cam.viewMatrix;
  const m = cam.projMatrix;
  clashBullesList.forEach(({ id, center }) => {
    const [x, y, z] = center;
    const ex = v[0] * x + v[4] * y + v[8] * z + v[12];
    const ey = v[1] * x + v[5] * y + v[9] * z + v[13];
    const ez = v[2] * x + v[6] * y + v[10] * z + v[14];
    // Derriere la camera (ou sur son plan) : rien.
    if (ez >= 0) return;
    const cx = m[0] * ex + m[4] * ey + m[8] * ez + m[12];
    const cy = m[1] * ex + m[5] * ey + m[9] * ez + m[13];
    const cw = m[3] * ex + m[7] * ey + m[11] * ez + m[15];
    if (!(cw > 0)) return;
    const px = (cx / cw * 0.5 + 0.5) * w;
    const py = (1 - (cy / cw * 0.5 + 0.5)) * h;
    const raw = COLLISION_BULLE_RAYON * m[5] * (h / 2) / cw;
    const r = Math.min(COLLISION_BULLE_MAX_PX, Math.max(COLLISION_BULLE_MIN_PX, raw));
    if (px < -r - 8 || px > w + r + 8 || py < -r - 8 || py > h + r + 8) return;
    if (id === clashBullesActiveId) {
      ctx.beginPath();
      ctx.arc(px, py, r + 6, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 200, 40, 0.35)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 210, 60, 0.95)";
    ctx.stroke();
  });
}

function renderClashBulles(clashes) {
  if (!COLLISION_BULLES_SURIMPRESSION) return;
  if (!clashBullesCanvas) {
    clashBullesCanvas = document.createElement("canvas");
    clashBullesCanvas.className = "clash-bulles";
    clashBullesCanvas.setAttribute("aria-hidden", "true");
    viewerWrap.appendChild(clashBullesCanvas);
  }
  if (!clashBullesBound) {
    clashBullesBound = true;
    viewer.camera.on("matrix", scheduleClashBulles);
    viewer.camera.on("projMatrix", scheduleClashBulles);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(scheduleClashBulles).observe(viewerWrap);
    window.addEventListener("resize", scheduleClashBulles);
  }
  clashBullesCanvas.hidden = false;
  clashBullesList = clashes.map((clash) => ({ id: clash.id, center: clashCenter(clash) }));
  scheduleClashBulles();
}

// Pastilles numerotees (COLLISION_PASTILLES) : AnnotationsPlugin de xeokit,
// marqueurs HTML non occultables. Le conteneur ne capte aucun clic
// (pointer-events: none), seules les pastilles les captent.
let clashPastillesPlugin = null;
let clashPastillesContainer = null;
const clashPastilles = new Map(); // clash.id -> { annotation, el }

function clearClashPastilles() {
  if (clashPastillesPlugin) clashPastillesPlugin.clear();
  clashPastilles.clear();
}

function setClashPastilleShown(clashId, shown) {
  const entry = clashPastilles.get(clashId);
  if (entry) entry.annotation.setMarkerShown(shown);
}

function highlightClashPastille(clashId) {
  clashPastilles.forEach((entry, id) => entry.el.classList.toggle("active", id === clashId));
}

function renderClashPastilles(clashes) {
  if (!COLLISION_PASTILLES) return;
  if (!clashPastillesPlugin) {
    clashPastillesContainer = document.createElement("div");
    clashPastillesContainer.className = "clash-pastilles";
    viewerWrap.appendChild(clashPastillesContainer);
    clashPastillesContainer.addEventListener("click", (e) => {
      const el = e.target.closest(".clash-pastille");
      const clash = el && CLASHES.find((c) => c.id === el.dataset.clashId);
      if (clash) activateClash(clash);
    });
    clashPastillesPlugin = new AnnotationsPlugin(viewer, { container: clashPastillesContainer });
  }
  clearClashPastilles();
  clashes.forEach((clash) => {
    const numero = CLASHES.indexOf(clash) + 1;
    const annotation = clashPastillesPlugin.createAnnotation({
      id: "clash-pastille-" + clash.id,
      worldPos: clashCenter(clash),
      occludable: false,
      markerShown: true,
      labelShown: false,
      markerHTML: '<button type="button" class="clash-pastille ' + clash.statut + '" data-clash-id="' + clash.id + '" aria-label="Collision n° ' + numero + '">' + numero + '</button>'
    });
    const el = clashPastillesContainer.querySelector('[data-clash-id="' + clash.id + '"]');
    clashPastilles.set(clash.id, { annotation, el });
  });
}

function renderClashMarkers(clashes) {
  clearClashMarkers();
  ensureClashMarkerAssets();
  clashes.forEach((clash) => {
    const center = clashCenter(clash);
    const mesh = new Mesh(viewer.scene, {
      id: CLASH_MARKER_ID_PREFIX + clash.id,
      geometry: clashMarkerGeometry,
      material: clashMarkerMaterial,
      position: center,
      scale: [CLASH_MARKER_RADIUS, CLASH_MARKER_RADIUS, CLASH_MARKER_RADIUS],
      colorize: CLASH_MARKER_COLORS[clash.statut] || CLASH_MARKER_COLORS.nouveau,
      opacity: CLASH_MARKER_OPACITY,
      pickable: true
    });
    clashMarkers.set(clash.id, mesh);
  });
  renderClashPastilles(clashes);
  renderClashBulles(clashes);
}

// Grossit le marqueur du clash actuellement selectionne pour le reperer
// dans le nuage de spheres, remet l'ancien a sa taille normale.
function highlightClashMarker(clash) {
  if (activeClashMarkerId && clashMarkers.has(activeClashMarkerId)) {
    const previous = clashMarkers.get(activeClashMarkerId);
    previous.scale = [CLASH_MARKER_RADIUS, CLASH_MARKER_RADIUS, CLASH_MARKER_RADIUS];
    previous.opacity = CLASH_MARKER_OPACITY;
  }
  const current = clashMarkers.get(clash.id);
  if (current) {
    current.scale = [CLASH_MARKER_RADIUS_ACTIVE, CLASH_MARKER_RADIUS_ACTIVE, CLASH_MARKER_RADIUS_ACTIVE];
    current.opacity = CLASH_MARKER_OPACITY_ACTIVE;
  }
  activeClashMarkerId = clash.id;
  highlightClashPastille(clash.id);
  clashBullesActiveId = clash.id;
  scheduleClashBulles();
}

// Colore les 2 vrais elements en collision (rouge/vert) uniquement quand on
// clique sur une collision precise (jamais dans la vue recap des
// detections). clash.entityIds vient directement de IfcClash (ordre
// [a_global_id, b_global_id] du resultat, cf clashes.json) : le role
// element 1/element 2 est celui du moteur de detection, pas un choix fait
// clash par clash ici.
const CLASH_ELEMENT_COLOR_A = [1, 0.2, 0.2];
const CLASH_ELEMENT_COLOR_B = [0.25, 1, 0.3];
let colorizedClashEntityIds = [];

function clearClashElementColors(sansRecalcul) {
  // Transparence de la collision rendue (le fantome du contexte, lui, reste).
  // sansRecalcul (19/10) : utilise par highlightClashElements, qui recalcule
  // juste apres ; evite de remettre puis de remettre en fantome ~74 000 objets
  // a chaque changement de collision (gel observe par Gilles).
  if (collisionActiveClash || collisionOpacityTouched.length > 0) {
    collisionActiveClash = null;
    if (!sansRecalcul) applyCollisionOpacities();
  }
  if (colorizedClashEntityIds.length === 0) return;
  viewer.scene.setObjectsColorized(colorizedClashEntityIds, null);
  colorizedClashEntityIds = [];
}

function highlightClashElements(clash) {
  clearClashElementColors(true);
  const [idA, idB] = clash.entityIds;
  viewer.scene.setObjectsColorized([idA], CLASH_ELEMENT_COLOR_A);
  viewer.scene.setObjectsColorized([idB], CLASH_ELEMENT_COLOR_B);
  colorizedClashEntityIds = [idA, idB];
  collisionActiveClash = clash;
  // Pendant le vol de camera, le calcul lourd est differe (voir finirTransitionCollision).
  if (!(COLLISION_TRANSITION_VERROUILLEE && collisionTransitionEnCours)) applyCollisionOpacities();
}

// ----------------------------------------------------------------------------
// Transparence de la page Collision (19/10) : revelation des elements
// masquants (COLLISION_REVELATION) + fantome du contexte (COLLISION_CONTEXTE).
// Source unique d'opacite : applyCollisionOpacities() remet TOUT ce qu'elle a
// touche a 1, puis recalcule la cible de chaque objet (la plus basse gagne).
// Rien d'autre dans l'app ne force l'opacite (applyVisibility ne touche que
// la visibilite, la coupe passe par un plan de coupe).
// Echelle hopital (74 000 objets) : candidats masquants = Architecture
// seulement (plus Structure si affichee), jamais la mecanique (59 000) ;
// boites englobantes lues paresseusement et mises en cache.
// ----------------------------------------------------------------------------
const collisionAabbCache = new Map();
const collisionEntityIdsCache = new Map();
let collisionGhostMaquettes = [];

function collisionAabbOf(id) {
  let aabb = collisionAabbCache.get(id);
  if (!aabb) {
    const entity = viewer.scene.objects[id];
    if (!entity) return null;
    aabb = entity.aabb;
    collisionAabbCache.set(id, aabb);
  }
  return aabb;
}

function collisionEntityIds(maquetteId) {
  let ids = collisionEntityIdsCache.get(maquetteId);
  if (!ids) {
    const maquette = MAQUETTES.find((m) => m.id === maquetteId);
    if (!maquette || !maquette.model) return [];
    ids = maquette.model.entityList.map((e) => e.id);
    collisionEntityIdsCache.set(maquetteId, ids);
  }
  return ids;
}

function collisionMaskingIds(clash) {
  const [idA, idB] = clash.entityIds;
  const point = clashCenter(clash);
  const radius = clashFrameDistance(clash);
  const candidateMaquettes = ["hosp-arch"];
  const struct = MAQUETTES.find((m) => m.id === "hosp-struct");
  if (struct && struct.shown) candidateMaquettes.push("hosp-struct");
  const masking = [];
  candidateMaquettes.forEach((maquetteId) => {
    collisionEntityIds(maquetteId).forEach((id) => {
      if (id === idA || id === idB) return;
      const entity = viewer.scene.objects[id];
      if (!entity || !entity.visible) return;
      const aabb = collisionAabbOf(id);
      if (aabb && aabbNearPoint(aabb, point, radius)) masking.push(id);
    });
  });
  return masking;
}

function resetCollisionOpacities() {
  if (collisionOpacityTouched.length === 0) return;
  viewer.scene.setObjectsOpacity(collisionOpacityTouched, 1);
  collisionOpacityTouched = [];
}

function applyCollisionOpacities() {
  const t0 = performance.now();
  resetCollisionOpacities();
  syncCollisionNiveauxGhosts();
  const target = new Map();
  const put = (ids, opacity) => ids.forEach((id) => {
    const current = target.get(id);
    if (current === undefined || opacity < current) target.set(id, opacity);
  });
  const isolating = COLLISION_ISOLATION && !!collisionActiveClash;
  // En isolation, le contexte passe en X-ray (pas d'opacite 0,2 en plus).
  if (COLLISION_CONTEXTE && collisionContexteOn && !isolating) {
    collisionGhostMaquettes.forEach((m) => put(collisionEntityIds(m.id), COLLISION_CONTEXTE_OPACITY));
  }
  if (COLLISION_REVELATION && !COLLISION_ISOLATION && collisionActiveClash) {
    const [idA, idB] = collisionActiveClash.entityIds;
    const { smaller, larger } = smallerLargerEntityIds(idA, idB);
    put([smaller], CLASH_ELEMENT_OPACITY);
    put([larger], CLASH_REVEAL_OPACITY);
    put(collisionMaskingIds(collisionActiveClash), CLASH_REVEAL_OPACITY);
  }
  const byOpacity = new Map();
  target.forEach((opacity, id) => {
    if (!byOpacity.has(opacity)) byOpacity.set(opacity, []);
    byOpacity.get(opacity).push(id);
  });
  byOpacity.forEach((ids, opacity) => viewer.scene.setObjectsOpacity(ids, opacity));
  collisionOpacityTouched = Array.from(target.keys());
  applyCollisionIsolation();
  console.info("[collision] isolation appliquee en " + Math.round(performance.now() - t0) + " ms, " + collisionIsolationIds.length + " objets en fantome");
}

// Mode isolation : tout sauf les 2 elements du conflit en X-ray, non
// cliquable. Appels groupes xeokit (un seul tableau d'ids). Appelee en fin de
// applyCollisionOpacities, donc a chaque selection, deselection, bascule du
// Contexte, sortie de page et changement de detection ; restaure d'abord tout
// ce qu'elle avait touche, puis reapplique si une collision est selectionnee.
function releaseCollisionIsolation() {
  if (collisionCulledIds.length > 0) {
    viewer.scene.setObjectsCulled(collisionCulledIds, false);
    collisionCulledIds = [];
  }
  if (collisionIsolationIds.length > 0) {
    const scene = viewer.scene;
    scene.setObjectsXRayed(collisionIsolationIds, false);
    scene.setObjectsPickable(collisionIsolationIds, true);
    // Le Contexte allume garde ses maquettes non cliquables.
    if (collisionContexteOn && !collisionNiveauxActive()) {
      collisionGhostMaquettes.forEach((m) => scene.setObjectsPickable(collisionEntityIds(m.id), false));
    }
    collisionIsolationIds = [];
  }
  if (collisionContextePickIds.length > 0) {
    viewer.scene.setObjectsPickable(collisionContextePickIds, true);
    collisionContextePickIds = [];
  }
  if (collisionIsolationSavedMaterial) {
    const material = viewer.scene.xrayMaterial;
    const saved = collisionIsolationSavedMaterial;
    material.fillAlpha = saved.fillAlpha;
    material.edgeAlpha = saved.edgeAlpha;
    material.fillColor = saved.fillColor;
    material.edgeColor = saved.edgeColor;
    collisionIsolationSavedMaterial = null;
  }
}

function applyCollisionIsolation() {
  if (!COLLISION_ISOLATION) return;
  const tIso0 = performance.now();
  const phases = [];
  const marque = (nom) => phases.push(nom + " " + Math.round(performance.now() - tIso0));
  releaseCollisionIsolation();
  marque("liberation");
  if (!collisionActiveClash) return;
  const scene = viewer.scene;
  const material = scene.xrayMaterial;
  collisionIsolationSavedMaterial = {
    fillAlpha: material.fillAlpha,
    edgeAlpha: material.edgeAlpha,
    fillColor: Array.from(material.fillColor),
    edgeColor: Array.from(material.edgeColor)
  };
  material.fillAlpha = COLLISION_ISOLATION_FILL_ALPHA;
  material.edgeAlpha = COLLISION_ISOLATION_EDGE_ALPHA;
  material.fillColor = COLLISION_ISOLATION_COLOR;
  material.edgeColor = COLLISION_ISOLATION_COLOR;
  const maquettes = collisionSubsetMaquettes.slice();
  if (collisionContexteOn) maquettes.push(...collisionGhostMaquettes);
  const [idA, idB] = collisionActiveClash.entityIds;
  const ids = [];
  maquettes.forEach((m) => collisionEntityIds(m.id).forEach((id) => {
    if (id !== idA && id !== idB) ids.push(id);
  }));
  marque("ids " + ids.length);
  let ctxIds = [];
  if (collisionNiveauxActive() && collisionContexteNiveau !== "isole") {
    ctxIds = collisionNiveauContextIds(collisionActiveClash, maquettes);
  }
  marque("contexte " + ctxIds.length);
  if (ctxIds.length > 0) {
    // Contexte proche / etage : vraies couleurs a 30 %, ni xray ni cliquable.
    const ctxSet = new Set(ctxIds);
    ids.splice(0, ids.length, ...ids.filter((id) => !ctxSet.has(id)));
    scene.setObjectsOpacity(ctxIds, COLLISION_CONTEXTE_NIVEAU_OPACITE);
    scene.setObjectsPickable(ctxIds, false);
    collisionOpacityTouched = collisionOpacityTouched.concat(ctxIds);
    collisionContextePickIds = ctxIds;
  }
  if (COLLISION_ISOLATION_ETAGE) {
    const levelSet = collisionSameLevelSet(collisionActiveClash, maquettes);
    if (levelSet) {
      const near = [];
      const far = [];
      ids.forEach((id) => (levelSet.has(id) ? near : far).push(id));
      marque("etage " + near.length + " proches / " + far.length + " ecartes");
      if (far.length > 0) {
        scene.setObjectsCulled(far, true);
        collisionCulledIds = far;
      }
      marque("ecartes");
      ids.splice(0, ids.length, ...near);
    }
  }
  scene.setObjectsXRayed(ids, true);
  marque("xray " + ids.length);
  scene.setObjectsPickable(ids, false);
  marque("pickable");
  scene.setObjectsXRayed([idA, idB], false);
  scene.setObjectsPickable([idA, idB], true);
  // Niveau "Isole" (19/10, demande de Gilles) : legere transparence sur les 2
  // elements en conflit, pour voir ce qui se trouve derriere eux. Restauree a 1
  // par la restauration des opacites (collisionOpacityTouched).
  if (collisionNiveauxActive() && collisionContexteNiveau === "isole") {
    const applyIsoleOpacity = () => {
      [idA, idB].forEach((id) => {
        const entity = scene.objects[id];
        if (entity) entity.opacity = COLLISION_ELEMENT_ISOLE_OPACITE;
      });
    };
    applyIsoleOpacity();
    collisionOpacityTouched = collisionOpacityTouched.concat([idA, idB]);
    // Reapplique a l'image suivante (au cas ou un autre appel remettrait
    // l'opacite a 1 juste apres la selection) et trace l'opacite reelle des 2
    // elements pour verification (retour de Gilles : transparence invisible).
    const clashAtCall = collisionActiveClash;
    requestAnimationFrame(() => {
      if (collisionActiveClash !== clashAtCall || collisionContexteNiveau !== "isole") return;
      applyIsoleOpacity();
      console.info("[collision] opacite en Isole : element A " + (scene.objects[idA] ? scene.objects[idA].opacity : "introuvable") +
        ", element B " + (scene.objects[idB] ? scene.objects[idB].opacity : "introuvable"));
    });
  }
  collisionIsolationIds = ids;
  console.info("[collision] phases de l'isolation (ms cumules) : " + phases.join(" | "));
}

// ----------------------------------------------------------------------------
// Selecteur de contexte a 3 niveaux (COLLISION_CONTEXTE_NIVEAUX).
// ----------------------------------------------------------------------------
function collisionNiveauxActive() {
  return COLLISION_CONTEXTE_NIVEAUX && COLLISION_ISOLATION;
}

// Index id -> etage canonique, construit une fois par maquette (sous-arbre de
// chaque IfcBuildingStorey, comme buildGenericNiveaux), jamais avant que les
// metadonnees de la maquette soient chargees. levelIds : etage -> ids (entites
// existantes seulement).
const collisionLevelIndexCache = new Map();
function collisionLevelIndexOf(maquetteId) {
  let index = collisionLevelIndexCache.get(maquetteId);
  if (index) return index;
  if (!viewer.metaScene.metaModels[maquetteId]) return null;
  index = { idToLevel: new Map(), levelIds: new Map() };
  Object.values(viewer.metaScene.metaObjectsByType["IfcBuildingStorey"] || {})
    .filter((mo) => mo.metaModels.some((m) => m.id === maquetteId))
    .forEach((mo) => {
      const level = canonicalStoreyName(mo.name);
      if (!index.levelIds.has(level)) index.levelIds.set(level, []);
      const bucket = index.levelIds.get(level);
      viewer.metaScene.getObjectIDsInSubtree(mo.id).forEach((id) => {
        if (!viewer.scene.objects[id] || index.idToLevel.has(id)) return;
        index.idToLevel.set(id, level);
        bucket.push(id);
      });
    });
  collisionLevelIndexCache.set(maquetteId, index);
  return index;
}

// Candidats du contexte : meme etage que le conflit, maquettes affichees,
// conflit exclu ; en "proche", filtre AABB (cache) dans le rayon autour du
// point de collision. Niveau du conflit introuvable : liste vide (isolation seule).
// Ensemble des ids de l'etage du conflit, toutes maquettes confondues (null si
// l'etage est introuvable : l'isolation retombe alors sur tout l'hopital).
function collisionSameLevelSet(clash, maquettes) {
  const [idA, idB] = clash.entityIds;
  const indexes = maquettes.map((m) => collisionLevelIndexOf(m.id)).filter((index) => index);
  let level = null;
  for (const index of indexes) {
    level = index.idToLevel.get(idA) || index.idToLevel.get(idB) || null;
    if (level) break;
  }
  if (!level) return null;
  const set = new Set();
  indexes.forEach((index) => (index.levelIds.get(level) || []).forEach((id) => set.add(id)));
  return set;
}

function collisionNiveauContextIds(clash, maquettes) {
  const [idA, idB] = clash.entityIds;
  const indexes = maquettes.map((m) => ({ m, index: collisionLevelIndexOf(m.id) })).filter((e) => e.index);
  let level = null;
  for (const { index } of indexes) {
    level = index.idToLevel.get(idA) || index.idToLevel.get(idB) || null;
    if (level) break;
  }
  if (!level) {
    console.warn("[collision] etage du conflit introuvable, isolation seule");
    return [];
  }
  const point = clashCenter(clash);
  const result = [];
  let total = 0;
  indexes.forEach(({ m, index }) => {
    if (!m.shown) return;
    const levelIds = index.levelIds.get(level) || [];
    total += levelIds.length;
    levelIds.forEach((id) => {
      if (id === idA || id === idB) return;
      if (collisionContexteNiveau === "proche") {
        const aabb = collisionAabbOf(id);
        if (!aabb || !aabbNearPoint(aabb, point, COLLISION_CONTEXTE_RAYON)) return;
      }
      result.push(id);
    });
  });
  console.info("[collision] contexte " + collisionContexteNiveau + " (" + level + ") : " + result.length + " objets sur " + total + " de l'etage");
  return result;
}

// Affiche Structure / Electricite quand un conflit est selectionne et que le
// niveau n'est pas "isole" ; les remasque sinon (deselection, sortie de page).
function syncCollisionNiveauxGhosts() {
  if (!collisionNiveauxActive() || collisionGhostMaquettes.length === 0) return;
  const desired = !!collisionActiveClash && collisionContexteNiveau !== "isole";
  if (desired === collisionContexteOn) return;
  collisionContexteOn = desired;
  collisionGhostMaquettes.forEach((m) => {
    m.shown = desired;
    if (!desired) viewer.scene.setObjectsPickable(collisionEntityIds(m.id), true);
  });
  applyVisibility();
}

function setCollisionContexteNiveau(key) {
  collisionContexteNiveau = key;
  refreshCollisionMaquetteToggles();
  if (collisionActiveClash) applyCollisionOpacities();
}

// Plus petit / plus grand des 2 elements (portee depuis IES), par diagonale
// de boite englobante.
function smallerLargerEntityIds(idA, idB) {
  const aabbA = viewer.scene.getAABB([idA]);
  const aabbB = viewer.scene.getAABB([idB]);
  const diagonalA = Math.hypot(aabbA[3] - aabbA[0], aabbA[4] - aabbA[1], aabbA[5] - aabbA[2]);
  const diagonalB = Math.hypot(aabbB[3] - aabbB[0], aabbB[4] - aabbB[1], aabbB[5] - aabbB[2]);
  return diagonalA <= diagonalB ? { smaller: idA, larger: idB } : { smaller: idB, larger: idA };
}

// Bouton Contexte : affiche/masque les maquettes hors paire en fantome, non
// cliquables tant qu'elles sont en fantome (setObjectsPickable).
function setCollisionContexte(on) {
  collisionContexteOn = on;
  collisionGhostMaquettes.forEach((m) => {
    m.shown = on;
    viewer.scene.setObjectsPickable(collisionEntityIds(m.id), !on);
  });
  applyVisibility();
  applyCollisionOpacities();
}

// Retour a l'etat normal, appelee a chaque sortie de la page Collision
// (activateView, restoreAllModelsVisible) et a l'ouverture d'une detection :
// opacite 1, pickable true, maquettes hors paire a nouveau masquees.
function resetCollisionOpacityState() {
  const wasOn = collisionContexteOn;
  collisionContexteOn = false;
  collisionActiveClash = null;
  if (wasOn) {
    collisionGhostMaquettes.forEach((m) => {
      m.shown = false;
      viewer.scene.setObjectsPickable(collisionEntityIds(m.id), true);
    });
    applyVisibility();
  }
  applyCollisionOpacities();
}

let currentDiscussionThread = null;
// COLLISION_ECHANGES_GRAND : etat declare en tete de fichier (voir plus haut), car activateView s'execute au demarrage.

function renderDiscussionMessages(thread) {
  if (COLLISION_BANDEAU && isHospitalClash(thread) && collisionLeft.contains(collisionDiscussion)) {
    renderChronologieCollision(thread);
    return;
  }
  if (isHospitalClash(thread)) {
    renderDiscussionMessagesAvecJournal(thread);
    return;
  }
  discussionMessages.innerHTML = "";
  // Plus recents en haut, plus anciens en bas (le tableau reste lui en
  // ordre chronologique, seul l'affichage est inverse) : le dernier
  // message est visible immediatement, sans avoir a scroller.
  thread.discussion.slice().reverse().forEach((msg) => {
    const li = document.createElement("li");
    li.className = "discussion-message";
    const auteur = document.createElement("div");
    auteur.className = "discussion-auteur";
    auteur.textContent = msg.auteur;
    const texte = document.createElement("div");
    texte.className = "discussion-texte";
    texte.textContent = msg.texte;
    li.append(auteur, texte);
    discussionMessages.appendChild(li);
  });
}

// COLLISION_PRIORITES : commentaires + journal des changements (priorite,
// statut), melanges chronologiquement (plus recent en haut). Les messages sans
// date (anciens) passent avant les entrees datees.
let journalNoteOuverte = null;
function fermerJournalNote() {
  if (!journalNoteOuverte) return;
  journalNoteOuverte.note.hidden = true;
  journalNoteOuverte.btn.setAttribute("aria-expanded", "false");
  journalNoteOuverte = null;
}
document.addEventListener("click", (e) => {
  if (journalNoteOuverte && !journalNoteOuverte.li.contains(e.target)) fermerJournalNote();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerJournalNote();
});

function renderDiscussionMessagesAvecJournal(thread) {
  journalNoteOuverte = null;
  discussionMessages.innerHTML = "";
  const temps = (x) => { const t = Date.parse(x.quand); return isNaN(t) ? 0 : t; };
  const items = thread.discussion.map((m) => ({ type: "message", data: m, t: temps(m) }))
    .concat((thread.historique || []).map((h) => ({ type: "journal", data: h, t: temps(h) })));
  // Tri stable : a date egale, l'ordre d'insertion est conserve.
  items.map((it, i) => ({ it, i })).sort((a, b) => a.it.t - b.it.t || a.i - b.i).map((x) => x.it).reverse().forEach((item) => {
    const li = document.createElement("li");
    if (item.type === "message") {
      li.className = "discussion-message";
      const auteur = document.createElement("div");
      auteur.className = "discussion-auteur";
      auteur.textContent = item.data.auteur;
      const texte = document.createElement("div");
      texte.className = "discussion-texte";
      texte.textContent = item.data.texte;
      li.append(auteur, texte);
    } else {
      const h = item.data;
      li.className = "discussion-journal";
      const icone = document.createElement("span");
      icone.className = "discussion-journal-icone";
      icone.setAttribute("aria-hidden", "true");
      icone.textContent = "↻";
      const qui = document.createElement("button");
      qui.type = "button";
      qui.className = "discussion-journal-qui";
      qui.textContent = h.qui || CLASH_UTILISATEUR_HISTORIQUE;
      qui.setAttribute("aria-expanded", "false");
      const note = document.createElement("span");
      note.className = "discussion-journal-note";
      note.hidden = true;
      note.setAttribute("role", "status");
      note.textContent = "Nom de l'utilisateur quand les comptes seront en place";
      qui.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = journalNoteOuverte && journalNoteOuverte.btn === qui;
        fermerJournalNote();
        if (wasOpen) return;
        note.hidden = false;
        qui.setAttribute("aria-expanded", "true");
        journalNoteOuverte = { li, btn: qui, note };
      });
      const labels = h.champ === "priorité" ? PRIORITE_LABELS : STATUT_LABELS;
      const texte = document.createElement("span");
      texte.textContent = " a changé " + (h.champ === "priorité" ? "la priorité" : "le statut") + " de " + (labels[h.de] || h.de) + " à " + (labels[h.vers] || h.vers);
      const quand = document.createElement("span");
      quand.className = "discussion-journal-quand";
      const d = formatHistoriqueDate(h.quand);
      quand.textContent = d ? " · " + d : "";
      li.append(icone, qui, texte, quand, note);
    }
    discussionMessages.appendChild(li);
  });
}

// COLLISION_BANDEAU : titre court, chronologie unique et filtre.
let collisionFiltre = "tout";
let collisionFiltreEl = null;
let collisionIdsEl = null;
const FILTRES_CHRONOLOGIE = [["tout", "Tout"], ["commentaires", "Commentaires"], ["modifications", "Modifications"]];

function ensureBandeauElements() {
  if (!collisionFiltreEl) {
    const bar = document.createElement("div");
    bar.id = "collisionFiltre";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Filtrer les échanges");
    FILTRES_CHRONOLOGIE.forEach(([cle, libelle]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.filtre = cle;
      b.textContent = libelle;
      b.setAttribute("aria-pressed", String(cle === collisionFiltre));
      b.addEventListener("click", () => {
        collisionFiltre = cle;
        bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.filtre === cle)));
        if (currentDiscussionThread) renderDiscussionMessages(currentDiscussionThread);
      });
      bar.appendChild(b);
    });
    discussionMessages.parentNode.insertBefore(bar, discussionMessages);
    collisionFiltreEl = bar;
  }
  if (!collisionIdsEl) {
    const ids = document.createElement("div");
    ids.id = "collisionDiscussionIds";
    const head = document.getElementById("collisionDiscussionHead");
    if (head) head.parentNode.insertBefore(ids, head.nextSibling);
    collisionIdsEl = ids;
  }
}

// Titre court "n° 5 · Cloison ↔ Tuyau · Niveau 4" (le nom Revit reste en infobulle).
function titreCourtCollision(clash) {
  const [partA, partB] = clash.zone.split(" ↔ ");
  const levelMatch = clash.zone.match(/·\s*([^·]+)$/);
  const niveau = (levelMatch ? levelMatch[1].trim() : "").replace(/^Level\s*/i, "Niveau ");
  const types = collisionTypeFr(partA || "") + " ↔ " + collisionTypeFr((partB || "").split("·")[0]);
  // Titre = identifiant seul (19/10, demande de Gilles : le nom complet n'etait pas lisible
  // sur mobile) ; types et niveau passent sur la 2e ligne (detailsCollision).
  return String(CLASHES.indexOf(clash) + 1);
}
function detailsCollision(clash) {
  const [partA, partB] = clash.zone.split(" ↔ ");
  const levelMatch = clash.zone.match(/·\s*([^·]+)$/);
  const niveau = (levelMatch ? levelMatch[1].trim() : "").replace(/^Level\s*/i, "Niveau ");
  const types = collisionTypeFr(partA || "") + " ↔ " + collisionTypeFr((partB || "").split("·")[0]);
  const ids = (clash.zone.match(/\(#(\d+)\)/g) || []).map((m) => m.slice(1, -1));
  return [types, niveau, ids.join(" ↔ ")].filter(Boolean).join(" · ");
}

function majBandeauCollision(thread) {
  const actif = COLLISION_BANDEAU && isHospitalClash(thread) && collisionLeft.contains(collisionDiscussion);
  ensureBandeauElements();
  collisionDiscussion.classList.toggle("cb", actif);
  if (!actif) {
    fermerEchangesGrand(false);
    collisionDiscussionTitle.title = "Cliquer pour voir le titre complet";
    if (collisionIdsEl) collisionIdsEl.textContent = "";
    return;
  }
  // 20/10 : deux spans, "Collision" (libelle, visible sur mobile seulement) puis le numero (n° X sur mobile).
  collisionDiscussionTitle.textContent = "";
  const libTitre = document.createElement("span");
  libTitre.className = "cb-titre-lib";
  libTitre.textContent = "Collision";
  const numTitre = document.createElement("span");
  numTitre.className = "cb-titre-num";
  numTitre.textContent = titreCourtCollision(thread);
  collisionDiscussionTitle.append(libTitre, numTitre);
  // 19/10 : plus aucun nom d'element ni de type (detailsCollision gardee, non utilisee).
  collisionDiscussionTitle.removeAttribute("title");
  collisionIdsEl.textContent = "";
}

// Champ de reponse a la demande (19/10, demande de Gilles) : en mode bandeau, seul un
// bouton "Message" est visible, il ouvre le champ ; plus de place pour defiler
// dans les echanges. Hors mode bandeau (Discussions), comportement d'avant.
let messageOuvert = false;
const messageOuvrirBtn = document.getElementById("messageOuvrirBtn");
function majFormulaireReponse(isOpen) {
  const cb = collisionDiscussion.classList.contains("cb");
  if (!cb || !messageOuvrirBtn) {
    discussionReplyForm.hidden = !isOpen;
    if (messageOuvrirBtn) messageOuvrirBtn.hidden = true;
    return;
  }
  messageOuvrirBtn.hidden = !isOpen || messageOuvert;
  discussionReplyForm.hidden = !isOpen || !messageOuvert;
}
function fermerMessage() {
  messageOuvert = false;
  majFormulaireReponse(!!currentDiscussionThread && isThreadOpen(currentDiscussionThread));
}
if (messageOuvrirBtn) {
  // Un clic ailleurs referme le champ (le brouillon reste dans le textarea) et ramene le bouton.
  document.addEventListener("pointerdown", (e) => {
    if (!messageOuvert) return;
    if (discussionReplyForm.contains(e.target) || messageOuvrirBtn.contains(e.target)) return;
    fermerMessage();
  }, true);
  messageOuvrirBtn.addEventListener("click", () => {
    messageOuvert = true;
    majFormulaireReponse(true);
    discussionReplyInput.focus();
    defilerChronologieBas();
  });
  discussionReplyInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && collisionDiscussion.classList.contains("cb")) fermerMessage();
  });
}

function defilerChronologieBas() {
  requestAnimationFrame(() => { discussionMessages.scrollTop = discussionMessages.scrollHeight; });
}

function initiales(nom) {
  const mots = String(nom || "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "?";
  if (mots.length === 1) return mots[0].charAt(0).toUpperCase();
  return (mots[0].charAt(0) + mots[mots.length - 1].charAt(0)).toUpperCase();
}

function puceValeur(champ, valeur, labels) {
  const span = document.createElement("span");
  span.className = "tl-valeur";
  const dot = document.createElement("span");
  dot.className = "tl-dot";
  dot.dataset.champ = champ === "priorité" ? "prio" : "statut";
  dot.dataset.v = valeur;
  dot.setAttribute("aria-hidden", "true");
  span.append(dot, document.createTextNode(labels[valeur] || valeur));
  return span;
}

function renderChronologieCollision(thread) {
  journalNoteOuverte = null;
  discussionMessages.innerHTML = "";
  const temps = (x) => { const t = Date.parse(x.quand); return isNaN(t) ? 0 : t; };
  let items = thread.discussion.map((m) => ({ type: "message", data: m, t: temps(m) }))
    .concat((thread.historique || []).map((h) => ({ type: "journal", data: h, t: temps(h) })));
  if (collisionFiltre === "commentaires") items = items.filter((i) => i.type === "message");
  if (collisionFiltre === "modifications") items = items.filter((i) => i.type === "journal");
  items = items.map((it, i) => ({ it, i })).sort((a, b) => a.it.t - b.it.t || a.i - b.i).map((x) => x.it);
  if (!items.length) {
    const vide = document.createElement("li");
    vide.className = "tl-vide";
    vide.textContent = "Aucun échange pour l'instant.";
    discussionMessages.appendChild(vide);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    const estMessage = item.type === "message";
    li.className = "tl-item " + (estMessage ? "tl-commentaire" : "tl-modif");
    const nom = estMessage && item.data.auteur !== "Vous" ? item.data.auteur : (estMessage ? CLASH_UTILISATEUR_HISTORIQUE : (item.data.qui || CLASH_UTILISATEUR_HISTORIQUE));
    const entete = document.createElement("div");
    entete.className = "tl-entete";
    const avatar = document.createElement("span");
    avatar.className = "tl-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initiales(nom);
    const qui = document.createElement("button");
    qui.type = "button";
    qui.className = "tl-qui";
    qui.textContent = nom;
    qui.setAttribute("aria-expanded", "false");
    const note = document.createElement("span");
    note.className = "discussion-journal-note";
    note.hidden = true;
    note.setAttribute("role", "status");
    note.textContent = "Nom de l'utilisateur quand les comptes seront en place";
    qui.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = journalNoteOuverte && journalNoteOuverte.btn === qui;
      fermerJournalNote();
      if (wasOpen) return;
      note.hidden = false;
      qui.setAttribute("aria-expanded", "true");
      journalNoteOuverte = { li, btn: qui, note };
    });
    const quand = document.createElement("span");
    quand.className = "tl-quand";
    quand.textContent = formatHistoriqueDate(item.data.quand);
    entete.append(avatar, qui, quand);
    const corps = document.createElement("div");
    corps.className = "tl-corps";
    if (estMessage) {
      corps.textContent = item.data.texte;
    } else {
      const h = item.data;
      const labels = h.champ === "priorité" ? PRIORITE_LABELS : STATUT_LABELS;
      const lib = document.createElement("span");
      lib.className = "tl-champ";
      lib.textContent = h.champ === "priorité" ? "Priorité" : "Statut";
      const fleche = document.createElement("span");
      fleche.className = "tl-fleche";
      fleche.setAttribute("aria-hidden", "true");
      fleche.textContent = "→";
      corps.classList.add("tl-puce");
      corps.append(lib, puceValeur(h.champ, h.de, labels), fleche, puceValeur(h.champ, h.vers, labels));
    }
    li.append(entete, corps, note);
    discussionMessages.appendChild(li);
  });
  defilerChronologieBas();
}

// COLLISION_PRIORITES : selecteurs Priorite et Statut au-dessus des messages.
let collisionControles = null;
function ensureCollisionControles() {
  if (collisionControles) return collisionControles;
  const wrap = document.createElement("div");
  wrap.id = "collisionControles";
  wrap.hidden = true;
  const mk = (id, libelle, labels, champ) => {
    const field = document.createElement("div");
    field.className = "collision-controle";
    const lab = document.createElement("label");
    lab.htmlFor = id;
    lab.textContent = libelle;
    const sel = document.createElement("select");
    sel.id = id;
    Object.keys(labels).forEach((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = labels[k];
      sel.appendChild(o);
    });
    // Pastille de couleur de la valeur choisie (data-valeur sur .collision-select-wrap).
    const selectWrap = document.createElement("span");
    selectWrap.className = "collision-select-wrap";
    selectWrap.dataset.champ = champ === "priorité" ? "prio" : "statut";
    const dot = document.createElement("span");
    dot.className = "collision-select-dot";
    dot.setAttribute("aria-hidden", "true");
    selectWrap.append(dot, sel);
    sel.addEventListener("change", () => {
      selectWrap.dataset.valeur = sel.value;
      changerChampCollision(champ, sel.value);
    });
    // Menu personnalise (19/10) : le <select> reste la source de verite mais est masque ;
    // un bouton "Priorité / Haute" ouvre un menu titre avec pastilles et coche.
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "collision-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const trigDot = document.createElement("span");
    trigDot.className = "collision-select-dot";
    trigDot.setAttribute("aria-hidden", "true");
    const trigTexte = document.createElement("span");
    trigTexte.className = "collision-trigger-texte";
    const trigLib = document.createElement("span");
    trigLib.className = "collision-trigger-lib";
    trigLib.textContent = libelle;
    const trigVal = document.createElement("span");
    trigVal.className = "collision-trigger-val";
    trigTexte.append(trigLib, trigVal);
    const chevron = document.createElement("span");
    chevron.className = "collision-trigger-chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.append(trigDot, trigTexte, chevron);
    selectWrap.prepend(trigger);
    const maj = () => {
      selectWrap.dataset.valeur = sel.value;
      trigVal.textContent = labels[sel.value] || "";
    };
    maj();
    let menu = null;
    const fermer = () => {
      if (!menu) return;
      menu.remove();
      menu = null;
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", surClicExterieur, true);
      document.removeEventListener("keydown", surTouche, true);
    };
    const surClicExterieur = (e) => {
      if (menu && !menu.contains(e.target) && !trigger.contains(e.target)) fermer();
    };
    const surTouche = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); fermer(); trigger.focus(); }
    };
    trigger.addEventListener("click", () => {
      if (menu) { fermer(); return; }
      menu = document.createElement("div");
      menu.className = "collision-menu";
      menu.setAttribute("role", "listbox");
      menu.dataset.champ = selectWrap.dataset.champ;
      const titre = document.createElement("div");
      titre.className = "collision-menu-titre";
      titre.textContent = libelle;
      menu.appendChild(titre);
      Object.keys(labels).forEach((k) => {
        const opt = document.createElement("button");
        opt.type = "button";
        opt.className = "collision-menu-option";
        opt.setAttribute("role", "option");
        opt.dataset.valeur = k;
        opt.setAttribute("aria-selected", String(k === sel.value));
        const d = document.createElement("span");
        d.className = "collision-select-dot";
        const t = document.createElement("span");
        t.className = "collision-menu-texte";
        t.textContent = labels[k];
        const coche = document.createElement("span");
        coche.className = "collision-menu-coche";
        coche.textContent = k === sel.value ? "✓" : "";
        opt.append(d, t, coche);
        opt.addEventListener("click", () => {
          if (sel.value !== k) {
            sel.value = k;
            sel.dispatchEvent(new Event("change"));
            maj();
          }
          fermer();
          trigger.focus();
        });
        menu.appendChild(opt);
      });
      menu.style.visibility = "hidden";
      document.body.appendChild(menu);
      const r = trigger.getBoundingClientRect();
      const mh = menu.offsetHeight;
      const mw = Math.max(menu.offsetWidth, 168);
      const place = window.innerHeight - r.bottom;
      menu.style.top = (place >= mh + 8 ? r.bottom + 6 : Math.max(8, r.top - mh - 6)) + "px";
      menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + "px";
      menu.style.minWidth = mw + "px";
      menu.style.visibility = "";
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", surClicExterieur, true);
      document.addEventListener("keydown", surTouche, true);
    });
    field.append(lab, selectWrap);
    return { field, sel, selectWrap, maj };
  };
  const statutsProposes = { nouveau: STATUT_LABELS.nouveau, confirme: STATUT_LABELS.confirme, ecarte: STATUT_LABELS.ecarte, resolu: STATUT_LABELS.resolu };
  const p = mk("collisionPrioriteSelect", "Priorité", PRIORITE_LABELS, "priorité");
  const st = mk("collisionStatutSelect", "Statut", statutsProposes, "statut");
  wrap.append(p.field, st.field);
  discussionMessages.parentNode.insertBefore(wrap, discussionMessages);
  if (COLLISION_BANDEAU) {
    // Dans le bandeau, a droite du titre : pas d'etiquette visible, aria-label et infobulle.
    const head = document.getElementById("collisionDiscussionHead");
    if (head) {
      head.appendChild(wrap);
      wrap.addEventListener("click", (e) => e.stopPropagation());
      [[p.sel, "Priorité"], [st.sel, "Statut"]].forEach(([sel, nom]) => {
        sel.setAttribute("aria-label", nom);
        sel.title = nom;
      });
    }
  }
  collisionControles = { wrap, prio: p.sel, statut: st.sel, majPrio: p.maj, majStatut: st.maj };
  return collisionControles;
}

function majCollisionControles(thread) {
  if (!COLLISION_PRIORITES) return;
  const c = ensureCollisionControles();
  const visible = isHospitalClash(thread);
  c.wrap.hidden = !visible;
  if (!visible) return;
  c.prio.value = clashPriorite(thread);
  c.statut.value = thread.statut;
  c.prio.parentNode.dataset.valeur = c.prio.value;
  c.statut.parentNode.dataset.valeur = c.statut.value;
  c.majPrio();
  c.majStatut();
}

function changerChampCollision(champ, vers) {
  const clash = currentDiscussionThread;
  if (!isHospitalClash(clash)) return;
  const cle = champ === "priorité" ? "priorite" : "statut";
  const de = cle === "priorite" ? clashPriorite(clash) : clash.statut;
  if (de === vers) return;
  clash[cle] = vers;
  if (!Array.isArray(clash.historique)) clash.historique = [];
  clash.historique.push({ qui: CLASH_UTILISATEUR_HISTORIQUE, quand: new Date().toISOString(), champ, de, vers });
  sauverEtatCollisions();
  renderCollisionsList(CLASHES.filter((c) => c.detectionId === clash.detectionId));
  renderDiscussionMessages(clash);
  majFormulaireReponse(isThreadOpen(clash));
  majCollisionControles(clash);
}

function isThreadOpen(thread) {
  return threadType(thread) === "collision" ? thread.statut !== "ecarte" : thread.open;
}

// Bloc "Discussion" (#collisionDiscussion, avec sa liste de messages et son
// formulaire) partage entre Collision et Discussions : un seul jeu de
// html/css/js, deplace physiquement dans le DOM au moment de l'usage (meme
// principe que #viewerWrap deplace entre Viewer/Collision/fil).
function showThreadDiscussion(thread) {
  currentDiscussionThread = thread;
  majCollisionControles(thread);
  const isOpen = isThreadOpen(thread);

  // Titre du fil a la place du generique "Discussion" (Collision et
  // Discussions partagent tous les deux un champ "zone" sur leur thread).
  // Retronque par CSS (text-overflow), classe "expanded" retiree a chaque
  // nouveau fil pour ne pas garder un vieux deplie.
  collisionDiscussionTitle.textContent = thread.zone;
  collisionDiscussionTitle.classList.remove("expanded");
  majBandeauCollision(thread);

  if (thread.discussion.length === 0 && !isOpen && !isHospitalClash(thread)) {
    collisionDiscussion.hidden = true;
    return;
  }

  collisionDiscussion.hidden = false;
  renderDiscussionMessages(thread);

  messageOuvert = false;
  majFormulaireReponse(isOpen);
  discussionReplyInput.value = "";

  // Instruction BE -> Projeteur (portee depuis IES le 16/09) : bouton
  // reserve au profil Bureau d'etudes, jamais propose depuis une
  // instruction deja creee (pas de chaine BE -> Projeteur -> Projeteur).
  // Badge visible par tous des qu'un fil a ete pris en charge (demande
  // explicite : le Responsable Synthese doit voir que ce n'est plus a lui
  // d'agir).
  threadAssignedBadge.hidden = !thread.assignedTo;
  if (thread.assignedTo) threadAssignedBadge.textContent = "Pris en charge par " + thread.assignedTo;
  createInstructionBtn.hidden = personaSelect.value !== "be" || !!thread.isInstruction;
}

function debuterTransitionCollision() {
  collisionTransitionEnCours = true;
  collisionsList.classList.add("en-transition");
  clearTimeout(collisionTransitionTimer);
  // Securite : si le vol est interrompu (camera deplacee a la main), on deverrouille quand meme.
  collisionTransitionTimer = setTimeout(finirTransitionCollision, 3000);
}
function finirTransitionCollision() {
  if (!collisionTransitionEnCours) return;
  collisionTransitionEnCours = false;
  clearTimeout(collisionTransitionTimer);
  collisionsList.classList.remove("en-transition");
  // Calcul lourd differe : isolation / contexte appliques une fois la camera arretee.
  if (collisionActiveClash) applyCollisionOpacities();
}

function selectClash(clash) {
  if (COLLISION_TRANSITION_VERROUILLEE) debuterTransitionCollision();
  flyToClash(clash, true, COLLISION_TRANSITION_VERROUILLEE ? finirTransitionCollision : undefined);
  highlightClashMarker(clash);
  // Une nouvelle collision remplace la selection precedente (carte fermee).
  deselectEntity();
  highlightClashElements(clash);
  recenterTarget = () => flyToClash(clash, true);
  showThreadDiscussion(clash);
}

// Point d'entree commun pour selectionner un clash, que ce soit via la
// ligne de la liste ou un clic direct sur sa bulle 3D dans le viewer.
function activateClash(clash) {
  // Verrou pendant le vol de camera : le clic est ignore tant que la camera n'est pas arretee.
  if (COLLISION_TRANSITION_VERROUILLEE && collisionTransitionEnCours) return;
  collisionsList.querySelectorAll(".collision-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.clashId === clash.id);
  });
  selectClash(clash);
  closeCollisionInfoPanelDrawer();
}

// Titre tronque (CSS) si trop long pour la largeur du panneau discussion :
// un clic affiche le titre complet, un reclic retronque.
collisionDiscussionTitle.addEventListener("click", () => {
  // Page Collision (19/10, demande de Gilles) : un clic sur le titre complet de la
  // collision ouvre ou ferme la zone de commentaires (en plus d'afficher le
  // titre en entier). Dans Discussions, la zone n'est jamais reduite : le clic
  // ne fait que deplier le titre.
  if (collisionLeft.contains(collisionDiscussion)) {
    const willOpen = collisionDiscussion.classList.contains("collapsed");
    collisionDiscussion.classList.toggle("collapsed", !willOpen);
    collisionDiscussionTitle.classList.toggle("expanded", willOpen);
    return;
  }
  collisionDiscussionTitle.classList.toggle("expanded");
});

// Reduire la discussion (portee depuis IES le 16/09, Collision et
// Discussions partagent #collisionDiscussion) : ne reste que le bandeau
// titre visible, pour laisser plus de place a la maquette 3D. Etat non
// reinitialise entre 2 clashs/fils (persiste tant que la page n'est pas
// rechargee) : parcourir plusieurs clashs avec le panneau reduit ne doit
// pas le rouvrir a chaque clic.
// Liste des collisions reductible sur ordinateur (19/10, demande de Gilles),
// comme le panneau du Viewer : une fine bande avec le bouton de bascule, la 3D
// recupere la largeur. Ouvert a chaque entree dans la page Collision (non
// memorise) ; bouton masque sur mobile (tiroir existant).
const collisionInfoPanelCollapse = document.getElementById("collisionInfoPanelCollapse");
function setCollisionPanelCollapsed(collapsed) {
  if (!collisionInfoPanelCollapse) return;
  collisionInfoPanel.classList.toggle("collapsed", collapsed);
  collisionInfoPanelCollapse.textContent = collapsed ? "‹" : "›";
  collisionInfoPanelCollapse.setAttribute("aria-expanded", String(!collapsed));
  const label = collapsed ? "Afficher la liste des collisions" : "Réduire la liste des collisions";
  collisionInfoPanelCollapse.setAttribute("aria-label", label);
  collisionInfoPanelCollapse.title = label;
}
if (collisionInfoPanelCollapse) {
  collisionInfoPanelCollapse.addEventListener("click", () => {
    setCollisionPanelCollapsed(!collisionInfoPanel.classList.contains("collapsed"));
    window.dispatchEvent(new Event("resize"));
  });
  collisionInfoPanel.addEventListener("transitionend", (e) => {
    if (e.target === collisionInfoPanel) window.dispatchEvent(new Event("resize"));
  });
}

collisionDiscussionToggle.addEventListener("click", () => {
  collisionDiscussion.classList.toggle("collapsed");
});

// COLLISION_BANDEAU : a l'ouverture de la zone, la chronologie descend sur le plus recent.
collisionDiscussionTitle.addEventListener("click", defilerChronologieBas);
collisionDiscussionToggle.addEventListener("click", defilerChronologieBas);

// COLLISION_ECHANGES_GRAND : agrandir la zone d'echange sur toute la zone de la 3D.
// N'agit que sur des classes de #collisionDiscussion : aucun etat 3D, aucun deplacement de viewerWrap.
function ouvrirEchangesGrand() {
  if (!echangesGrandBtn || echangesGrandOuvert || !collisionDiscussion.classList.contains("cb")) return;
  echangesGrandOuvert = true;
  echangesGrandEtaitReplie = collisionDiscussion.classList.contains("collapsed");
  collisionDiscussion.classList.remove("collapsed");
  collisionDiscussion.classList.add("cb-grand");
  echangesGrandBtn.setAttribute("aria-pressed", "true");
  echangesGrandBtn.setAttribute("aria-label", "Réduire les échanges");
  echangesGrandBtn.title = "Réduire les échanges";
  closeCollisionInfoPanelDrawer();
  discussionMessages.setAttribute("tabindex", "-1");
  discussionMessages.focus({ preventScroll: true });
  defilerChronologieBas();
}

function fermerEchangesGrand(rendreFocus) {
  if (!echangesGrandOuvert) return;
  echangesGrandOuvert = false;
  collisionDiscussion.classList.remove("cb-grand");
  collisionDiscussion.classList.toggle("collapsed", echangesGrandEtaitReplie);
  discussionMessages.removeAttribute("tabindex");
  if (echangesGrandBtn) {
    echangesGrandBtn.setAttribute("aria-pressed", "false");
    echangesGrandBtn.setAttribute("aria-label", "Agrandir les échanges");
    echangesGrandBtn.title = "Agrandir les échanges";
    if (rendreFocus) echangesGrandBtn.focus();
  }
}

(function initEchangesGrand() {
  if (!COLLISION_ECHANGES_GRAND || !COLLISION_BANDEAU) return;
  const head = document.getElementById("collisionDiscussionHead");
  if (!head) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "collisionGrandBtn";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "Agrandir les échanges");
  btn.title = "Agrandir les échanges";
  btn.innerHTML =
    '<svg class="gb-agrandir" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M9.5 2H14v4.5M14 2L8.5 7.5M6.5 14H2V9.5M2 14l5.5-5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<svg class="gb-reduire" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M14 6.5H9.5V2M9.5 6.5L15 1M2 9.5h4.5V14M6.5 9.5L1 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<svg class="gb-fermer" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (echangesGrandOuvert) fermerEchangesGrand(true);
    else ouvrirEchangesGrand();
  });
  head.appendChild(btn);
  echangesGrandBtn = btn;
  // En mode agrandi, un clic sur le titre ou le chevron ne replie pas la zone.
  head.addEventListener("click", (e) => {
    if (echangesGrandOuvert && !btn.contains(e.target) && !e.target.closest("#collisionControles")) e.stopImmediatePropagation();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !echangesGrandOuvert) return;
    if (e.target instanceof HTMLSelectElement) return;
    fermerEchangesGrand(true);
  });
})();

discussionReplyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const texte = discussionReplyInput.value.trim();
  if (!texte || !currentDiscussionThread) return;

  currentDiscussionThread.discussion.push(COLLISION_PRIORITES ? { auteur: "Vous", texte, quand: new Date().toISOString() } : { auteur: "Vous", texte });
  renderDiscussionMessages(currentDiscussionThread);
  discussionReplyInput.value = "";
  fermerMessage();
});

// Instruction BE -> Projeteur (portee depuis IES le 16/09) : copie le
// contexte 3D du fil source (meme mecanisme que "Nouvelle discussion",
// captureViewerState) dans un nouveau fil dedie a 2, plutot que d'ajouter le
// Projeteur au fil existant (qui reste multi-metiers). Le fil source garde
// une trace (assignedTo) pour que le Responsable Synthese sache que c'est
// desormais gere par le BE, sans avoir a suivre le fil dedie lui-meme.
createInstructionBtn.addEventListener("click", () => {
  if (!currentDiscussionThread) return;
  const source = currentDiscussionThread;
  const snapshot = captureViewerState();

  const thread = {
    id: "disc-" + Date.now(),
    zone: source.zone,
    auteur: "Vous (Bureau d'études)",
    tagged: ["Projeteur"],
    open: true,
    isInstruction: true,
    sourceThreadId: source.id,
    camera: snapshot.camera,
    niveaux: snapshot.niveaux,
    maquettes: snapshot.maquettes,
    coupe: snapshot.coupe,
    discussion: [{ auteur: "Vous (Bureau d'études)", texte: "Instruction issue du fil « " + source.zone + " » : à traiter." }]
  };
  DISCUSSIONS.push(thread);
  source.assignedTo = "Bureau d'études";

  renderDiscussionsPage();
  renderProjeteurList();
  openThreadDetail(thread);
});

function goBackToDetections() {
  fermerEchangesGrand(false);
  collisionDetail.hidden = true;
  collisionRecap.hidden = false;
  viewViewer.insertBefore(viewerWrap, infoPanel);
  recenterTarget = null;
  clearClashMarkers();
  clearClashElementColors();
  deselectEntity();
  restoreAllModelsVisible();
}
collisionBackBtn.addEventListener("click", goBackToDetections);

// Meme principe que le tiroir Viewer/Presentation : le panneau Maquettes/
// Collisions masque par defaut sur mobile, ouvert en overlay via ce bouton
// (duplique flottant sur la maquette, cf le bouton retour ci-dessus, qui vit
// normalement dans ce meme panneau donc invisible tant qu'il est ferme).
collisionInfoPanelToggle.addEventListener("click", () => {
  collisionInfoPanel.classList.add("open");
  collisionInfoPanelBackdrop.hidden = false;
});
function closeCollisionInfoPanelDrawer() {
  collisionInfoPanel.classList.remove("open");
  collisionInfoPanelBackdrop.hidden = true;
}
collisionInfoPanelBackdrop.addEventListener("click", closeCollisionInfoPanelDrawer);
const collisionInfoPanelCloseBtn = document.getElementById("collisionInfoPanelClose");
if (collisionInfoPanelCloseBtn) collisionInfoPanelCloseBtn.addEventListener("click", closeCollisionInfoPanelDrawer);

renderDetections();

const maquetteCountEls = new Map();

// Versions de demonstration, saisies a la main (19/10) : pas encore de source
// reelle (le futur depot dans l'Admin les renseignera). Une maquette absente
// de cette table n'affiche pas de badge.
const MAQUETTE_VERSIONS = {
  archi: { lot: "Lot Structure", version: 3, date: "12/10/2026" },
  toit: { lot: "Lot Toiture", version: 2, date: "05/10/2026" },
  cea: { lot: "Lot Architecture", version: 1, date: "21/09/2026" },
  "hosp-arch": { lot: "Lot Architecture", version: 2, date: "12/10/2026" },
  "hosp-mep": { lot: "Lot CVC", version: 1, date: "05/10/2026" },
  "hosp-struct": { lot: "Lot Structure", version: 3, date: "12/10/2026" },
  "hosp-elec": { lot: "Lot Électricité", version: 1, date: "28/09/2026" },
  "hosp-alarm": { lot: "Lot Sécurité incendie", version: 1, date: "28/09/2026" },
  "hosp-plomb": { lot: "Lot Plomberie", version: 2, date: "05/10/2026" },
  "hosp-spr": { lot: "Lot Sprinklers", version: 1, date: "05/10/2026" }
};

// Une seule bulle, rattachee a <body> et positionnee en "fixed" : elle passe
// ainsi au-dessus de tout et n'est jamais rognee par le panneau lateral ni
// masquee par la section Niveaux.
const versionTip = document.createElement("div");
versionTip.id = "versionTip";
versionTip.setAttribute("role", "tooltip");
versionTip.hidden = true;
document.body.appendChild(versionTip);
let versionTipOwner = null;

function showVersionTip(badge, info) {
  versionTip.textContent = "";
  const lot = document.createElement("strong");
  lot.textContent = info.lot;
  versionTip.append(lot, "Version " + info.version + " · mise à jour le " + info.date);
  versionTip.hidden = false;
  versionTipOwner = badge;
  const r = badge.getBoundingClientRect();
  const t = versionTip.getBoundingClientRect();
  const margin = 8;
  let left = r.right - t.width;
  left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
  let top = r.top - t.height - 6;
  if (top < margin) top = r.bottom + 6;
  versionTip.style.left = left + "px";
  versionTip.style.top = top + "px";
}

function hideVersionTip() {
  versionTip.hidden = true;
  versionTipOwner = null;
}

function createVersionBadge(info) {
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "ver-badge";
  badge.textContent = "V" + info.version;
  badge.setAttribute("aria-label", "Version " + info.version + " de la maquette, voir le détail");
  badge.addEventListener("mouseenter", () => showVersionTip(badge, info));
  badge.addEventListener("mouseleave", hideVersionTip);
  badge.addEventListener("focus", () => showVersionTip(badge, info));
  badge.addEventListener("blur", hideVersionTip);
  badge.addEventListener("click", () => {
    if (versionTipOwner === badge && !versionTip.hidden) hideVersionTip();
    else showVersionTip(badge, info);
  });
  return badge;
}

document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".ver-badge")) hideVersionTip();
});

function renderMaquetteRows(targetList, maquettesSubset) {
  targetList.innerHTML = "";
  maquettesSubset.forEach((maquette) => {
    const li = document.createElement("li");
    li.className = "maquette-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = maquette.shown;
    checkbox.addEventListener("change", () => {
      maquette.shown = checkbox.checked;
      applyVisibility();
    });

    const swatch = document.createElement("span");
    swatch.className = "maquette-swatch";
    swatch.style.background = maquette.color;

    const name = document.createElement("button");
    name.type = "button";
    name.className = "maquette-name";
    name.textContent = maquette.label;
    name.addEventListener("click", () => {
      maquettesSubset.forEach((m) => { m.shown = m === maquette; });
      applyVisibility();
      renderMaquetteRows(targetList, maquettesSubset);
    });

    const count = document.createElement("span");
    count.className = "maquette-count";
    count.textContent = maquette.model ? maquette.model.numEntities.toLocaleString("fr-FR") + " éléments" : "…";

    // Nom puis nombre d'elements en dessous (meme gabarit pour toutes les
    // maquettes), le badge de version a droite.
    const text = document.createElement("span");
    text.className = "maquette-text";
    text.append(name, count);

    li.append(checkbox, swatch, text);
    if (MAQUETTE_VERSIONS[maquette.id]) li.append(createVersionBadge(MAQUETTE_VERSIONS[maquette.id]));
    targetList.appendChild(li);

    if (!maquetteCountEls.has(maquette.id)) maquetteCountEls.set(maquette.id, []);
    maquetteCountEls.get(maquette.id).push(count);
  });
}

const niveauxState = [];

// Seul point de la page qui pousse un changement de visibilite vers xeokit.
// Recalcule tout depuis 2 sources independantes : maquette.shown (case a
// cocher/solo maquette) et niveau.checked (case a cocher/solo niveau) :
// - une maquette non "shown" : tous ses objets masques, quels que soient les
//   niveaux coches ou non (regle du 05/09 : le solo maquette ne doit JAMAIS
//   toucher aux niveaux) ;
// - une maquette "shown" : chaque objet suit le niveau auquel il est
//   rattache (s'il y en a un), les objets sans niveau connu restent visibles.
// Toujours tout recalculer d'un coup (jamais une reapplication partielle) :
// c'est ce qui evitait les bugs en cascade des versions precedentes (masquer
// une maquette puis en montrer une autre pouvait rendre visibles des objets
// d'une maquette pourtant encore decochee).
function applyVisibility() {
  const shownById = new Map(MAQUETTES.map((m) => [m.id, m.shown]));

  MAQUETTES.forEach((m) => {
    if (m.model) m.model.visible = m.shown;
  });

  niveauxState.forEach((niveau) => {
    Object.entries(niveau.objectsByMaquette).forEach(([maquetteId, ids]) => {
      const shown = (shownById.get(maquetteId) !== false) && niveau.checked;
      viewer.scene.setObjectsVisible(ids, shown);
    });
  });

  // Garde-corps IfcRailing mal positionnes a la source IFC du projet hopital
  // (cf HOSPITAL_MISPLACED_RAILING_IDS plus bas, diagnostic IES du 11/09,
  // porte le 16/09 avec les memes fichiers XKT) : toujours masques quand la
  // maquette "hosp-arch" est chargee, quel que soit l'etat des niveaux/
  // checkbox. Reapplique ici, a la fin, a chaque recalcul (et non en dehors
  // de cette fonction, seul point qui pousse de la visibilite vers xeokit)
  // pour ne jamais se faire ecraser par un toggle de niveau qui les
  // remettrait visibles.
  if (shownById.has("hosp-arch")) {
    viewer.scene.setObjectsVisible(HOSPITAL_MISPLACED_RAILING_IDS, false);
  }

  refreshCollisionMaquetteToggles();
  // Previent le curseur de coupe (course a recalculer selon ce qui est visible).
  window.dispatchEvent(new Event("visibilite-changee"));
}

// Garde-corps (IfcRailing) du projet hopital dont la chaine IfcLocalPlacement
// est corrompue directement a la source (offset local quasiment oppose a
// l'offset de leur placement parent, diagnostic IES du 11/09, pas un bug du
// pipeline d'import de ce projet). Ils atterrissent pres de l'origine du
// monde IFC au lieu de leur etage. Fichier source = jeu de test public
// (WestRiverSide Hospital) : contournement visuel plutot que reparation de
// l'IFC ou reconversion. Liste figee (memes GUID que cote IES, memes
// fichiers XKT) : GUID = element.GlobalId, elements dont le centre de bbox
// tombe hors de l'enveloppe du batiment.
const HOSPITAL_MISPLACED_RAILING_IDS = [
  "1NU4DBqZr9TveX2NFh7PrI",
  "2e$FV4Y9f6NPrJ7KOfe14U",
  "3NoPuFwSP2$ukR3bjeYMMS",
  "37lZNn4SHFawe$5ITwJJpq",
  "1zhleAQ4z7IhcfPaY8GgGb",
  "2ZoIlszeb7y8t1_FxE$e8y",
  "0OLDFHvsT2fvWuPyaWakuD",
  "0mPx06yCT81Oir7rgqE8a2",
  "21BheI$eX15OQoWN2f7nBq",
  "1JtlWVxEHF7AtnVhy0$7Xe",
  "38$O$vZ5r3$h_KGQTTsXE5",
  "0FQP_M_L9CUOuIiAy668HI",
  "0DJSIqdVP289oPRnBHeG5C",
  "2WetIfYwT3igEiGFFiPlO9",
  "0yWW_91e9BzgCnPQ6U_Vy2",
  "3Z2iznH717FxB09x2OQu1S",
  "0bWHqDYhP9l9bZwXFgwD6F",
  "0cvnr162r2qRGfCroKgvqN",
  "2Cd4x0qfzCaubEd0IqNKaH",
  "1iTlCtoG5BNRuGHj1YUyKK",
  "1Ib3Rs4fn1Ufu1Vad7Ar6F",
  "2rxO7f4zbBJ8Ji6togGdpG",
  "1vFhikqQ163Pzjkl699cjh",
  "2ebwD8q_r6DeLBBZ8NlCRr",
  "3Aqo$pSrb7YwrcNdiiJdK0",
  "2M$9CiIFv8_fHn8uoZNXCJ",
  "0mRctqW7P5IwSZkA2Fi9OV",
  "3sXCbf4XTByQhehgTY2Son",
  "3LgX6wz1L7pRQ1ad9wkmz6",
  "0Yy5HEbTj9jQzJM_Clf3Z_"
];

// Correspondance manuelle par NOM de niveau propre a chaque maquette (plus
// fiable que toute geometrie, cf le 05/09 : les altitudes ne se recoupaient
// pas entre fichiers, et deux heuristiques Z de suite ont donne des ordres
// incoherents). La CEA et Archi ont chacune leurs vrais niveaux IFC ("Niveau
// R+1" / "Niveau 1" par ex.) ; Toiture n'en a pas, ses objets sont rattaches
// en bloc au dernier niveau (R+3). Un element mal rattache dans un fichier
// source (deja vu sur des lits, cf discussion "Niveau R+2, lits") reste
// alors visible au mauvais endroit : assume, ca revele un souci de la
// maquette elle-meme, pas un bug du viewer.
const NIVEAU_MAPPING = [
  { label: "Soubassement", cea: "Base Mur soubassement", archi: null },
  { label: "R+0", cea: "Structure R+0", archi: "Niveau 0" },
  { label: "R+1", cea: "Structure R+1", archi: "Niveau 1" },
  { label: "R+2", cea: "Niveau R+2", archi: "Niveau 2" },
  { label: "R+3", cea: "Niveau R+3", archi: null }
];

function findStoreyObjectIds(maquetteId, storeyName) {
  if (!storeyName || !viewer.metaScene.metaModels[maquetteId]) return [];
  const metaObject = Object.values(viewer.metaScene.metaObjectsByType["IfcBuildingStorey"] || {})
    .find((mo) => mo.name === storeyName && mo.metaModels.some((m) => m.id === maquetteId));
  return metaObject ? viewer.metaScene.getObjectIDsInSubtree(metaObject.id) : [];
}

// Decouverte generique des niveaux (portee depuis IES le 16/09, projets
// autres que la demo) : vrais IfcBuildingStorey de chaque maquette chargee,
// regroupes par nom exact. Contrairement a NIVEAU_MAPPING (demo, mapping
// fige a la main), aucune correspondance geree si 2 maquettes du meme
// projet nomment leurs etages differemment : chaque nom distinct devient sa
// propre ligne. "Level 2 Ceiling" regroupe avec "Level 2" : Revit cree
// souvent un etage de reference distinct pour heberger les plafonds/plenum
// d'un niveau, pas un vrai niveau separe du point de vue de l'usager.
function canonicalStoreyName(name) {
  return name
    .replace(/\s+Ceiling$/i, "")
    // "Level 2 TOS" (Top Of Steel, etage de reference du modele Structure)
    // rejoint "Level 2" : meme logique que Ceiling.
    .replace(/\s+TOS$/i, "")
    // "Level 7A" rejoint "Level 7" : suffixe lettre apres un niveau
    // numerote, variante/mezzanine du meme niveau plutot qu'un vrai niveau
    // distinct du point de vue de l'usager.
    .replace(/^(Level\s+\d+)[A-Z]$/i, "$1");
}

function buildGenericNiveaux(previousChecked) {
  const loadedMaquettes = MAQUETTES.filter((m) => viewer.metaScene.metaModels[m.id]);
  if (loadedMaquettes.length === 0) return null;

  const storeysByName = new Map();
  loadedMaquettes.forEach((maquette) => {
    Object.values(viewer.metaScene.metaObjectsByType["IfcBuildingStorey"] || {})
      .filter((mo) => mo.metaModels.some((m) => m.id === maquette.id))
      .forEach((mo) => {
        const ids = viewer.metaScene.getObjectIDsInSubtree(mo.id);
        if (ids.length === 0) return;
        const key = canonicalStoreyName(mo.name);
        if (!storeysByName.has(key)) storeysByName.set(key, {});
        const bucket = storeysByName.get(key);
        bucket[maquette.id] = (bucket[maquette.id] || []).concat(ids);
      });
  });

  return Array.from(storeysByName.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "fr", { numeric: true }))
    .map(([name, objectsByMaquette]) => ({
      name,
      checked: previousChecked.has(name) ? previousChecked.get(name) : true,
      checkboxEl: null,
      objectsByMaquette
    }));
}

function renderNiveaux() {
  // Le rendu peut se re-declencher a chaque maquette qui termine son
  // chargement (elles arrivent dans un ordre pas garanti) : on repart de zero
  // a chaque fois, mais en conservant l'etat coche choisi par l'utilisateur
  // entre-temps, plutot que de le reinitialiser silencieusement.
  const previousChecked = new Map(niveauxState.map((n) => [n.name, n.checked]));

  let niveaux;
  if (projectSelect.value === DEMO_PROJECT_KEY) {
    if (!viewer.metaScene.metaModels["cea"]) return;
    niveaux = NIVEAU_MAPPING.map((entry) => {
      const objectsByMaquette = {};
      const ceaIds = findStoreyObjectIds("cea", entry.cea);
      if (ceaIds.length > 0) objectsByMaquette.cea = ceaIds;
      const archiIds = findStoreyObjectIds("archi", entry.archi);
      if (archiIds.length > 0) objectsByMaquette.archi = archiIds;
      if (entry.label === "R+3") {
        const toitMetaModel = viewer.metaScene.metaModels["toit"];
        if (toitMetaModel && toitMetaModel.rootMetaObject) {
          const toitIds = viewer.metaScene.getObjectIDsInSubtree(toitMetaModel.rootMetaObject.id);
          if (toitIds.length > 0) objectsByMaquette.toit = toitIds;
        }
      }
      return {
        name: entry.label,
        checked: previousChecked.has(entry.label) ? previousChecked.get(entry.label) : true,
        checkboxEl: null,
        objectsByMaquette
      };
    });
  } else {
    // Projet hopital (porte depuis IES le 16/09) : pas de NIVEAU_MAPPING
    // fige a la main (specifique aux noms d'etages de la demo), decouverte
    // generique des vrais IfcBuildingStorey a la place.
    niveaux = buildGenericNiveaux(previousChecked);
    if (niveaux === null) return;
  }

  niveauxList.innerHTML = "";
  niveauxState.length = 0;

  niveaux.forEach((niveau) => {
    niveauxState.push(niveau);

    const li = document.createElement("li");
    li.className = "niveau-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = niveau.checked;
    checkbox.addEventListener("change", () => {
      niveau.checked = checkbox.checked;
      applyVisibility();
    });
    niveau.checkboxEl = checkbox;

    const name = document.createElement("button");
    name.type = "button";
    name.className = "niveau-name";
    name.textContent = niveau.name;
    name.addEventListener("click", () => soloNiveau(niveau));

    li.append(checkbox, name);
    niveauxList.appendChild(li);
  });

  applyVisibility();
}

function soloNiveau(target) {
  niveauxState.forEach((niveau) => {
    niveau.checked = niveau === target;
    niveau.checkboxEl.checked = niveau.checked;
  });
  applyVisibility();

  // 20/10 : la fiche d'un niveau ne montrait que son nom, sans interet ; elle ne s'affiche plus
  // que si des documents sont rattaches au niveau.
  const docs = DOCS_BY_NIVEAU[target.name] || [];
  if (docs.length) showSelection([["Niveau", target.name]], docs);
}

maquettesResetBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  MAQUETTES.forEach((m) => { m.shown = true; });
  applyVisibility();
  renderMaquetteRows(maquettesList, MAQUETTES);
});

niveauxResetBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  niveauxState.forEach((niveau) => {
    niveau.checked = true;
    niveau.checkboxEl.checked = true;
  });
  applyVisibility();
});

function openDocModal(doc) {
  docModalName.textContent = doc.nom;
  docModalVersion.textContent = doc.version;
  docModalLot.textContent = doc.lot;
  docModalType.textContent = doc.type;
  docModalOverlay.hidden = false;
}

function closeDocModal() {
  docModalOverlay.hidden = true;
}

function closeAllModals() {
  downloadModalOverlay.hidden = true;
  docModalOverlay.hidden = true;
}

docModalClose.addEventListener("click", closeDocModal);
docModalOverlay.addEventListener("click", (e) => {
  if (e.target === docModalOverlay) closeDocModal();
});
docModalDownload.addEventListener("click", () => {
  downloadModalOverlay.hidden = false;
});
downloadModalOk.addEventListener("click", closeAllModals);

function labelForMaquette(maquetteId) {
  const maquette = MAQUETTES.find((m) => m.id === maquetteId);
  return maquette ? maquette.label : maquetteId;
}

// Rendu partage entre la fiche du tiroir lateral (desktop + tiroir "☰ Infos"
// mobile) et la modale discrete du bas d'ecran (mobile, cf ficheSheet) :
// memes donnees, deux emplacements d'affichage.
function renderFicheInto(contentEl, docsEl, rows, docs) {
  contentEl.innerHTML = "";
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    contentEl.append(dt, dd);
  });

  docsEl.innerHTML = "";
  if (docs && docs.length > 0) {
    const docsByLot = new Map();
    docs.forEach((doc) => {
      if (!docsByLot.has(doc.lot)) docsByLot.set(doc.lot, []);
      docsByLot.get(doc.lot).push(doc);
    });

    docsByLot.forEach((lotDocs, lot) => {
      const lotTitle = document.createElement("p");
      lotTitle.className = "doc-lot";
      lotTitle.textContent = lot;
      docsEl.appendChild(lotTitle);

      lotDocs.forEach((doc) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "doc-item";
        btn.addEventListener("click", () => openDocModal(doc));

        const version = document.createElement("span");
        version.className = "doc-version";
        version.textContent = doc.version;

        const name = document.createElement("span");
        name.className = "doc-name";
        name.textContent = doc.nom;

        btn.append(version, name);
        docsEl.appendChild(btn);
      });
    });
  }
}

// Carte "Info selection" independante (ordinateur) : n'existe visuellement
// que pendant une selection dans la vue Viewer. Elements recherches a la
// demande et gardes (null) : aucune dependance a l'ordre de declaration.
function closeFicheCard() {
  const card = document.getElementById("ficheCard");
  if (card) card.classList.remove("open");
  const collisionCard = document.getElementById("collisionFicheCard");
  if (collisionCard) collisionCard.classList.remove("open");
}

function showSelection(rows, docs) {
  // Carte independante / feuille du bas : seulement si la vue Viewer est
  // affichee (le meme code sert la selection de Collision, qui a sa fiche).
  const card = document.getElementById("ficheCard");
  const cardContent = document.getElementById("ficheCardContent");
  const cardDocs = document.getElementById("ficheCardDocs");
  if (!viewViewer.hidden) {
    if (isMobileViewport()) {
      renderFicheInto(ficheSheetContent, ficheSheetDocs, rows, docs);
      openFicheSheet();
    } else if (card && cardContent && cardDocs) {
      renderFicheInto(cardContent, cardDocs, rows, docs);
      card.classList.add("open");
    }
  }

  // "Info selection" est repliee par defaut : elle s'ouvre au clic sur un
  // element ou un niveau. Ne deplie jamais le panneau lui-meme.
  document.getElementById("section-fiche").open = true;
  renderFicheInto(ficheContent, ficheDocs, rows, docs);
  fichePlaceholder.hidden = true;
  ficheContent.hidden = false;
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function openFicheSheet() {
  ficheSheet.classList.add("open");
}

function closeFicheSheet() {
  ficheSheet.classList.remove("open");
}

// Fermer la fiche deselectionne l'element (20/10) : de pres dans la maquette, il n'y a plus de zone vide ou toucher.
ficheSheetClose.addEventListener("click", () => {
  closeFicheSheet();
  deselectEntity();
});

// Remonte l'arbre spatial IFC (parent en parent) jusqu'a trouver l'etage
// auquel l'element clique est officiellement rattache dans le fichier
// source, independamment de sa position reelle dans l'espace (utile pour
// reperer un element mal rattache par la maquette d'origine).
function findNiveauIfc(objectId) {
  let metaObject = viewer.metaScene.metaObjects[objectId];
  while (metaObject) {
    if (metaObject.type === "IfcBuildingStorey") return metaObject.name;
    metaObject = metaObject.parent;
  }
  return null;
}

function showFiche(entity) {
  const metaObject = viewer.metaScene.metaObjects[entity.id];
  const rows = [
    ["Nom", metaObject ? metaObject.name : entity.id],
    ["Type IFC", metaObject ? metaObject.type : "n/a"],
    ["Maquette", metaObject && metaObject.metaModels[0] ? labelForMaquette(metaObject.metaModels[0].id) : "n/a"],
    ["Niveau (IFC)", findNiveauIfc(entity.id) || "n/a"]
  ];
  const docs = DOCS_BY_ELEMENT[entity.id] || [];
  showSelection(rows, docs);

  // Meme fiche que le tiroir Viewer, dans le panneau Collision (section
  // "Info sélection" en bas du drawer) : utile pour identifier precisement
  // l'element rouge ou vert d'une collision selectionnee.
  renderFicheInto(collisionFicheContent, collisionFicheDocs, rows, docs);
  collisionFichePlaceholder.hidden = true;
  collisionFicheContent.hidden = false;

  // Carte independante de la page Collision (ordinateur) : seulement si la
  // page Collision est affichee avec une detection ouverte (showFiche sert
  // aussi Viewer et Discussions). Mobile : feuille du bas ci-dessous.
  const collisionCard = document.getElementById("collisionFicheCard");
  const collisionCardContent = document.getElementById("collisionFicheCardContent");
  const collisionCardDocs = document.getElementById("collisionFicheCardDocs");
  const viewCollisionEl = document.getElementById("view-collision");
  if (viewCollisionEl && !viewCollisionEl.hidden && !collisionDetail.hidden && !isMobileViewport()
      && collisionCard && collisionCardContent && collisionCardDocs) {
    renderFicheInto(collisionCardContent, collisionCardDocs, rows, docs);
    collisionCard.classList.add("open");
  }

  // Mobile : evite d'obliger a ouvrir le tiroir "☰ Infos" en entier juste
  // pour voir la fiche d'un element tape, une modale discrete en bas
  // d'ecran suffit (memes donnees que le tiroir).
  if (isMobileViewport()) {
    renderFicheInto(ficheSheetContent, ficheSheetDocs, rows, docs);
    openFicheSheet();
  }
}

function clearFiche() {
  // "Info selection" n'est ouverte que lorsqu'un element est selectionne :
  // on la referme des qu'il n'y a plus de selection.
  document.getElementById("section-fiche").open = false;
  fichePlaceholder.hidden = false;
  ficheContent.hidden = true;
  ficheContent.innerHTML = "";
  ficheDocs.innerHTML = "";
  collisionFichePlaceholder.hidden = false;
  collisionFicheContent.hidden = true;
  collisionFicheContent.innerHTML = "";
  collisionFicheDocs.innerHTML = "";
  closeFicheSheet();
  closeFicheCard();
}

let selectedEntity = null;

function deselectEntity() {
  if (selectedEntity) {
    selectedEntity.selected = false;
    selectedEntity = null;
  }
  clearFiche();
}

// Coupe par surface : clic sur "Créer une coupe" arme le mode, le prochain
// clic sur la maquette pose le plan a cet endroit avec la normale de la
// surface visee (pas une position/orientation inventee). Un seul plan de
// coupe actif a la fois.
let coupePickingMode = false;
let activeCoupeId = null;
// Choix "Sur une surface" / "Coupe horizontale" ouvert par "Creer une coupe" (20/10).
let coupeChoixOuvert = false;

// Etat des boutons : coupe active (Desactiver), choix ouvert (Annuler + les deux choix), sinon Creer une coupe.
function majBoutonsCoupe() {
  const choix = coupeChoixOuvert && !activeCoupeId;
  coupeChoixBar.hidden = !choix;
  coupeChoixSurface.classList.toggle("active", choix && coupePickingMode);
  coupeChoixSurface.textContent = coupePickingMode ? "Cliquez sur une surface…" : "Sur une surface";
  if (activeCoupeId) {
    coupeBtn.textContent = "Désactiver la coupe";
    coupeBtn.classList.add("active");
  } else if (choix) {
    coupeBtn.textContent = "Annuler";
    coupeBtn.classList.add("active");
  } else {
    coupeBtn.textContent = "Créer une coupe";
    coupeBtn.classList.remove("active");
  }
}

function setCoupePickingMode(on) {
  coupePickingMode = on;
  majBoutonsCoupe();
}

function destroyActiveCoupe() {
  if (activeCoupeId) {
    sectionPlanes.destroySectionPlane(activeCoupeId);
    sectionPlanes.hideControl();
    activeCoupeId = null;
  }
  coupeToggleVisibilityBtn.hidden = true;
  coupeToggleVisibilityBtn.textContent = "Masquer le plan de coupe";
  coupeInvertBtn.hidden = true;
  coupeChoixOuvert = false;
  coupePickingMode = false;
  majBoutonsCoupe();
  if (coupeSliderWrap) coupeSliderWrap.hidden = true;
}

// Curseur "Position de la coupe" : deplace le plan le long de sa normale, entre les deux extremites de la maquette
// projetees sur cette normale. Sur mobile il remplace la fleche 3D (retiree), sur ordinateur il s'y ajoute.
// Course du curseur (20/10) : etendue des elements VISIBLES seulement (sans les bulles de collision), sinon des
// elements masques mais lointains (les garde-corps mal places de l'hopital, tout pres de l'origine du monde)
// l'etiraient bien au-dela de la maquette. Si tout est masque, etendue de toute la maquette : le plan ne sort jamais
// de la maquette. Calculee une fois (creation, inversion, changement de visibilite), pas a chaque mouvement.
let coupeAabb = null;
function calculerAabbCoupe() {
  const sansBulles = (ids) => ids.filter((id) => !String(id).startsWith(CLASH_MARKER_ID_PREFIX));
  let ids = sansBulles(viewer.scene.visibleObjectIds);
  if (ids.length === 0) ids = sansBulles(viewer.scene.objectIds);
  return ids.length ? viewer.scene.getAABB(ids) : viewer.scene.aabb;
}
// Axe du curseur : la direction du plan, sauf pour un plan (presque) horizontal ou on prend toujours la verticale
// vers le haut, pour que pousser le curseur vers la droite monte le plan, que la coupe soit inversee ou non.
function coupeAxe(sectionPlane) {
  const d = sectionPlane.dir;
  return Math.abs(d[1]) > 0.7 ? (d[1] > 0 ? [d[0], d[1], d[2]] : [-d[0], -d[1], -d[2]]) : [d[0], d[1], d[2]];
}
function coupePlage(sectionPlane) {
  const a = coupeAabb || (coupeAabb = calculerAabbCoupe());
  const axe = coupeAxe(sectionPlane);
  let tmin = Infinity;
  let tmax = -Infinity;
  for (const x of [a[0], a[3]]) for (const y of [a[1], a[4]]) for (const z of [a[2], a[5]]) {
    const t = x * axe[0] + y * axe[1] + z * axe[2];
    if (t < tmin) tmin = t;
    if (t > tmax) tmax = t;
  }
  return { tmin, tmax };
}
function coupeDistance(sectionPlane) {
  const axe = coupeAxe(sectionPlane);
  return sectionPlane.pos[0] * axe[0] + sectionPlane.pos[1] * axe[1] + sectionPlane.pos[2] * axe[2];
}
// Le plan peut aussi etre deplace par la fleche 3D : le curseur suit.
function coupeSyncValeur(sectionPlane) {
  const { tmin, tmax } = coupePlage(sectionPlane);
  const ratio = tmax > tmin ? (coupeDistance(sectionPlane) - tmin) / (tmax - tmin) : 0.5;
  coupeSlider.value = String(Math.min(1000, Math.max(0, Math.round(ratio * 1000))));
}
function ecouterPositionCoupe(sectionPlane) {
  sectionPlane.on("pos", () => coupeSyncValeur(sectionPlane));
}
function majCoupeSlider() {
  const sectionPlane = activeCoupeId ? viewer.scene.sectionPlanes[activeCoupeId] : null;
  coupeSliderWrap.hidden = !sectionPlane;
  if (!sectionPlane) return;
  coupeAabb = calculerAabbCoupe();
  // Place le curseur juste au-dessus de la barre de coupe.
  coupeSliderWrap.style.bottom = (parseFloat(getComputedStyle(coupeToolbar).bottom) + coupeToolbar.offsetHeight + 8) + "px";
  coupeSyncValeur(sectionPlane);
}
coupeSlider.addEventListener("input", () => {
  const sectionPlane = activeCoupeId ? viewer.scene.sectionPlanes[activeCoupeId] : null;
  if (!sectionPlane) return;
  const { tmin, tmax } = coupePlage(sectionPlane);
  const decalage = tmin + (Number(coupeSlider.value) / 1000) * (tmax - tmin) - coupeDistance(sectionPlane);
  const axe = coupeAxe(sectionPlane);
  sectionPlane.pos = [
    sectionPlane.pos[0] + axe[0] * decalage,
    sectionPlane.pos[1] + axe[1] * decalage,
    sectionPlane.pos[2] + axe[2] * decalage
  ];
});
window.addEventListener("resize", () => { if (activeCoupeId) majCoupeSlider(); });
window.addEventListener("visibilite-changee", () => { if (activeCoupeId) majCoupeSlider(); });

// Orientation du rectangle du plan de coupe (20/10, demande de Gilles) : son bord bas reste parallele au sol.
// xeokit laisse une rotation libre autour de la normale (roll) : on impose donc l'orientation, avec comme
// axes locaux X = horizontal, Y = la verticale du monde projetee sur le plan, Z = la direction du plan
// (SectionPlane : dir = quaternion * [0, 0, 1], la direction ne change donc pas). Monde : Y vers le haut.
function orienterPlanDeCoupe(sectionPlane) {
  const d = sectionPlane.dir;
  const z = [d[0], d[1], d[2]];
  let x = [z[2], 0, -z[0]]; // haut x z : toujours horizontal
  let n = Math.hypot(x[0], x[1], x[2]);
  if (n < 1e-3) { // plan quasi horizontal : pas de "bas" defini, on prend l'axe X du monde
    const k = z[0];
    x = [1 - z[0] * k, -z[1] * k, -z[2] * k];
    n = Math.hypot(x[0], x[1], x[2]);
  }
  x = x.map((v) => v / n);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  // Quaternion [x, y, z, w] depuis la base (colonnes x, y, z).
  const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
  const trace = m00 + m11 + m22;
  let q;
  if (trace > 0) {
    const t = 0.5 / Math.sqrt(trace + 1);
    q = [(m21 - m12) * t, (m02 - m20) * t, (m10 - m01) * t, 0.25 / t];
  } else if (m00 > m11 && m00 > m22) {
    const t = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * t, (m01 + m10) / t, (m02 + m20) / t, (m21 - m12) / t];
  } else if (m11 > m22) {
    const t = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / t, 0.25 * t, (m12 + m21) / t, (m02 - m20) / t];
  } else {
    const t = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / t, (m12 + m21) / t, 0.25 * t, (m10 - m01) / t];
  }
  sectionPlane.quaternion = q;
}

coupeInvertBtn.addEventListener("click", () => {
  if (!activeCoupeId) return;
  sectionPlanes.flipSectionPlanes();
  orienterPlanDeCoupe(viewer.scene.sectionPlanes[activeCoupeId]);
  majCoupeSlider();
});

coupeBtn.addEventListener("click", () => {
  if (activeCoupeId) {
    destroyActiveCoupe();
    return;
  }
  // "Creer une coupe" ouvre le choix (sur une surface, ou horizontale), "Annuler" le referme (20/10).
  coupeChoixOuvert = !coupeChoixOuvert;
  if (!coupeChoixOuvert) coupePickingMode = false;
  majBoutonsCoupe();
});

// Sur une surface : meme principe qu'avant (04/09), le prochain clic sur la maquette pose le plan avec la normale de
// la surface visee. Retire le 04/09 : reutiliser un element deja selectionne ne donnait pas une position fiable.
coupeChoixSurface.addEventListener("click", () => setCoupePickingMode(!coupePickingMode));
// Coupe horizontale : a mi-hauteur des elements visibles, on retire ce qui est au-dessus du plan.
coupeChoixHoriz.addEventListener("click", () => {
  const a = calculerAabbCoupe();
  creerCoupe([(a[0] + a[3]) / 2, (a[1] + a[4]) / 2, (a[2] + a[5]) / 2], [0, -1, 0]);
});

coupeToggleVisibilityBtn.addEventListener("click", () => {
  if (!activeCoupeId) return;
  // Masque/affiche le widget 3D (rectangle + poignees de rotation/translation),
  // pas l'effet de coupe lui-meme : le batiment reste tranche dans les 2 cas,
  // ca sert juste a degager la vue une fois le plan bien positionne.
  if (sectionPlanes.getShownControl() === activeCoupeId) {
    sectionPlanes.hideControl();
    coupeToggleVisibilityBtn.textContent = "Afficher le plan de coupe";
  } else {
    sectionPlanes.showControl(activeCoupeId);
    coupeToggleVisibilityBtn.textContent = "Masquer le plan de coupe";
  }
});

// Position + orientation = donnees reelles du pick sur la surface visee
// (pickSurface), pas une approximation (ni entity.aabb, ni direction
// camera, qui donnaient tous les deux un plan errone, cf incidents du
// 04/09).
function creerCoupe(pos, dir) {
  activeCoupeId = "coupe-surface";
  sectionPlanes.createSectionPlane({ id: activeCoupeId, pos, dir });
  orienterPlanDeCoupe(viewer.scene.sectionPlanes[activeCoupeId]);
  ecouterPositionCoupe(viewer.scene.sectionPlanes[activeCoupeId]);
  sectionPlanes.showControl(activeCoupeId);
  coupeChoixOuvert = false;
  coupePickingMode = false;
  majBoutonsCoupe();
  coupeToggleVisibilityBtn.hidden = false;
  coupeToggleVisibilityBtn.textContent = "Masquer le plan de coupe";
  coupeInvertBtn.hidden = false;
  majCoupeSlider();
}

function createCoupeFromHit(hit) {
  // Sens inverse de la normale de surface par defaut (demande explicite du
  // 04/09) : coupe ce qui est devant la surface visee, pas derriere.
  creerCoupe(hit.worldPos, [-hit.worldNormal[0], -hit.worldNormal[1], -hit.worldNormal[2]]);
}

function handleViewerPick(canvasCoords) {
  if (coupePickingMode) {
    const hit = viewer.scene.pick({ canvasPos: canvasCoords, pickSurface: true, pickSurfaceNormal: true });
    setCoupePickingMode(false);
    if (hit && hit.worldPos && hit.worldNormal) {
      createCoupeFromHit(hit);
    }
    return;
  }

  const hit = viewer.scene.pick({ canvasPos: canvasCoords });

  // Clic sur une bulle de collision : meme effet que cliquer la ligne dans
  // la liste, pas une selection d'element classique (fiche/proprietes).
  if (hit && hit.entity && typeof hit.entity.id === "string" && hit.entity.id.startsWith(CLASH_MARKER_ID_PREFIX)) {
    const clash = CLASHES.find((c) => c.id === hit.entity.id.slice(CLASH_MARKER_ID_PREFIX.length));
    if (clash) activateClash(clash);
    return;
  }

  // Retoucher l'element deja selectionne le deselectionne (20/10) : de pres dans la maquette, il n'y a plus de
  // zone vide ou toucher. Une des mecaniques possibles avec la croix de la fiche (la croix reste la plus visible).
  if (hit && hit.entity && selectedEntity && hit.entity.id === selectedEntity.id) {
    deselectEntity();
    closeFicheSheet();
    closeFicheCard();
    return;
  }

  if (selectedEntity) {
    selectedEntity.selected = false;
    selectedEntity = null;
  }

  if (hit && hit.entity) {
    hit.entity.selected = true;
    selectedEntity = hit.entity;
    showFiche(hit.entity);
  } else {
    clearFiche();
  }
}

viewer.scene.input.on("mouseclicked", handleViewerPick);

// "mouseclicked" de xeokit ne se declenche jamais au tactile (aucune souris
// n'est impliquee) : sur mobile, un tap ne selectionnait donc jamais rien.
// Un tap est detecte a la main (peu de mouvement, pas trop long entre le
// debut et la fin du toucher), pour ne pas interferer avec le CameraControl
// de xeokit qui gere deja l'orbite/le pincer-zoomer au tactile sur le meme
// canvas.
let viewerTouchStart = null;
viewerCanvas.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) {
    viewerTouchStart = null;
    return;
  }
  const rect = viewerCanvas.getBoundingClientRect();
  viewerTouchStart = {
    x: e.touches[0].clientX - rect.left,
    y: e.touches[0].clientY - rect.top,
    time: Date.now()
  };
}, { passive: true });

viewerCanvas.addEventListener("touchend", (e) => {
  if (!viewerTouchStart) return;
  const rect = viewerCanvas.getBoundingClientRect();
  const touch = e.changedTouches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const moved = Math.hypot(x - viewerTouchStart.x, y - viewerTouchStart.y);
  const elapsed = Date.now() - viewerTouchStart.time;
  viewerTouchStart = null;
  if (moved < 10 && elapsed < 500) {
    handleViewerPick([x, y]);
  }
}, { passive: true });

renderMaquetteRows(maquettesList, MAQUETTES);

const IfcAPI = new WebIFC.IfcAPI();
IfcAPI.SetWasmPath("/wasm/");

let ifcLoader = null;
let xktLoader = null;

// Vue de depart definissable par le BIM Manager (porte depuis IES le 16/09,
// cf ecran Admin > Maquettes > "Vue d'ensemble") : ecrit dans le meme
// localStorage que l'app (meme origine, l'ecran Admin tourne dans un iframe
// sur ce domaine), cle scopee par projet pour ne jamais melanger les 2
// projets. Fallback sur DEFAULT_CAMERA_STATE/HOSPITAL_CAMERA_STATE (valeurs
// trouvees a la main via le log camera console) si rien n'a ete enregistre.
function getDefaultCameraState(projectKey) {
  try {
    const stored = localStorage.getItem("chantier-default-camera-" + projectKey);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // localStorage indisponible ou valeur corrompue, on retombe sur le defaut.
  }
  if (projectKey === HOSPITAL_PROJECT_KEY) return HOSPITAL_CAMERA_STATE;
  if (projectKey === DEMO_PROJECT_KEY) return DEFAULT_CAMERA_STATE;
  return null;
}

// Renommage d'une maquette depuis Admin > Maquettes (porte depuis IES le
// 16/09) : ids differents cote Admin (structure/toiture/cea/hospital-archi/
// hospital-meca) et cote PROJECTS ci-dessus (archi/toit/cea/hosp-arch/
// hosp-mep), d'ou cette table de correspondance plutot qu'un id partage
// (aurait force a toucher tout le reste du code qui depend deja des ids
// PROJECTS existants).
const ADMIN_MAQUETTE_ID_MAP = {
  archi: "structure",
  toit: "toiture",
  cea: "cea",
  "hosp-arch": "hospital-archi",
  "hosp-mep": "hospital-meca"
};

function getAdminDisplayLabel(maquetteId, fallbackLabel) {
  const adminId = ADMIN_MAQUETTE_ID_MAP[maquetteId];
  if (!adminId) return fallbackLabel;
  try {
    const names = JSON.parse(localStorage.getItem("admin-maquette-display-names") || "{}");
    if (names[adminId]) return names[adminId];
  } catch (e) {
    // localStorage indisponible ou valeur corrompue, on garde le label par defaut.
  }
  return fallbackLabel;
}

// Selecteur de projet/maquette (porte depuis IES le 16/09) : remplace
// l'ancien chargement statique de MAQUETTES par un chargement pilote par
// #projectSelect. MAQUETTES reste la reference stable (const, mutee en
// place) capturee par closure dans tout le reste du fichier.
function loadProject(projectKey) {
  MAQUETTES.forEach((maquette) => {
    if (maquette.model) maquette.model.destroy();
  });
  MAQUETTES.length = 0;
  PROJECTS[projectKey].forEach((m) => {
    const maquette = Object.assign({}, m);
    maquette.label = getAdminDisplayLabel(maquette.id, maquette.label);
    MAQUETTES.push(maquette);
  });

  if (projectKey === HOSPITAL_PROJECT_KEY) {
    // 20/10 : du plus leger au plus lourd (poids des fichiers XKT : alarme 0,05 Mo, electricite 0,1,
    // plomberie 2, sprinklers 3, structure 5, mecanique 20 (12 en version legere), architecture 26 (15)),
    // pour que les premiers temps affiches soient tres courts et que l'attente paraisse plus rapide.
    const ordre = ["hosp-alarm", "hosp-elec", "hosp-plomb", "hosp-spr", "hosp-struct", "hosp-mep", "hosp-arch"];
    const rang = (m) => { const i = ordre.indexOf(m.id); return i < 0 ? ordre.length : i; };
    MAQUETTES.sort((a, b) => rang(a) - rang(b));
  }
  niveauxState.length = 0;
  // renderNiveaux() sort tot si la maquette source des niveaux n'est pas
  // (encore) chargee : vide la liste a la main ici pour ne pas laisser les
  // niveaux de l'ancien projet affiches (ex. bascule vers l'hopital, qui
  // n'a pas de maquette "cea").
  niveauxList.innerHTML = "";
  renderNiveaux();
  renderMaquetteRows(maquettesList, MAQUETTES);
  renderMaquetteRows(collisionMaquettesList, MAQUETTES);

  loadingOverlay.classList.remove("hidden", "error");
  loadingOverlay.innerHTML = '<p class="loading-titre">Chargement des maquettes</p>' + LOADING_LOGO_HTML;

  // Etat de chaque maquette sous le logo (20/10) : en attente, en cours, puis le temps de chargement.
  const etatsMaquettes = new Map();
  const etatsListe = document.createElement("ul");
  etatsListe.className = "loading-etats";
  MAQUETTES.forEach((m) => {
    const li = document.createElement("li");
    const nom = document.createElement("span");
    nom.textContent = m.label;
    const etat = document.createElement("span");
    etat.className = "loading-etat";
    etat.textContent = "en attente";
    li.append(nom, etat);
    etatsListe.appendChild(li);
    etatsMaquettes.set(m.id, { li, etat });
  });
  loadingOverlay.appendChild(etatsListe);
  function majEtatMaquette(maquette, texte, classe) {
    const el = etatsMaquettes.get(maquette.id);
    if (!el) return;
    el.etat.textContent = texte;
    el.li.className = classe;
  }

  // Chargement sequentiel (porte depuis IES le 16/09, meme correctif que le
  // crash Safari observe en 4G sur Qiddiya) : un lot a la fois plutot que
  // tous en parallele (ancien MAQUETTES.forEach + loadedCount). Evite le pic
  // de bande passante/memoire des gros fichiers XKT telecharges+parses
  // simultanement, et affiche chaque lot des qu'il est pret au lieu qu'ils
  // arrivent presque tous en meme temps.
  const tDebutChargement = performance.now();
  const tempsParMaquette = [];
  function majIndicateurChargement(texte) {
    const chip = ensureChargementSuite();
    chip.textContent = texte;
    chip.hidden = !texte;
  }
  function premiereMaquetteAffichee() {
    // Viewer utilisable des la premiere maquette (CHARGEMENT_PROGRESSIF).
    loadingOverlay.classList.add("hidden");
    initialCameraState = getDefaultCameraState(projectKey);
    if (initialCameraState) {
      viewer.cameraFlight.flyTo(initialCameraState);
    } else {
      viewer.cameraFlight.flyTo({ aabb: viewer.scene.getAABB(), duration: 0 });
      initialCameraState = { eye: viewer.camera.eye.slice(), look: viewer.camera.look.slice(), up: viewer.camera.up.slice() };
    }
  }
  function loadNextMaquette(index) {
    if (index >= MAQUETTES.length) {
      if (CHARGEMENT_PROGRESSIF) {
        const total = ((performance.now() - tDebutChargement) / 1000).toFixed(1).replace(".", ",");
        console.info("[chargement] " + tempsParMaquette.join(" | ") + " | total " + total + " s");
        window.__tempsChargement = tempsParMaquette.concat(["total " + total + " s"]);
        majIndicateurChargement("Chargé en " + total + " s");
        // Disparait au premier clic/toucher n'importe ou (19/10), ou apres 6 s.
        const effacer = () => {
          majIndicateurChargement("");
          document.removeEventListener("pointerdown", effacer, true);
        };
        document.addEventListener("pointerdown", effacer, true);
        setTimeout(effacer, 6000);
      }
      // 20/10 : 1 s de pause pour lire le temps de la derniere maquette (la 3D se dessine derriere),
      // puis le logo s'ouvre sur la maquette. Affichage immediat en mode progressif.
      if (CHARGEMENT_PROGRESSIF) loadingOverlay.classList.add("hidden");
      else setTimeout(reveleMaquette, 1000);
      // Arrivee directe sur #collision : la detection unique s'ouvre une fois
      // les maquettes chargees.
      if (!document.getElementById("view-collision").hidden) {
        if (collisionDetail.hidden) openSoleDetectionIfAlone();
        else if (DETECTIONS.length === 1) renderClashMarkers(CLASHES.filter((c) => c.detectionId === DETECTIONS[0].id));
      }
      if (!CHARGEMENT_PROGRESSIF) {
        initialCameraState = getDefaultCameraState(projectKey);
        if (initialCameraState) {
          // duration 0 : la maquette apparait deja cadree, sans vol visible.
          viewer.cameraFlight.flyTo(Object.assign({}, initialCameraState, { duration: 0 }));
        } else {
          viewer.cameraFlight.flyTo({ aabb: viewer.scene.getAABB(), duration: 0 });
          // Snapshot du cadrage obtenu : reutilise par le bouton "Recentrer"
          // (initialCameraState || DEFAULT_CAMERA_STATE ailleurs dans le
          // fichier), qui retomberait sinon sur les coordonnees demo.
          initialCameraState = { eye: viewer.camera.eye.slice(), look: viewer.camera.look.slice(), up: viewer.camera.up.slice() };
        }
      }
      return;
    }

    const maquette = MAQUETTES[index];
    const tMaquette = performance.now();
    majEtatMaquette(maquette, "en cours…", "en-cours");
    if (CHARGEMENT_PROGRESSIF && index > 0) majIndicateurChargement("Chargement : " + maquette.label + " (" + (index + 1) + "/" + MAQUETTES.length + ")");
    const model = maquette.format === "xkt"
      ? xktLoader.load(Object.assign({ id: maquette.id, src: maquette.src, edges: !(MOBILE_SANS_ARETES && APPAREIL_MOBILE) }, maquette.metaSrc ? { metaModelSrc: maquette.metaSrc } : {}))
      : ifcLoader.load({ id: maquette.id, src: maquette.src, excludeTypes: ["IfcSpace"], edges: true });

    maquette.model = model;

    model.on("loaded", () => {
      if (maquette.colorize) {
        model.colorize = maquette.colorize;
      }

      const countText = model.numEntities.toLocaleString("fr-FR") + " éléments";
      (maquetteCountEls.get(maquette.id) || []).forEach((el) => { el.textContent = countText; });

      // Rappelee a chaque chargement (pas seulement celui de la CEA, source
      // des niveaux) : l'ordre d'arrivee suit desormais l'ordre de
      // MAQUETTES, mais renderNiveaux() sort tout de suite si la CEA n'est
      // pas encore prete, et se re-declenche correctement des qu'elle l'est.
      renderNiveaux();
      const secondes = ((performance.now() - tMaquette) / 1000).toFixed(1).replace(".", ",");
      tempsParMaquette.push(maquette.label + " " + secondes + " s");
      window.__tempsChargement = tempsParMaquette.slice();
      majEtatMaquette(maquette, "✓ " + secondes + " s", "ok");
      if (CHARGEMENT_PROGRESSIF && index === 0) premiereMaquetteAffichee();
      loadNextMaquette(index + 1);
    });

    // Chaine stoppee sur erreur (comme avant : loadedCount n'atteignait
    // jamais MAQUETTES.length, l'overlay restait bloque en erreur) : les
    // lots suivants ne se chargent pas, plutot que de continuer sur un etat
    // partiellement rate sans le signaler clairement.
    model.on("error", (msg) => {
      model.__erreur = String(msg).slice(0, 120);
      loadingOverlay.classList.add("error");
      loadingOverlay.textContent = "Erreur de chargement (" + maquette.label + ") : " + msg;
    });
  }

  loadNextMaquette(0);
}

// Perte du contexte graphique (memoire saturee, surtout sur telephone) : message
// visible a l'ecran, pour ne pas laisser une 3D vide sans explication.
viewerCanvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  console.warn("[3D] contexte WebGL perdu (memoire graphique saturee)");
  const chip = ensureChargementSuite();
  chip.textContent = "Mémoire graphique saturée : la 3D est interrompue. Recharge la page.";
  chip.hidden = false;
  chip.style.pointerEvents = "auto";
});
// Diagnostic a l'ecran (?diag=1, 19/10) : sur telephone, pas de console. Affiche
// la taille du canvas, l'etat du contexte WebGL, les objets visibles, la camera
// et les temps de chargement, rafraichis chaque seconde.
function installerDiagnostic() {
  if (!/[?&]diag=1/.test(location.search)) return;
  const pre = document.createElement("pre");
  pre.id = "diagEcran";
  document.body.appendChild(pre);
  const maj = () => {
    try {
      const scene = viewer.scene;
      const canvas = scene.canvas.canvas;
      const gl = scene.canvas.gl;
      let rendu = "?";
      try {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        rendu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "inconnu";
      } catch (e) { rendu = "erreur"; }
      const lignes = [
        "canvas " + canvas.clientWidth + "x" + canvas.clientHeight + " (px " + canvas.width + "x" + canvas.height + "), dpr " + window.devicePixelRatio,
        "contexte perdu : " + (gl && gl.isContextLost ? gl.isContextLost() : "?") + " | " + rendu,
        "visibles " + scene.numVisibleObjects + ", xray " + scene.numXRayedObjects,
        "modeles " + Object.keys(scene.models).join(","),
        "camera eye " + viewer.camera.eye.map((v) => v.toFixed(0)).join(",") + " look " + viewer.camera.look.map((v) => v.toFixed(0)).join(","),
        "vue " + (Array.from(document.querySelectorAll(".view")).filter((v) => !v.hidden).map((v) => v.id).join(",")),
        ...MAQUETTES.map((m) => {
          const md = m.model;
          if (!md) return m.id + " : pas de modele";
          return m.id + " : entites " + md.numEntities + ", meshes " + (md.numMeshes !== undefined ? md.numMeshes : "?") +
            ", detruit " + md.destroyed +
            (md.__erreur ? ", ERREUR " + md.__erreur : "");
        }),
        "metaModels " + Object.keys(viewer.metaScene.metaModels).length,
        "chargement " + (window.__tempsChargement || []).join(" | ")
      ];
      pre.textContent = lignes.join("\n");
    } catch (e) { pre.textContent = "diag erreur : " + e.message; }
  };
  maj();
  // Leger (19/10) : un rafraichissement toutes les 4 s, sans parcourir les objets (les versions precedentes faussaient les temps mesures).
  setInterval(maj, 4000);
}

let chargementSuiteEl = null;
function ensureChargementSuite() {
  if (chargementSuiteEl) return chargementSuiteEl;
  chargementSuiteEl = document.createElement("div");
  chargementSuiteEl.id = "chargementSuite";
  chargementSuiteEl.setAttribute("role", "status");
  chargementSuiteEl.hidden = true;
  document.body.appendChild(chargementSuiteEl);
  return chargementSuiteEl;
}

installerDiagnostic();
let chargementDemarre = false;
function demarrerChargement() {
  if (chargementDemarre) return;
  chargementDemarre = true;
  loadProject(projectSelect.value);
  if (!document.getElementById("view-collision").hidden) openSoleDetectionIfAlone();
}
// (20/10) Ne depend plus de CHARGEMENT_PROGRESSIF : sans web-ifc, c'est ce bloc qui lance le chargement.
if ((CHARGEMENT_SANS_ATTENDRE_WEBIFC || HOPITAL_SANS_WEBIFC) && projectSelect.value === HOSPITAL_PROJECT_KEY) {
  // Telechargement des XKT sans attendre web-ifc (WASM) : seul l'IFC en a besoin.
  xktLoader = new XKTLoaderPlugin(viewer);
  demarrerChargement();
}

// L'hopital n'utilise que des XKT : on n'initialise pas web-ifc (memoire du telephone).
if (!(HOPITAL_SANS_WEBIFC && projectSelect.value === HOSPITAL_PROJECT_KEY)) IfcAPI.Init().then(() => {
  ifcLoader = new WebIFCLoaderPlugin(viewer, { WebIFC, IfcAPI });
  if (!xktLoader) xktLoader = new XKTLoaderPlugin(viewer);
  demarrerChargement();
  // Arrivee directe (rechargement) sur #collision : la liste des collisions
  // s'affiche tout de suite, sans attendre la fin du chargement des maquettes
  // (sinon la page de choix de la paire reste visible pendant le chargement).
  // Les bulles sont recreees a la fin du chargement (point de collision verifie).
  if (!document.getElementById("view-collision").hidden) openSoleDetectionIfAlone();
});

// Bascule de projet (porte depuis IES le 16/09) : applyPersona() rejoue le
// gating navbar/profils juste apres, le projet hopital masquant tous les
// profils (cf HOSPITAL_VISIBLE_VIEWS dans applyPersona).
projectSelect.addEventListener("change", () => {
  if (!ifcLoader) return;
  applyProjectData(projectSelect.value);
  renderDetections();
  renderDiscussionsPage();
  renderProjeteurList();
  loadProject(projectSelect.value);
  applyPersona(personaSelect.value, false);
});

// Renommage en direct (porte depuis IES le 16/09) : l'ecran Admin tourne
// dans un iframe de meme origine, l'evenement "storage" se declenche donc
// bien ici des qu'il ecrit dans localStorage, sans recharger la page (qui
// remettrait a zero la camera/le point de vue en cours et tout le reste de
// la session).
window.addEventListener("storage", (e) => {
  if (e.key !== "admin-maquette-display-names") return;
  MAQUETTES.forEach((maquette) => {
    maquette.label = getAdminDisplayLabel(maquette.id, maquette.label);
  });
  renderMaquetteRows(maquettesList, MAQUETTES);
  renderMaquetteRows(collisionMaquettesList, MAQUETTES);
});
