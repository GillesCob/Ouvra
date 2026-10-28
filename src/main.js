import { Viewer, AnnotationsPlugin, WebIFCLoaderPlugin, XKTLoaderPlugin, SectionPlanesPlugin, TransformControl, Mesh, ReadableGeometry, PhongMaterial, Texture, buildSphereGeometry, buildPlaneGeometry } from "@xeokit/xeokit-sdk";
import * as WebIFC from "web-ifc";
import { HOSPITAL_DETECTIONS, HOSPITAL_CLASHES, HOSPITAL_CLASHES_FACTICES } from "./clashesHospital.js";
import { creerMessagerie } from "./messagerie/messagerie.js";
import { creerDiscussionsIAMontage } from "./discussionsIAMontage.js";
import { descripteurElement, validerRegle, appliquerRegle } from "./reglesCollision.js";
import { creerReglesModale } from "./reglesModale.js";
import { urlVueCollision } from "./reglesImages.js";
import { chargerBanque } from "./messagerie/vuesMessagerie.js";
import { creerReglesIA } from "./reglesIA.js";
import { valeursPourIA } from "./reglesValeurs.js";
import { demanderRegle } from "./reglesIAClient.js";
import { EXEMPLES_REGLES } from "./reglesExemples.js";
import { creerControleur, REGISTRE } from "./commandesViewer.js";
import { creerCommandesIA } from "./commandesIA.js";
import { creerFlux } from "./commandesFlux.js";
import { etatDrawerDepuisVisibles, capturerEtatDrawer, boiteDesVisibles } from "./commandesDrawer.js";
import { creerCommandesBandeau } from "./commandesBandeau.js";
import { creerZones } from "./commandesZones.js";
import { valeursPourCommande } from "./commandesValeurs.js";
import { demanderCommande } from "./commandesIAClient.js";
import { EXEMPLES_COMMANDES, reconnaitreExemple } from "./commandesExemples.js";
import { creerQuantitatifPage } from "./quantitatifPage.js";
import { demanderQuantitatif } from "./quantitatifIAClient.js";
import { elementsDepuisScene, chargerElementsJson } from "./quantitatifDonnees.js";
import { lireEmpreintes } from "./quantitatifVersions.js";
import "./retourContexte.css";
import "./retourVisiteur.css";
import { creerRetourVisiteur } from "./retourVisiteur.js";
import { creerRetourContexte } from "./retourContexte.js";
import { vitesseCameraInitiale } from "./vitesseCamera.js";
import { cadrerCentre } from "./cadrageCentre.js";
import { creerHistorique, creerDepotLocal } from "./quantitatifHistorique.js";
import { amorcerHistoriqueDemo } from "./quantitatifHistoriqueDemo.js";
import { REQUETE_MOBILE } from "./seuilMobile.js";

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
// DISCUSSIONS_MESSAGERIE (21/10)
//   Page Discussions : true = nouvelle messagerie (conversations individuelles et
//   de groupe, sujets a statut, prises de vue, code dans src/messagerie/) ; false =
//   ancienne page (liste par niveaux, panneau de discussion). L'ancienne page, son
//   code, son HTML et son CSS sont conserves, simplement masques. Retour arriere :
//   mettre l'interrupteur a false.
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
const APPAREIL_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia(REQUETE_MOBILE).matches;
// Architecture et mecanique de l'hopital reconverties en XKT v12 avec buffers compresses (20/10, IFC d'origine de
// Chantier/public/models/hospital, xeokit-convert -b) : memes objets et memes identifiants IFC, 3,9 et 3,0 Mo au lieu
// de 26 et 20 Mo. Contenu identique (memes tailles une fois decompresse, memes nombres d'elements). Mesure sur
// iPhone le 20/10 : aucun gain (16,5 s contre 16,7 s), desactive par defaut. ?v12=1 pour les essayer.
const HOPITAL_V12_LEGER = reglageUrl("v12", false);
const HOPITAL_CLASHES_ABSENTS_LEGERES = new Set(["hosp-clash-14"]);
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
// Collision selectionnee (20/10, regle de Gilles : les 2 elements en conflit doivent TOUJOURS etre entierement visibles) : ils restent
// pleins (opacite 1, colores). Tous les autres elements des 2 maquettes du couple passent en "fantome" X-ray de xeokit (remplissage
// tres leger, trait fin, non cliquables) : ils ne voilent plus rien, quel que soit l'angle, et le contexte reste visible partout (pas de
// zone vide, rien n'est masque). Historique : 35 % d'opacite (reprise d'IES) voilaient la surface de l'element le plus grand ; 5 % puis
// masquage a plus de 4 m ont ete essayes (le masquage laissait des zones vides en changeant de collision).
// Tout passe par l'ecriture groupee des drapeaux de xeokit : l'opacite se reecrit objet par objet dans la carte graphique (~14 000
// objets pour l'Architecture), ce qui saturait sa file pendant des secondes et retardait la rotation.
// Sans Contexte : fantome calme (traits discrets, pas de remplissage) pour que le conflit se lise. Avec Contexte : un peu de remplissage
// et des traits plus nets sur les elements autour, en plus des autres maquettes en fantome colore (COLLISION_CONTEXTE_OPACITY).
const CLASH_FANTOME_FILL_ALPHA = 0.03;
const CLASH_FANTOME_EDGE_ALPHA = 0.14;
const CLASH_FANTOME_CONTEXTE_FILL_ALPHA = 0.14;
const CLASH_FANTOME_CONTEXTE_EDGE_ALPHA = 0.24;
const CLASH_FANTOME_COLOR = [0.82, 0.84, 0.86];
// Etat de la transparence de la page Collision, declare ici (et non pres des
// fonctions) car activateView le lit des le chargement initial.
// Mode d'affichage de la vue 3D d'une collision (20/10, bouton "Contexte" devenu menu) :
//  "conflit"  : les 2 elements en plein, le reste des 2 maquettes en fantome leger (defaut) ;
//  "contexte" : fantome plus marque et les autres maquettes en transparence coloree (ancien bouton Contexte) ;
//  "couple"   : les 2 maquettes du couple telles quelles, sans transparence ;
//  "toutes"   : toutes les maquettes du projet telles quelles, sans transparence.
// collisionContexteOn : vrai quand les maquettes hors couple sont affichees ("contexte" et "toutes").
let collisionModeAffichage = "conflit";
const MODES_AFFICHAGE_COLLISION = [
  { id: "conflit", libelle: "Conflit seul", detail: "Les 2 éléments en plein, le reste en fantôme léger" },
  { id: "contexte", libelle: "Contexte", detail: "Fantôme plus marqué, autres maquettes en transparence" },
  { id: "couple", libelle: "Les 2 maquettes", detail: "Les 2 maquettes en conflit, sans transparence" },
  { id: "toutes", libelle: "Tout le projet", detail: "Toutes les maquettes, sans transparence" }
];
let collisionContexteOn = false;
let collisionActiveClash = null;
let collisionOpacityTouched = [];
let collisionIsolationIds = [];
let collisionIsolationSavedMaterial = null;
let collisionSubsetMaquettes = [];
let collisionContexteBtn = null;
let collisionAffichageMenu = null;
let collisionContexteNiveau = "isole"; // niveau par defaut a l'arrivee (19/10, demande de Gilles) ; avant : "proche"
let collisionNiveauBtns = [];
let collisionContextePickIds = [];
const MASQUE_FICHE_DANS_DRAWER = true;
const MASQUE_LISTE_MAQUETTES_COLLISION = true;
const MASQUE_FICHE_COLLISION_DANS_DRAWER = true;
const PRESENTATION_MASQUEE = true;
const DISCUSSIONS_MESSAGERIE = true;
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
const vueDessusBtn = document.getElementById("vueDessusBtn");
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
// Pastille qui glisse sous le lien actif de la barre (ordinateur), meme principe que la bascule Niveaux / Maquettes du drawer : position
// et largeur mesurees sur le lien, 0,3 s. Elle se pose sans glisser la premiere fois (barre masquee jusque-la, sur l'accueil).
const navbarThumb = document.getElementById("navbarThumb");
let navbarThumbPosee = false;
function placerPastilleNavbar(lien) {
  const cible = lien || navLinks.find((l) => l.classList.contains("active"));
  if (!navbarThumb || !cible || !cible.offsetWidth) return;
  if (!navbarThumbPosee) navbarThumb.style.transition = "none";
  navbarThumb.style.width = cible.offsetWidth + "px";
  navbarThumb.style.transform = "translateX(" + cible.offsetLeft + "px)";
  if (!navbarThumbPosee) {
    void navbarThumb.offsetWidth;
    navbarThumb.style.transition = "";
    navbarThumbPosee = true;
  }
}
const observateurNavbar = new ResizeObserver(() => placerPastilleNavbar());
navLinks.forEach((l) => observateurNavbar.observe(l));
const navbarLinksEl = document.getElementById("navbarLinks");
const navbarEl = document.getElementById("navbar");

// « Me contacter » (28/10) : centre sur la page tant qu'il y a la place, sinon il s'arrete ECART_CONTACT_PX apres le dernier onglet visible, meme si la fenetre
// se reduit. Mesure sur la barre (comme placerPastilleNavbar), donc valable quel que soit le nombre d'onglets affiches (profils). Menu hamburger (960 px) : position
// statique, rien a poser. Recalcule a chaque changement de taille de la barre ou de ses onglets, au choix d'une vue (la barre est masquee sur l'accueil) et quand les polices sont chargees.
const ECART_CONTACT_PX = 16;
const navbarContactEl = document.getElementById("navbarContact");
const requeteBarreHamburger = window.matchMedia("(max-width: 960px)");
function placerContactNavbar() {
  if (!navbarContactEl) return;
  const onglets = navLinks.filter((l) => !l.hidden && l.offsetWidth);
  if (requeteBarreHamburger.matches || !onglets.length) { navbarEl.style.removeProperty("--contact-x"); return; }
  const barre = navbarEl.getBoundingClientRect();
  const dernierBord = onglets[onglets.length - 1].getBoundingClientRect().right - barre.left;
  const demi = navbarContactEl.offsetWidth / 2;
  const centre = Math.max(navbarEl.clientWidth / 2, dernierBord + ECART_CONTACT_PX + demi);
  navbarEl.style.setProperty("--contact-x", Math.round(centre) + "px");
}
new ResizeObserver(placerContactNavbar).observe(navbarEl);
new ResizeObserver(placerContactNavbar).observe(navbarLinksEl);
requeteBarreHamburger.addEventListener("change", placerContactNavbar);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(placerContactNavbar);
placerContactNavbar();
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
const collisionCouplesList = document.getElementById("collisionCouplesList");
const sectionCollisionCouples = document.getElementById("section-collision-couples");
const sectionCollisionListe = document.getElementById("section-collision-liste");
const detectionsEmpty = document.getElementById("detectionsEmpty");
const collisionMaquettesList = document.getElementById("collisionMaquettesList");
const collisionMaquetteToggles = document.getElementById("collisionMaquetteToggles");
const sectionCollisionMaquettes = document.getElementById("section-collision-maquettes");
if (MASQUE_LISTE_MAQUETTES_COLLISION && sectionCollisionMaquettes) sectionCollisionMaquettes.hidden = true;
const collisionsList = document.getElementById("collisionsList");
const collisionListTitle = document.getElementById("collisionListTitle");
const collisionListTitleText = document.getElementById("collisionListTitleText");
const collisionListTitleCount = document.getElementById("collisionListTitleCount");
const collisionCouplesMenu = document.getElementById("collisionCouplesMenu");
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
const newDiscussionComment = document.getElementById("newDiscussionComment");

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
      <span class="footer-credit-name">Gilles Cobigo</span>
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
// Vrai quand l'etat courant du Viewer vient d'une vue de discussion (pose par ouvrirViewerSurVue), remis a faux au retour sur l'etat general.
let viewerDepuisVueDiscussion = false;

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

// Messagerie de la page Discussions (21/10). Les fonctions passees en options sont appelees plus tard, apres le chargement complet
// du module : elles peuvent donc utiliser ce qui est declare plus bas.
// Recolte AUTOMATIQUE des vues 3D de la messagerie (21/10, serveur de dev SEULEMENT : le plugin tools/viteRecolteVues.js qui ecrit les
// fichiers n'existe pas ailleurs). Au chargement, une fois TOUTES les maquettes chargees, si public/images/vues/index.json ne couvre pas
// les premieres collisions reelles, chacune est selectionnee comme sur la page Collision (selectClash : camera a l'angle enregistre,
// isolation X-ray) puis la 3D en PERSPECTIVE est capturee en JPEG et envoyee au plugin avec l'etat du Viewer (camera, niveaux,
// maquettes, coupe). Tout se passe dans #rendusHorsEcran (la 3D y est deplacee, invisible) : rien n'est affiche, la page courante
// (jamais Viewer ni Collision) n'est pas touchee. Un rendu a la fois, avec des pauses. Puis camera, visibilites, X-ray, coupe et
// emplacement de la 3D sont remis tels qu'avant. Un changement de page l'interrompt. Les fichiers etant statiques ensuite, les
// rechargements suivants n'ont plus rien a faire (la messagerie lit index.json au demarrage).
const RECOLTE_NOMBRE = 15; // les 15 collisions reelles de l'hopital (modale « Regle a valider » : une image par collision) ; Discussions n'en utilise que les 8 premieres (NOMBRE_VUES_MESSAGERIE)
const RECOLTE_LARGEUR_MAX = 640;
// Version du format des vues enregistrees : une entree d'index d'une autre version (ou sans camera) est recoltee de nouveau.
const RECOLTE_VERSION = 3;
const recolteAuto = { enCours: false, interrompue: false, termine: false, minuteur: null, essais: 0, echecs: 0 };
const attendreMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const imageSuivante = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
function collisionsPourVues() {
  return CLASHES.filter((c) => c.detectionId === "hopital-arch-mep" && !c.factice).slice(0, RECOLTE_NOMBRE);
}
function nomVueAffichee() {
  const vue = document.querySelector(".view:not([hidden])");
  return vue ? vue.id.replace(/^view-/, "") : null;
}
// Metadonnees enregistrees avec l'image : lieu lisible + etat complet du Viewer (utilise par « Ouvrir dans le Viewer »).
function decrireClashPourVue(clash) {
  const detection = DETECTIONS.find((d) => d.id === clash.detectionId);
  const etat = captureViewerState();
  return {
    version: RECOLTE_VERSION,
    collisionId: clash.id,
    niveau: libelleNiveau(clash.zone.split("·").pop().trim()),
    modeles: detection.modeles.map((id) => COLLISION_TOGGLE_LABELS[id] || id).join(" + "),
    camera: etat.camera,
    niveaux: etat.niveaux,
    maquettes: etat.maquettes,
    coupe: etat.coupe,
    entites: etat.entites
  };
}
function planifierRecolteAuto(delai) {
  const r = recolteAuto;
  if (!import.meta.env.DEV || r.enCours || r.termine || r.minuteur) return;
  if (new URLSearchParams(location.search).has("vues")) return; // mode manuel (panneau) : pas d'automatisme
  r.minuteur = setTimeout(() => { r.minuteur = null; verifierRecolteAuto(); }, delai);
}
async function verifierRecolteAuto() {
  const r = recolteAuto;
  const pret = CLASHES.length > 0 && MAQUETTES.length > 0 && MAQUETTES.every((m) => m.chargee) && loadingOverlay.classList.contains("hidden") &&
    !document.hidden && !viewer.cameraFlight.flying && !["viewer", "collision"].includes(nomVueAffichee());
  if (!pret) {
    if (++r.essais <= 300) planifierRecolteAuto(4000);
    return;
  }
  r.essais = 0;
  const cibles = collisionsPourVues();
  let deja = new Set();
  try {
    const reponse = await fetch(import.meta.env.BASE_URL + "images/vues/index.json", { cache: "no-store" });
    if (reponse.ok) {
      const liste = await reponse.json();
      if (Array.isArray(liste)) deja = new Set(liste.filter((v) => v && typeof v.id === "string" && v.version === RECOLTE_VERSION && v.camera && v.entites).map((v) => v.id));
    }
  } catch (e) {
    // Index absent (le serveur de dev renvoie alors une page HTML) ou illisible : tout est a recolter.
  }
  const manquantes = cibles.filter((c) => !deja.has(c.id));
  if (!manquantes.length) { r.termine = true; return; }
  executerRecolteAuto(manquantes);
}
async function executerRecolteAuto(cibles) {
  const r = recolteAuto;
  r.enCours = true;
  r.interrompue = false;
  const detection = DETECTIONS.find((d) => d.id === "hopital-arch-mep");
  const etatAvant = captureViewerState();
  const detectionAvant = detectionCourante;
  const parent = viewerWrap.parentNode;
  const suivant = viewerWrap.nextSibling;
  let boite = document.getElementById("rendusHorsEcran");
  if (!boite) {
    boite = document.createElement("div");
    boite.id = "rendusHorsEcran";
    boite.setAttribute("aria-hidden", "true");
    document.body.appendChild(boite);
  }
  const canevas = viewer.scene.canvas.canvas;
  let enregistrees = 0;
  try {
    // Meme ouverture que la page Collision (maquettes de la paire, marqueurs, isolation), puis la 3D passe hors ecran.
    openDetection(detection);
    boite.appendChild(viewerWrap);
    // Taille prise en compte par xeokit (ResizeObserver puis tick de la scene : quelques images).
    for (let i = 0; i < 120; i++) {
      const prete = canevas.clientWidth > 0 && viewer.scene.canvas.boundary[2] === canevas.clientWidth &&
        viewer.scene.canvas.boundary[3] === canevas.clientHeight && canevas.width > 0;
      if (prete) break;
      if (i === 119) throw new Error("la 3D hors écran n'a pas pris sa taille.");
      await imageSuivante();
    }
    for (const clash of cibles) {
      if (r.interrompue || viewerWrap.parentNode !== boite) break;
      await new Promise((resolve, reject) => {
        const filet = setTimeout(() => { clearInterval(veille); reject(new Error("la caméra n'est pas arrivée à la collision " + clash.id + ".")); }, 20000);
        const veille = setInterval(() => { if (r.interrompue) { clearTimeout(filet); clearInterval(veille); resolve(); } }, 200);
        selectClash(clash, () => { clearTimeout(filet); clearInterval(veille); resolve(); });
      });
      if (r.interrompue) break;
      await imageSuivante();
      await imageSuivante();
      const image = await capturerVueJpeg(RECOLTE_LARGEUR_MAX);
      if (r.interrompue) break;
      const reponse = await fetch("/__vues/" + encodeURIComponent(clash.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, meta: decrireClashPourVue(clash) })
      });
      if (!reponse.ok) throw new Error("le serveur a refusé la vue " + clash.id + " (" + reponse.status + ").");
      enregistrees++;
      await attendreMs(600); // pause : la page reste fluide entre deux rendus
    }
    if (!r.interrompue) r.termine = true;
  } catch (erreur) {
    console.warn("[récolte des vues] " + erreur.message);
    if (++r.echecs >= 2) r.termine = true; // deux echecs : on arrete, rien ne boucle
  } finally {
    clearTimeout(minuteurOpacitesCollision);
    if (viewerWrap.parentNode === boite) {
      // Page non Viewer/Collision toujours affichee : on remet tout comme avant (equivalent de ce que fait la navigation).
      viewer.cameraFlight.cancel();
      resetCollisionOpacityState();
      clearClashMarkers();
      clearClashElementColors();
      deselectEntity();
      recenterTarget = null;
      collisionDetail.hidden = true;
      collisionRecap.hidden = false;
      detectionCourante = detectionAvant;
      restoreAllModelsVisible();
      restoreViewerState(etatAvant);
      viewer.cameraFlight.jumpTo({ eye: etatAvant.camera.eye, look: etatAvant.camera.look, up: etatAvant.camera.up });
      if (suivant && suivant.parentNode === parent) parent.insertBefore(viewerWrap, suivant);
      else parent.appendChild(viewerWrap);
    }
    r.enCours = false;
    if (messagerie && enregistrees > 0) messagerie.rechargerVues();
    if (enregistrees > 0) relireBanqueVuesCollisions();
    // Interrompue ou reportee : la prochaine page non Viewer/Collision relance la verification (les vues deja ecrites sont comptees).
    if (!r.termine) planifierRecolteAuto(r.echecs > 0 ? 30000 : 3000);
  }
}
const viewDiscussions = document.getElementById("view-discussions");
// Discussions par commande IA (24/10) : bouton « IA » de la liste des discussions, tout est assemble dans src/discussionsIAMontage.js. La messagerie
// rappelle monter / action apres sa construction.
const discussionsIA = creerDiscussionsIAMontage();
const messagerie = DISCUSSIONS_MESSAGERIE ? creerMessagerie({
  surMonte: () => discussionsIA.monter(messagerie),
  surActionIA: (nom) => discussionsIA.action(nom),
  surOngletIA: () => discussionsIA.ouvrirSaisie(),
  racine: document.getElementById("msgRoot"),
  lienNavbar: navLinks.find((l) => l.dataset.view === "discussions"),
  capturerVue: capturerVuePourMessagerie,
  allerA: (nomVue) => navLinks.find((l) => l.dataset.view === nomVue).click(),
  ouvrirDansViewer: ouvrirViewerSurVue,
  glisserPourFermer: enableDrawerSwipeToClose
}) : null;
// Modale « Regle a valider » des regles de collision (etapes 2 et 3), creee plus bas une fois les libelles de priorite et de statut definis.
let reglesModale = null;
let reglesIA = null; // cree plus bas ; « Reformuler » de la modale y rouvre le panneau
// Retours des visiteurs (28/10) : bouton « Bug ou idée ? » de la barre de navigation, la page d'origine est lue sur la vue affichee.
creerRetourVisiteur({
  declencheurs: [...document.querySelectorAll(".nav-avis")], // deux exemplaires : la barre (ordinateur) et le menu ☰ (mobile), un seul est visible
  pageCourante: () => { const vue = document.querySelector(".view:not([hidden])"); return vue ? vue.id.replace("view-", "") : ""; }
});
let retourQuantitatif = null; // bandeau « ← Retour au quantitatif » (src/retourContexte.js), cree plus bas ; relu par activateView avant sa definition
let quantitatif = null; // page Quantitatif (creee plus bas) ; relue par activateView avant sa definition
let plan3d = null; // page 2D -> 3D (src/plan3d/plan3dPage.js), chargee a la premiere ouverture ; relue par activateView avant sa definition
let plan3dEnCours = null; // chargement de la page 2D -> 3D en route (evite deux creations)
let retourPlan3d = null; // bandeau « ← Retour au plan 2D » (src/retourContexte.js), cree plus bas ; relu par activateView avant sa definition
let planDansViewer = null; // maquette « Plan 2D -> 3D » montree dans le Viewer : { maquette, avant } ; relu par activateView avant sa definition
let vueAvantDessus = null; // camera avant la vue a plat : { eye, look, up, projection } (voir entrerVueDessus)
let vitesseAvantDessus = null; // valeur du curseur « Vitesse » avant la vue a plat, rendue en sortant
let maquettesVueDessus = ""; // maquettes presentes quand la vue a plat a ete cadree : un changement la recadre
let cameraAvantCommande = null; // camera d'avant la commande « IA » en attente de reponse, que « Non » rend : { eye, look, up } ; relue par activateView
const DUREE_RETOUR_CAMERA_S = 0.6; // vol de retour de la camera apres « Non »
let commandesViewer = null; // moteur des commandes du Viewer (cree a la premiere commande) ; relu par activateView avant sa definition
let commandesFlux = null; // flux « appliquer puis confirmer » des commandes (cree a la premiere commande), idem
let commandesBandeau = null; // bandeau « Est-ce bien votre demande ? » (cree plus bas), idem
let commandesIA = null; // saisie « IA » du Viewer (creee plus bas) ; fermee par activateView a la sortie du Viewer
let origineDrawer = null; // cases du drawer avant la premiere commande en cours (photo de capturerEtatDrawer), rendue au « Non » et a la sortie du Viewer
if (messagerie) {
  document.getElementById("msgRoot").hidden = false;
  viewDiscussions.classList.add("msg-actif");
}

// options.garder3D (navigation Viewer/Collision) : ni remise a zero de la collision ni fermeture des echanges agrandis au depart, ils sont
// faits par la cible (appliquerCibleViewer / openDetection).
function activateView(viewName, options = {}) {
  if (viewName !== "collision" && !options.garder3D) fermerEchangesGrand(false);
  if (PRESENTATION_MASQUEE && viewName === "presentation") viewName = "viewer";
  if (MASQUE_ANCIENNE_LANDING && viewName === "landing") viewName = "accueil";
  viewName = redirectMaskedView(viewName);
  // Quitter la page Collision : plus aucune transparence ni fantome.
  if (viewName !== "collision" && !options.garder3D && (collisionContexteOn || collisionActiveClash || collisionOpacityTouched.length > 0)) {
    resetCollisionOpacityState();
  }
  // Accueil : navbar de l'app masquee par CSS (body.acc-actif).
  document.body.classList.toggle("acc-actif", viewName === "accueil");
  // Barre d'etat / zones sures : meme couleur que la page affichee (claire sur l'accueil, verte dans l'application).
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", viewName === "accueil" ? "#fbf7f0" : "#161c18");
  // La vue est choisie : le logo de demarrage (#splashLogo) peut s'effacer.
  document.documentElement.classList.remove("demarrage");
  navLinks.forEach((l) => l.classList.toggle("active", l.dataset.view === viewName));
  placerPastilleNavbar();
  placerContactNavbar(); // la barre vient d'etre affichee (masquee sur l'accueil) : « Me contacter » se replace
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== "view-" + viewName;
  });
  if (messagerie) messagerie.surVueActivee(viewName);
  if (quantitatif) quantitatif.surVueActivee(viewName);
  if (viewName === "plan3d") ouvrirPlan3d();
  else if (plan3d) plan3d.surVueActivee(viewName);
  if (viewName !== "discussions") discussionsIA.effacerRetour(); // le bandeau « Retour au rapport » ne vit que sur la page Discussions
  if (retourQuantitatif && viewName !== "viewer") retourQuantitatif.effacer(); // le bandeau de retour ne vit que dans le Viewer ouvert par le Quantitatif
  if (viewName !== "viewer") {
    if (retourPlan3d) retourPlan3d.effacer(); // idem pour le bandeau du plan 2D -> 3D
    retirerPlanDuViewer(); // quitter le Viewer rend les maquettes a leur etat d'avant et retire la maquette du plan
  }
  // Quitter la vue Collision pendant une visite 3D depuis la modale de regle : le bandeau de retour disparait, la regle est oubliee.
  if (viewName !== "collision" && reglesModale) reglesModale.oublier();
  // Quitter le Viewer : une commande « IA » appliquee (isolement, surbrillance) est annulee, les autres pages repartent d'une scene intacte.
  if (viewName !== "viewer") {
    // Saisie ouverte, dictee en cours ou reponse IA en route : tout est coupe, sinon une reponse tardive s'appliquerait dans un Viewer masque.
    if (commandesIA) commandesIA.fermer();
    reinitialiserCommandesViewer();
  }
  if (import.meta.env.DEV) {
    // Changement de page pendant la recolte automatique : elle s'interrompt et remet tout en place ; sinon elle (re)verifie son point de depart.
    if (recolteAuto.enCours) recolteAuto.interrompue = true;
    else planifierRecolteAuto(1500);
  }
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

// Aides d'animation (20/10). jouerClasse : (re)joue une animation CSS portee par une classe temporaire. animerEntreeListe : les
// enfants directs d'une liste apparaissent l'un apres l'autre (decalage de 30 ms, plafonne a 9 pour rester court).
function jouerClasse(el, classe, duree) {
  if (!el) return;
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
  setTimeout(() => el.classList.remove(classe), duree);
}
// Duree totale de l'apparition en cascade d'une liste (decalage de 30 ms plafonne a 9, animation de 0,3 s).
// decalage : nombre d'elements qui precedent la liste dans la cascade (le titre de la paire en Collision).
function dureeEntreeListe(ul, decalage = 0) {
  return Math.min(Math.max(ul.children.length + decalage - 1, 0), 9) * 30 + 300;
}
function animerEntreeListe(ul, decalage = 0) {
  if (ul) ul.classList.remove("liste-attente"); // lignes masquees en attendant l'apparition (voir openDetection)
  if (!ul || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  Array.from(ul.children).forEach((enfant, i) => enfant.style.setProperty("--i", Math.min(i + decalage, 9)));
  jouerClasse(ul, "liste-entree", 700);
}

// Cadrage global du batiment : la camera est posee directement dessus, sans vol.
// avecDezoom : la camera recule en vol (1,1 s) jusqu'a ce cadrage au lieu d'y etre posee ; apres (optionnel) est appelee a l'arrivee.
function poserCameraCadrageGlobal(avecDezoom, apres) {
  viewer.cameraFlight.cancel();
  const cadrage = cadrageBatimentDansZone();
  if (!avecDezoom || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    viewer.cameraFlight.jumpTo(cadrage);
    if (apres) apres();
    return;
  }
  let fait = false;
  let filet = null;
  const suite = () => {
    if (fait) return;
    fait = true;
    clearTimeout(filet);
    if (apres) apres();
  };
  viewer.cameraFlight.flyTo(Object.assign(cadrage, { duration: 1.1 }), suite);
  filet = setTimeout(suite, 2200); // si le vol est interrompu, la suite part quand meme
}

// Remise a plat de l'affichage 3D a l'arrivee (sous le canvas masque) : transparence, fantome, couleurs, selection, marqueurs, coupe, X-ray,
// niveaux coches. La visibilite des maquettes est reglee par definirMaquettesVisibles.
function remettreA3DNeutre() {
  clearTimeout(minuteurOpacitesCollision);
  fermerEchangesGrand(false);
  resetCollisionOpacityState();
  clearClashMarkers();
  clearClashElementColors();
  deselectEntity();
  restoreViewerState({
    niveaux: niveauxState.map((n) => ({ name: n.name, checked: true })),
    coupe: null,
    entites: { parMaquette: {}, xrayMat: null }
  });
}

// Cible Viewer : toutes les maquettes visibles et tous les niveaux coches (pendant une prise de vue de la messagerie : les maquettes
// que le Viewer avait avant de le quitter, memorisees dans memoMaquettesViewer).
// avecFondu (arrivee depuis Collision) : les maquettes masquees reapparaissent progressivement (dissolution).
// reveler (ids des objets en fantome avant la remise au propre, apres un dezoom) : ils repassent d'abord progressivement en rendu plein,
// puis les maquettes reapparaissent et les listes du drawer s'affichent en cascade.
// animerListes : les listes Niveaux et Maquettes du drawer apparaissent en cascade (faux si on est deja dans le Viewer).
function appliquerCibleViewer(maquettesVoulues, avecDezoom, avecFondu, reveler, animerListes) {
  if (document.getElementById("view-viewer").hidden) return;
  garderXrayAuReset = !!reveler;
  try {
    remettreA3DNeutre();
  } finally {
    garderXrayAuReset = false;
  }
  poserCameraCadrageGlobal(avecDezoom);
  const etats = new Map(MAQUETTES.map((m) => [m.id, maquettesVoulues ? maquettesVoulues.get(m.id) !== false : true]));
  // Apparition des listes differee (degel, dissolution) : les lignes restent masquees jusque-la, sinon elles s'afficheraient, disparaitraient
  // au depart de l'animation, puis reapparaitraient (une seule animation).
  if (reveler && animerListes) {
    niveauxList.classList.add("liste-attente");
    maquettesList.classList.add("liste-attente");
  }
  const finir = () => {
    renderMaquetteRows(maquettesList, MAQUETTES);
    if (reveler && animerListes) {
      animerEntreeListe(niveauxList);
      animerEntreeListe(maquettesList);
    }
  };
  const appliquer = () => {
    if (avecFondu) changerVisibiliteAvecFondu(etats, finir);
    else {
      definirMaquettesVisibles(etats);
      finir();
    }
  };
  if (reveler) degelerFantomesProgressivement(reveler, appliquer, true);
  else appliquer();
}

// Transition de page (20/10), calquee sur le portfolio (bascule Mode Dev / Mode Batiment) : la page s'efface en descendant de
// 8 px (0,3 s), le contenu change, puis elle revient (0,3 s) ; un trait d'accent balaie le bas de la barre de navigation. Pas de
// transition quand on clique sur la page deja ouverte ni si le systeme demande moins d'animations.
let transitionVueEnCours = false;
const traitNavigation = document.createElement("div");
traitNavigation.id = "navTrait";
traitNavigation.setAttribute("aria-hidden", "true");
document.getElementById("navbar").appendChild(traitNavigation);
// Debut de la transition : le contenu de la page quitte l'ecran. Renvoie faux si aucune transition n'est necessaire (page deja ouverte,
// transition deja en cours, mouvement reduit).
function demarrerSortieVue(vue) {
  const appBodyEl = document.getElementById("appBody");
  const courant = navLinks.find((l) => l.classList.contains("active"));
  if ((courant && courant.dataset.view === vue) || transitionVueEnCours || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  transitionVueEnCours = true;
  // Viewer <-> Collision sur laptop : la structure de la page ne bouge pas (meme 3D, meme drawer de 300 px, Recentrer et Vitesse
  // au meme endroit). Seul le contenu change : drawer, boutons propres a chaque page (voir .contenu-seul dans style.css).
  const vues = ["viewer", "collision"];
  const contenuSeul = window.matchMedia("(min-width: 769px)").matches && courant && vues.includes(courant.dataset.view) && vues.includes(vue);
  appBodyEl.classList.toggle("contenu-seul", !!contenuSeul);
  traitNavigation.classList.remove("balayage");
  void traitNavigation.offsetWidth;
  traitNavigation.classList.add("balayage");
  appBodyEl.classList.add("vue-sortie");
  return true;
}
// Fin de la transition : le contenu change, puis la page revient.
function terminerTransitionVue(changer) {
  const appBodyEl = document.getElementById("appBody");
  changer();
  appBodyEl.classList.remove("vue-sortie");
  appBodyEl.classList.add("vue-entree");
  void appBodyEl.offsetHeight;
  appBodyEl.classList.remove("vue-entree");
  window.dispatchEvent(new Event("resize"));
  setTimeout(() => {
    transitionVueEnCours = false;
    appBodyEl.classList.remove("contenu-seul");
  }, 300);
}
// sortieDejaFaite : la sortie a deja ete lancee (voir le dezoom dans le handler des onglets), le contenu change tout de suite.
function transitionVue(vue, changer, sortieDejaFaite) {
  if (sortieDejaFaite) {
    terminerTransitionVue(changer);
    return;
  }
  if (!demarrerSortieVue(vue)) {
    changer();
    return;
  }
  setTimeout(() => terminerTransitionVue(changer), 300);
}

let sortieVueDemarree = false; // vrai si la sortie du contenu a ete lancee pendant le dezoom (0,3 s avant son arrivee)
let minuteurSortieVue = null;
let dezoomDejaFait = false; // vrai le temps du clic rejoue a l'arrivee du dezoom (voir le handler ci-dessous)
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    placerPastilleNavbar(link);
    // Clic sur Collision ou Viewer alors qu'une collision precise ou une vue ouverte depuis une conversation est affichee : la camera dezoome d'abord, la mise en forme de la maquette
    // (X-ray, fantomes, selection, bulles) ne change pas pendant le vol ; a l'arrivee, l'arrivee classique sur Collision se joue
    // (remise au propre, dissolution progressive, apparition des lignes et des bulles) : le clic est rejoue avec dezoomDejaFait.
    if ((link.dataset.view === "collision" || link.dataset.view === "viewer") && !dezoomDejaFait
        && ((!collisionDetail.hidden && collisionActiveClash) || viewerDepuisVueDiscussion)) {
      // Le bandeau de la collision se ferme avant le vol : la zone 3D a sa taille finale, la maquette arrive au meme endroit qu'a l'arrivee
      // « au propre » sur Collision.
      collisionDiscussion.hidden = true;
      window.dispatchEvent(new Event("resize"));
      // Le verrou de la camera sur la bulle est libere : sinon, a chaque image, il recentre la bulle sur l'axe de vue et decale la maquette.
      deverrouillerCamera();
      // Le contenu du drawer quitte l'ecran 0,3 s avant la fin du dezoom (vol de 1,1 s) : a l'arrivee, il change tout de suite.
      sortieVueDemarree = false;
      clearTimeout(minuteurSortieVue);
      minuteurSortieVue = setTimeout(() => { sortieVueDemarree = demarrerSortieVue(link.dataset.view); }, 800);
      poserCameraCadrageGlobal(true, () => {
        clearTimeout(minuteurSortieVue);
        dezoomDejaFait = true;
        link.click();
      });
      navbarLinksEl.classList.remove("open");
      return;
    }
    const sortieFaite = sortieVueDemarree;
    sortieVueDemarree = false;
    transitionVue(link.dataset.view, () => {
    const page = link.dataset.view;
    // Tout changement de page par la navbar met fin a l'etat « vue de conversation » (bandeau de retour).
    if (messagerie) messagerie.vueDeConversation(false);
    if (reglesModale) reglesModale.oublier();
    const dezoomFait = dezoomDejaFait;
    dezoomDejaFait = false;
    // Objets en fantome au moment ou l'arrivee classique se joue apres un dezoom : ils repasseront progressivement en rendu plein.
    const xrayAvantDezoom = dezoomFait ? Array.from(viewer.scene.xrayedObjectIds) : null;
    // Passages Viewer vers Collision et Collision vers Viewer : les maquettes se dissolvent progressivement (voir openDetection et appliquerCibleViewer).
    const depuisViewer = !!navLinks.find((l) => l.classList.contains("active") && l.dataset.view === "viewer");
    const depuisCollision = !!navLinks.find((l) => l.classList.contains("active") && l.dataset.view === "collision");
    const priseDeVue = !!(messagerie && messagerie.priseDeVueEnCours());
    const deja3D = !viewViewer.hidden;
    // Choix du Viewer retenu en le quittant : sert seulement a la prise de vue de la messagerie.
    if (deja3D) memoMaquettesViewer = new Map(MAQUETTES.map((m) => [m.id, m.shown]));
    // Prise de vue en cours, deja dans le Viewer : rien ne se reinitialise.
    if (page === "viewer" && priseDeVue && deja3D) {
      navbarLinksEl.classList.remove("open");
      return;
    }
    if (page === "viewer" || page === "collision") {
      const depuisVueDiscussion = viewerDepuisVueDiscussion;
      viewerDepuisVueDiscussion = false;
      const maquettesPrise = priseDeVue && page === "viewer" ? memoMaquettesViewer : null;
      // Clic sur Viewer ou Collision alors qu'une collision precise ou une vue ouverte depuis une conversation est affichee : la camera
      // dezoome jusqu'au resultat final.
      const depuisCollisionPrecise = ((!collisionDetail.hidden && !!collisionActiveClash) || depuisVueDiscussion) && !dezoomFait;
      // Une collision restee ouverte : on repasse au recap (sinon revenir sur Collision rouvrirait la meme detection avec viewerWrap deplace
      // ailleurs : canvas vide).
      if (!collisionDetail.hidden) {
        collisionDetail.hidden = true;
        collisionRecap.hidden = false;
      }
      if (!discussionsDetailPane.hidden) {
        discussionsDetailPane.hidden = true;
        discussionsListPane.hidden = false;
      }
      activateView(page, { garder3D: true });
      if (page === "viewer") {
        appliquerCibleViewer(maquettesPrise, depuisCollisionPrecise, depuisCollision, xrayAvantDezoom, !depuisViewer);
        if (!xrayAvantDezoom && !depuisViewer) {
          animerEntreeListe(niveauxList);
          animerEntreeListe(maquettesList);
        }
      } else {
        garderXrayAuReset = !!xrayAvantDezoom;
        try {
          if (depuisVueDiscussion) remettreA3DNeutre();
          ouvrirPageCollision({ fondu: depuisViewer, reveler: xrayAvantDezoom });
        } finally {
          garderXrayAuReset = false;
        }
        poserCameraCadrageGlobal(depuisCollisionPrecise);
      }
      navbarLinksEl.classList.remove("open");
      return;
    }
    // Autre page (sans 3D) : repart d'un etat sain (une detection ou un fil qui masquait des maquettes).
    fermerEchangesGrand(false);
    restoreAllModelsVisible();
    if (!collisionDetail.hidden) {
      collisionDetail.hidden = true;
      collisionRecap.hidden = false;
      clearClashMarkers();
      clearClashElementColors();
      deselectEntity();
    }
    // Meme chose pour un fil de discussion reste ouvert : sinon revenir sur Discussions rouvre le meme fil au lieu de la liste.
    if (!discussionsDetailPane.hidden) {
      discussionsDetailPane.hidden = true;
      discussionsListPane.hidden = false;
    }
    activateView(page);
    if (page === "discussions") animerEntreeListe(discussionsThreadsList);
    // Admin (porte depuis IES le 16/09) : la liste des maquettes ne doit montrer que celles du projet actuellement charge. Le mockup est un
    // iframe statique : le projet lui est passe en query string, src reaffecte a chaque clic.
    if (page === "admin" && !MASQUE_TODO_ADMIN) {
      adminFrame.src = "/personas/admin-groupes.html?project=" + encodeURIComponent(projectSelect.value);
    }
    navbarLinksEl.classList.remove("open");
    }, sortieFaite);
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
  absorberGesteNeutre();
}, true);

// Clic neutre (mobile) : l'appui qui ferme le menu ne doit rien declencher d'autre
// (xeokit ecoute souris + tactile sur le canvas). Pendant ce geste, les evenements
// pointeur/tactile/souris/clic sont absorbes en phase de capture sur document, puis
// le drapeau est retire quand le doigt est leve (+ delai de securite).
let gesteNeutre = false;
let gesteNeutreTimer = 0;
const EVENEMENTS_ABSORBES = ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "mousedown", "mousemove", "mouseup", "click", "dblclick", "contextmenu"];
function absorberGesteNeutre() {
  if (!window.matchMedia(REQUETE_MOBILE).matches) return;
  gesteNeutre = true;
  clearTimeout(gesteNeutreTimer);
  gesteNeutreTimer = setTimeout(() => { gesteNeutre = false; }, 5000);
}
function terminerGesteNeutre() {
  if (!gesteNeutre) return;
  clearTimeout(gesteNeutreTimer);
  gesteNeutreTimer = setTimeout(() => { gesteNeutre = false; }, 400);
}
EVENEMENTS_ABSORBES.forEach((type) => {
  document.addEventListener(type, (e) => {
    if (!gesteNeutre) return;
    if (type === "pointerup" || type === "pointercancel") terminerGesteNeutre();
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
  }, true);
});
["pointercancel", "touchcancel"].forEach((type) => document.addEventListener(type, terminerGesteNeutre, true));

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
  if (window.matchMedia(REQUETE_MOBILE).matches) closeInfoPanelDrawer();
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
// Ouvert a l'arrivee (20/10, demande de Gilles, remplace le "replie a chaque arrivee" du 19/10) : le drawer du Viewer et celui de
// Collision ont la meme largeur et le meme etat (voir plus bas), pour que la page ne bouge pas d'un onglet a l'autre. La valeur
// memorisee n'est pas lue au chargement (elle reste ecrite au clic). Applique avant le premier rendu, sans transition.
setInfoPanelCollapsed(false);
window.dispatchEvent(new Event("resize"));
infoPanelCollapse.addEventListener("click", () => {
  const collapsed = !infoPanel.classList.contains("collapsed");
  setInfoPanelCollapsed(collapsed);
  setCollisionPanelCollapsed(collapsed);
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
// Bascule animee (20/10), calquee sur le bouton Mode Dev / Mode Batiment du portfolio : la pastille et l'onglet changent
// tout de suite (la pastille glisse 0,3 s), le contenu attend : le panneau sortant s'efface en descendant de 8 px (0,3 s),
// puis l'entrant apparait et remonte (0,3 s).
const infoTabsThumb = document.querySelector("#infoPanel .tabs-thumb");
function placerPastilleInfoTabs() {
  const actif = infoTabs.find((t) => t.getAttribute("aria-selected") === "true");
  if (!infoTabsThumb || !actif || !actif.offsetWidth) return;
  infoTabsThumb.style.width = actif.offsetWidth + "px";
  infoTabsThumb.style.transform = "translateX(" + actif.offsetLeft + "px)";
}
// Mesure aussi a chaque changement de taille d'un onglet (drawer ouvert apres coup, police chargee, redimensionnement).
const observateurInfoTabs = new ResizeObserver(placerPastilleInfoTabs);
infoTabs.forEach((t) => observateurInfoTabs.observe(t));

let infoTabFinaliser = null;
function selectInfoTab(tab) {
  if (infoTabFinaliser) infoTabFinaliser();
  const courant = infoTabs.find((t) => t.getAttribute("aria-selected") === "true");
  const sortant = courant && document.getElementById(courant.getAttribute("aria-controls"));
  const entrant = document.getElementById(tab.getAttribute("aria-controls"));
  infoTabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  placerPastilleInfoTabs();
  const instantane = () => infoTabs.forEach((t) => {
    const panel = document.getElementById(t.getAttribute("aria-controls"));
    if (panel) panel.hidden = t !== tab;
  });
  if (!courant || courant === tab || !sortant || !entrant || sortant.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    instantane();
    return;
  }
  sortant.classList.add("tab-sortie");
  let minuteur = null;
  const finaliser = () => {
    clearTimeout(minuteur);
    infoTabFinaliser = null;
    sortant.classList.remove("tab-sortie");
    entrant.classList.remove("tab-entree");
    instantane();
  };
  infoTabFinaliser = finaliser;
  minuteur = setTimeout(() => {
    sortant.hidden = true;
    sortant.classList.remove("tab-sortie");
    entrant.classList.add("tab-entree");
    entrant.hidden = false;
    void entrant.offsetHeight;
    entrant.classList.remove("tab-entree");
    infoTabFinaliser = null;
  }, 300);
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
// Messagerie : donnees chargees quand le navigateur est au repos (le badge de la navbar en a besoin avant la premiere visite de la page).
if (messagerie) {
  if ("requestIdleCallback" in window) requestIdleCallback(() => messagerie.preparer(), { timeout: 6000 });
  else setTimeout(() => messagerie.preparer(), 3000);
}
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
const HOSPITAL_VISIBLE_VIEWS = ["presentation", "viewer", "collision", "discussions", "quantitatif", "plan3d"];

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
const navbarMobileQuery = window.matchMedia("(max-width: 960px)"); // menu hamburger de la barre : seuil propre a la barre (28/10), le reste de l'application garde 768 px
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
// en localStorage. Depart a 50% pour tous (28/10, pave tactile ; src/vitesseCamera.js) tant
// qu'aucune preference n'est enregistree. Cle de stockage conservee telle quelle
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
const initialCameraSpeed = vitesseCameraInitiale(savedCameraSpeed);
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

// Boite englobante (aabb xeokit) des maquettes chargees de la liste, ou null s'il n'y en a aucune.
function aabbDesMaquettes(liste) {
  const boites = liste.filter((m) => m.model).map((m) => m.model.aabb);
  if (!boites.length) return null;
  return [0, 1, 2].map((i) => Math.min(...boites.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boites.map((b) => b[i]))));
}

// Vue de depart (ou pose donnee) recadree pour que la maquette soit parfaitement centree dans la zone 3D (28/10) : meme direction de regard et meme haut,
// cible et distance calculees pour le canvas courant (src/cadrageCentre.js). Sans boite, sans canvas mesurable ou en projection orthogonale : pose inchangee.
function poseCentreeSurBoite(pose, boite) {
  const canevas = viewer.scene.canvas.canvas;
  if (!pose || !boite || !boite.every(Number.isFinite) || boite[3] <= boite[0] || viewer.camera.projection !== "perspective" || !canevas || !canevas.offsetWidth || !canevas.offsetHeight) return pose;
  return cadrerCentre({
    aabb: boite, eye: pose.eye, look: pose.look, up: pose.up,
    fov: viewer.camera.perspective.fov, fovAxis: viewer.camera.perspective.fovAxis,
    largeur: canevas.offsetWidth, hauteur: canevas.offsetHeight
  });
}

// Vue de depart de la maquette centree sur ce qui est visible (position initiale du Viewer et « Recentrer ») : la boite des objets visibles,
// pas celle des fichiers (des objets masques par defaut, hors de la maquette vue, la decaleraient).
function vueDepartCentree() {
  const pose = initialCameraState || DEFAULT_CAMERA_STATE;
  const visibles = viewer.scene.visibleObjectIds;
  const boite = visibles.length ? viewer.scene.getAABB(visibles) : aabbDesMaquettes(MAQUETTES.filter((m) => m.model));
  return poseCentreeSurBoite(pose, boite);
}

// Pose centrant une boite dans la zone 3D en gardant la direction de regard actuelle (commandes IA du Viewer) ; null si le cadrage centre n'est pas possible.
function poseCentreeSurBoiteActuelle(boite) {
  const actuelle = { eye: viewer.camera.eye.slice(), look: viewer.camera.look.slice(), up: viewer.camera.up.slice() };
  const pose = poseCentreeSurBoite(actuelle, boite);
  return pose === actuelle ? null : pose;
}

// « Recentrer » s'adapte aux maquettes cochees (25/10) : seule une partie est cochee, la camera se cadre sur celles-la (cocher uniquement la maquette
// du plan 2D -> 3D = recentrer sur elle seule). Toutes cochees : la vue de depart de la maquette, comme avant. En vue a plat, la vue a plat est refaite.
// Cadrage de « Recentrer » sur la page Viewer (hors vue a plat et hors cible propre a Collision / Discussions), partage avec la commande IA du Viewer.
function recentrerSurMaquettes() {
  const chargees = MAQUETTES.filter((m) => m.model);
  const cochees = chargees.filter((m) => m.shown);
  // Avec la maquette du plan dans la liste, meme toutes cochees : la vue de depart est celle de l'hopital et ne montrerait pas le plan.
  const boite = cochees.length > 0 && (cochees.length < chargees.length || planDansViewer) ? aabbDesMaquettes(cochees) : null;
  // Maquettes cochees seules : direction de regard actuelle (comme le cadrage xeokit sur une boite), recadree pour centrer le rectangle projete.
  if (boite) {
    viewer.cameraFlight.flyTo(poseCentreeSurBoiteActuelle(boite) ?? { aabb: boite });
  } else viewer.cameraFlight.flyTo(vueDepartCentree());
}

recenterBtn.addEventListener("click", () => {
  if (vueAvantDessus) { appliquerVueDessus(); return; }
  if (recenterTarget) { recenterTarget(); return; }
  recentrerSurMaquettes();
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
      // Seules les modifications de l'utilisateur sont gardees : les entrees de demonstration (demo: true) viennent des donnees.
      etat[c.id] = { priorite: clashPriorite(c), statut: c.statut, historique: (c.historique || []).filter((h) => !h.demo) };
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
    // Sans modification de l'utilisateur, les donnees (priorite, statut, historique de demonstration) font foi.
    const perso = Array.isArray(e.historique) ? e.historique.filter((h) => h && typeof h === "object" && !h.demo) : [];
    if (!perso.length) return;
    if (PRIORITE_ORDRE.includes(e.priorite)) c.priorite = e.priorite;
    if (typeof e.statut === "string" && STATUT_LABELS[e.statut]) c.statut = e.statut;
    c.historique = (c.historique || []).concat(perso);
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

// Discussions de demonstration sur l'hopital (20/10, demande de Gilles) : pour juger tout de suite le rendu du panneau
// de discussion. Ces discussions sont FICTIVES (noms de KNOWN_PEOPLE, textes et heures inventes) : a retirer avant toute
// vraie demonstration publique, avec le reste du bloc. Retirer ce bloc et sa ligne dans applyProjectData
// pour repartir d'une liste vide.
const HOPITAL_DISCUSSIONS_DEMO = [
  {
    id: "disc-demo-hopital-1",
    priorite: "haute",
    statut: "confirme",
    lieu: { niveau: "Niveau 2", maquettes: ["Structure", "Architecture"] },
    zone: "Garde-corps du palier du niveau 2 : décalage avec le plan",
    auteur: CURRENT_USER,
    tagged: ["Julie Martin (BE Structure)", "Karim Haddad (Charpente)", "Léa Fontaine (BE Architecture)"],
    open: true,
    assignedTo: "Bureau d'études",
    camera: {
      eye: HOSPITAL_CAMERA_STATE.eye.slice(),
      look: HOSPITAL_CAMERA_STATE.look.slice(),
      up: HOSPITAL_CAMERA_STATE.up.slice()
    },
    discussion: [
      { auteur: CURRENT_USER, quand: "2026-10-19T16:40:00", texte: "J'ai repéré un décalage d'environ 20 cm entre le garde-corps du palier du niveau 2 et le plan de structure. À vérifier avant la validation de la synthèse." },
      { auteur: "Julie Martin (BE Structure)", quand: "2026-10-19T17:12:00", texte: "Je regarde la maquette de structure demain matin et je reviens vers vous." },
      { auteur: "Léa Fontaine (BE Architecture)", quand: "2026-10-20T09:05:00", texte: "Côté architecture, la cote du plan est bien celle indiquée sur le plan d'exécution. Le décalage semble venir de la maquette de structure." },
      { auteur: "Karim Haddad (Charpente)", quand: "2026-10-20T09:48:00", texte: "Je confirme : l'appui de la charpente est à 20 cm du nu fini. Je peux décaler le garde-corps si le BE valide la cote." },
      { auteur: "Julie Martin (BE Structure)", quand: "2026-10-20T10:30:00", texte: "Cote confirmée côté structure, c'est bien l'architecture qui a raison. Karim, tu peux décaler ton appui de 20 cm vers l'intérieur ? Je mets à jour la maquette de structure dans la foulée, nouvelle version demain." },
      { auteur: CURRENT_USER, quand: "2026-10-20T11:02:00", texte: "Merci à tous. Je crée une instruction pour le projeteur et je referme le fil dès que la nouvelle version de la maquette est déposée." }
    ]
  },
  {
    id: "disc-demo-hopital-2",
    priorite: "urgente",
    statut: "nouveau",
    lieu: { niveau: "Niveau 3", maquettes: ["Mécanique", "Structure"] },
    zone: "Réservation de trémie pour la gaine CVC au niveau 3",
    auteur: CURRENT_USER,
    tagged: ["Julie Martin (BE Structure)", "Karim Haddad (Charpente)", "Sofia Benali (Coordination BIM)"],
    open: true,
    discussion: [
      { auteur: CURRENT_USER, quand: "2026-10-19T10:15:00", texte: "La gaine CVC du niveau 3 traverse la dalle sans réservation prévue. Il faut une trémie, merci de confirmer l'emplacement." },
      { auteur: "Julie Martin (BE Structure)", quand: "2026-10-19T14:20:00", texte: "Une trémie de 60 x 40 cm est possible à cet endroit, à condition de rester à 30 cm de la poutre voisine." },
      { auteur: "Karim Haddad (Charpente)", quand: "2026-10-20T08:50:00", texte: "Côté charpente, rien ne gêne. Je n'ai pas de pièce dans cette zone." }
    ]
  },
  {
    id: "disc-demo-hopital-3",
    priorite: "normale",
    statut: "nouveau",
    lieu: { niveau: "Niveau 2", maquettes: ["Architecture", "Électricité"] },
    zone: "Hauteur sous plafond du couloir du niveau 2",
    auteur: CURRENT_USER,
    tagged: ["Léa Fontaine (BE Architecture)", "Sofia Benali (Coordination BIM)"],
    open: true,
    discussion: [
      { auteur: CURRENT_USER, quand: "2026-10-19T11:30:00", texte: "Sous les chemins de câbles, le couloir du niveau 2 n'a plus que 2,15 m de hauteur libre. Le programme demande 2,30 m." },
      { auteur: "Léa Fontaine (BE Architecture)", quand: "2026-10-19T15:45:00", texte: "Je regarde si on peut abaisser le faux plafond dans l'axe du couloir ou décaler les chemins de câbles." },
      { auteur: "Sofia Benali (Coordination BIM)", quand: "2026-10-20T09:30:00", texte: "Je prépare une coupe du couloir pour la prochaine réunion de synthèse." }
    ]
  },
  {
    id: "disc-demo-hopital-4",
    priorite: "basse",
    statut: "resolu",
    lieu: { niveau: null, maquettes: ["Structure"] },
    zone: "Mise à jour de la maquette Structure du 19/10",
    auteur: CURRENT_USER,
    tagged: ["Julie Martin (BE Structure)", "Sofia Benali (Coordination BIM)"],
    open: false,
    discussion: [
      { auteur: CURRENT_USER, quand: "2026-10-19T10:40:00", texte: "Julie a déposé ce matin la nouvelle version de la maquette Structure, avec les poutres du niveau 2 corrigées." },
      { auteur: "Sofia Benali (Coordination BIM)", quand: "2026-10-19T13:10:00", texte: "Bien reçue, je lance le contrôle et je relance la détection de collisions." },
      { auteur: "Julie Martin (BE Structure)", quand: "2026-10-19T16:00:00", texte: "Oui, les poutres du niveau 2 sont corrigées, rien d'autre n'a changé dans cette version." },
      { auteur: CURRENT_USER, quand: "2026-10-20T14:00:00", texte: "Contrôle terminé, la version est validée. Je ferme le fil." }
    ]
  },
  {
    id: "disc-demo-hopital-5",
    priorite: "haute",
    statut: "confirme",
    lieu: { niveau: null, maquettes: ["Architecture", "Plomberie"] },
    zone: "Passage des réseaux de plomberie dans la cage d'escalier B",
    auteur: CURRENT_USER,
    tagged: ["Léa Fontaine (BE Architecture)", "Karim Haddad (Charpente)"],
    open: true,
    discussion: [
      { auteur: CURRENT_USER, quand: "2026-10-20T10:20:00", texte: "Léa, les réseaux de plomberie traversent la cage d'escalier B, ce qui réduit la largeur de passage. Une autre route est à étudier." },
      { auteur: "Karim Haddad (Charpente)", quand: "2026-10-20T13:15:00", texte: "On peut les passer sous le palier, il y a la place côté charpente. Je vous envoie une coupe." },
      { auteur: CURRENT_USER, quand: "2026-10-20T15:50:00", texte: "Bonne piste, merci. J'attends la coupe pour valider avec la plomberie." }
    ]
  }
];

function applyProjectData(projectKey) {
  DETECTIONS.length = 0;
  CLASHES.length = 0;
  DISCUSSIONS.length = 0;
  if (projectKey === DEMO_PROJECT_KEY) {
    DETECTIONS.push(...DEMO_DETECTIONS);
    CLASHES.push(...DEMO_CLASHES);
    DISCUSSIONS.push(...DEMO_DISCUSSIONS);
  } else if (COLLISIONS_HOPITAL_ECHANTILLON && projectKey === HOSPITAL_PROJECT_KEY) {
    // Echantillon hopital : detections et clashs, plus la conversation de demonstration (HOPITAL_DISCUSSIONS_DEMO).
    // Les clashs ne sont jamais ajoutes a DISCUSSIONS (renderDiscussionsPage ne lit que DISCUSSIONS).
    DISCUSSIONS.push(...HOPITAL_DISCUSSIONS_DEMO);
    DETECTIONS.push(...HOSPITAL_DETECTIONS);
    CLASHES.push(...HOSPITAL_CLASHES.filter((c) => !(HOPITAL_MAQUETTES_LEGERES && HOPITAL_CLASHES_ABSENTS_LEGERES.has(c.id))));
    // Collisions fictives du second couple (voir clashesHospital.js) : listees, jamais selectionnables.
    CLASHES.push(...HOSPITAL_CLASHES_FACTICES);
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
  // Deux modes : les discussions ouvertes (par défaut), ou l'historique (fermées : statuts resolu et ecarte). Le numéro des
  // pastilles et des cartes se compte dans le mode affiché.
  discussionsNbFermees = threads.filter((t) => !isThreadOpen(t)).length;
  const historique = discussionsFiltres.etat === "historique";
  discussionsAffichees = discussionsParActivite(threads.filter((t) => isThreadOpen(t) !== historique));

  discussionsThreadsEmpty.hidden = threads.length > 0;
  initDiscussionsInteractions();
  const focus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
  renderDiscussionsBarre(discussionsAffichees);
  renderDiscussionsCoupe(discussionsAffichees);
  renderDiscussionsCartes(discussionsAffichees);
  if (focus) {
    const cible = Array.from(document.querySelectorAll("#discussionsListPane [data-fk]")).find((e) => e.dataset.fk === focus);
    if (cible) cible.focus({ preventScroll: true });
  }
}
// Crochet réservé aux tests (URL avec ?test) : n'expose rien d'autre. Accesseur pour niveauxState, déclaré plus bas dans le module.
if (new URLSearchParams(location.search).has("test")) window.__ouvraTest = { get niveauxState() { return niveauxState; }, DISCUSSIONS, renderDiscussionsPage };

// ---- Page Discussions, mise en page "coupe du bâtiment" (20/10, maquette ouvra-discussions-v3) ----
// Filtres combinables (priorité, niveau), conservés quand on revient d'un fil. Pas de filtre par personne : avec 10 ou 20 interlocuteurs il
// serait illisible, et les sujets affichés sont déjà ceux qui concernent l'utilisateur.
// etat : "ouvertes" (par défaut) ou "historique" (discussions fermées) ; les autres filtres se combinent dans les deux modes.
const NIVEAU_GENERAL = "__general__";
const discussionsFiltres = { etat: "ouvertes", priorite: "toutes", niveau: null };
// Tranches de niveaux vides dépliées par un clic (clé = "premier|dernier"), conservées d'un rendu à l'autre.
const discTranchesOuvertes = new Set();
let discHauteurRegle = 0;
let discussionsNbFermees = 0;
// Priorité et statut d'une discussion (mêmes valeurs que ceux d'une collision). Un fil sans ces champs (créé par le formulaire)
// vaut "normale" ; son statut se déduit de open ("resolu" si fermé, "nouveau" sinon).
const STATUTS_DISCUSSION = ["nouveau", "confirme", "ecarte", "resolu"];
const STATUTS_FERMES = ["ecarte", "resolu"];
function prioriteFil(thread) {
  return PRIORITE_ORDRE.includes(thread.priorite) ? thread.priorite : PRIORITE_DEFAUT;
}
function statutFil(thread) {
  if (STATUTS_DISCUSSION.includes(thread.statut)) return thread.statut;
  return thread.open === false ? "resolu" : "nouveau";
}
// Fils affichés, triés par activité récente : le rang (n) donne le numéro de la pastille et de la carte.
let discussionsAffichees = [];
let discussionsInteractionsPosees = false;

function dernierMessage(thread) {
  const msgs = thread.discussion || [];
  return msgs.length ? msgs[msgs.length - 1] : null;
}
function activiteFil(thread) {
  const t = Date.parse((dernierMessage(thread) || {}).quand);
  return isNaN(t) ? null : t;
}
// Priorité d'abord (urgente en haut), puis plus récent d'abord ; un fil sans date garde sa place d'origine après les fils datés.
function discussionsParActivite(threads) {
  return threads
    .map((thread, i) => ({ thread, i, t: activiteFil(thread), p: PRIORITE_ORDRE.indexOf(prioriteFil(thread)) }))
    .sort((a, b) => a.p - b.p || (a.t === null) - (b.t === null) || (b.t || 0) - (a.t || 0) || a.i - b.i)
    .map((e, rang) => Object.assign(e.thread, { _rang: rang + 1 }));
}
function niveauFil(thread) {
  return (thread.lieu && thread.lieu.niveau) || null;
}
// Valeur de tri d'un libellé de niveau : "Niveau 2" -> 2, "RDC" -> 0, le reste après (en bas).
function rangNiveau(libelle) {
  const m = /-?\d+/.exec(libelle);
  if (m) return parseInt(m[0], 10);
  return /rdc|rez/i.test(libelle) ? 0 : -1000;
}
// Niveaux de la coupe : tous ceux du bâtiment (niveauxState, noms IFC libellés par libelleNiveau, remplis au chargement des maquettes),
// plus tout niveau cité par un fil mais absent de niveauxState (aucune discussion perdue), le plus haut en haut.
// niveauxState est déclaré plus bas dans le fichier : lecture protégée tant que le module n'est pas évalué jusque-là.
function niveauxDuBatiment() {
  try { return niveauxState.map((n) => libelleNiveau(n.name)).filter(Boolean); } catch (e) { return []; }
}
function niveauxDeLaCoupe(threads) {
  const distincts = [...new Set(niveauxDuBatiment().concat(threads.map(niveauFil).filter(Boolean)))];
  return distincts.sort((a, b) => rangNiveau(b) - rangNiveau(a) || a.localeCompare(b, "fr"));
}
function personnesDuFil(thread) {
  const noms = [];
  const ajouter = (n) => { if (n && !noms.includes(n)) noms.push(n); };
  (thread.discussion || []).forEach((m) => ajouter(m.auteur));
  ajouter(thread.auteur);
  (thread.tagged || []).forEach(ajouter);
  return noms;
}
// Un nom peut apparaître "Vous (Bureau d'études)" ou "Julie Martin (BE Structure)" : comparaison sur le nom court.
function memePersonne(a, b) {
  return nomCourt(a) === nomCourt(b);
}
function filtreAccepte(thread) {
  const f = discussionsFiltres;
  if (f.priorite !== "toutes" && prioriteFil(thread) !== f.priorite) return false;
  // Un fil "Général" (sans niveau) concerne tous les niveaux : il reste visible quand un niveau est choisi.
  // Valeur dédiée "__general__" : uniquement les sujets sans niveau.
  if (f.niveau === NIVEAU_GENERAL) return !niveauFil(thread);
  if (f.niveau && niveauFil(thread) && niveauFil(thread) !== f.niveau) return false;
  return true;
}

// Mêmes couleurs que les pastilles de priorité d'une collision (cf style.css, .collision-select-wrap[data-champ="prio"]).
const PRIORITE_COULEURS = { urgente: "#f85149", haute: "#f0883e", normale: "#6e8bb5", basse: "#b4bcc6" };
function escHtmlDisc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// Compteur rond d'une ligne de la règle : nombre de discussions du mode affiché, couleur = priorité la plus haute parmi elles.
// Absent (chaîne vide) s'il n'y en a aucune. Un clic filtre les cartes sur ce niveau.
function compteurRegle(liste, valeurNiveau, libelle) {
  if (!liste.length) return "";
  const prio = PRIORITE_ORDRE.find((p) => liste.some((t) => prioriteFil(t) === p));
  const choisi = discussionsFiltres.niveau === valeurNiveau;
  return '<button type="button" class="disc-compteur disc-pin prio-' + prio + '" data-niveau="' + escHtmlDisc(valeurNiveau) + '" data-fk="cpt-' + escHtmlDisc(valeurNiveau) + '" aria-pressed="' + choisi + '"'
    + ' aria-label="' + liste.length + " discussion" + (liste.length > 1 ? "s" : "") + " : " + escHtmlDisc(libelle) + ", priorité la plus haute " + PRIORITE_LABELS[prio].toLowerCase() + '"'
    + ' title="' + liste.length + " discussion" + (liste.length > 1 ? "s" : "") + " (" + PRIORITE_LABELS[prio].toLowerCase() + ')">' + liste.length + "</button>";
}
function avatarDisc(nom) {
  return '<span class="disc-av" title="' + escHtmlDisc(nom) + '">' + escHtmlDisc(initialesNom(nom)) + "</span>";
}

// Vignette d'un fil : la vraie vue 3D enregistrée à la création (thread.vignette, "data:image/jpeg;base64,..."), sinon un pictogramme
// neutre (bulle de conversation) avec en dessous les maquettes concernées, ou "Sujet général".
function vignetteDiscussion(thread) {
  if (typeof thread.vignette === "string" && thread.vignette.startsWith("data:image/jpeg;base64,")) {
    return '<img class="disc-vignette-img" src="' + escHtmlDisc(thread.vignette) + '" alt="Vue 3D de la maquette enregistrée à la création de la discussion : ' + escHtmlDisc(thread.zone || "") + '" decoding="async" draggable="false">';
  }
  const maquettes = (thread.lieu && thread.lieu.maquettes) || [];
  return '<span class="disc-picto"><svg viewBox="0 0 48 44" aria-hidden="true" focusable="false"><path d="M8 6h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    + '<g fill="currentColor"><circle cx="16" cy="19" r="2"/><circle cx="24" cy="19" r="2"/><circle cx="32" cy="19" r="2"/></g></svg>'
    + '<span class="disc-picto-legende">' + escHtmlDisc(maquettes.length ? maquettes.join(" · ") : "Sujet général") + "</span></span>";
}

function renderDiscussionsBarre(threads) {
  // Bouton Historique (nombre de discussions fermées) ; en mode historique il est enfoncé et un bouton ramène aux ouvertes.
  const historique = discussionsFiltres.etat === "historique";
  document.querySelector("#discToolbar h2").textContent = historique ? "Historique : discussions fermées" : "Discussions";
  document.getElementById("discEtat").innerHTML = '<button type="button" data-historique="1" data-fk="historique" aria-pressed="' + historique + '">Historique <span class="n">(' + discussionsNbFermees + ")</span></button>"
    + (historique ? '<button type="button" class="disc-retour" data-retour="1" data-fk="retour">← Retour aux discussions ouvertes</button>' : "");
  // Priorité : compteurs du mode affiché ; le filtre se combine avec le niveau.
  const cPrio = { toutes: threads.length };
  PRIORITE_ORDRE.forEach((p) => { cPrio[p] = threads.filter((t) => prioriteFil(t) === p).length; });
  document.getElementById("discPriorite").innerHTML = [["toutes", "Toutes"]].concat(PRIORITE_ORDRE.map((p) => [p, PRIORITE_LABELS[p]]))
    .map(([v, l]) => '<button type="button" data-priorite="' + v + '" data-fk="prio-' + v + '" aria-pressed="' + (discussionsFiltres.priorite === v) + '">'
      + (v === "toutes" ? "" : '<i class="tl-dot" data-champ="prio" data-v="' + v + '" aria-hidden="true"></i>') + l + '<span class="n">' + cPrio[v] + "</span></button>")
    .join("");
}

function renderDiscussionsCoupe(threads) {
  const niveaux = niveauxDeLaCoupe(threads);
  if (discussionsFiltres.niveau && discussionsFiltres.niveau !== NIVEAU_GENERAL && !niveaux.includes(discussionsFiltres.niveau)) discussionsFiltres.niveau = null;
  const etages = document.getElementById("discEtages");
  // Règle des niveaux : une ligne par niveau, du plus haut au plus bas. Si les lignes ne tiennent pas à la hauteur minimale dans la hauteur
  // disponible, les niveaux VIDES consécutifs se replient en tranches (les niveaux qui portent des discussions restent dépliés) ;
  // en dernier recours la règle défile en interne.
  const items = niveaux.map((niv) => ({ niv, liste: threads.filter((t) => niveauFil(t) === niv) }));
  const runs = [];
  items.forEach((it, i) => {
    if (it.liste.length) return;
    const dernier = runs[runs.length - 1];
    if (dernier && dernier.fin === i - 1) { dernier.fin = i; dernier.len++; } else runs.push({ debut: i, fin: i, len: 1 });
  });
  runs.forEach((r) => { r.cle = items[r.debut].niv + "|" + items[r.fin].niv; r.replie = false; });
  discHauteurRegle = etages.clientHeight;
  const ligneMin = parseFloat(getComputedStyle(etages).getPropertyValue("--ligne-min")) || 18;
  if (discHauteurRegle > 0) {
    let lignes = items.length;
    runs.filter((r) => r.len >= 2 && !discTranchesOuvertes.has(r.cle)).sort((a, b) => b.len - a.len).forEach((r) => {
      if (lignes * ligneMin > discHauteurRegle) { r.replie = true; lignes -= r.len - 1; }
    });
  }
  const rangs = (niv) => rangNiveau(niv);
  const libelleTranche = (r) => {
    const haut = items[r.debut].niv, bas = items[r.fin].niv;
    return rangs(haut) > -1000 && rangs(bas) > -1000 ? "Niv. " + rangs(bas) + " à " + rangs(haut) : bas + " à " + haut;
  };
  let html = "";
  for (let i = 0; i < items.length; i++) {
    const run = runs.find((r) => r.replie && r.debut === i);
    if (run) {
      html += '<div class="disc-etage disc-tranche"><button type="button" class="disc-tranche-btn" data-tranche="' + escHtmlDisc(run.cle) + '" data-fk="tr-' + escHtmlDisc(run.cle) + '" aria-expanded="false"'
        + ' aria-label="Déplier ' + run.len + ' niveaux vides, ' + escHtmlDisc(libelleTranche(run)) + '">' + escHtmlDisc(libelleTranche(run)) + "</button></div>";
      i = run.fin;
      continue;
    }
    const { niv, liste } = items[i];
    const choisi = discussionsFiltres.niveau === niv;
    // Niveau sans discussion : ligne atténuée, étiquette non cliquable (filtrer dessus ne montrerait que les fils "Général").
    const vide = !liste.length;
    html += '<div class="disc-etage' + (choisi ? " sel" : "") + (vide ? " vide" : "") + '" data-niveau="' + escHtmlDisc(niv) + '" data-ligne="' + escHtmlDisc(niv) + '">'
      + '<button type="button" class="disc-etage-label" data-niveau="' + escHtmlDisc(niv) + '" data-fk="niv-' + escHtmlDisc(niv) + '" aria-pressed="' + choisi + '"'
      + (vide ? ' disabled aria-label="' + escHtmlDisc(niv) + ', aucune discussion"' : ' aria-label="Filtrer sur ' + escHtmlDisc(niv) + '"') + ">" + escHtmlDisc(niv) + "</button>"
      + '<span class="disc-piste" aria-hidden="true"></span>'
      + compteurRegle(liste, niv, niv)
      + '<button type="button" class="disc-etage-ajout" data-nouveau-sujet-niveau="' + escHtmlDisc(niv) + '" aria-label="Nouveau sujet au ' + escHtmlDisc(niv) + '" title="Nouveau sujet lié au ' + escHtmlDisc(niv) + '">+</button></div>';
  }
  etages.innerHTML = html || '<p class="disc-coupe-vide">Aucun niveau renseigné pour ces discussions.</p>';
  // Ligne du haut de la règle : Général (sujets sans niveau).
  const ruban = document.getElementById("discRuban");
  const generaux = threads.filter((t) => !niveauFil(t));
  const generalChoisi = discussionsFiltres.niveau === NIVEAU_GENERAL;
  ruban.classList.toggle("sel", generalChoisi);
  ruban.dataset.ligne = NIVEAU_GENERAL;
  ruban.innerHTML = '<span class="disc-ruban-label"><button type="button" class="disc-etage-label disc-general-label" data-niveau="' + NIVEAU_GENERAL + '" data-fk="niv-general" aria-pressed="' + generalChoisi + '" aria-label="Filtrer sur les sujets généraux, sans lieu">Général</button>'
    + "<small>sans lieu</small></span>"
    + compteurRegle(generaux, NIVEAU_GENERAL, "Général")
    + '<button type="button" class="disc-ruban-ajout" data-nouveau-sujet="1" title="Ouvrir un sujet qui n\'est lié à aucun endroit de la maquette">+ Nouveau sujet</button>';
}

function renderDiscussionsCartes(threads) {
  const liste = document.getElementById("discussionsThreadsList");
  const visibles = threads.filter(filtreAccepte);
  liste.innerHTML = "";
  if (!visibles.length && threads.length) {
    liste.innerHTML = '<div class="disc-vide"><span>Aucune discussion pour ce filtre.</span><button type="button" data-fk="reset" data-reset="1">Tout afficher</button></div>';
    return;
  }
  if (!threads.length) {
    // Rien dans le mode affiché : état vide propre, avec un renvoi vers l'autre liste quand elle n'est pas vide.
    liste.innerHTML = discussionsFiltres.etat === "historique"
      ? '<div class="disc-vide"><span>Historique vide.</span><button type="button" data-fk="retour" data-retour="1">Retour aux discussions ouvertes</button></div>'
      : '<div class="disc-vide"><span>Aucune discussion ouverte.</span>' + (discussionsNbFermees ? '<button type="button" data-fk="historique" data-historique="1">Voir l\'historique (' + discussionsNbFermees + ")</button>" : "") + "</div>";
    return;
  }
  visibles.forEach((thread) => {
    const dernier = dernierMessage(thread);
    const msgs = (thread.discussion || []).length;
    const niveau = niveauFil(thread);
    const personnes = personnesDuFil(thread);
    const maquettes = (thread.lieu && thread.lieu.maquettes) || [];
    const quand = dernier ? formaterQuand(dernier.quand) : "";
    const carte = document.createElement("button");
    carte.type = "button";
    // thread-item conservé pour les tests existants ; la mise en forme vient de .disc-carte (voir style.css).
    carte.className = "thread-item disc-carte";
    carte.dataset.fil = thread.id;
    carte.dataset.fk = "carte-" + thread.id;
    carte.setAttribute("role", "listitem");
    const prio = prioriteFil(thread);
    const statut = statutFil(thread);
    carte.setAttribute("aria-label", "Discussion " + thread._rang + ", " + thread.zone + ", priorité " + PRIORITE_LABELS[prio].toLowerCase() + ", " + STATUT_LABELS[statut].toLowerCase() + ", " + msgs + " message" + (msgs > 1 ? "s" : ""));
    carte.dataset.niveau = niveau || NIVEAU_GENERAL;
    // Haut de la vignette : le lieu en pastille, sur la vue 3D enregistrée ou sur le pictogramme neutre.
    carte.innerHTML = '<span class="disc-vignette">' + vignetteDiscussion(thread)
      + '<span class="disc-badges"><span class="disc-tag" title="' + escHtmlDisc(maquettes.join(", ")) + '">' + escHtmlDisc(niveau || "Général") + "</span></span></span>"
      + '<span class="disc-corps"><span class="disc-etiqs">'
      + '<span class="disc-etiq" data-etiq="priorite"><i class="tl-dot" data-champ="prio" data-v="' + prio + '" aria-hidden="true"></i>' + PRIORITE_LABELS[prio] + "</span>"
      + '<span class="disc-etiq" data-etiq="statut"><i class="tl-dot" data-champ="statut" data-v="' + statut + '" aria-hidden="true"></i>' + STATUT_LABELS[statut] + "</span></span>"
      + '<span class="disc-titre">' + escHtmlDisc(thread.zone) + "</span>"
      + '<span class="disc-dernier">' + (dernier ? "<b>" + escHtmlDisc(nomCourt(dernier.auteur)) + "</b>" + (quand ? " · " + quand : "") + " · " + escHtmlDisc(dernier.texte || "") : "Aucun message") + "</span>"
      + '<span class="disc-pied"><span class="disc-avs">' + personnes.slice(0, 5).map(avatarDisc).join("") + (personnes.length > 5 ? '<span class="disc-av plus">+' + (personnes.length - 5) + "</span>" : "") + "</span>"
      + '<span class="disc-compte">' + msgs + " message" + (msgs > 1 ? "s" : "") + "</span></span></span>";
    liste.appendChild(carte);
  });
  animerEntreeListe(liste);
}

// Écouteurs posés une seule fois sur le conteneur (le contenu est reconstruit à chaque rendu).
function initDiscussionsInteractions() {
  if (discussionsInteractionsPosees) return;
  discussionsInteractionsPosees = true;
  const pane = document.getElementById("discussionsListPane");
  const rerendre = (fk) => {
    renderDiscussionsBarre(discussionsAffichees);
    renderDiscussionsCoupe(discussionsAffichees);
    renderDiscussionsCartes(discussionsAffichees);
    const cible = fk && Array.from(pane.querySelectorAll("[data-fk]")).find((e) => e.dataset.fk === fk);
    if (cible) cible.focus({ preventScroll: true });
  };
  pane.addEventListener("click", (e) => {
    const cible = e.target.closest("button");
    if (!cible || !pane.contains(cible)) return;
    const f = discussionsFiltres;
    if (cible.dataset.historique || cible.dataset.retour) {
      f.etat = cible.dataset.retour || f.etat === "historique" ? "ouvertes" : "historique";
      renderDiscussionsPage();
      return;
    }
    if (cible.dataset.priorite) { f.priorite = cible.dataset.priorite; rerendre(cible.dataset.fk); return; }
    if (cible.classList.contains("disc-etage-label") || cible.classList.contains("disc-compteur")) {
      f.niveau = f.niveau === cible.dataset.niveau ? null : cible.dataset.niveau;
      rerendre(cible.dataset.fk);
      return;
    }
    if (cible.dataset.tranche) { discTranchesOuvertes.add(cible.dataset.tranche); rerendre(null); return; }
    if (cible.dataset.reset) { f.priorite = "toutes"; f.niveau = null; rerendre(null); return; }
    if (cible.dataset.nouveauSujet) { ouvrirNouveauSujetGeneral(); return; }
    if (cible.dataset.nouveauSujetNiveau) { ouvrirNouveauSujetGeneral(cible.dataset.nouveauSujetNiveau); return; }
    if (cible.dataset.fil) {
      const thread = discussionsAffichees.find((t) => t.id === cible.dataset.fil);
      if (thread) openThreadDetail(thread);
    }
  });
  // Survol ou focus d'une pastille éclaire la carte, et inversement.
  const eclairer = (id) => pane.querySelectorAll("[data-fil]").forEach((e) => e.classList.toggle("eclaire", id !== null && e.dataset.fil === id));
  pane.addEventListener("mouseover", (e) => { const c = e.target.closest("[data-fil]"); if (c) eclairer(c.dataset.fil); });
  pane.addEventListener("mouseout", (e) => { const c = e.target.closest("[data-fil]"); if (c && !c.contains(e.relatedTarget)) eclairer(null); });
  pane.addEventListener("focusin", (e) => { const c = e.target.closest("[data-fil]"); if (c) eclairer(c.dataset.fil); });
  pane.addEventListener("focusout", () => eclairer(null));
  // Survol ou focus d'une ligne de la règle (niveau ou Général) : éclaire les cartes de ce niveau.
  const eclairerNiveau = (valeur) => pane.querySelectorAll(".disc-carte").forEach((c) => c.classList.toggle("eclaire", valeur !== null && c.dataset.niveau === valeur));
  pane.addEventListener("mouseover", (e) => { const l = e.target.closest("[data-ligne]"); if (l) eclairerNiveau(l.dataset.ligne); });
  pane.addEventListener("mouseout", (e) => { const l = e.target.closest("[data-ligne]"); if (l && !l.contains(e.relatedTarget)) eclairerNiveau(null); });
  pane.addEventListener("focusin", (e) => { const l = e.target.closest("[data-ligne]"); if (l) eclairerNiveau(l.dataset.ligne); });
  pane.addEventListener("focusout", () => eclairerNiveau(null));
  // La règle s'adapte à la hauteur disponible : nouveau calcul des tranches quand la hauteur du panneau change (fenêtre, page qui s'affiche).
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      const h = document.getElementById("discEtages").clientHeight;
      if (h !== discHauteurRegle) renderDiscussionsCoupe(discussionsAffichees);
    }).observe(document.getElementById("discEtages"));
  }
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

// ---- Panneau de la discussion (20/10) ----
const filTitre = document.getElementById("filTitre");
const filEtat = document.getElementById("filEtat");
const filAuteurDate = document.getElementById("filAuteurDate");
const filTags = document.getElementById("filTags");
const filActions = document.getElementById("filActions");
const filListe = document.getElementById("filListe");
const filTagsNb = document.getElementById("filTagsNb");
const filAjoutBtn = document.getElementById("filAjoutBtn");
const filAjoutMenu = document.getElementById("filAjoutMenu");
const filInstructionBtn = document.getElementById("filInstructionBtn");
const filMessages = document.getElementById("filMessages");
const filReponse = document.getElementById("filReponse");
const filReponseInput = document.getElementById("filReponseInput");
const filPleinBtn = document.getElementById("filPleinBtn");
const discussionsDetailContent = document.getElementById("discussionsDetailContent");

// "Julie Martin (BE Structure)" : le nom seul pour l'affichage, le titre complet reste en infobulle.
const nomCourt = (nom) => nom.replace(/\s*\(.*\)\s*/, "").trim() || nom;
function initialesNom(nom) {
  const mots = nomCourt(nom).split(/\s+/).filter(Boolean);
  return ((mots[0] || "?")[0] + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase();
}
// Date et heure seulement pour les messages qui en ont (les fils de demonstration n'en ont pas).
function formaterQuand(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const d = new Date(t);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + ", " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function renderFilMessages(thread, nouveau) {
  filMessages.innerHTML = "";
  // Messages et changements de priorité / statut (thread.historique) dans l'ordre chronologique ; à date égale, l'ordre d'origine.
  const temps = (x) => { const t = Date.parse(x.quand); return isNaN(t) ? 0 : t; };
  const elements = thread.discussion.map((m) => ({ m, t: temps(m), h: false }))
    .concat((thread.historique || []).map((m) => ({ m, t: temps(m), h: true })))
    .map((e, i) => Object.assign(e, { i }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  elements.forEach(({ m: msg, h }) => {
    if (h) {
      const labels = msg.champ === "priorité" ? PRIORITE_LABELS : STATUT_LABELS;
      const lj = document.createElement("li");
      lj.className = "fil-journal";
      const lib = document.createElement("span");
      lib.className = "tl-champ";
      lib.textContent = (msg.champ === "priorité" ? "Priorité" : "Statut");
      const fleche = document.createElement("span");
      fleche.setAttribute("aria-hidden", "true");
      fleche.textContent = "→";
      const quandJ = document.createElement("span");
      quandJ.className = "fil-heure";
      quandJ.textContent = (msg.qui || "Vous") + " · " + formaterQuand(msg.quand);
      lj.append(lib, puceValeur(msg.champ, msg.de, labels), fleche, puceValeur(msg.champ, msg.vers, labels), quandJ);
      filMessages.appendChild(lj);
      return;
    }
    const li = document.createElement("li");
    li.className = "fil-message";
    const avatar = document.createElement("span");
    avatar.className = "fil-avatar" + (msg.auteur.indexOf("Vous") === 0 ? " moi" : "");
    avatar.textContent = initialesNom(msg.auteur);
    const corps = document.createElement("div");
    corps.className = "fil-message-corps";
    const entete = document.createElement("div");
    entete.className = "fil-message-entete";
    const auteur = document.createElement("span");
    auteur.className = "fil-auteur";
    auteur.textContent = msg.auteur;
    entete.appendChild(auteur);
    const quand = msg.quand ? formaterQuand(msg.quand) : "";
    if (quand) {
      const heure = document.createElement("span");
      heure.className = "fil-heure";
      heure.textContent = quand;
      entete.appendChild(heure);
    }
    const texte = document.createElement("div");
    texte.className = "fil-texte";
    texte.textContent = msg.texte;
    corps.append(entete, texte);
    li.append(avatar, corps);
    filMessages.appendChild(li);
  });
  if (nouveau && filMessages.lastElementChild) filMessages.lastElementChild.classList.add("apparition");
  // Plus ancien en haut, plus recent en bas : on arrive sur le dernier message.
  requestAnimationFrame(() => { filMessages.scrollTop = filMessages.scrollHeight; });
}

// "Julie Martin (BE Structure)" : le role entre parentheses, affiche a droite du nom.
const roleNom = (nom) => (nom.match(/\((.*)\)/) || [])[1] || "";

// Bloc "Tagués" : une ligne par personne, "+ Ajouter" propose les personnes connues pas encore taguees.
function renderFilTags(thread, ouvert) {
  const tagues = thread.tagged || (thread.tagged = []);
  filListe.innerHTML = "";
  tagues.forEach((nom) => {
    const li = document.createElement("li");
    li.title = nom;
    const avatar = document.createElement("i");
    avatar.className = "fil-avatar";
    avatar.textContent = initialesNom(nom);
    const role = document.createElement("small");
    role.textContent = roleNom(nom);
    li.append(avatar, document.createTextNode(nomCourt(nom)), role);
    filListe.appendChild(li);
  });
  filTagsNb.textContent = tagues.length || "";
  const restants = KNOWN_PEOPLE.filter((nom) => tagues.indexOf(nom) === -1);
  filAjoutMenu.innerHTML = "";
  restants.forEach((nom) => {
    const li = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.dataset.nom = nom;
    const role = document.createElement("small");
    role.textContent = roleNom(nom);
    bouton.append(document.createTextNode(nomCourt(nom)), role);
    li.appendChild(bouton);
    filAjoutMenu.appendChild(li);
  });
  filAjoutMenu.hidden = true;
  filAjoutBtn.parentNode.hidden = !ouvert || restants.length === 0;
}
filAjoutBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  filAjoutMenu.hidden = !filAjoutMenu.hidden;
});
filAjoutMenu.addEventListener("click", (e) => {
  const bouton = e.target.closest("button[data-nom]");
  if (!bouton || !currentThread) return;
  currentThread.tagged.push(bouton.dataset.nom);
  renderFilTags(currentThread, true);
  jouerClasse(filTagsNb, "pulse", 500);
  if (filListe.lastElementChild) filListe.lastElementChild.classList.add("apparition");
});
document.addEventListener("click", () => { filAjoutMenu.hidden = true; });

function renderFilPanel(thread) {
  filTitre.textContent = thread.zone;
  const ouvert = isThreadOpen(thread);
  filEtat.textContent = ouvert ? "Ouverte" : "Fermée";
  filEtat.classList.toggle("ferme", !ouvert);
  const debut = thread.discussion[0] && thread.discussion[0].quand ? formaterQuand(thread.discussion[0].quand) : "";
  filAuteurDate.textContent = "par " + thread.auteur + (debut ? " · " + debut : "");

  renderFilTags(thread, ouvert);
  // Meme regle que l'ancien bouton : reserve au Bureau d'etudes, jamais depuis une instruction.
  filInstructionBtn.hidden = personaSelect.value !== "be" || !!thread.isInstruction;
  filActions.hidden = filInstructionBtn.hidden;

  filReponse.hidden = !ouvert;
  filReponseInput.value = "";
  majFilControles(thread);
  renderFilMessages(thread);
}

// Priorité et Statut d'une discussion : mêmes menus personnalisés qu'une collision (creerControleMenu), dans la fiche du panneau.
let filControles = null;
function ensureFilControles() {
  if (filControles) return filControles;
  const statuts = {};
  STATUTS_DISCUSSION.forEach((k) => { statuts[k] = STATUT_LABELS[k]; });
  const p = creerControleMenu("filPrioriteSelect", "Priorité", PRIORITE_LABELS, "priorité", changerChampFil);
  const st = creerControleMenu("filStatutSelect", "Statut", statuts, "statut", changerChampFil);
  document.getElementById("filControlesChamps").append(p.field, st.field);
  filControles = { prio: p.sel, statut: st.sel, majPrio: p.maj, majStatut: st.maj };
  return filControles;
}
function majFilControles(thread) {
  const c = ensureFilControles();
  c.prio.value = prioriteFil(thread);
  c.statut.value = statutFil(thread);
  c.prio.parentNode.dataset.valeur = c.prio.value;
  c.statut.parentNode.dataset.valeur = c.statut.value;
  c.majPrio();
  c.majStatut();
}
// Change la priorité ou le statut du fil ouvert. Un statut resolu/ecarte ferme le fil (open: false), nouveau/confirme le rouvre.
// Chaque changement est consigné dans thread.historique (affiché dans la conversation, jamais dans thread.discussion).
function changerChampFil(champ, vers) {
  const fil = currentThread;
  if (!fil || threadType(fil) === "collision") return;
  const cle = champ === "priorité" ? "priorite" : "statut";
  const de = cle === "priorite" ? prioriteFil(fil) : statutFil(fil);
  if (de === vers) return;
  fil[cle] = vers;
  if (cle === "statut") fil.open = !STATUTS_FERMES.includes(vers);
  if (!Array.isArray(fil.historique)) fil.historique = [];
  fil.historique.push({ qui: "Vous", quand: new Date().toISOString(), champ, de, vers });
  const ouvert = isThreadOpen(fil);
  filEtat.textContent = ouvert ? "Ouverte" : "Fermée";
  filEtat.classList.toggle("ferme", !ouvert);
  filReponse.hidden = !ouvert;
  renderFilTags(fil, ouvert);
  majFilControles(fil);
  renderFilMessages(fil, true);
  renderDiscussionsPage();
}

filReponse.addEventListener("submit", (e) => {
  e.preventDefault();
  const texte = filReponseInput.value.trim();
  if (!texte || !currentDiscussionThread) return;
  currentDiscussionThread.discussion.push({ auteur: "Vous", texte, quand: new Date().toISOString() });
  filReponseInput.value = "";
  renderFilMessages(currentDiscussionThread, true);
});
filReponseInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    filReponse.requestSubmit();
  }
});

// Pleine page : la conversation sur toute la largeur, la maquette devient une photo figee en haut de la fiche a gauche (meme
// 3D rapetissee, non manipulable, au point de vue enregistre). Retour : clic sur la photo, "Reduire" ou Echap.
// Passage anime panneau <-> pleine page (20/10) : la photo de la maquette glisse et change de taille jusqu'a sa place
// (WAAPI sur left/top/width/height) pendant que le panneau s'etend vers la gauche (clip-path), 0,3 s. A la fermeture, la classe
// "plein" n'est retiree qu'a la fin de l'animation. Les positions d'arrivee sont mesurees en basculant la classe un instant.
const filPanelEl = document.getElementById("filPanel");
const cadreEl = document.getElementById("threadVisualWrap");
let filEnAnimation = false;
function mesurerFilLayout() {
  const pane = discussionsDetailPane.getBoundingClientRect();
  const photo = discussionsDetailContent.getBoundingClientRect();
  const panneau = filPanelEl.getBoundingClientRect();
  const cadre = document.getElementById("threadVisualWrap").getBoundingClientRect();
  return {
    cadreHauteur: cadre.height,
    photo: { left: photo.left - pane.left, top: photo.top - pane.top, width: photo.width, height: photo.height },
    panneauGauche: panneau.left - pane.left
  };
}
function filPleinPage(actif) {
  if (discussionsDetailPane.classList.contains("plein") === actif || filEnAnimation) return;
  const animer = discussionsDetailPane.offsetParent !== null && !window.matchMedia(REQUETE_MOBILE).matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const options = { duration: 300, easing: "ease" };
  const clip = (dx) => "inset(0 0 0 " + Math.max(0, dx) + "px)";
  const fin = () => {
    filEnAnimation = false;
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };
  if (!animer) {
    discussionsDetailPane.classList.toggle("plein", actif);
    if (actif && currentThread && !threadSnapshotPane.hidden) setThreadVisualMode("apres", currentThread);
    fin();
    return;
  }
  const avant = mesurerFilLayout();
  discussionsDetailPane.classList.toggle("plein", actif);
  // La photo montre la 3D, jamais l'image "Avant" de remplacement.
  if (actif && currentThread && !threadSnapshotPane.hidden) setThreadVisualMode("apres", currentThread);
  const apres = mesurerFilLayout();
  const dx = Math.abs(avant.panneauGauche - apres.panneauGauche);
  const pleinEtat = actif ? apres : avant;
  const petitEtat = actif ? avant : apres;
  // Le panneau et la photo sont mesures dans les deux etats ; on anime depuis l'etat de depart vers celui d'arrivee.
  const boite = (r) => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  filEnAnimation = true;
  if (actif) {
    filPanelEl.animate([{ clipPath: clip(dx) }, { clipPath: clip(0) }], options);
    cadreEl.animate([{ height: avant.cadreHauteur + "px" }, { height: apres.cadreHauteur + "px" }], options);
    const anim = discussionsDetailContent.animate([boite(avant.photo), boite(apres.photo)], options);
    anim.onfinish = anim.oncancel = fin;
  } else {
    // Retour : on repart de l'etat pleine page (classe remise un instant), on anime, puis on retire la classe.
    discussionsDetailPane.classList.add("plein");
    filPanelEl.animate([{ clipPath: clip(0) }, { clipPath: clip(dx) }], options);
    cadreEl.animate([{ height: pleinEtat.cadreHauteur + "px" }, { height: petitEtat.cadreHauteur + "px" }], options);
    const anim = discussionsDetailContent.animate([boite(pleinEtat.photo), boite(petitEtat.photo)], options);
    anim.onfinish = anim.oncancel = () => {
      discussionsDetailPane.classList.remove("plein");
      fin();
    };
  }
}
filPleinBtn.addEventListener("click", () => filPleinPage(!discussionsDetailPane.classList.contains("plein")));
discussionsDetailContent.addEventListener("click", () => {
  if (discussionsDetailPane.classList.contains("plein")) filPleinPage(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!filAjoutMenu.hidden) { filAjoutMenu.hidden = true; return; }
  if (!discussionsDetailPane.hidden && discussionsDetailPane.classList.contains("plein")) filPleinPage(false);
});

function openThreadDetail(thread, returnView) {
  discussionsReturnView = returnView || "discussions";
  // discussionsDetailPane vit dans view-discussions : la basculer visible
  // avant de l'utiliser, meme quand on vient de la vue Todo.
  activateView("discussions");
  discussionsListPane.hidden = true;
  discussionsDetailPane.hidden = false;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) jouerClasse(discussionsDetailPane, "detail-entree", 450);
  currentThread = thread;
  filPleinPage(false);
  setThreadVisualMode("apres", thread);

  if (isHospitalClash(thread)) {
    // Une collision de l'hopital ouverte par son lien direct : ancien bloc partage avec Collision (journal des
    // changements, priorite, statut).
    discussionsDetailPane.classList.remove("fil-actif");
    discussionsDetailPane.appendChild(collisionDiscussion);
    // Dans un fil de Discussions, la zone de commentaires est le contenu principal : toujours depliee.
    collisionDiscussion.classList.remove("collapsed");
    showThreadDiscussion(thread);
  } else {
    // Panneau a droite de la 3D (20/10) ; le bandeau partage reste a sa place dans Collision.
    discussionsDetailPane.classList.add("fil-actif");
    if (discussionsDetailPane.contains(collisionDiscussion)) collisionLeft.appendChild(collisionDiscussion);
    currentDiscussionThread = thread;
    renderFilPanel(thread);
  }
  window.dispatchEvent(new Event("resize"));

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
    animerEntreeListe(discussionsThreadsList);
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
      // Array.from : xeokit renvoie des Float64Array, que JSON.stringify transforme en objet {"0":..} (camera perdue a l'enregistrement).
      eye: Array.from(viewer.camera.eye),
      look: Array.from(viewer.camera.look),
      up: Array.from(viewer.camera.up)
    },
    niveaux: niveauxState.map((n) => ({ name: n.name, checked: n.checked })),
    maquettes: MAQUETTES.map((m) => ({ id: m.id, visible: m.shown })),
    coupe: activeCoupeId ? capturedCoupeState() : null,
    entites: capturerEtatEntites()
  };
}

// Etat d'affichage des entites (21/10) : tout ce que l'utilisateur compose dans le Viewer (isolation X-ray, elements masques, couleurs,
// transparences, selection, surlignage) ou que la page Collision pose (selectClash), enregistre de facon COMPACTE : uniquement les ecarts
// par rapport a l'etat par defaut, par maquette. Une liste d'ids qui couvre plus de la moitie des entites de la maquette est stockee en
// negatif ({ sauf: true } : toutes SAUF ces ids), ce qui garde l'isolation X-ray (presque tout en fantome) a quelques ids. Plafond de
// ETAT_ENTITES_PLAFOND ids au total : les plus grandes listes sont abandonnees au-dela (entites.tronque = true).
// Forme : { parMaquette: { <id maquette>: { masques, xray, selection, surlignes, couleurs: [{ rgb, ids }], opacites: [{ a, ids }] } },
//           xrayMat, tronque }. masques / xray / selection / surlignes / ids = { sauf, ids }. rgb = [0..255]x3, ou null = couleur d'origine
// (maquette avec teinte, entite sans teinte) ; a = opacite sur 0..255. Anciennes vues : pas de champ entites, rien n'est modifie.
const ETAT_ENTITES_PLAFOND = 4000;
const XRAY_MATERIAU_DEFAUT = {
  fillAlpha: viewer.scene.xrayMaterial.fillAlpha,
  edgeAlpha: viewer.scene.xrayMaterial.edgeAlpha,
  fillColor: Array.from(viewer.scene.xrayMaterial.fillColor),
  edgeColor: Array.from(viewer.scene.xrayMaterial.edgeColor)
};

// Vrai le temps d'une remise a plat dont l'etat fantome (X-ray) doit etre conserve : il est ensuite retire progressivement par
// degelerFantomesProgressivement, sans etre efface puis remis (une seule ecriture sur la maquette).
let garderXrayAuReset = false;

function entitesObjetsDeMaquette(maquette) {
  return maquette.model && maquette.model.entityList ? maquette.model.entityList.filter((e) => e.isObject) : [];
}

// Teinte de base d'une maquette, en entiers 0..255 (quantification de xeokit : floor(c * 255)), ou null.
function teinteBaseMaquette(maquette) {
  return maquette.colorize ? maquette.colorize.map((c) => Math.floor(c * 255)) : null;
}

// Ecarts courants par maquette, sous forme de tableaux d'ids bruts (sert a la capture ET a la remise a zero avant restauration).
function collecterEcartsEntites() {
  const scene = viewer.scene;
  const parId = new Map(MAQUETTES.map((m) => [m.id, m]));
  const acc = new Map();
  const de = (entite) => {
    const mid = entite.model && entite.model.id;
    if (!parId.has(mid)) return null;
    let a = acc.get(mid);
    if (!a) {
      a = { masques: [], xray: [], selection: [], surlignes: [], couleurs: new Map(), opacites: new Map() };
      acc.set(mid, a);
    }
    return a;
  };
  Object.values(scene.xrayedObjects).forEach((e) => { const a = de(e); if (a) a.xray.push(e.id); });
  Object.values(scene.selectedObjects).forEach((e) => { const a = de(e); if (a) a.selection.push(e.id); });
  Object.values(scene.highlightedObjects).forEach((e) => { const a = de(e); if (a) a.surlignes.push(e.id); });
  Object.values(scene.opacityObjects).forEach((e) => {
    const a = de(e);
    if (!a) return;
    const q = Math.round(e.opacity * 255);
    if (q === 255) return;
    if (!a.opacites.has(q)) a.opacites.set(q, []);
    a.opacites.get(q).push(e.id);
  });
  const ajouterCouleur = (a, cle, rgb, id) => {
    if (!a.couleurs.has(cle)) a.couleurs.set(cle, { rgb, ids: [] });
    a.couleurs.get(cle).ids.push(id);
  };
  MAQUETTES.forEach((m) => {
    if (!m.model) return;
    const base = teinteBaseMaquette(m);
    if (base) {
      // Teinte de la maquette perdue (ex. couleur remise a l'origine apres une collision) : ecart « couleur d'origine ».
      entitesObjetsDeMaquette(m).forEach((e) => {
        if (!scene.colorizedObjects[e.id]) {
          if (!acc.has(m.id)) de(e);
          ajouterCouleur(acc.get(m.id), "origine", null, e.id);
        }
      });
    }
    // Entites hors niveaux decoches, hors maquette masquee, hors garde-corps toujours masques : masquees (ou ecartees) par l'utilisateur.
    if (m.shown) {
      const attendusMasques = new Set(m.id === "hosp-arch" ? HOSPITAL_MISPLACED_RAILING_IDS : []);
      niveauxState.forEach((n) => { if (!n.checked) (n.objectsByMaquette[m.id] || []).forEach((id) => attendusMasques.add(id)); });
      entitesObjetsDeMaquette(m).forEach((e) => {
        if ((!e.visible || e.culled) && !attendusMasques.has(e.id)) {
          const a = de(e);
          if (a) a.masques.push(e.id);
        }
      });
    }
  });
  Object.values(scene.colorizedObjects).forEach((e) => {
    const a = de(e);
    if (!a) return;
    const maquette = parId.get(e.model.id);
    const base = teinteBaseMaquette(maquette);
    const c = e.colorize;
    const rgb = [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
    if (base && base[0] === rgb[0] && base[1] === rgb[1] && base[2] === rgb[2]) return;
    ajouterCouleur(a, rgb.join(","), rgb, e.id);
  });
  return acc;
}

function capturerEtatEntites() {
  const scene = viewer.scene;
  const acc = collecterEcartsEntites();
  const parMaquette = {};
  const grandes = []; // { liste, taille } : candidates a l'abandon si le plafond est depasse
  let total = 0;
  const compacter = (ids, tous) => {
    const negatif = ids.length * 2 > tous.length;
    let liste;
    if (negatif) {
      const set = new Set(ids);
      liste = { sauf: true, ids: tous.filter((id) => !set.has(id)) };
    } else {
      liste = { sauf: false, ids };
    }
    total += liste.ids.length;
    return liste;
  };
  acc.forEach((a, mid) => {
    const m = MAQUETTES.find((x) => x.id === mid);
    const tous = entitesObjetsDeMaquette(m).map((e) => e.id);
    const sortie = {};
    ["masques", "xray", "selection", "surlignes"].forEach((cat) => {
      if (a[cat].length) sortie[cat] = compacter(a[cat], tous);
    });
    if (a.couleurs.size) sortie.couleurs = [...a.couleurs.values()].map((c) => ({ rgb: c.rgb, ids: compacter(c.ids, tous) }));
    if (a.opacites.size) sortie.opacites = [...a.opacites.entries()].map(([q, ids]) => ({ a: q, ids: compacter(ids, tous) }));
    if (Object.keys(sortie).length) parMaquette[mid] = sortie;
  });
  // Plafond : on retire d'abord les plus grandes listes (une liste retiree = ecart non restaure, jamais une liste coupee a moitie).
  let tronque = false;
  if (total > ETAT_ENTITES_PLAFOND) {
    Object.values(parMaquette).forEach((sortie) => {
      ["masques", "xray", "selection", "surlignes"].forEach((cat) => { if (sortie[cat]) grandes.push({ liste: sortie[cat], retirer: () => { delete sortie[cat]; } }); });
      (sortie.couleurs || []).forEach((c) => grandes.push({ liste: c.ids, retirer: () => { sortie.couleurs.splice(sortie.couleurs.indexOf(c), 1); } }));
      (sortie.opacites || []).forEach((o) => grandes.push({ liste: o.ids, retirer: () => { sortie.opacites.splice(sortie.opacites.indexOf(o), 1); } }));
    });
    grandes.sort((x, y) => y.liste.ids.length - x.liste.ids.length);
    for (const g of grandes) {
      if (total <= ETAT_ENTITES_PLAFOND) break;
      total -= g.liste.ids.length;
      g.retirer();
      tronque = true;
    }
  }
  const mat = scene.xrayMaterial;
  const materielModifie = mat.fillAlpha !== XRAY_MATERIAU_DEFAUT.fillAlpha || mat.edgeAlpha !== XRAY_MATERIAU_DEFAUT.edgeAlpha ||
    Array.from(mat.fillColor).join() !== XRAY_MATERIAU_DEFAUT.fillColor.join() || Array.from(mat.edgeColor).join() !== XRAY_MATERIAU_DEFAUT.edgeColor.join();
  return {
    parMaquette,
    xrayMat: materielModifie ? { fillAlpha: mat.fillAlpha, edgeAlpha: mat.edgeAlpha, fillColor: Array.from(mat.fillColor), edgeColor: Array.from(mat.edgeColor) } : null,
    tronque
  };
}

// Rejoue l'etat des entites : remise a l'etat par defaut de tout ecart courant, puis application de celui de la vue. Une entite absente
// de la scene (id inconnu) est ignoree. Appelee APRES applyVisibility (qui remet la visibilite par niveaux et maquettes).
function restaurerEtatEntites(entites) {
  const scene = viewer.scene;
  const courants = collecterEcartsEntites();
  deselectEntity();
  const decoder = (liste, maquette) => {
    if (!liste || !Array.isArray(liste.ids)) return [];
    if (!liste.sauf) return liste.ids.filter((id) => scene.objects[id]);
    const exclus = new Set(liste.ids);
    return entitesObjetsDeMaquette(maquette).map((e) => e.id).filter((id) => !exclus.has(id));
  };
  const modeles = MAQUETTES.filter((m) => m.model).map((m) => m.model);
  const apres = []; // couleurs et opacites : hors ecriture groupee (setObjects* gere ses propres drapeaux)
  ecritureGroupeeDrapeaux(modeles, () => {
    courants.forEach((a, mid) => {
      a.xray.forEach((id) => { const e = scene.objects[id]; if (e) { if (!garderXrayAuReset) e.xrayed = false; e.pickable = true; } });
      a.selection.forEach((id) => { const e = scene.objects[id]; if (e) e.selected = false; });
      a.surlignes.forEach((id) => { const e = scene.objects[id]; if (e) e.highlighted = false; });
      a.masques.forEach((id) => { const e = scene.objects[id]; if (e) { e.culled = false; e.visible = true; } });
      const maquette = MAQUETTES.find((x) => x.id === mid);
      a.couleurs.forEach((c) => apres.push(() => scene.setObjectsColorized(c.ids, maquette.colorize || null)));
      a.opacites.forEach((ids) => apres.push(() => scene.setObjectsOpacity(ids, 1)));
    });
    Object.entries(entites.parMaquette || {}).forEach(([mid, cats]) => {
      const maquette = MAQUETTES.find((x) => x.id === mid);
      if (!maquette || !maquette.model) return;
      decoder(cats.xray, maquette).forEach((id) => { const e = scene.objects[id]; if (e) { e.xrayed = true; e.pickable = false; } });
      decoder(cats.masques, maquette).forEach((id) => { const e = scene.objects[id]; if (e) e.visible = false; });
      decoder(cats.selection, maquette).forEach((id) => { const e = scene.objects[id]; if (e) e.selected = true; });
      decoder(cats.surlignes, maquette).forEach((id) => { const e = scene.objects[id]; if (e) e.highlighted = true; });
      (cats.couleurs || []).forEach((c) => {
        const ids = decoder(c.ids, maquette);
        const couleur = Array.isArray(c.rgb) ? c.rgb.map((v) => (v + 0.5) / 255) : null; // null = couleur d'origine
        apres.push(() => scene.setObjectsColorized(ids, couleur));
      });
      (cats.opacites || []).forEach((o) => {
        const ids = decoder(o.ids, maquette);
        apres.push(() => scene.setObjectsOpacity(ids, (o.a + 0.5) / 255));
      });
    });
  });
  apres.forEach((appliquer) => appliquer());
  if (!garderXrayAuReset) {
    const mat = scene.xrayMaterial;
    const voulu = entites.xrayMat || XRAY_MATERIAU_DEFAUT;
    mat.fillAlpha = voulu.fillAlpha;
    mat.edgeAlpha = voulu.edgeAlpha;
    mat.fillColor = voulu.fillColor;
    mat.edgeColor = voulu.edgeColor;
  }
  const selectionnee = Object.values(scene.selectedObjects).find((e) => e.model && MAQUETTES.some((m) => m.id === e.model.id));
  if (selectionnee) selectedEntity = selectionnee;
}

function capturedCoupeState() {
  const sectionPlane = viewer.scene.sectionPlanes[activeCoupeId];
  return {
    pos: Array.from(sectionPlane.pos),
    dir: Array.from(sectionPlane.dir),
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
  if (snapshot.entites) restaurerEtatEntites(snapshot.entites);

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

// "Level 3 Ceiling", "Level 7A", "Niveau 2" -> "Niveau 3", "Niveau 7A", "Niveau 2" ; autre nom : tel quel.
function libelleNiveau(nomIfc) {
  if (!nomIfc) return null;
  const m = nomIfc.match(/^\s*(?:level|niveau)\s*([0-9A-Za-z]+)/i);
  return m ? "Niveau " + m[1] : nomIfc;
}

// Lieu d'une discussion DEDUIT DE LA VUE 3D, sans IA ni saisie (20/10) : le niveau vient de l'element de reference (l'element selectionne,
// sinon l'element sous le centre de la vue) via l'arbre spatial IFC, les maquettes sont celles affichees. Aucun niveau trouve : null
// (la discussion ira dans "Général").
function lieuDepuis3D() {
  let entite = selectedEntity;
  if (!entite) {
    const canevas = viewer.scene.canvas.canvas;
    const touche = viewer.scene.pick({ canvasPos: [Math.round(canevas.clientWidth / 2), Math.round(canevas.clientHeight / 2)] });
    entite = touche && touche.entity ? touche.entity : null;
  }
  const niveau = entite ? libelleNiveau(findNiveauIfc(entite.id)) : null;
  const maquettes = MAQUETTES.filter((m) => m.shown).map((m) => COLLISION_TOGGLE_LABELS[m.id] || m.label);
  return { niveau, maquettes };
}

// Vignette d'une discussion (20/10) : la VRAIE vue 3D au moment de la creation, en JPEG reduit (480 px de large, ~30 Ko), qui illustre la
// carte dans la liste. Meme rapport largeur/hauteur que l'ecran. Un echec de capture n'empeche jamais la creation (pas de vignette).
function capturerVignette() {
  try {
    const canevas = viewer.scene.canvas.canvas;
    if (!canevas.clientWidth || !canevas.clientHeight) return null;
    const largeur = 480;
    const hauteur = Math.max(120, Math.round(largeur * canevas.clientHeight / canevas.clientWidth));
    return viewer.getSnapshot({ width: largeur, height: hauteur, format: "jpeg" });
  } catch (e) {
    console.warn("[discussion] vignette impossible : " + e.message);
    return null;
  }
}

// Titre d'une discussion tire du premier message : premiere ligne non vide, 70 caracteres au plus, coupee a un mot. Remplace l'ancien champ
// "Sujet" ; une IA proposera ensuite un titre plus parlant (thread.titreAuto signale que le titre n'a pas ete saisi).
function titreDepuisMessage(texte) {
  const ligne = (texte.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "Nouvelle discussion").replace(/\s+/g, " ");
  if (ligne.length <= 70) return ligne;
  const coupe = ligne.slice(0, 70);
  return coupe.slice(0, Math.max(coupe.lastIndexOf(" "), 40)).trim() + "…";
}

// Vue du Viewer pour la messagerie (21/10) : la capture existante (capturerVignette, JPEG 480 px) et l'etat du Viewer (captureViewerState :
// camera, niveaux, maquettes, coupe) pour rouvrir le Viewer au meme angle. Le « seed » ne sert qu'au schema de repli si la capture echoue.
// Capture de la 3D en JPEG pour la recolte des vues : meme methode que capturerVignette (viewer.getSnapshot), mais 640 px de large au plus
// et une qualite de 0,8 (getSnapshot n'en regle pas : on recompresse la capture dans un canvas 2D).
function capturerVueJpeg(largeurMax) {
  const canevas = viewer.scene.canvas.canvas;
  if (!canevas.clientWidth || !canevas.clientHeight) return Promise.reject(new Error("Le canevas 3D n'est pas affiche."));
  const largeur = Math.min(largeurMax, canevas.clientWidth);
  const hauteur = Math.max(120, Math.round(largeur * canevas.clientHeight / canevas.clientWidth));
  const source = viewer.getSnapshot({ width: largeur, height: hauteur, format: "jpeg" });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const cible = document.createElement("canvas");
      cible.width = image.naturalWidth;
      cible.height = image.naturalHeight;
      cible.getContext("2d").drawImage(image, 0, 0);
      resolve(cible.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => reject(new Error("La capture de la 3D est illisible."));
    image.src = source;
  });
}

function capturerVuePourMessagerie() {
  const lieu = lieuDepuis3D();
  return {
    seed: Date.now() % 100000,
    niveau: lieu.niveau || "Vue libre",
    modeles: lieu.maquettes.join(" + ") || "Aucune maquette",
    image: capturerVignette(),
    etat: captureViewerState()
  };
}

// « Ouvrir dans le Viewer » depuis la messagerie : meme parcours que le clic sur l'onglet Viewer (transition, maquettes et niveaux
// remis a plat), mais sans le vol de camera vers la vue d'accueil : la camera est posee directement sur celle de la vue.
function ouvrirViewerSurVue(vue) {
  if (!vue.etat || !vue.etat.camera) {
    navLinks.find((l) => l.dataset.view === "viewer").click();
    return;
  }
  fermerEchangesGrand(false);
  restoreAllModelsVisible();
  niveauxState.forEach((n) => {
    n.checked = true;
    if (n.checkboxEl) n.checkboxEl.checked = true;
  });
  // Rien d'asynchrone laisse par la page Collision (vol de camera, pose differee des transparences) ne doit passer apres la restauration.
  viewer.cameraFlight.cancel();
  clearTimeout(minuteurOpacitesCollision);
  activateView("viewer");
  restoreViewerState(vue.etat);
  viewerDepuisVueDiscussion = true;
  if (messagerie) messagerie.vueDeConversation(true);
  viewer.camera.projection = "perspective"; // projection de la capture (la page Collision peut avoir laisse l'orthographique du plan)
  viewer.cameraFlight.jumpTo({ eye: vue.etat.camera.eye, look: vue.etat.camera.look, up: vue.etat.camera.up });
  navbarLinksEl.classList.remove("open");
}

newDiscussionBtn.addEventListener("click", () => {
  closeFicheSheet();
  // Messagerie : « Nouvelle discussion » ouvre le dialogue « Nouveau sujet » avec la vue du Viewer deja jointe.
  if (messagerie) {
    messagerie.nouveauSujetDepuisViewer(capturerVuePourMessagerie());
    return;
  }
  pendingSnapshot = captureViewerState();
  pendingSnapshot.lieu = lieuDepuis3D();
  pendingSnapshot.vignette = capturerVignette();
  newDiscussionForm.reset();
  document.getElementById("newDiscussionTitre").textContent = "Nouvelle discussion";
  newDiscussionModalOverlay.hidden = false;
  // Curseur directement dans le champ (20/10) : appele dans le geste du clic pour que le clavier s'ouvre aussi sur iPhone.
  newDiscussionComment.focus();
});

// Nouveau sujet GENERAL (20/10), depuis la zone "Général" de la page Discussions : meme formulaire a un seul champ, mais aucune capture de la 3D,
// donc aucun lieu, ni camera, ni niveau : un sujet de projet n'est pas forcement lie a un endroit de la maquette.
// Avec un niveau (bouton "+" d'un etage de la coupe) : sujet lie a ce niveau, sans lien avec un element de la maquette.
function ouvrirNouveauSujetGeneral(niveau) {
  pendingSnapshot = { general: !niveau, lieu: { niveau: niveau || null, maquettes: [] } };
  newDiscussionForm.reset();
  document.getElementById("newDiscussionTitre").textContent = niveau ? "Nouveau sujet · " + niveau : "Nouveau sujet";
  newDiscussionModalOverlay.hidden = false;
  newDiscussionComment.focus();
}

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

  const texte = newDiscussionComment.value.trim();
  const thread = {
    id: "disc-" + Date.now(),
    zone: titreDepuisMessage(texte),
    titreAuto: true,
    lieu: pendingSnapshot.lieu,
    vignette: pendingSnapshot.vignette || null,
    general: !!pendingSnapshot.general,
    auteur: CURRENT_USER,
    tagged: [],
    open: true,
    camera: pendingSnapshot.camera,
    niveaux: pendingSnapshot.niveaux,
    maquettes: pendingSnapshot.maquettes,
    coupe: pendingSnapshot.coupe,
    discussion: [{ auteur: CURRENT_USER, texte: newDiscussionComment.value.trim(), quand: new Date().toISOString() }]
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
  if (!DISCUSSIONS_MESSAGERIE && hashParts[0] === "discussions" && hashParts[1]) {
    const targetThread = [...CLASHES, ...DISCUSSIONS].find((t) => t.id === hashParts[1]);
    if (targetThread) {
      openThreadDetail(targetThread);
    }
  }
}

// Liste des couples de maquettes dans le drawer de la page Collision (20/10). Un couple sans collision calculee
// (detection.indisponible) est affiche mais non cliquable.
function remplirCouples(ul) {
  ul.innerHTML = "";
  DETECTIONS.forEach((detection) => {
    const count = CLASHES.filter((c) => c.detectionId === detection.id).length;

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "detection-item";
    btn.disabled = !!detection.indisponible;
    if (detection === detectionCourante) btn.classList.add("courant");
    btn.addEventListener("click", () => {
      memoriserDetection(detection.id);
      // Changer de couple de maquettes : les maquettes se dissolvent progressivement, puis les bulles de la nouvelle paire apparaissent.
      openDetection(detection, { fondu: true, garderTiroir: true });
    });

    // Une pastille de couleur par maquette du couple, comme les boutons de la 3D.
    const pastilles = document.createElement("span");
    pastilles.className = "detection-pastilles";
    detection.modeles.forEach((id) => {
      const maquette = MAQUETTES.find((m) => m.id === id);
      const dot = document.createElement("i");
      dot.style.background = maquette ? maquette.color : "var(--muted)";
      pastilles.appendChild(dot);
    });

    const label = document.createElement("span");
    label.className = "detection-label";
    label.textContent = detection.label;

    const badge = document.createElement("span");
    badge.className = "detection-count";
    badge.textContent = detection.indisponible ? "Bientôt" : count + (count > 1 ? " clashs" : " clash");

    btn.append(pastilles, label, badge);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

// Liste des couples de maquettes : dans le drawer tant qu'aucun couple n'est choisi, et dans le menu du titre (20/10).
// Un couple sans collision calculee (detection.indisponible) est affiche mais non cliquable.
function renderDetections() {
  collisionCouplesList.innerHTML = "";
  collisionCouplesMenu.innerHTML = "";
  if (DETECTIONS.length === 0) {
    detectionsEmpty.hidden = false;
    return;
  }
  detectionsEmpty.hidden = true;
  remplirCouples(collisionCouplesList);
  remplirCouples(collisionCouplesMenu);
}

// Choix du couple memorise pour la navigation (sessionStorage) : perdu quand le navigateur ou l'onglet se ferme,
// la page Collision repart alors sur la liste des couples.
const CLE_DETECTION = "ouvra-collision-detection";
function memoriserDetection(id) {
  try {
    if (id) sessionStorage.setItem(CLE_DETECTION, id);
    else sessionStorage.removeItem(CLE_DETECTION);
  } catch (e) {
    // sessionStorage indisponible : pas bloquant, le choix n'est simplement pas retenu.
  }
}
function detectionMemorisee() {
  try {
    const id = sessionStorage.getItem(CLE_DETECTION);
    return DETECTIONS.find((d) => d.id === id && !d.indisponible) || null;
  } catch (e) {
    return null;
  }
}
let detectionCourante = null;

// Une seule paire de maquettes : la page Collision s'ouvre directement sur sa liste. Plusieurs couples : le dernier
// choix memorise, sinon la liste des couples dans le drawer (openDetection(null)). Aucun couple : message vide.
function ouvrirPageCollision(options = {}) {
  if (!collisionDetail.hidden || DETECTIONS.length === 0) return;
  if (DETECTIONS.length === 1) openDetection(DETECTIONS[0], options);
  else openDetection(detectionMemorisee(), options);
}

// detection = null : aucun couple choisi (20/10), la 3D montre toutes les maquettes et le drawer la liste des couples.
// options.fondu (arrivee depuis le Viewer) : les maquettes hors paire se dissolvent progressivement, puis les bulles apparaissent.
// options.reveler (ids des objets en fantome avant la remise au propre) : ils repassent progressivement en rendu plein, puis la liste et les bulles apparaissent.
function openDetection(detection, options = {}) {
  detectionCourante = detection;
  renderDetections();
  collisionRecap.hidden = true;
  collisionDetail.hidden = false;
  collisionCouplesMenu.hidden = true;
  collisionListTitle.setAttribute("aria-expanded", "false");
  sectionCollisionCouples.hidden = !!detection;
  sectionCollisionListe.hidden = !detection;
  fermerEchangesGrand(false);
  collisionViewerSlot.appendChild(viewerWrap);
  collisionLeft.appendChild(collisionDiscussion);
  collisionDiscussion.classList.add("collapsed");
  setCollisionPanelCollapsed(infoPanel.classList.contains("collapsed"));
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
  const collisionMobile = window.matchMedia(REQUETE_MOBILE).matches;
  // options.garderTiroir (changement de paire de maquettes) : le tiroir reste ouvert, seule la liste des collisions se met a jour.
  collisionInfoPanel.classList.toggle("open", !collisionMobile || !detection || !!options.garderTiroir);
  collisionInfoPanelBackdrop.hidden = true;

  // Ne montre que les maquettes de cette detection (ex. Maquette CEA hors
  // sujet d'une comparaison structure/toiture, masquee ici) : avant le rendu
  // des cases a cocher, pour qu'elles refletent l'etat a jour des l'entree.
  const subset = detection ? MAQUETTES.filter((m) => detection.modeles.includes(m.id)) : [];
  // Nouvelle detection : fantome du contexte et transparence repartent de zero.
  if ((collisionContexteOn || collisionActiveClash || collisionOpacityTouched.length > 0)) resetCollisionOpacityState();
  const etatsModeles = new Map(MAQUETTES.map((m) => [m.id, detection ? detection.modeles.includes(m.id) : true]));
  const detectionClashes = detection ? CLASHES.filter((c) => c.detectionId === detection.id) : [];
  const marqueursAPoser = detectionClashes.filter((c) => !c.factice);
  if (!options.fondu) definirMaquettesVisibles(etatsModeles);
  renderMaquetteRows(collisionMaquettesList, subset);
  renderCollisionMaquetteToggles(subset);

  renderCollisionsList(detectionClashes);
  // Les lignes de la liste et les bulles apparaissent ensemble et finissent en meme temps (apres la dissolution si elle a lieu).
  const liste = detection ? collisionsList : collisionCouplesList;
  // Si l'apparition est differee (degel, dissolution), les lignes restent masquees jusque-la : sinon elles s'afficheraient, disparaitraient
  // au depart de l'animation, puis reapparaitraient.
  // Le titre de la paire de maquettes ouvre la cascade (indice 0), les lignes de la liste suivent : une seule apparition.
  const titre = detection ? collisionListTitle.parentElement : null;
  const decalage = titre ? 1 : 0;
  if (options.fondu || options.reveler) {
    liste.classList.add("liste-attente");
    if (titre) titre.classList.add("titre-attente");
  }
  const lancerApparition = () => {
    if (titre) titre.classList.remove("titre-attente");
    if (detectionCourante !== detection) {
      liste.classList.remove("liste-attente");
      return;
    }
    dureeApparitionMs = dureeEntreeListe(liste, decalage);
    if (titre && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) jouerClasse(titre, "titre-entree", 700);
    animerEntreeListe(liste, decalage);
    renderClashMarkers(marqueursAPoser);
  };
  const apparition = options.fondu ? () => changerVisibiliteAvecFondu(etatsModeles, lancerApparition) : lancerApparition;
  if (options.reveler) degelerFantomesProgressivement(options.reveler, apparition, true);
  else apparition();
  clearClashElementColors();
  deselectEntity();

  collisionDiscussion.hidden = true;
  discussionMessages.innerHTML = "";
  discussionReplyForm.hidden = true;
  currentDiscussionThread = null;
  recenterTarget = null;
}

// Cadrage du batiment entier, centre dans la zone 3D telle qu'elle est affichee (rapport largeur/hauteur du canvas actuel).
// Meme direction de vue et meme haut que la vue d'accueil du Viewer ; seuls le centre (centre de la scene) et la distance
// (sphere englobante dans le plus petit des deux angles de champ) sont calcules pour la zone courante.
function cadrageBatimentDansZone() {
  // Meme cadrage que l'accueil du Viewer (le batiment remplit la zone comme a la premiere arrivee) ; la camera ne s'eloigne que si la zone
  // 3D est plus etroite que celle du Viewer (rapport largeur/hauteur inferieur a 1,6), pour que le batiment ne soit jamais coupe.
  const base = initialCameraState || DEFAULT_CAMERA_STATE;
  const canevas = viewer.scene.canvas.canvas;
  if (!canevas || !canevas.clientWidth || !canevas.clientHeight) return Object.assign({}, base);
  // Mobile (<= 768 px) : pas de recul (la zone 3D portrait donnerait un facteur de 3 : maquette minuscule), meme vue que « Recentrer ».
  const facteur = window.matchMedia(REQUETE_MOBILE).matches ? 1 : Math.max(1, 1.6 / (canevas.clientWidth / canevas.clientHeight));
  const dir = [base.eye[0] - base.look[0], base.eye[1] - base.look[1], base.eye[2] - base.look[2]];
  return {
    eye: [base.look[0] + dir[0] * facteur, base.look[1] + dir[1] * facteur, base.look[2] + dir[2] * facteur],
    look: base.look,
    up: base.up
  };
}

// Boutons a bascule de la page Collision (19/10) : meme effet que la case de
// la liste (maquette.shown + applyVisibility). Etat relu a chaque
// applyVisibility() (refreshCollisionMaquetteToggles), donc synchrone avec la liste.
const COLLISION_TOGGLE_LABELS = { "hosp-arch": "Architecture", "hosp-mep": "Mécanique" };
let collisionToggleEntries = [];
function renderCollisionMaquetteToggles(subset) {
  if (!collisionMaquetteToggles) return;
  collisionMaquetteToggles.innerHTML = "";
  // Aucun couple choisi (liste des couples dans le drawer) : ni bascule de maquette ni contexte.
  if (subset.length === 0) {
    collisionToggleEntries = [];
    collisionGhostMaquettes = [];
    collisionSubsetMaquettes = [];
    collisionContexteBtn = null;
    collisionNiveauBtns = [];
    return;
  }
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
    const conteneur = document.createElement("div");
    conteneur.className = "collision-affichage";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collision-maquette-toggle collision-contexte-toggle";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    const menu = document.createElement("ul");
    menu.className = "collision-affichage-menu";
    menu.hidden = true;
    MODES_AFFICHAGE_COLLISION.forEach((mode) => {
      const li = document.createElement("li");
      const choix = document.createElement("button");
      choix.type = "button";
      choix.dataset.mode = mode.id;
      const coche = document.createElement("span");
      coche.className = "coche";
      const textes = document.createElement("span");
      textes.className = "textes";
      const nom = document.createElement("b");
      nom.textContent = mode.libelle;
      const detail = document.createElement("small");
      detail.textContent = mode.detail;
      textes.append(nom, detail);
      choix.append(coche, textes);
      choix.addEventListener("click", () => {
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        setModeAffichageCollision(mode.id);
      });
      li.appendChild(choix);
      menu.appendChild(li);
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute("aria-expanded", String(!menu.hidden));
    });
    conteneur.append(btn, menu);
    collisionMaquetteToggles.appendChild(conteneur);
    collisionContexteBtn = btn;
    collisionAffichageMenu = menu;
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
    const mode = MODES_AFFICHAGE_COLLISION.find((m) => m.id === collisionModeAffichage);
    collisionContexteBtn.textContent = (mode ? mode.libelle : "Contexte") + " ▾";
    collisionContexteBtn.classList.toggle("off", false);
  }
  if (collisionAffichageMenu) {
    collisionAffichageMenu.querySelectorAll("button[data-mode]").forEach((b) => {
      const actif = b.dataset.mode === collisionModeAffichage;
      b.classList.toggle("actif", actif);
      b.querySelector(".coche").textContent = actif ? "✓" : "";
    });
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

// Carte d'une collision de la liste (numero, types en francais, identifiants et niveau, point de statut, filet de priorite). Partagee entre la
// liste (balise "button") et la modale « Regle a valider » (balise "span", 22/10, creerCarte) : un seul rendu pour les deux.
function buildCollisionCard(clash, tag = "button") {
  const btn = document.createElement(tag);
  if (tag === "button") btn.type = "button";
  btn.className = "collision-item";
  btn.dataset.clashId = clash.id;
  // Collision fictive (exemple de mise en page) : visible dans la liste, mais ni cliquable ni marqueur 3D.
  if (clash.factice) {
    btn.disabled = true;
    btn.classList.add("factice");
  }

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
  return btn;
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

  const btn = buildCollisionCard(clash);
  btn.addEventListener("click", () => activateClash(clash));
  if (clash.factice) toggle.hidden = true;

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
  {
    const detection = clashes.length ? DETECTIONS.find((d) => d.id === clashes[0].detectionId) : null;
    if (detection) {
      collisionListTitleText.textContent = detection.label;
      collisionListTitleCount.textContent = clashes.length + (clashes.length > 1 ? " collisions" : " collision");
      collisionListTitle.hidden = false;
      requestAnimationFrame(ajusterTitreCollision);
    } else {
      collisionListTitle.hidden = true;
    }
    collisionListTitle.disabled = DETECTIONS.length < 2;
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
// Camera verrouillee sur la bulle de collision (20/10, demande de Gilles) : en vue collision, seuls la rotation et le zoom
// sont possibles, la rotation se fait toujours autour du point de collision. Le deplacement lateral (clic droit, deux
// doigts, clavier) deplacerait le point regarde : a chaque image, on le ramene sur la collision en reculant l'oeil du
// meme decalage, ce qui annule le deplacement sans toucher a la rotation ni au zoom.
// ---- Angle de vue enregistre par collision (20/10) ----
// Stocke dans le navigateur (localStorage), par collision : decalage de l'oeil par rapport au point de collision, et vecteur "haut".
// Relatif a la bulle, donc valable meme si la camera automatique change.
const CLE_ANGLES_COLLISION = "ouvra-angles-collision";
function lireAnglesEnregistres() {
  try {
    return JSON.parse(localStorage.getItem(CLE_ANGLES_COLLISION)) || {};
  } catch (e) {
    return {};
  }
}
let anglesEnregistres = lireAnglesEnregistres();
function angleEnregistre(clash) {
  const a = anglesEnregistres[clash.id];
  return a && Array.isArray(a.offset) && a.offset.length === 3 && Array.isArray(a.up) ? a : null;
}
function ecrireAnglesEnregistres() {
  try {
    localStorage.setItem(CLE_ANGLES_COLLISION, JSON.stringify(anglesEnregistres));
  } catch (e) {
    // localStorage indisponible (navigation privee...) : l'angle ne survit pas au rechargement.
  }
}
const saveAngleBtn = document.getElementById("saveAngleBtn");
// "Angle automatique" : uniquement en pleine page de la collision (fiche de gauche, voir construireFicheCollision).
const resetAngleBtn = document.createElement("button");
resetAngleBtn.type = "button";
resetAngleBtn.id = "resetAngleBtn";
resetAngleBtn.hidden = true;
resetAngleBtn.textContent = "Revenir à l'angle automatique";
resetAngleBtn.title = "Supprimer l'angle enregistré de cette collision et revenir à l'angle automatique";
function majBoutonsAngle() {
  const clash = collisionActiveClash;
  const actif = !!clash && !collisionDetail.hidden && !clash.factice;
  saveAngleBtn.hidden = !actif;
  resetAngleBtn.hidden = !(actif && angleEnregistre(clash));
}
let minuteurAngle = null;
saveAngleBtn.addEventListener("click", () => {
  const clash = collisionActiveClash;
  if (!clash) return;
  const point = clashCenter(clash);
  const cam = viewer.camera;
  anglesEnregistres[clash.id] = {
    offset: [cam.eye[0] - point[0], cam.eye[1] - point[1], cam.eye[2] - point[2]],
    up: Array.from(cam.up)
  };
  ecrireAnglesEnregistres();
  majBoutonsAngle();
  saveAngleBtn.textContent = "Angle enregistré ✓";
  saveAngleBtn.classList.add("enregistre");
  clearTimeout(minuteurAngle);
  minuteurAngle = setTimeout(() => {
    saveAngleBtn.textContent = "Enregistrer cet angle";
    saveAngleBtn.classList.remove("enregistre");
  }, 1600);
});
resetAngleBtn.addEventListener("click", () => {
  const clash = collisionActiveClash;
  if (!clash) return;
  delete anglesEnregistres[clash.id];
  ecrireAnglesEnregistres();
  majBoutonsAngle();
  flyToClash(clash, true);
});

let verrouCamera = null;
// La rotation de xeokit tourne autour du "pivot" (PivotController), pose par defaut sous le curseur a chaque clic : en
// vue collision il est force sur la bulle. Le deplacement lateral est annule a chaque image (voir plus bas).
const pivotControllerXeokit = viewer.cameraControl._controllers.pivotController;
const poserPivotXeokit = pivotControllerXeokit.setPivotPos.bind(pivotControllerXeokit);
pivotControllerXeokit.setPivotPos = (pos) => poserPivotXeokit(verrouCamera || pos);
function verrouillerCamera(point) {
  verrouCamera = point;
  pivotControllerXeokit.setPivotPos(point);
}
function deverrouillerCamera() {
  verrouCamera = null;
}
// Le zoom de xeokit deplace l'oeil ET le point regarde le long du rayon du curseur, comme un deplacement lateral : on
// ne garde que la part du decalage de "look" perpendiculaire a l'axe de vue (deplacement latéral), jamais la part sur
// l'axe (zoom). La bulle reste ainsi sur l'axe de vue, au centre, quelle que soit la distance.
viewer.scene.on("tick", () => {
  if (!verrouCamera) return;
  const cam = viewer.camera;
  const eye = cam.eye;
  const look = cam.look;
  const f = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]];
  const len = Math.hypot(f[0], f[1], f[2]);
  if (len < 1e-6) return;
  f[0] /= len; f[1] /= len; f[2] /= len;
  const d = [look[0] - verrouCamera[0], look[1] - verrouCamera[1], look[2] - verrouCamera[2]];
  const along = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const perp = [d[0] - along * f[0], d[1] - along * f[1], d[2] - along * f[2]];
  if (perp[0] * perp[0] + perp[1] * perp[1] + perp[2] * perp[2] < 1e-8) return;
  cam.eye = [eye[0] - perp[0], eye[1] - perp[1], eye[2] - perp[2]];
  cam.look = [look[0] - perp[0], look[1] - perp[1], look[2] - perp[2]];
});

function flyToClash(clash, cadrageVolume = false, onDone = undefined) {
  const center = clashCenter(clash);
  // Verrou seulement pour la page Collision (cadrageVolume) ; il est libere pendant le vol, repose a l'arrivee.
  deverrouillerCamera();
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

  let eye = pickBestClashView(clash, center, nearbyAabbs, volume);
  let up = [0, 1, 0];
  // Angle officiel enregistre par Gilles pour cette collision (bouton "Enregistrer cet angle") : il remplace l'angle automatique,
  // au choix de la collision comme au bouton Recentrer.
  const angle = cadrageVolume ? angleEnregistre(clash) : null;
  if (angle && center.every(Number.isFinite)) {
    eye = [center[0] + angle.offset[0], center[1] + angle.offset[1], center[2] + angle.offset[2]];
    up = angle.up;
  }
  if (volume) {
    const dist = Math.hypot(eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]);
    console.info("[collision] cadrage n° " + (CLASHES.indexOf(clash) + 1) + " : volume " +
      volume.raw.map((v) => v.toFixed(1)).join("x") + " m (plafonne : " + (volume.capped ? "oui" : "non") +
      "), distance " + dist.toFixed(1) + " m");
  }

  // cancel() et non stop() : flyTo() appelle stop() sur un vol en cours, et stop() DECLENCHE la callback d'arrivee de l'ancien vol
  // (calcul de transparence et verrou de camera de la collision precedente, en pleine animation). cancel() l'abandonne sans rappel.
  viewer.cameraFlight.cancel();
  viewer.cameraFlight.flyTo({ eye, look: center, up, duration: 1.2 }, () => {
    if (cadrageVolume && center.every(Number.isFinite)) verrouillerCamera(center.slice());
    if (onDone) onDone();
  });
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
let clashMarkerAnchor = null;
const clashMarkers = new Map(); // clash.id -> Mesh
let activeClashMarkerId = null;

function ensureClashMarkerAssets() {
  if (clashMarkerGeometry) return;
  clashMarkerGeometry = new ReadableGeometry(viewer.scene, buildSphereGeometry({
    radius: 1, heightSegments: 12, widthSegments: 12
  }));
  clashMarkerMaterial = new PhongMaterial(viewer.scene, { diffuse: [1, 1, 1], emissive: [1, 1, 1] });
  // Mesh d'ancrage invisible, jamais detruit : xeokit compile le programme WebGL du Mesh de facon SYNCHRONE dans
  // le constructeur de Mesh (getShaderParameter), et le detruit des que le dernier Mesh qui l'utilise disparait.
  // Sans ancre, chaque retour a un couple avec marqueurs recompilait le shader, et cet appel attend toute la file
  // GPU (14 000 bufferSubData d'un changement de visibilite precedent) : gel de 4 a 8 s. Avec l'ancre, le programme reste
  // vivant et les marqueurs ne compilent plus rien.
  clashMarkerAnchor = new Mesh(viewer.scene, {
    id: CLASH_MARKER_ID_PREFIX + "ancre",
    geometry: clashMarkerGeometry,
    material: clashMarkerMaterial,
    visible: false,
    pickable: false,
    colorize: CLASH_MARKER_COLORS.nouveau,
    opacity: CLASH_MARKER_OPACITY
  });
}

// Apparition des collisions l'une apres l'autre (20/10, demande de Gilles) : a la pose des marqueurs, pastilles numerotees, cercles jaunes et
// spheres 3D apparaissent un par un, les plus urgentes d'abord. L'ensemble dure autant que l'apparition des lignes de la liste du drawer
// (dureeApparitionMs, posee par openDetection) : la derniere bulle a fini de grossir quand la derniere ligne a fini d'apparaitre, quel
// que soit leur nombre ; l'ecart entre deux bulles se deduit du nombre. Instantane si le systeme demande moins de mouvement. Les
// minuteurs sont annules des qu'on efface les marqueurs.
let dureeApparitionMs = 600;
const FONDU_APPARITION_MS = 450; // duree de l'animation CSS .clash-pastille (pastilleApparition)
function pasRevelation(nombre) {
  return nombre > 1 ? Math.max(0, (dureeApparitionMs - FONDU_APPARITION_MS) / (nombre - 1)) : 0;
}
let clashRevelationTimers = [];
function rangsRevelation(clashes) {
  const rang = { urgente: 0, haute: 1, normale: 2, basse: 3 };
  const tri = clashes.slice().sort((a, b) => (rang[clashPriorite(a)] - rang[clashPriorite(b)]) || (CLASHES.indexOf(a) - CLASHES.indexOf(b)));
  return new Map(tri.map((c, i) => [c.id, i]));
}
function revelationProgressive() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearClashMarkers() {
  clashRevelationTimers.forEach(clearTimeout);
  clashRevelationTimers = [];
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
let clashBullesDessine = false;

// Contexte 2D des bulles en mode logiciel (willReadFrequently) : un canvas 2D accelere par le GPU se synchronise
// avec le processus GPU a chaque setTransform/clearRect ; quand la file GPU est encombree par un changement de
// visibilite des maquettes (14 000 bufferSubData), le fil principal attendait 6 a 9 s. 15 cercles se dessinent tres bien au CPU.
function contexteBulles() {
  return clashBullesCanvas.getContext("2d", { willReadFrequently: true });
}

function clearClashBulles() {
  clashBullesList = [];
  clashBullesActiveId = null;
  if (clashBullesRaf) cancelAnimationFrame(clashBullesRaf);
  clashBullesRaf = 0;
  if (!clashBullesCanvas) return;
  // clearRect sur un canvas 2D accelere = point de synchronisation avec le processus GPU (6,7 s mesures sous
  // SwiftShader au premier choix d'un couple, quand le canvas etait vide) : on n'efface que s'il a ete dessine.
  if (clashBullesDessine) {
    const ctx = contexteBulles();
    if (ctx) ctx.clearRect(0, 0, clashBullesCanvas.width, clashBullesCanvas.height);
    clashBullesDessine = false;
  }
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
  const ctx = contexteBulles();
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  clashBullesDessine = true;
  const cam = viewer.camera;
  const v = cam.viewMatrix;
  const m = cam.projMatrix;
  // La bulle de la collision selectionnee est dessinee en dernier : elle passe au-dessus des autres quand elles se superposent.
  clashBullesList.slice().sort((a, b) => (a.id === clashBullesActiveId) - (b.id === clashBullesActiveId)).forEach(({ id, center, revele }) => {
    if (revele === false) return;
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

function renderClashBulles(clashes, rangs) {
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
  clashBullesList = clashes.map((clash) => ({ id: clash.id, center: clashCenter(clash), revele: !rangs }));
  if (rangs) {
    clashBullesList.forEach((bulle) => {
      clashRevelationTimers.push(setTimeout(() => { bulle.revele = true; scheduleClashBulles(); }, rangs.get(bulle.id) * pasRevelation(clashes.length)));
    });
  }
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

function renderClashPastilles(clashes, rangs) {
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
    // Apparition decalee : l'animation CSS d'entree (.clash-pastille) attend son rang.
    if (rangs && el) el.style.animationDelay = rangs.get(clash.id) * pasRevelation(clashes.length) + "ms";
  });
}

function renderClashMarkers(clashes) {
  clearClashMarkers();
  ensureClashMarkerAssets();
  const progressif = revelationProgressive() && clashes.length > 1;
  const rangs = rangsRevelation(clashes);
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
      pickable: true,
      visible: !progressif
    });
    clashMarkers.set(clash.id, mesh);
    if (progressif) clashRevelationTimers.push(setTimeout(() => { if (clashMarkers.get(clash.id) === mesh) mesh.visible = true; }, rangs.get(clash.id) * pasRevelation(clashes.length)));
  });
  renderClashPastilles(clashes, progressif ? rangs : null);
  renderClashBulles(clashes, progressif ? rangs : null);
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
  deverrouillerCamera();
  if (!sansRecalcul) setTimeout(majBoutonsAngle, 0);
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
  // Le calcul de transparence (des milliers d'objets) n'est PAS lance ici : il est differe a l'arrivee de la camera
  // (voir selectClash). Lance pendant le vol, il prenait 8 a 20 s et gelait le navigateur quand on enchainait les collisions.
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
  // Maquettes du couple affichees (Architecture et Mecanique pour l'hopital) ; sans couple connu : Architecture (+ Structure si affichee).
  let candidateMaquettes = collisionSubsetMaquettes.map((m) => m.id);
  if (candidateMaquettes.length === 0) {
    candidateMaquettes = ["hosp-arch"];
    const struct = MAQUETTES.find((m) => m.id === "hosp-struct");
    if (struct && struct.shown) candidateMaquettes.push("hosp-struct");
  }
  // Tous les autres elements visibles de ces maquettes, par maquette : ils passent en fantome (plus de masquage a distance, 20/10).
  const autres = {};
  candidateMaquettes.forEach((maquetteId) => {
    autres[maquetteId] = collisionEntityIds(maquetteId).filter((id) => {
      if (id === idA || id === idB) return false;
      const entity = viewer.scene.objects[id];
      return !!entity && entity.visible;
    });
  });
  return autres;
}

// Elements lointains masques par la collision selectionnee : { id de maquette: [ids] }. Remis visibles (si leur maquette l'est encore)
// a chaque recalcul et a la sortie.
let collisionLointainsMasques = null;
// Elements proches passes en fantome X-ray par la collision selectionnee : { id de maquette: [ids] }, et materiau X-ray d'origine.
let collisionFantomes = null;
let collisionXraySauvegarde = null;
function changerFantomesGroupe(parMaquette, actif) {
  const modeles = [];
  Object.keys(parMaquette).forEach((maquetteId) => {
    const m = MAQUETTES.find((x) => x.id === maquetteId);
    if (m && m.model) modeles.push(m.model);
  });
  if (modeles.length === 0) return;
  ecritureGroupeeDrapeaux(modeles, () => {
    Object.keys(parMaquette).forEach((maquetteId) => {
      parMaquette[maquetteId].forEach((id) => {
        const entite = viewer.scene.objects[id];
        if (!entite) return;
        entite.xrayed = actif;
        entite.pickable = !actif;
      });
    });
  });
}
function changerVisibiliteGroupee(parMaquette, visible) {
  const modeles = [];
  Object.keys(parMaquette).forEach((maquetteId) => {
    const m = MAQUETTES.find((x) => x.id === maquetteId);
    if (m && m.model && (visible ? m.shown : true)) modeles.push(m.model);
  });
  if (modeles.length === 0) return;
  ecritureGroupeeDrapeaux(modeles, () => {
    Object.keys(parMaquette).forEach((maquetteId) => {
      const m = MAQUETTES.find((x) => x.id === maquetteId);
      if (!m || !m.model || (visible && !m.shown)) return;
      parMaquette[maquetteId].forEach((id) => {
        const entite = viewer.scene.objects[id];
        if (entite) entite.visible = visible;
      });
    });
  });
}
function resetCollisionOpacities() {
  if (collisionFantomes) {
    if (!garderXrayAuReset) changerFantomesGroupe(collisionFantomes, false);
    collisionFantomes = null;
  }
  if (collisionXraySauvegarde && !garderXrayAuReset) {
    const materiau = viewer.scene.xrayMaterial;
    materiau.fillAlpha = collisionXraySauvegarde.fillAlpha;
    materiau.edgeAlpha = collisionXraySauvegarde.edgeAlpha;
    materiau.fillColor = collisionXraySauvegarde.fillColor;
    materiau.edgeColor = collisionXraySauvegarde.edgeColor;
    collisionXraySauvegarde = null;
  }
  if (collisionLointainsMasques) {
    changerVisibiliteGroupee(collisionLointainsMasques, true);
    collisionLointainsMasques = null;
  }
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
  if (COLLISION_CONTEXTE && collisionModeAffichage === "contexte" && !isolating) {
    collisionGhostMaquettes.forEach((m) => put(collisionEntityIds(m.id), COLLISION_CONTEXTE_OPACITY));
  }
  if (COLLISION_REVELATION && !COLLISION_ISOLATION && collisionActiveClash && (collisionModeAffichage === "conflit" || collisionModeAffichage === "contexte")) {
    // Les 2 elements en conflit gardent opacite 1 (rien n'est pose dessus). Tout le reste des 2 maquettes : fantome X-ray, jamais masque
    // (le contexte reste visible partout : pas de zone vide en passant d'une collision a l'autre).
    const autres = collisionMaskingIds(collisionActiveClash);
    const materiau = viewer.scene.xrayMaterial;
    collisionXraySauvegarde = {
      fillAlpha: materiau.fillAlpha, edgeAlpha: materiau.edgeAlpha,
      fillColor: Array.from(materiau.fillColor), edgeColor: Array.from(materiau.edgeColor)
    };
    materiau.fillAlpha = collisionModeAffichage === "contexte" ? CLASH_FANTOME_CONTEXTE_FILL_ALPHA : CLASH_FANTOME_FILL_ALPHA;
    materiau.edgeAlpha = collisionModeAffichage === "contexte" ? CLASH_FANTOME_CONTEXTE_EDGE_ALPHA : CLASH_FANTOME_EDGE_ALPHA;
    materiau.fillColor = CLASH_FANTOME_COLOR;
    materiau.edgeColor = CLASH_FANTOME_COLOR;
    collisionFantomes = autres;
    changerFantomesGroupe(autres, true);
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
document.addEventListener("click", () => { if (collisionAffichageMenu) collisionAffichageMenu.hidden = true; });
// Mobile : un appui hors du menu d'affichage le ferme en clic neutre (meme mecanisme que le hamburger), rien n'est selectionne dessous.
document.addEventListener("pointerdown", (e) => {
  if (!collisionAffichageMenu || collisionAffichageMenu.hidden) return;
  if (collisionAffichageMenu.parentElement.contains(e.target)) return;
  collisionAffichageMenu.hidden = true;
  if (collisionContexteBtn) collisionContexteBtn.setAttribute("aria-expanded", "false");
  absorberGesteNeutre();
}, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && collisionAffichageMenu) collisionAffichageMenu.hidden = true; });
function setModeAffichageCollision(mode) {
  if (mode === collisionModeAffichage) return;
  collisionModeAffichage = mode;
  const autres = mode === "contexte" || mode === "toutes";
  collisionContexteOn = autres;
  collisionGhostMaquettes.forEach((m) => {
    // Hors couple : non cliquables en "contexte" (fantome colore), cliquables sinon.
    viewer.scene.setObjectsPickable(collisionEntityIds(m.id), mode !== "contexte");
  });
  refreshCollisionMaquetteToggles();
  // Les maquettes hors couple apparaissent ou disparaissent, puis la transparence est recalculee.
  definirMaquettesVisibles(new Map(collisionGhostMaquettes.map((m) => [m.id, autres])));
  refreshCollisionMaquetteToggles();
  applyCollisionOpacities();
}

// Retour a l'etat normal, appelee a chaque sortie de la page Collision
// (activateView, restoreAllModelsVisible) et a l'ouverture d'une detection :
// opacite 1, pickable true, maquettes hors paire a nouveau masquees.
function resetCollisionOpacityState() {
  const wasOn = collisionContexteOn;
  collisionContexteOn = false;
  collisionModeAffichage = "conflit";
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

// Mention « via la regle » d'une entree d'historique issue d'une regle en langage naturel : une ligne tronquee (CSS), demande complete en infobulle.
function ligneRegleHistorique(classe, demande) {
  const el = document.createElement("div");
  el.className = classe;
  el.textContent = "via la règle : « " + demande + " »";
  el.title = demande;
  return el;
}

// COLLISION_PRIORITES : commentaires + journal des changements (priorite,
// statut), melanges chronologiquement (plus recent en haut). Les messages sans
// date (anciens) passent avant les entrees datees.
function renderDiscussionMessagesAvecJournal(thread) {
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
      const qui = document.createElement("span");
      qui.className = "discussion-journal-qui";
      qui.textContent = h.qui || CLASH_UTILISATEUR_HISTORIQUE;
      const labels = h.champ === "priorité" ? PRIORITE_LABELS : STATUT_LABELS;
      const texte = document.createElement("span");
      texte.textContent = " a changé " + (h.champ === "priorité" ? "la priorité" : "le statut") + " de " + (labels[h.de] || h.de) + " à " + (labels[h.vers] || h.vers);
      const quand = document.createElement("span");
      quand.className = "discussion-journal-quand";
      const d = formatHistoriqueDate(h.quand);
      quand.textContent = d ? " · " + d : "";
      li.append(icone, qui, texte, quand);
      if (h.regle) li.appendChild(ligneRegleHistorique("discussion-journal-regle", h.regle));
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
    const qui = document.createElement("span");
    qui.className = "tl-qui";
    qui.textContent = nom;
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
    li.append(entete, corps);
    if (!estMessage && item.data.regle) li.appendChild(ligneRegleHistorique("tl-regle", item.data.regle));
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
  const mk = (id, libelle, labels, champ) => creerControleMenu(id, libelle, labels, champ, changerChampCollision);
  return finirControlesCollision(wrap, mk);
}

// Menu personnalise Priorite / Statut, partage par la page Collision (bandeau) et le panneau d'une discussion :
// surChangement(champ, valeur) est appele a chaque changement de valeur.
function creerControleMenu(id, libelle, labels, champ, surChangement) {
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
      surChangement(champ, sel.value);
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
      const mw = Math.max(menu.offsetWidth, 168, r.width); // jamais plus etroit que le bouton qui l'ouvre (28/10)
      const place = window.innerHeight - r.bottom;
      menu.style.top = (place >= mh + 8 ? r.bottom + 6 : Math.max(8, r.top - mh - 6)) + "px";
      menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + "px";
      menu.style.minWidth = mw + "px";
      if (window.matchMedia(REQUETE_MOBILE).matches) cadrerMenuCollisionMobile(menu, r);
      menu.style.visibility = "";
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", surClicExterieur, true);
      document.addEventListener("keydown", surTouche, true);
    });
    field.append(lab, selectWrap);
    return { field, sel, selectWrap, maj };
}

// Mobile (retour 12) : le menu Priorite / Statut reste DANS l'ecran et sous le bandeau « ← Retour a la regle » s'il est affiche (il s'ouvre vers le bas, ou vers le haut
// s'il y a plus de place, avec defilement interne si aucun des deux ne suffit) ; la largeur reelle (min-width + marges internes) ne deborde plus a droite.
function cadrerMenuCollisionMobile(menu, declencheur) {
  const bandeau = document.getElementById("reglesBandeauRetour");
  const haut = Math.max(8, bandeau && !bandeau.hidden ? Math.ceil(bandeau.getBoundingClientRect().bottom) + 6 : 8);
  const bas = window.innerHeight - 8;
  const mh = menu.offsetHeight;
  const sous = bas - (declencheur.bottom + 6);
  const dessus = declencheur.top - 6 - haut;
  const versBas = sous >= mh || sous >= dessus;
  const dispo = Math.max(0, versBas ? sous : dessus);
  menu.style.maxHeight = dispo < mh ? dispo + "px" : "";
  menu.style.overflowY = dispo < mh ? "auto" : "";
  const hauteur = Math.min(mh, dispo);
  menu.style.top = (versBas ? declencheur.bottom + 6 : declencheur.top - 6 - hauteur) + "px";
  menu.style.left = Math.max(8, Math.min(declencheur.left, window.innerWidth - menu.offsetWidth - 8)) + "px";
}

function finirControlesCollision(wrap, mk) {
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
      construireFicheCollision(wrap);
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

// Applique le changement a la collision et l'inscrit dans son historique, sans sauvegarde ni rafraichissement. Rend vrai si quelque chose a change.
// regle (optionnel) : la demande validee par l'utilisateur quand le changement vient d'une regle en langage naturel.
function modifierChampCollision(clash, champ, vers, regle) {
  if (!isHospitalClash(clash)) return false;
  const cle = champ === "priorité" ? "priorite" : "statut";
  const de = cle === "priorite" ? clashPriorite(clash) : clash.statut;
  if (de === vers) return false;
  clash[cle] = vers;
  if (!Array.isArray(clash.historique)) clash.historique = [];
  const entree = { qui: CLASH_UTILISATEUR_HISTORIQUE, quand: new Date().toISOString(), champ, de, vers };
  if (regle) entree.regle = regle;
  clash.historique.push(entree);
  return true;
}

function changerChampCollision(champ, vers) {
  const clash = currentDiscussionThread;
  if (!modifierChampCollision(clash, champ, vers)) return;
  sauverEtatCollisions();
  renderCollisionsList(CLASHES.filter((c) => c.detectionId === clash.detectionId));
  renderDiscussionMessages(clash);
  majFormulaireReponse(isThreadOpen(clash));
  majCollisionControles(clash);
}

// ---- Regles de collision en langage naturel (etapes 2 et 3) : modale de validation, voir src/reglesModale.js ----
// selection : [{ clash, champ: "priorite"|"statut", vers }] (champ du moteur de regles, sans accent) ; demande : la phrase validee par l'utilisateur,
// inscrite dans l'historique de chaque collision modifiee (champ regle).
function appliquerSelectionRegle(selection, demande) {
  const modifiees = selection.filter((s) => modifierChampCollision(s.clash, s.champ === "priorite" ? "priorité" : "statut", s.vers, demande));
  if (!modifiees.length) return;
  sauverEtatCollisions();
  new Set(modifiees.map((s) => s.clash.detectionId)).forEach((detectionId) => renderCollisionsList(CLASHES.filter((c) => c.detectionId === detectionId)));
  // Collision ouverte et modifiee : echanges, formulaire et menus Priorite / Statut a jour.
  const ouverte = currentDiscussionThread;
  if (ouverte && modifiees.some((s) => s.clash === ouverte)) {
    renderDiscussionMessages(ouverte);
    majFormulaireReponse(isThreadOpen(ouverte));
    majCollisionControles(ouverte);
  }
}

// Banque des vues 3D deja generees (public/images/vues/index.json), lue au demarrage et apres chaque recolte : la modale n'a qu'a y chercher l'image de chaque collision.
let banqueVuesCollisions = [];
function relireBanqueVuesCollisions() { return chargerBanque().then((b) => { banqueVuesCollisions = b; }); }
relireBanqueVuesCollisions();

// Numero affiche d'une collision (liste, pastilles, modale) : son rang dans CLASHES + 1. Le meme sert au critere « numeros » des regles IA.
function numeroAffiche(clash) { return CLASHES.indexOf(clash) + 1; }

reglesModale = creerReglesModale({
  libellesPriorite: PRIORITE_LABELS,
  libellesStatut: STATUT_LABELS,
  numero: numeroAffiche,
  creerCarte: (clash) => buildCollisionCard(clash, "span"),
  lireElement: (id) => descripteurElement(viewer.metaScene, id, MAQUETTES),
  voirEn3D: (clash) => activateClash(clash),
  imageDe: (clash) => urlVueCollision(banqueVuesCollisions, clash.id, import.meta.env.BASE_URL),
  appliquer: appliquerSelectionRegle,
  reformuler: (phrase) => reglesIA && reglesIA.reformuler(phrase),
  glisserPourFermer: enableDrawerSwipeToClose
});

// Collisions reelles de la detection courante (jamais les fictives), celles que les regles IA peuvent toucher.
function clashesDeLaDetection() {
  return detectionCourante ? CLASHES.filter((c) => c.detectionId === detectionCourante.id && !c.factice && isHospitalClash(c)) : [];
}

// Valide la regle, la confronte aux collisions reelles de la detection courante (jamais les fictives) et ouvre la modale « Regle a valider ».
// Rend { ok } ou { ok: false, erreur }. Utilisee par le panneau « IA » de la page Collision et par le declencheur de diagnostic.
function ouvrirRegleCollision(regle) {
  const verdict = validerRegle(regle, { priorite: PRIORITE_ORDRE, statut: Object.keys(STATUT_LABELS) });
  if (!verdict.ok) return verdict;
  const clashes = clashesDeLaDetection();
  const touchees = appliquerRegle(
    regle,
    clashes,
    (id) => descripteurElement(viewer.metaScene, id, MAQUETTES),
    (clash) => ({ priorite: clashPriorite(clash), statut: clash.statut }),
    { maintenant: Date.now(), evenements: evenementsDeCollision, numero: numeroAffiche }
  );
  reglesModale.ouvrir(regle, touchees, clashes.map(numeroAffiche));
  return { ok: true };
}

// Declencheur de diagnostic (?diag=1 seulement), conserve : window.ouvraRegles.ouvrir(regle).
function installerOuvertureReglesDiag() {
  if (!/[?&]diag=1/.test(location.search)) return;
  window.ouvraRegles = { ouvrir: ouvrirRegleCollision };
}
installerOuvertureReglesDiag();

// Point d'entree visible (etape 5) : bouton « IA » de la page Collision et son panneau (src/reglesIA.js).
function fermerMenusDeroulantsCollision() {
  if (collisionAffichageMenu) collisionAffichageMenu.hidden = true;
  if (collisionContexteBtn) collisionContexteBtn.setAttribute("aria-expanded", "false");
  fermerMenuCouples();
}
// Phrase de l'utilisateur -> relais IA hebergé (api/regle.js). Seuls des mots partent : types IFC, niveaux, maquettes et quelques noms proches de
// la phrase, lus sur les maquettes chargees ; jamais la geometrie. Ne rejette jamais (repli sur les phrases d'exemple en cas d'echec).
function traduirePhraseParIA(phrase) {
  const valeurs = valeursPourIA(viewer.metaScene, MAQUETTES, phrase, { priorite: PRIORITE_ORDRE, statut: Object.keys(STATUT_LABELS) });
  // Numeros reels des collisions de la detection courante (memes que ceux de ouvrirRegleCollision) : le modele ne peut en citer aucun autre.
  valeurs.numeros = clashesDeLaDetection().map(numeroAffiche);
  return demanderRegle({ phrase, valeurs, aujourdhui: dateDuJourLocale() });
}

// Date du jour de l'utilisateur, « AAAA-MM-JJ » (heure locale), envoyee au relais pour resoudre « depuis 3 jours » ou « le 15 octobre ».
function dateDuJourLocale() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Evenements d'une collision lus par les filtres de date : ses messages (discussion) et ses modifications de priorite ou de statut (historique).
// Date.parse lit un horodatage sans fuseau comme une heure locale, comme les jours calendaires du moteur.
function evenementsDeCollision(clash) {
  return (clash.discussion || []).map((m) => ({ type: "message", quand: Date.parse(m.quand) }))
    .concat((clash.historique || []).map((h) => ({ type: "modification", quand: Date.parse(h.quand) })));
}
reglesIA = creerReglesIA({
  parent: collisionLeft,
  slot: collisionViewerSlot,
  boutonCollisions: collisionInfoPanelToggle,
  masquerSurMobile: () => collisionDiscussion.classList.contains("cb-grand"),
  observes: [collisionInfoPanelToggle, collisionDiscussion, collisionLeft, collisionViewerSlot, messageOuvrirBtn],
  exemples: EXEMPLES_REGLES,
  ouvrirRegle: ouvrirRegleCollision,
  traduire: traduirePhraseParIA,
  fermerAutres: fermerMenusDeroulantsCollision
});

// ---------- Viewer par commande en langage naturel (24/10) ----------
// Bouton « IA » de la barre du Viewer (src/commandesIA.js) : une phrase ecrite ou dictee devient une commande du moteur (src/commandesViewer.js) qui
// isole, met en surbrillance et cadre. Seuls des mots partent vers l'IA (relais api/commande.js) ; les phrases toutes faites sont reconnues ici, sans IA.
const commandesIABtn = document.getElementById("commandesIABtn");
const commandesResetBtn = document.getElementById("commandesResetBtn");

// Zones nommees (option A de « afficher une piece » : les maquettes n'ont aucun IfcSpace), sauvegardees dans localStorage (jamais bloquant).
function stockageLocal() {
  try { return window.localStorage; } catch (e) { return null; }
}
const zonesCommandes = creerZones({ stockage: stockageLocal() });

// Le moteur est cree a la premiere commande : la scene et les maquettes sont alors chargees. Les garde-corps mal places de l'hopital
// (HOSPITAL_MISPLACED_RAILING_IDS) restent hors de portee : ni trouves, ni rendus visibles.
function moteurCommandesViewer() {
  if (!commandesViewer) {
    commandesViewer = creerControleur({
      scene: viewer.scene,
      metaScene: viewer.metaScene,
      maquettes: MAQUETTES,
      cameraFlight: viewer.cameraFlight,
      exclus: new Set(HOSPITAL_MISPLACED_RAILING_IDS),
      zones: zonesCommandes,
      poseCentree: poseCentreeSurBoiteActuelle,
      apres: synchroniserDrawerApresCommande,
      registre: REGISTRE
    });
  }
  return commandesViewer;
}

// Le drawer (maquettes visibles, niveaux coches) suit la 3D, sinon il la contredirait : « Tout reafficher » recoche tout ; apres une commande
// « afficher », une maquette est cochee si un de ses elements est visible, un niveau aussi (src/commandesDrawer.js). On ne rappelle PAS
// applyVisibility apres une commande « afficher » : il redefairait l'isolement fin (types, noms) que la commande vient d'appliquer.
const idsParMaquetteCommandes = new Map(); // id de maquette -> ids de ses elements (calcule une fois, les maquettes ne changent pas)

function idsDeMaquette(maquette) {
  if (!idsParMaquetteCommandes.has(maquette.id)) {
    const metaModel = viewer.metaScene.metaModels[maquette.id];
    const racine = metaModel && metaModel.rootMetaObject;
    idsParMaquetteCommandes.set(maquette.id, racine ? viewer.metaScene.getObjectIDsInSubtree(racine.id) : []);
  }
  return idsParMaquetteCommandes.get(maquette.id);
}

// Reporte un etat de cases (Map par maquette et par niveau) sur les modeles, les cases du drawer et les boutons de maquettes de Collision.
function reporterEtatDrawer(etat) {
  MAQUETTES.forEach((m) => { if (etat.maquettes.has(m.id)) m.shown = etat.maquettes.get(m.id); });
  niveauxState.forEach((n) => {
    if (!etat.niveaux.has(n.name)) return;
    n.checked = etat.niveaux.get(n.name);
    if (n.checkboxEl) n.checkboxEl.checked = n.checked;
  });
  renderMaquetteRows(maquettesList, MAQUETTES);
  refreshCollisionMaquetteToggles();
}

// Retour des cases a ce qu'elles etaient avant la premiere commande en cours (« Non » sans commande confirmee avant, sortie du Viewer).
function restaurerDrawerOrigine() {
  if (!origineDrawer) return;
  const photo = origineDrawer;
  origineDrawer = null;
  reporterEtatDrawer(photo);
}

function synchroniserDrawerApresCommande(nomAction) {
  if (nomAction === "tout_afficher") {
    origineDrawer = null;
    MAQUETTES.forEach((m) => { m.shown = true; });
    niveauxState.forEach((n) => { n.checked = true; if (n.checkboxEl) n.checkboxEl.checked = true; });
    applyVisibility();
    renderMaquetteRows(maquettesList, MAQUETTES);
    return;
  }
  if (nomAction !== "afficher") return;
  const chargees = MAQUETTES.filter((m) => viewer.metaScene.metaModels[m.id]);
  reporterEtatDrawer(etatDrawerDepuisVisibles({
    idsParMaquette: new Map(chargees.map((m) => [m.id, idsDeMaquette(m)])),
    niveaux: niveauxState,
    visibles: new Set(viewer.scene.visibleObjectIds)
  }));
}

// Bouton « Tout reafficher » : visible tant qu'une commande est appliquee. Aucun compte rendu n'est affiche : la relecture du bandeau suffit.
function majBoutonToutReafficher() {
  commandesResetBtn.hidden = !(commandesViewer && commandesViewer.active());
}

// Flux « appliquer tout de suite, puis confirmer » (src/commandesFlux.js) : la commande comprise est appliquee, le bandeau pose la question.
function fluxCommandes() {
  if (!commandesFlux) commandesFlux = creerFlux({ moteur: moteurCommandesViewer() });
  return commandesFlux;
}

// Sortie du Viewer : la commande est defaite et le bandeau se ferme.
function reinitialiserCommandesViewer() {
  if (commandesBandeau) commandesBandeau.masquer(false);
  cameraAvantCommande = null;
  if (commandesFlux && commandesFlux.abandonner()) {
    restaurerDrawerOrigine();
    majBoutonToutReafficher();
  }
}

// Phrase -> commande : une phrase toute faite est reconnue ici (aucun appel), sinon le relais IA traduit. Ne rejette jamais.
async function traduirePhraseViewer(phrase) {
  const exemple = reconnaitreExemple(phrase);
  if (exemple) return { ok: true, resultat: "commande", commande: exemple };
  const valeurs = valeursPourCommande(viewer.metaScene, MAQUETTES, phrase, zonesCommandes.noms());
  return demanderCommande({ phrase, valeurs, etat: fluxCommandes().etatPourIA() }); // la vue actuelle, en mots : « ajoute », « enleve », « uniquement »
}

commandesBandeau = creerCommandesBandeau({
  conteneur: document.getElementById("viewerWrap"),
  retourFocus: commandesIABtn,
  surOui() {
    cameraAvantCommande = null;
    fluxCommandes().accepter();
  },
  surNon() {
    const retour = fluxCommandes().refuser();
    restaurerCameraAvantCommande();
    // Une commande confirmee avant est rejouee par le flux (le drawer s'y resynchronise) ; sinon retour exact des cases d'avant.
    if (!moteurCommandesViewer().active()) restaurerDrawerOrigine();
    majBoutonToutReafficher();
    if (retour) commandesIA.reformuler(retour.phrase);
  }
});

// Saisie « IA » : la camera se recadre comme un clic sur « Recentrer » (les cases du drawer sont deja synchronisees par la commande), sauf pour un focus
// (cadrage propre sur l'element) ou une commande qui ne cadre pas (resultat.recentrer faux) ; en vue a plat rien ne change. Un seul vol : il remplace celui du moteur.
function recentrerApresCommande(resultat, cameraAvant, enAttente) {
  if (vueAvantDessus) return;
  if (resultat.confirmation) { if (!enAttente) cameraAvantCommande = cameraAvant; } else cameraAvantCommande = null;
  if (!resultat.recentrer) return;
  viewer.cameraFlight.cancel();
  // Commande confirmable : cadrage sur les seuls elements visibles ; « Tout reafficher » (sans confirmation) ou boite inexploitable : cadrage de « Recentrer ».
  const boite = resultat.confirmation ? boiteDesVisibles(viewer.scene.visibleObjectIds, (ids) => viewer.scene.getAABB(ids)) : null;
  if (boite) viewer.cameraFlight.flyTo(poseCentreeSurBoiteActuelle(boite) ?? { aabb: boite });
  else recentrerSurMaquettes();
}

// « Non » : la camera revient la ou elle etait avant la commande (la derniere etape seulement, comme la scene).
function restaurerCameraAvantCommande() {
  const avant = cameraAvantCommande;
  cameraAvantCommande = null;
  if (!avant || vueAvantDessus) return;
  viewer.cameraFlight.cancel();
  viewer.cameraFlight.flyTo({ eye: avant.eye, look: avant.look, up: avant.up, duration: DUREE_RETOUR_CAMERA_S });
}

// Applique la commande tout de suite puis pose la question. Rend { ok: true } ou { ok: false, message } (rien n'est applique, pas de bandeau).
// deLaSaisieIA : la commande vient de la saisie « IA » du Viewer (recadrage de la camera, retour au « Non »).
function proposerCommandeViewer(commande, deLaSaisieIA = false) {
  const photo = moteurCommandesViewer().active() ? null : capturerEtatDrawer({ maquettes: MAQUETTES, niveaux: niveauxState });
  const enAttente = fluxCommandes().enAttente();
  const cameraAvant = { eye: viewer.camera.eye.slice(), look: viewer.camera.look.slice(), up: viewer.camera.up.slice() };
  const resultat = fluxCommandes().proposer(commande);
  if (!resultat.ok) return { ok: false, message: resultat.message };
  if (photo && resultat.confirmation) origineDrawer = photo;
  if (deLaSaisieIA) recentrerApresCommande(resultat, cameraAvant, enAttente);
  majBoutonToutReafficher();
  if (resultat.confirmation) commandesBandeau.montrer(resultat);
  else commandesBandeau.masquer(false);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Page Quantitatif (24/10, src/quantitatifPage.js) : une demande en francais, un tableau de quantites calcule en local (src/quantitatif.js).
// Source des elements : la scene xeokit quand TOUTES les maquettes sont chargees (boites englobantes disponibles, mesures estimees possibles) ;
// sinon les metadonnees JSON seules, sans geometrie (src/quantitatifDonnees.js : leger, comptage exact). Memoisee tant que la source ne change pas.
let quantitatifDonnees = null; // { cle, promesse }
function donneesQuantitatif() {
  const pret = MAQUETTES.length > 0 && MAQUETTES.every((m) => m.model);
  const cle = (pret ? "scene:" + Object.keys(viewer.metaScene.metaObjects).length : "json") + ":" + MAQUETTES.map((m) => m.id).join(",");
  if (quantitatifDonnees && quantitatifDonnees.cle === cle) return quantitatifDonnees.promesse;
  const promesse = pret
    ? Promise.resolve({ source: "scene", notes: [], elements: elementsDepuisScene({ metaScene: viewer.metaScene, scene: viewer.scene, maquettes: MAQUETTES, exclus: new Set(HOSPITAL_MISPLACED_RAILING_IDS) }) })
    : chargerElementsJson(MAQUETTES, { exclus: new Set(HOSPITAL_MISPLACED_RAILING_IDS) }).then((r) => (r.elements.length ? { source: "json", ...r } : null));
  quantitatifDonnees = { cle, promesse };
  // Un echec (aucun element lisible) n'est pas memorise : la demande suivante retente.
  promesse.then((r) => { if (!r && quantitatifDonnees && quantitatifDonnees.promesse === promesse) quantitatifDonnees = null; });
  return promesse;
}

// Empreintes de version des maquettes (en-tetes HEAD, voir src/quantitatifVersions.js), relues a chaque ouverture de la page ou de l'historique ;
// une courte memoire (10 s) evite de repeter les requetes quand la page enchaine plusieurs affichages.
let quantitatifVersions = null; // { cle, quand, promesse }
function versionsQuantitatif() {
  const cle = MAQUETTES.map((m) => m.id + "=" + m.src).join(",");
  if (quantitatifVersions && quantitatifVersions.cle === cle && Date.now() - quantitatifVersions.quand < 10000) return quantitatifVersions.promesse;
  const promesse = lireEmpreintes(MAQUETTES.map((m) => ({ id: m.id, label: m.label, src: m.src })));
  quantitatifVersions = { cle, quand: Date.now(), promesse };
  return promesse;
}

// « Voir » d'une ligne du tableau : le Viewer isole les elements de la ligne (meme mecanisme que la commande « afficher » du Viewer par commande).
// Rend un message (rien a voir, maquettes non chargees) ou null si le Viewer est ouvert sur la selection.
function voirQuantitatifDansViewer(criteres, retour = null) {
  const commande = {
    action: "afficher",
    parametres: { typesIfc: criteres.typesIfc, niveaux: criteres.niveaux, maquettes: criteres.maquettes, noms: criteres.noms, isoler: true, surbrillance: false, cadrer: true },
    demande: "",
    relecture: ""
  };
  const essai = moteurCommandesViewer().preparer(commande);
  if (!essai.ok) return essai.erreur;
  if (essai.vide) return "Rien à voir dans le Viewer pour cette ligne : les maquettes ne sont peut-être pas encore chargées.";
  activateView("viewer");
  const resultat = proposerCommandeViewer(commande);
  if (!resultat.ok) return resultat.message;
  // La demande vient du tableau, pas d'une phrase a verifier : pas de question « Est-ce bien votre demande ? ».
  commandesBandeau.masquer(false);
  fluxCommandes().accepter();
  // Bandeau « ← Retour au quantitatif » : la page fournit le rappel, le bandeau ne sait rien d'elle. Un clic revient sur la page (comme un clic sur l'onglet,
  // pour la meme remise a zero) puis rappelle la page, qui re-affiche le meme rapport.
  if (retour) {
    retourQuantitatif.montrer({
      libelle: retour.libelle,
      surRetour: () => {
        const lien = navLinks.find((l) => l.dataset.view === "quantitatif");
        if (lien) lien.click(); else activateView("quantitatif");
        retour.surRetour();
      }
    });
  }
  return null;
}

retourQuantitatif = creerRetourContexte({
  id: "quantitatifBandeauRetour",
  classeCorps: "quantitatif-retour-actif",
  ariaLabel: "Retour au quantitatif",
  autresClasses: ["msg-retour-actif", "regles-retour-actif"] // un seul bandeau de retour a la fois : le plus recent gagne
});

// Page 2D -> 3D (25/10) : chargee a la demande (Three.js et pdf.js ne pesent pas sur le demarrage). Si le chargement echoue, la page affiche l'erreur.
function ouvrirPlan3d() {
  if (plan3d) { plan3d.surVueActivee("plan3d"); return; }
  if (!plan3dEnCours) {
    const racine = document.getElementById("plan3dRoot");
    plan3dEnCours = import("./plan3d/plan3dPage.js")
      .then(({ creerPlan3dPage }) => { plan3d = creerPlan3dPage({ racine, voirDansViewer: voirPlanDansViewer }); })
      .catch(() => { plan3dEnCours = null; racine.textContent = "La page 2D → 3D n'a pas pu se charger. Recharge la page."; });
  }
  plan3dEnCours.then(() => { if (plan3d && !document.getElementById("view-plan3d").hidden) plan3d.surVueActivee("plan3d"); });
}

// Maquette 3D de la page 2D -> 3D (25/10) : c'est le VRAI Viewer. L'IFC genere depuis le plan y est charge comme une maquette (web-ifc), les autres maquettes
// sont masquees le temps de la visite, et le bandeau « ← Retour au plan 2D » ramene sur la page. Coupe, vitesse, recentrer, isolation, commande IA,
// nouvelle discussion et fiche d'element sont donc ceux du Viewer, sans copie. Quitter le Viewer par n'importe quel chemin appelle retirerPlanDuViewer
// (via activateView) : la maquette du plan disparait et la visibilite des autres maquettes revient comme avant.
let initWebIfc = null;
function initialiserWebIfc() {
  if (!initWebIfc) initWebIfc = IfcAPI.Init().catch((e) => { initWebIfc = null; throw e; });
  return initWebIfc;
}

async function assurerChargeurIfc() {
  if (ifcLoader) return;
  await initialiserWebIfc();
  if (!ifcLoader) ifcLoader = new WebIFCLoaderPlugin(viewer, { WebIFC, IfcAPI });
  if (!xktLoader) xktLoader = new XKTLoaderPlugin(viewer);
}

// ifc : ArrayBuffer de l'IFC genere. Rend null si tout va bien, sinon un message pour la page.
async function voirPlanDansViewer({ ifc, noms = [], surRetour }) {
  try {
    await assurerChargeurIfc();
  } catch (e) {
    return "Le lecteur d'IFC n'a pas pu démarrer. Recharge la page.";
  }
  if (!planDansViewer) {
    const avant = new Map(MAQUETTES.map((m) => [m.id, m.shown]));
    MAQUETTES.forEach((m) => { m.shown = false; });
    const maquette = { id: "plan2d3d", label: "Plan 2D → 3D", color: "#5c7a5f", format: "ifc", shown: true, chargee: false, externe: true, model: null };
    MAQUETTES.push(maquette);
    const cam = viewer.camera;
    planDansViewer = { maquette, avant, plaques: [], camera: { eye: cam.eye.slice(), look: cam.look.slice(), up: cam.up.slice(), projection: cam.projection } }; // camera a rendre en sortant
    vueDessusBtn.hidden = false;
  } else if (planDansViewer.maquette.model) {
    sortirVueDessus(false);
    planDansViewer.maquette.model.destroy(); // plan modifie depuis la derniere visite : on recharge
  }
  const { maquette } = planDansViewer;
  poserNomsAuSol(noms);
  maquette.shown = true;
  maquette.chargee = false;
  const model = ifcLoader.load({ id: maquette.id, ifc, excludeTypes: ["IfcSpace"], edges: true });
  maquette.model = model;
  model.on("loaded", () => {
    maquette.chargee = true;
    applyVisibility();
    renderMaquetteRows(maquettesList, MAQUETTES);
    if (planDansViewer && planDansViewer.maquette === maquette) viewer.cameraFlight.jumpTo({ aabb: model.aabb }); // l'utilisateur a pu quitter la vue pendant le chargement
  });
  model.on("error", (msg) => { console.warn("[plan 2D -> 3D] chargement de l'IFC : " + msg); });
  activateView("viewer");
  retourPlan3d.montrer({
    libelle: "Retour au plan 2D", // la fleche est ajoutee par le bandeau
    surRetour: () => {
      const lien = navLinks.find((l) => l.dataset.view === "plan3d");
      if (lien) lien.click(); else activateView("plan3d");
      if (surRetour) surRetour();
    }
  });
  return null;
}

// Vue a plat (25/10) : projection orthographique, camera au-dessus de la maquette, nord du plan en haut. Dans la scene xeokit (Y vers le haut), le nord
// du plan (+y IFC) est -z : « up » = [0, 0, -1] donne x vers la droite et le nord vers le haut de l'ecran, comme sur le plan 2D.
// Reglages de la vue a plat, a ajuster ici au fil des tests.
const VUE_PLAT_VITESSE = 30; // % : vitesse de navigation de la vue a plat (le curseur « Vitesse » du Viewer l'affiche et peut la changer)
const VUE_PLAT_PART_MIN = 2 / 3; // part de l'ecran que la maquette garde AU MINIMUM en dezoomant (1 = remplit l'ecran, 0,5 = la moitie)

// Echelle orthographique (ortho.scale) pour que le rectangle largeur x profondeur (metres), agrandi de `marge` (1,15 = 15 % de marge), tienne dans l'ecran.
// xeokit (Ortho.js) : ecran en paysage, ortho.scale est la LARGEUR visible (la hauteur en decoule par le rapport de l'ecran) ; en portrait, c'est la HAUTEUR visible.
function echelleOrtho(largeur, profondeur, marge) {
  const aspect = Math.max(viewerCanvas.clientWidth, 1) / Math.max(viewerCanvas.clientHeight, 1);
  const l = Math.max(largeur, 1) * marge;
  const p = Math.max(profondeur, 1) * marge;
  return viewerCanvas.clientWidth > viewerCanvas.clientHeight ? Math.max(l, p * aspect) : Math.max(p, l / aspect);
}

// Plus grande echelle orthographique permise : celle ou la maquette occupe encore VUE_PLAT_PART_MIN de l'ecran dans sa dimension la plus contraignante.
function echelleOrthoMax() {
  const boite = aabbDesMaquettes(maquettesPresentes());
  if (!boite) return Infinity;
  const [x0, , z0, x1, , z1] = boite;
  return echelleOrtho(x1 - x0, z1 - z0, 1 / VUE_PLAT_PART_MIN);
}

// Zoom arriere borne : impossible de s'eloigner au-dela de echelleOrthoMax (molette, pincement ou curseur).
viewer.camera.ortho.on("scale", (echelle) => {
  if (!vueAvantDessus) return;
  const max = echelleOrthoMax();
  if (echelle > max + 1e-6) viewer.camera.ortho.scale = max;
});

function reglerVitesseCamera(pourcent) {
  cameraSpeedSlider.value = String(pourcent);
  cameraSpeedValue.textContent = pourcent + " %";
  applyCameraTouchSpeed(pourcent); // le curseur n'est pas persiste ici : c'est l'ecouteur « input » du curseur qui memorise
}

// Maquettes presentes dans la vue a plat : celles qui sont cochees (et chargees). La vue se cadre sur leur ensemble.
function maquettesPresentes() {
  return MAQUETTES.filter((m) => m.shown && m.model);
}

function appliquerVueDessus() {
  const presentes = maquettesPresentes();
  const boite = aabbDesMaquettes(presentes);
  if (!boite) return;
  maquettesVueDessus = presentes.map((m) => m.id).join(",");
  const [x0, y0, z0, x1, y1, z1] = boite;
  const camera = viewer.camera;
  const centre = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  camera.projection = "ortho";
  camera.ortho.scale = Math.min(echelleOrtho(x1 - x0, z1 - z0, 1.15), echelleOrthoMax()); // tout le niveau, avec 15 % de marge
  viewer.cameraFlight.jumpTo({ eye: [centre[0], y1 + 50, centre[2]], look: centre, up: [0, 0, -1] });
}

function entrerVueDessus() {
  if (vueAvantDessus || !planDansViewer || !planDansViewer.maquette.model) return;
  const camera = viewer.camera;
  vueAvantDessus = { eye: camera.eye.slice(), look: camera.look.slice(), up: camera.up.slice(), projection: camera.projection };
  appliquerVueDessus();
  vitesseAvantDessus = Number(cameraSpeedSlider.value);
  reglerVitesseCamera(VUE_PLAT_VITESSE);
  vueDessusBtn.textContent = "Perspective";
  vueDessusBtn.setAttribute("aria-pressed", "true");
}

// retablir : remettre la camera d'avant (bouton « Perspective »). Sans retablir, seule la projection revient (sortie du Viewer, rechargement).
function sortirVueDessus(retablir) {
  if (!vueAvantDessus) return;
  const avant = vueAvantDessus;
  vueAvantDessus = null;
  viewer.camera.projection = "perspective";
  if (vitesseAvantDessus !== null) { reglerVitesseCamera(vitesseAvantDessus); vitesseAvantDessus = null; }
  if (retablir) viewer.cameraFlight.jumpTo({ eye: avant.eye, look: avant.look, up: avant.up });
  vueDessusBtn.textContent = "Vue à plat";
  vueDessusBtn.setAttribute("aria-pressed", "false");
}

vueDessusBtn.addEventListener("click", () => { if (vueAvantDessus) sortirVueDessus(true); else entrerVueDessus(); });

// Noms des pieces, poses au sol : un plan horizontal par piece (texture PNG transparente, haut de l'image = nord = -z dans la scene), a 3 cm au-dessus de la dalle.
// Meshes hors « objets » de la scene (isObject faux) : les commandes d'affichage du Viewer (isoler, masquer, IA) ne les voient pas ; la coupe les decoupe comme le reste.
function poserNomsAuSol(noms) {
  viderNomsAuSol();
  const scene = viewer.scene;
  for (const n of noms) {
    const geometrie = new ReadableGeometry(scene, buildPlaneGeometry({ xSize: n.largeur, zSize: n.hauteur }));
    const texture = new Texture(scene, { src: n.image });
    const materiau = new PhongMaterial(scene, { diffuseMap: texture, alphaMode: "blend", alpha: 1.0, specular: [0, 0, 0], emissive: [0.35, 0.35, 0.35] });
    const maille = new Mesh(scene, { id: "plan2d3d-nom-" + n.id, geometry: geometrie, material: materiau, position: [n.x, 0.03, n.z], pickable: false, collidable: false });
    planDansViewer.plaques.push({ maille, geometrie, materiau, texture });
  }
}

function viderNomsAuSol() {
  if (!planDansViewer) return;
  for (const p of planDansViewer.plaques) { p.maille.destroy(); p.geometrie.destroy(); p.materiau.destroy(); p.texture.destroy(); }
  planDansViewer.plaques = [];
}

function retirerPlanDuViewer() {
  if (!planDansViewer) return;
  viderNomsAuSol();
  const { maquette, avant, camera } = planDansViewer;
  sortirVueDessus(false);
  planDansViewer = null;
  vueDessusBtn.hidden = true;
  viewer.camera.projection = camera.projection;
  viewer.cameraFlight.jumpTo({ eye: camera.eye, look: camera.look, up: camera.up }); // la camera du Viewer comme avant la visite
  if (maquette.model) maquette.model.destroy();
  const i = MAQUETTES.indexOf(maquette);
  if (i >= 0) MAQUETTES.splice(i, 1);
  MAQUETTES.forEach((m) => { if (avant.has(m.id)) m.shown = avant.get(m.id); });
  applyVisibility();
  renderMaquetteRows(maquettesList, MAQUETTES);
}

retourPlan3d = creerRetourContexte({
  id: "plan3dBandeauRetour",
  classeCorps: "plan3d-retour-actif",
  ariaLabel: "Retour au plan 2D",
  autresClasses: ["msg-retour-actif", "regles-retour-actif", "quantitatif-retour-actif"]
});

const quantitatifHistorique = creerHistorique({ depot: creerDepotLocal() });
quantitatif = creerQuantitatifPage({
  racine: document.getElementById("quantitatifRoot"),
  obtenirDonnees: donneesQuantitatif,
  demander: demanderQuantitatif,
  voirDansViewer: voirQuantitatifDansViewer,
  obtenirVersions: versionsQuantitatif,
  historique: quantitatifHistorique
});
// Historique de demonstration (28/10) : deux quantitatifs deja passes, amorces une seule fois par navigateur.
amorcerHistoriqueDemo({ historique: quantitatifHistorique, versions: versionsQuantitatif }).then((ajoute) => { if (ajoute) quantitatif.rafraichirHistorique(); });
// Rechargement direct sur la page (hash ou dernier onglet) : activateView s'est execute avant la creation de la page.
// Differe d'un cran : appelee pendant l'initialisation du module, la page lirait des constantes declarees plus bas (HOSPITAL_MISPLACED_RAILING_IDS...) avant leur initialisation.
if (!document.getElementById("view-quantitatif").hidden) setTimeout(() => quantitatif.surVueActivee("quantitatif"), 0);

commandesIA = creerCommandesIA({
  bouton: commandesIABtn,
  exemples: EXEMPLES_COMMANDES,
  proposerCommande: (commande) => proposerCommandeViewer(commande, true),
  traduire: traduirePhraseViewer,
  fermerAutres: () => { cameraSpeedPanel.hidden = true; cameraSpeedToggle.classList.remove("active"); }
});

// « Tout reafficher » : toute question en cours tombe avec la commande qu'elle portait.
commandesResetBtn.addEventListener("click", () => {
  commandesBandeau.masquer(false);
  fluxCommandes().toutReafficher();
  majBoutonToutReafficher();
});

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

  // Le bandeau monte et apparait la premiere fois ; en passant d'une collision a l'autre, son contenu se renouvelle en fondu.
  const etaitCache = collisionDiscussion.hidden;
  collisionDiscussion.hidden = false;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !collisionDiscussion.classList.contains("cb-grand")) {
    jouerClasse(collisionDiscussion, etaitCache ? "bandeau-entree" : "bandeau-maj", 450);
  }
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

// Transparence de la collision (20/10) : appliquee une seule fois, a l'arrivee de la camera. Si l'on clique une autre collision en
// cours de vol, le vol repart et le calcul de la precedente n'a jamais lieu (rien ne s'accumule, plus de gel). Filet : si le vol
// est interrompu a la main (rotation), la callback d'arrivee n'est jamais appelee, un minuteur applique alors quand meme.
let opacitesAppliqueesPour = null;
let minuteurOpacitesCollision = null;
function appliquerOpacitesSiActive(clash) {
  if (collisionActiveClash !== clash || opacitesAppliqueesPour === clash) return;
  opacitesAppliqueesPour = clash;
  applyCollisionOpacities();
  // Pleine page ouverte : le plan du niveau de la nouvelle collision, une fois le contexte en fantome pose.
  if (collisionDiscussion.classList.contains("cb-grand")) majPlanCollision();
}
// surArrivee (optionnel, 21/10) : appelee une fois la camera arrivee et la transparence posee (recolte des vues, ?vues=1).
function selectClash(clash, surArrivee) {
  clearTimeout(minuteurOpacitesCollision);
  opacitesAppliqueesPour = null;
  // Le contexte de la collision precedente est remis tel quel des le choix : la camera traverse la maquette complete pendant son vol, le
  // fantome de la nouvelle collision n'est pose qu'a l'arrivee (voir appliquerOpacitesSiActive).
  resetCollisionOpacities();
  flyToClash(clash, true, () => {
    appliquerOpacitesSiActive(clash);
    if (surArrivee) surArrivee();
  });
  minuteurOpacitesCollision = setTimeout(() => appliquerOpacitesSiActive(clash), 2500);
  highlightClashMarker(clash);
  // Une nouvelle collision remplace la selection precedente (carte fermee).
  deselectEntity();
  highlightClashElements(clash);
  recenterTarget = () => flyToClash(clash, true);
  showThreadDiscussion(clash);
  majBoutonsAngle();
  // Pleine page ouverte : les infos suivent tout de suite la collision choisie, le plan est efface puis refait a l'arrivee de la camera.
  if (collisionDiscussion.classList.contains("cb-grand")) {
    majInfosCollision(clash);
    if (fichePlanCanvasEl) fichePlanCanvasEl.getContext("2d").clearRect(0, 0, fichePlanCanvasEl.width, fichePlanCanvasEl.height);
    if (fichePlanLegendeEl) fichePlanLegendeEl.textContent = "Génération du plan…";
  }
}

// Point d'entree commun pour selectionner un clash, que ce soit via la
// ligne de la liste ou un clic direct sur sa bulle 3D dans le viewer.
function activateClash(clash, surArrivee) {
  collisionsList.querySelectorAll(".collision-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.clashId === clash.id);
  });
  selectClash(clash, surArrivee);
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
    basculerBandeauAnime(!willOpen);
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
    const replie = !collisionInfoPanel.classList.contains("collapsed");
    setCollisionPanelCollapsed(replie);
    setInfoPanelCollapsed(replie);
    window.dispatchEvent(new Event("resize"));
  });
  collisionInfoPanel.addEventListener("transitionend", (e) => {
    if (e.target === collisionInfoPanel) window.dispatchEvent(new Event("resize"));
  });
}

// Depliement anime du bandeau de collision (20/10) : la hauteur passe de l'ancienne a la nouvelle valeur en 0,28 s et la
// fleche tourne, au lieu d'un saut. A la fermeture le contenu reste visible pendant que la hauteur diminue, puis la
// classe "collapsed" est posee a la fin.
let bandeauEnAnimation = false;
function basculerBandeauAnime(reduire) {
  const el = collisionDiscussion;
  if (bandeauEnAnimation) return;
  const mobileMq = window.matchMedia(REQUETE_MOBILE).matches;
  // Mobile, appui sur le numero : meme mouvement que le glissement (sans redimensionner la 3D a chaque image).
  if (reduire && mobileMq && preparerFermetureBandeau()) { animerFermetureBandeau(0, 0); return; }
  const h0 = el.offsetHeight;
  el.classList.toggle("collapsed", reduire);
  const h1 = el.offsetHeight;
  if (!el.classList.contains("cb") || h0 === h1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  bandeauEnAnimation = true;
  if (reduire) {
    el.classList.remove("collapsed");
    collisionDiscussionToggle.style.transform = "rotate(-90deg)";
  }
  // box-sizing: la hauteur posee en pixels doit inclure padding et bordure (offsetHeight), sinon le bandeau gagne 5 px a la premiere image
  // (saut de depart) et perd 5 px a la fin sur mobile.
  // Ouverture sur ordinateur (22/10) : meme cause, le bandeau depassait de 9 px (padding bas 8 + bordure 1) puis redescendait a la fin.
  el.style.cssText += ";height:" + h0 + "px;min-height:0;max-height:none;overflow:hidden" + (mobileMq || !reduire ? ";box-sizing:border-box" : "");
  void el.offsetHeight;
  el.style.transition = "height 0.28s ease";
  el.style.height = h1 + "px";
  setTimeout(() => {
    el.style.transition = "";
    el.style.height = "";
    el.style.minHeight = "";
    el.style.maxHeight = "";
    el.style.overflow = "";
    el.style.boxSizing = "";
    if (reduire) el.classList.add("collapsed");
    collisionDiscussionToggle.style.transform = "";
    bandeauEnAnimation = false;
    window.dispatchEvent(new Event("resize"));
  }, 300);
}
collisionDiscussionToggle.addEventListener("click", () => {
  basculerBandeauAnime(!collisionDiscussion.classList.contains("collapsed"));
});
// Repli du bandeau sur mobile (glissement vers le bas ou appui sur le numero), 21/10. Le bandeau ne change JAMAIS de hauteur pendant le
// mouvement : il passe en position absolue au bas de la zone (meme place, meme taille) et glisse par un simple transform. La zone 3D prend
// sa taille FINALE des le debut (un seul recalage du canvas, pendant que le bandeau la recouvre), et le canvas est decale en CSS pour que
// l'image reste celle d'avant : ce decalage (compositeur seul, aucun redimensionnement WebGL) se resorbe au meme rythme que le bandeau, donc
// la maquette n'est jamais rognee et ne saute pas a la fin. Le decalage n'est pas qu'une translation : xeokit (fovAxis "min", portrait) fait
// varier l'angle de champ avec la hauteur du canvas, donc l'image se dezoome aussi (x0,79 de 431 a 682 px) ; le facteur est calcule avec la
// meme formule (echelle ecran = (H/2) / tan(fov(H)/2), fov(H) = fov * H / L) et applique en CSS autour du centre du canvas.
function echelleEcran3d(hauteur, largeur) {
  const cam = viewer.camera;
  const fov = Math.min(cam.perspective.fov * hauteur / largeur, 120) * Math.PI / 180;
  return (hauteur / 2) / Math.tan(fov / 2);
}
function transformFermeture(f, p) {
  return "translateY(" + -f.decal * (1 - p) + "px) scale(" + (1 + (f.echelle - 1) * (1 - p)) + ")";
}
// Bouton « Collisions » (ancre en bas de la photo 3D) : la photo prend sa hauteur finale des le debut (+delta), le bouton est donc ramene
// d'autant vers le haut puis suit le bord haut du bandeau qui descend (22/10), sans jamais sauter.
function transformBoutonFermeture(f, p) {
  return "translateY(" + -f.delta * (1 - p) + "px)";
}
let fermetureBandeau = null;
function preparerFermetureBandeau() {
  if (fermetureBandeau || bandeauEnAnimation || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const el = collisionDiscussion;
  if (!el.classList.contains("cb") || el.classList.contains("collapsed")) return false;
  const h0 = el.offsetHeight;
  el.classList.add("collapsed");
  const h1 = el.offsetHeight;
  el.classList.remove("collapsed");
  if (h0 <= h1) return false;
  const toile = viewer.scene.canvas.canvas;
  const calques = [toile, clashBullesCanvas, clashPastillesContainer].filter(Boolean);
  const avant = toile.clientHeight;
  bandeauEnAnimation = true;
  const etat = { delta: h0 - h1, calques, decal: 0, echelle: 1, cssAvant: el.style.cssText, cssGaucheAvant: collisionLeft.style.cssText };
  collisionLeft.style.cssText += ";position:relative;padding-bottom:" + h1 + "px"; // la zone 3D prend d'emblee sa hauteur finale (bandeau replie = h1)
  el.style.cssText += ";position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;height:" + h0 + "px;min-height:0;max-height:none";
  collisionViewerSlot.style.overflow = "hidden";
  const apres = toile.clientHeight;
  etat.decal = (apres - avant) / 2;
  if (viewer.camera.projection === "perspective" && viewer.camera.perspective.fovAxis === "min" && toile.clientWidth < Math.min(avant, apres)) {
    etat.echelle = echelleEcran3d(avant, toile.clientWidth) / echelleEcran3d(apres, toile.clientWidth);
  }
  fermetureBandeau = etat;
  calques.forEach((c) => { c.style.transform = transformFermeture(etat, 0); });
  collisionInfoPanelToggle.style.transform = transformBoutonFermeture(etat, 0);
  // Titres et tailles du bandeau replie : ils arrivent progressivement (--fp de 0 a 1) au lieu de surgir d'un coup a la fin.
  el.style.setProperty("--fp", "0");
  el.classList.add("cb-ferme");
  return true;
}
function suivreFermetureBandeau(dy) {
  const f = fermetureBandeau;
  if (!f) return;
  const p = Math.min(1, Math.max(0, dy / f.delta));
  f.calques.forEach((c) => { c.style.transform = transformFermeture(f, p); });
  collisionInfoPanelToggle.style.transform = transformBoutonFermeture(f, p);
  collisionDiscussion.style.setProperty("--fp", String(p));
}
function nettoyerFermetureBandeau() {
  const f = fermetureBandeau;
  if (!f) return;
  const el = collisionDiscussion;
  f.calques.forEach((c) => { c.getAnimations().forEach((a) => a.cancel()); c.style.transform = ""; });
  collisionInfoPanelToggle.getAnimations().forEach((a) => a.cancel());
  collisionInfoPanelToggle.style.transform = "";
  el.getAnimations().forEach((a) => a.cancel());
  el.style.cssText = f.cssAvant;
  el.classList.remove("cb-ferme");
  collisionLeft.style.cssText = f.cssGaucheAvant;
  collisionViewerSlot.style.overflow = "";
  collisionDiscussionToggle.style.transform = "";
  fermetureBandeau = null;
  bandeauEnAnimation = false;
}
// Geste abandonne (relache trop tot) : retour a la mise en page d'origine.
function annulerFermetureBandeau() { nettoyerFermetureBandeau(); window.dispatchEvent(new Event("resize")); }
// Lance le mouvement depuis le decalage du doigt (dy, 0 pour un appui). Retourne true quand il est gere ici.
function animerFermetureBandeau(dy, vitesse) {
  const f = fermetureBandeau;
  if (!f) { basculerBandeauAnime(true); return false; }
  const el = collisionDiscussion;
  const reste = Math.max(1, f.delta - dy);
  // Courbe qui demarre a la vitesse du doigt (pente initiale = vitesse * duree / distance restante) ; appui : "ease" comme le reste.
  const pente = Math.min(3.3, Math.max(0.5, (vitesse || 0) * 280 / reste));
  const options = { duration: 280, easing: vitesse > 0 ? "cubic-bezier(0.3," + (pente * 0.3).toFixed(3) + ",0.5,1)" : "ease", fill: "forwards" };
  const p0 = Math.min(1, dy / f.delta);
  collisionDiscussionToggle.style.transform = "rotate(-90deg)";
  const anim = el.animate([{ transform: "translateY(" + dy + "px)", "--fp": p0 }, { transform: "translateY(" + f.delta + "px)", "--fp": 1 }], options);
  const anims = [anim].concat(f.calques.map((c) => c.animate([{ transform: transformFermeture(f, p0) }, { transform: transformFermeture(f, 1) }], options)));
  anims.push(collisionInfoPanelToggle.animate([{ transform: transformBoutonFermeture(f, p0) }, { transform: transformBoutonFermeture(f, 1) }], options));
  if (vitesse > 0) anims.forEach((a) => { a.currentTime = AVANCE_RELACHEMENT; });
  anim.onfinish = () => {
    el.classList.add("collapsed");
    nettoyerFermetureBandeau();
    window.dispatchEvent(new Event("resize"));
  };
  return true;
}

// Sections repliables des drawers (20/10) : meme animation que le bandeau de collision. La hauteur passe de l'ancienne a la
// nouvelle valeur en 0,28 s (les sections voisines suivent car le drawer est en flex) et la fleche tourne. A la fermeture,
// l'attribut "open" n'est retire qu'a la fin, pour que le contenu reste visible pendant que la hauteur diminue.
function animerDetails(details, ouvrir) {
  const h0 = details.offsetHeight;
  details.open = ouvrir;
  const h1 = details.offsetHeight;
  if (h0 === h1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  details._animation = true;
  if (!ouvrir) {
    details.open = true;
    details.classList.add("fermeture");
  }
  details.style.flex = "none";
  details.style.overflow = "hidden";
  details.style.height = h0 + "px";
  void details.offsetHeight;
  details.style.transition = "height 0.28s ease";
  details.style.height = h1 + "px";
  setTimeout(() => {
    details.style.transition = "";
    details.style.height = "";
    details.style.overflow = "";
    details.style.flex = "";
    details.classList.remove("fermeture");
    details.open = ouvrir;
    details._animation = false;
    if (details.closest("#collisionInfoPanel, #infoPanel")) window.dispatchEvent(new Event("resize"));
  }, 300);
}
document.addEventListener("click", (e) => {
  const summary = e.target.closest("details.info-section > summary, details.collision-ecartes > summary");
  if (!summary || summary.parentElement.hidden) return;
  e.preventDefault();
  const details = summary.parentElement;
  // Drawer Collision (20/10) : la liste des collisions et la liste des couples restent toujours ouvertes.
  if (details.matches("#section-collision-liste, #section-collision-couples")) return;
  if (details._animation) return;
  animerDetails(details, !details.open);
});

// COLLISION_BANDEAU : a l'ouverture de la zone, la chronologie descend sur le plus recent.
// Fleche + titre = un seul element : un clic n'importe ou sur la pilule (marges comprises) agit comme sur la fleche.
document.querySelector(".cb-titre-groupe").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) collisionDiscussionToggle.click();
});
collisionDiscussionTitle.addEventListener("click", defilerChronologieBas);
collisionDiscussionToggle.addEventListener("click", defilerChronologieBas);

// COLLISION_ECHANGES_GRAND : agrandir la zone d'echange sur toute la zone de la 3D.
// N'agit que sur des classes de #collisionDiscussion : aucun etat 3D, aucun deplacement de viewerWrap.
// ---- Fiche de la collision en pleine page (20/10) : infos sous l'apercu + plan du niveau ----
// Contenu des blocs inseres sous Priorite / Statut (colonne de gauche). Visibles seulement en pleine page (CSS .cb-grand).
let ficheInfosEl = null;
let fichePlanBlocEl = null;
let fichePlanCanvasEl = null;
let fichePlanLegendeEl = null;
const plansCollision = new Map(); // id de collision -> { url, w, h }
function construireFicheCollision(wrap) {
  ficheInfosEl = document.createElement("dl");
  ficheInfosEl.id = "collisionInfos";
  ficheInfosEl.className = "coll-infos";
  fichePlanBlocEl = document.createElement("button");
  fichePlanBlocEl.type = "button";
  fichePlanBlocEl.id = "collisionPlanBloc";
  fichePlanBlocEl.className = "coll-plan";
  fichePlanBlocEl.title = "Agrandir le plan";
  fichePlanCanvasEl = document.createElement("canvas");
  fichePlanLegendeEl = document.createElement("span");
  fichePlanLegendeEl.className = "coll-plan-legende";
  fichePlanBlocEl.append(fichePlanCanvasEl, fichePlanLegendeEl);
  fichePlanBlocEl.addEventListener("click", () => {
    const plan = collisionActiveClash && plansCollision.get(collisionActiveClash.id);
    if (!plan) return;
    document.getElementById("collisionPlanGrand").src = plan.url;
    document.getElementById("collisionPlanModal").hidden = false;
  });
  wrap.append(ficheInfosEl, fichePlanBlocEl, resetAngleBtn);
  // Carte "Info selection" de l'element clique dans la fiche (pleine page) : flottante, a droite de la colonne de gauche.
  ficheElementEl = document.createElement("div");
  ficheElementEl.id = "collisionElementCarte";
  ficheElementEl.hidden = true;
  ficheElementEl.setAttribute("role", "dialog");
  ficheElementEl.setAttribute("aria-label", "Informations sur l'élément");
  const entete = document.createElement("div");
  entete.className = "coll-element-entete";
  ficheElementTitreEl = document.createElement("span");
  const fermer = document.createElement("button");
  fermer.type = "button";
  fermer.setAttribute("aria-label", "Fermer");
  fermer.textContent = "✕";
  fermer.addEventListener("click", fermerFicheElementCollision);
  entete.append(ficheElementTitreEl, fermer);
  ficheElementContenuEl = document.createElement("dl");
  ficheElementContenuEl.className = "fiche-content";
  ficheElementDocsEl = document.createElement("div");
  ficheElementEl.append(entete, ficheElementContenuEl, ficheElementDocsEl);
  collisionDiscussion.appendChild(ficheElementEl);
  ficheInfosEl.addEventListener("click", (e) => {
    const bouton = e.target.closest("button.coll-info-element");
    if (!bouton) return;
    if (bouton.classList.contains("actif")) fermerFicheElementCollision();
    else afficherElementCollision(bouton.dataset.id, bouton.dataset.discipline);
  });
}
let ficheElementEl = null;
let ficheElementTitreEl = null;
let ficheElementContenuEl = null;
let ficheElementDocsEl = null;
// Clic sur "Cloison" ou "Tuyau" dans la fiche : meme effet qu'un clic sur l'element dans la 3D (element selectionne, memes informations).
function afficherElementCollision(id, discipline) {
  const entite = viewer.scene.objects[id];
  if (!entite || !ficheElementEl) return;
  deselectEntity();
  selectedEntity = entite;
  entite.selected = true;
  showFiche(entite);
  const { rows, docs } = rowsFicheEntite(entite);
  renderFicheInto(ficheElementContenuEl, ficheElementDocsEl, rows, docs);
  ficheElementTitreEl.textContent = discipline;
  ficheElementEl.hidden = false;
  // Juste sous le trait qui separe les onglets Tout / Commentaires / Modifications de la liste des echanges, avec 12 px d'air : la carte a
  // ainsi une marge au-dessus comme a gauche et a droite (16 px).
  const trait = document.getElementById("discussionMessages").getBoundingClientRect().top - collisionDiscussion.getBoundingClientRect().top;
  ficheElementEl.style.top = Math.round(trait + 12) + "px";
  ficheInfosEl.querySelectorAll("button.coll-info-element").forEach((b) => b.classList.toggle("actif", b.dataset.id === id));
}
// Un clic n'importe ou en dehors de la carte ferme la carte (les lignes cliquables de la fiche gerent elles-memes leur ouverture et fermeture).
// Phase de capture : un clic sur un element qui arrete la propagation (bouton, liste, canevas 3D) ferme aussi la carte, et ce clic garde son effet.
// L'evenement qui a ferme la carte est memorise : un clic sur la photo de la 3D qui ferme la carte ne doit PAS en plus quitter la pleine page.
let clicQuiAFermeLaCarte = null;
document.addEventListener("click", (e) => {
  if (!ficheElementEl || ficheElementEl.hidden) return;
  if (ficheElementEl.contains(e.target) || e.target.closest(".coll-info-element")) return;
  clicQuiAFermeLaCarte = e;
  fermerFicheElementCollision();
}, true);
function fermerFicheElementCollision() {
  if (!ficheElementEl || ficheElementEl.hidden) return;
  ficheElementEl.hidden = true;
  if (ficheInfosEl) ficheInfosEl.querySelectorAll("button.coll-info-element").forEach((b) => b.classList.remove("actif"));
  deselectEntity();
}
document.getElementById("collisionPlanModal").addEventListener("click", () => { document.getElementById("collisionPlanModal").hidden = true; });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("collisionPlanModal").hidden) {
    e.stopImmediatePropagation();
    document.getElementById("collisionPlanModal").hidden = true;
  }
}, true);

// Ancetres IFC d'un element (niveau, batiment, piece...) a partir des metadonnees xeokit, indexes par type.
function ancetresIfc(id) {
  const out = {};
  let cur = viewer.metaScene.metaObjects[id];
  while (cur) {
    if (!out[cur.type]) out[cur.type] = cur;
    cur = cur.parent;
  }
  return out;
}
let nomsBatimentsCache = null;
function nomsBatiments() {
  if (!nomsBatimentsCache) {
    nomsBatimentsCache = new Set(Object.values(viewer.metaScene.metaObjects).filter((mo) => mo.type === "IfcBuilding").map((mo) => mo.name));
  }
  return nomsBatimentsCache;
}
function majInfosCollision(clash) {
  if (!ficheInfosEl) return;
  if (ficheElementEl && !ficheElementEl.hidden) { ficheElementEl.hidden = true; }
  ficheInfosEl.innerHTML = "";
  if (!clash) return;
  const ajouter = (libelle, valeur, detail, elementId) => {
    const dt = document.createElement("dt");
    dt.textContent = libelle;
    const dd = document.createElement("dd");
    if (elementId) {
      // Element de la collision : cliquable, affiche ses informations comme un clic dans la 3D.
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "coll-info-element";
      bouton.dataset.id = elementId;
      bouton.dataset.discipline = libelle;
      bouton.title = "Voir les informations de cet élément";
      bouton.textContent = valeur;
      dd.appendChild(bouton);
    } else {
      dd.textContent = valeur;
    }
    if (detail) {
      const small = document.createElement("small");
      small.textContent = detail;
      dd.appendChild(small);
    }
    ficheInfosEl.append(dt, dd);
  };
  const niveau = (clash.zone.match(/·\s*([^·]+)$/) || [])[1];
  if (niveau) ajouter("Niveau", niveau.trim().replace(/^Level\s*/i, ""));
  // Un seul niveau (ligne du dessus) ; chaque element n'est donne que par son type, sans identifiant ni etage repete.
  const [partA, partB] = clash.zone.split(" ↔ ");
  const [idA, idB] = clash.entityIds;
  ajouter(clash.disciplineA, collisionTypeFr(partA || ""), null, idA);
  ajouter(clash.disciplineB, collisionTypeFr((partB || "").split("·")[0]), null, idB);
  // Piece : seulement quand l'element est rattache a une piece (aucune dans les maquettes de l'hopital aujourd'hui).
  const pieces = [idA, idB].map((id) => ancetresIfc(id).IfcSpace).filter(Boolean).map((p) => p.name);
  if (pieces.length) ajouter("Pièce", [...new Set(pieces)].join(" / "));
  // Batiment : seulement s'il y en a plusieurs (noms distincts) dans le projet.
  if (nomsBatiments().size > 1) {
    const noms = [idA, idB].map((id) => ancetresIfc(id).IfcBuilding).filter(Boolean).map((b) => b.name);
    if (noms.length) ajouter("Bâtiment", [...new Set(noms)].join(" / "));
  }
}

// Plan du niveau (methode A, 20/10) : rendu reel de la maquette vue de dessus (camera orthographique), coupee juste au-dessus du
// conflit sur l'epaisseur d'un etage, en X-ray net (traits des murs et gaines), avec la zone du conflit entouree par-dessus.
// Une seule image, calculee a l'ouverture de la pleine page puis gardee en memoire pour cette collision. Tout se passe dans la
// meme tache JS : camera, materiau X-ray et projection sont restaures avant la peinture suivante, rien ne clignote.
function genererPlanCollision(clash) {
  const cache = plansCollision.get(clash.id);
  if (cache) return cache;
  const point = clashCenter(clash);
  if (!point.every(Number.isFinite)) return null;
  const [idA, idB] = clash.entityIds;
  const maquettes = MAQUETTES.filter((m) => m.model);
  const ids = collisionSameLevelSet(clash, maquettes);
  let boite = null;
  const etendre = (aabb) => {
    if (!aabb) return;
    boite = boite ? [Math.min(boite[0], aabb[0]), Math.min(boite[1], aabb[1]), Math.min(boite[2], aabb[2]), Math.max(boite[3], aabb[3]), Math.max(boite[4], aabb[4]), Math.max(boite[5], aabb[5])] : aabb.slice();
  };
  // Cadrage sur le batiment lui-meme : emprises des elements du niveau, en ecartant 2 % des plus excentres de chaque cote (un element
  // isole tres loin, dalle de site ou repere, agrandissait le cadre et laissait le batiment petit et decentre).
  const minsX = [];
  const maxsX = [];
  const minsZ = [];
  const maxsZ = [];
  // Plan de coupe : au-dessus du plus haut des DEUX elements en conflit (et au moins 0,4 m au-dessus du point), pour qu'ils soient rendus en
  // entier, avec leur vraie forme et leur couleur (rouge / vert). Plus de rectangle englobant par-dessus : il debordait des elements obliques.
  const aabbA = collisionAabbOf(idA);
  const aabbB = collisionAabbOf(idB);
  const coupe = Math.max(point[1] + 0.4, aabbA ? aabbA[4] + 0.02 : 0, aabbB ? aabbB[4] + 0.02 : 0);
  // Elements gardes : ceux du niveau qui commencent sous le plan de coupe (murs, sols, gaines basses) ; plafonds et gaines hautes
  // sont au-dessus et ne sont pas dessines. Les deux elements en conflit sont toujours gardes.
  const garder = new Set([idA, idB]);
  (ids ? Array.from(ids) : []).forEach((id) => {
    const aabb = collisionAabbOf(id);
    if (!aabb) return;
    etendre(aabb);
    if (aabb[1] <= coupe) {
      garder.add(id);
      minsX.push(aabb[0]); maxsX.push(aabb[3]); minsZ.push(aabb[2]); maxsZ.push(aabb[5]);
    }
  });
  const quantile = (tableau, q) => {
    const t = tableau.slice().sort((a, b) => a - b);
    return t[Math.min(t.length - 1, Math.max(0, Math.round(q * (t.length - 1))))];
  };
  if (minsX.length >= 20) {
    // Emprise robuste, toujours agrandie pour contenir le point de collision avec un peu d'air.
    boite = [
      Math.min(quantile(minsX, 0.02), point[0] - 4), boite[1], Math.min(quantile(minsZ, 0.02), point[2] - 4),
      Math.max(quantile(maxsX, 0.98), point[0] + 4), boite[4], Math.max(quantile(maxsZ, 0.98), point[2] + 4)
    ];
  }
  if (!boite) {
    etendre(collisionAabbOf(idA));
    etendre(collisionAabbOf(idB));
    if (boite) boite = [boite[0] - 15, boite[1], boite[2] - 15, boite[3] + 15, boite[4], boite[5] + 15];
  }
  if (!boite) return null;
  const marge = 1.12; // un peu d'air autour du batiment
  const cx = (boite[0] + boite[3]) / 2;
  const cz = (boite[2] + boite[5]) / 2;
  const largeurX = Math.max(boite[3] - boite[0], 4) * marge;
  const largeurZ = Math.max(boite[5] - boite[2], 4) * marge;
  const canevas = viewer.scene.canvas.canvas;
  const aspect = canevas.clientWidth / Math.max(canevas.clientHeight, 1);
  const cam = viewer.camera;
  const sauve = {
    eye: Array.from(cam.eye), look: Array.from(cam.look), up: Array.from(cam.up), projection: cam.projection,
    scale: cam.ortho.scale, near: cam.ortho.near, far: cam.ortho.far
  };
  const mat = viewer.scene.xrayMaterial;
  const matSauve = { fillAlpha: mat.fillAlpha, edgeAlpha: mat.edgeAlpha, fillColor: Array.from(mat.fillColor), edgeColor: Array.from(mat.edgeColor) };
  const modeles = maquettes.map((m) => m.model);
  const masques = [];
  let url = null;
  let projeter = null;
  let W = 0;
  let H = 0;
  try {
    // Le reste du batiment est masque UN instant (ecriture groupee, meme tache JS) : sinon tous les etages se superposent en vue de dessus.
    ecritureGroupeeDrapeaux(modeles, () => {
      modeles.forEach((m) => m.entityList.forEach((e) => {
        if (e.visible && !garder.has(e.id)) { masques.push(e); e.visible = false; }
      }));
    });
    mat.fillAlpha = 0.10;
    mat.edgeAlpha = 0.85;
    mat.fillColor = [0.5, 0.6, 0.7];
    mat.edgeColor = [0.85, 0.9, 0.95];
    // Projection orthographique vue de dessus ; l'oeil est AU niveau du plan de coupe, donc tout ce qui est plus haut est derriere la
    // camera et coupe par le plan proche. Portee lointaine tres grande : une portee courte rend une image vide (mesure du 20/10).
    cam.projection = "ortho";
    cam.ortho.near = 0.1;
    cam.ortho.far = 10000;
    cam.ortho.scale = Math.max(largeurX, largeurZ * aspect);
    cam.eye = [cx, coupe + 0.15, cz]; // plan proche a 0,1 m sous l'oeil : le haut des elements (coupe + 0,02) reste visible
    cam.look = [cx, coupe - 1, cz];
    cam.up = [0, 0, -1];
    // Haute resolution meme quand la 3D n'est plus qu'une photo (pleine page) : le rendu d'instantane de xeokit redimensionne la zone de
    // dessin, avec le MEME rapport largeur/hauteur que l'ecran (la projection orthographique s'y cale). Repli : zone de dessin actuelle.
    if (canevas.clientWidth < 800) {
      try {
        W = 1200;
        H = Math.max(200, Math.round(W * canevas.clientHeight / Math.max(canevas.clientWidth, 1)));
        url = viewer.getSnapshot({ width: W, height: H, format: "png" });
      } catch (e) {
        url = null;
      }
    }
    if (!url) {
      viewer.scene.render(true);
      url = canevas.toDataURL("image/png");
      W = canevas.width;
      H = canevas.height;
    }
    const V = Array.from(cam.viewMatrix);
    const P = Array.from(cam.projMatrix);
    projeter = (x, y, z) => {
      const vx = V[0] * x + V[4] * y + V[8] * z + V[12];
      const vy = V[1] * x + V[5] * y + V[9] * z + V[13];
      const vz = V[2] * x + V[6] * y + V[10] * z + V[14];
      const px = P[0] * vx + P[4] * vy + P[8] * vz + P[12];
      const py = P[1] * vx + P[5] * vy + P[9] * vz + P[13];
      return [(px * 0.5 + 0.5) * W, (1 - (py * 0.5 + 0.5)) * H];
    };
  } finally {
    mat.fillAlpha = matSauve.fillAlpha;
    mat.edgeAlpha = matSauve.edgeAlpha;
    mat.fillColor = matSauve.fillColor;
    mat.edgeColor = matSauve.edgeColor;
    cam.ortho.scale = sauve.scale;
    cam.ortho.near = sauve.near;
    cam.ortho.far = sauve.far;
    cam.projection = sauve.projection;
    cam.eye = sauve.eye;
    cam.look = sauve.look;
    cam.up = sauve.up;
    if (masques.length) ecritureGroupeeDrapeaux(modeles, () => masques.forEach((e) => { e.visible = true; }));
    // Image 3D remise a jour dans la meme tache : le plan n'est jamais peint a l'ecran.
    viewer.scene.render(true);
  }
  if (!url || !projeter) return null;
  const plan = { url, w: W, h: H, projeter, point, idA, idB };
  plansCollision.set(clash.id, plan);
  return plan;
}
// Compose l'image finale : fond, plan, zone des deux elements en conflit et repere sur le point de collision.
function composerPlanCollision(clash, plan, cible, quand, apres) {
  const image = new Image();
  image.onerror = () => { if (apres) apres(); };
  image.onload = () => {
    if (collisionActiveClash !== clash && quand === "ouverture") return;
    cible.width = plan.w;
    cible.height = plan.h;
    const ctx = cible.getContext("2d");
    ctx.fillStyle = "#101512";
    ctx.fillRect(0, 0, plan.w, plan.h);
    ctx.drawImage(image, 0, 0, plan.w, plan.h);
    const [px, py] = plan.projeter(plan.point[0], plan.point[1], plan.point[2]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#f0b429";
    ctx.beginPath(); ctx.arc(px, py, 21, 0, Math.PI * 2); ctx.stroke();
    plan.url = cible.toDataURL("image/png");
    plan.pret = true;
    if (fichePlanLegendeEl && quand === "ouverture") fichePlanLegendeEl.textContent = "Plan du niveau, zone du conflit entourée";
    if (apres) apres();
  };
  image.src = plan.url;
}
function majPlanCollision() {
  const clash = collisionActiveClash;
  if (!fichePlanBlocEl || !clash || clash.factice || !collisionDiscussion.classList.contains("cb-grand")) return;
  fichePlanLegendeEl.textContent = "Génération du plan…";
  setTimeout(() => {
    if (collisionActiveClash !== clash) return;
    let plan = null;
    try {
      plan = genererPlanCollision(clash);
    } catch (e) {
      console.warn("[collision] plan impossible : " + e.message);
    }
    if (!plan) {
      fichePlanLegendeEl.textContent = "Plan indisponible pour cette collision";
      return;
    }
    if (plan.pret) {
      const img = new Image();
      img.onload = () => {
        fichePlanCanvasEl.width = plan.w; fichePlanCanvasEl.height = plan.h;
        fichePlanCanvasEl.getContext("2d").drawImage(img, 0, 0);
        fichePlanLegendeEl.textContent = "Plan du niveau, zone du conflit entourée";
      };
      img.src = plan.url;
    } else {
      composerPlanCollision(clash, plan, fichePlanCanvasEl, "ouverture");
    }
  }, 60);
}

// Passage anime au pleine page (20/10) : en pleine page le bandeau est en position absolue sur toute la zone de la 3D.
// L'animation fait glisser son bord haut (WAAPI sur "top") entre la place du bandeau et le haut de la zone, 0,28 s, comme
// le depliement du bandeau : le contenu se reorganise a chaque image. A la fermeture, les classes ne changent qu'a la fin.
let grandEnAnimation = false;
// Au relachement le doigt s'arrete avant que l'animation ne demarre : sans avance, la premiere image peinte apres le relachement est
// immobile (plateau d'une image mesure : position identique a l'image precedente). Les animations de fermeture au doigt partent donc a 16 ms.
const AVANCE_RELACHEMENT = 16;
let progressionDoigtGrand = 0; // avancement (0 a 1) de la fermeture au doigt de la pleine page, consomme une fois par basculerGrandAnime
let decalageDoigtGrand = 0; // decalage (px) de la fiche au doigt au moment du relachement : sert a garder le bouton « Message » fixe a l'ecran
let suiviBoutonGrand = null; // { parcours, delta } : course de la fiche et du bouton « Collisions » pendant la fermeture au doigt de la pleine page
let glisseGrandPrise = false; // vrai quand basculerGrandAnime a pris en charge le decalage du doigt (animation de `top`), le crochet de relachement ne resorbe alors plus rien
let easingGlisseGrand = null; // courbe de la fermeture au glissement (mobile), consommee une fois par basculerGrandAnime
function classesEchangesGrand(actif, etaitReplie, recaler = true) {
  collisionDiscussion.classList.toggle("cb-grand", actif);
  collisionDiscussion.classList.toggle("collapsed", actif ? false : etaitReplie);
  // La 3D change de taille (photo a gauche / pleine zone) : le canvas doit se recaler.
  if (recaler) requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}
// Mobile : la pleine page est un calque au-dessus de la 3D, qui ne doit jamais bouger. On fige la hauteur de la zone 3D pendant tout
// le temps de la pleine page (sinon le bandeau sort du flux et le canvas passe de ~430 a ~730 px a l'ouverture, puis revient a la
// fermeture) ; la hauteur figee est celle d'avant l'ouverture, donc identique a celle d'apres la fermeture.
function figerZone3dMobile() {
  const slot = collisionViewerSlot;
  if (!window.matchMedia(REQUETE_MOBILE).matches || slot.dataset.fige) return;
  const h = slot.getBoundingClientRect().height;
  // Hauteur du bandeau sous la photo : le bouton « Collisions » s'en sert pour rejoindre la ligne du bouton « Message » (style.css, 22/10).
  collisionLeft.style.setProperty("--bas-fiche", (collisionLeft.getBoundingClientRect().bottom - slot.getBoundingClientRect().bottom) + "px");
  slot.style.flex = "none";
  slot.style.minHeight = "0";
  slot.style.boxSizing = "border-box";
  slot.style.height = h + "px";
  slot.dataset.fige = "1";
}
function liberer3dMobile() {
  const slot = collisionViewerSlot;
  if (!slot.dataset.fige) return;
  collisionLeft.style.removeProperty("--bas-fiche");
  slot.style.flex = "";
  slot.style.minHeight = "";
  slot.style.boxSizing = "";
  slot.style.height = "";
  delete slot.dataset.fige;
}
// Deplacement fluide des elements du bandeau (titre, bouton agrandir, gelules Priorite/Statut) entre leur place dans le
// bandeau et leur place en pleine page (laptop, 20/10) : chaque element glisse (et la gelule change de largeur) au lieu de sauter.
// Les positions sont celles de la fenetre ; le bloc lui-meme se deplace pendant l'animation (decalage), on le compense.
function elementsBandeauGrand() {
  return [collisionDiscussionTitle, echangesGrandBtn, ...collisionDiscussion.querySelectorAll(".collision-controle")].filter(Boolean);
}
function mesurerBandeauGrand() {
  return new Map(elementsBandeauGrand().map((e) => [e, e.getBoundingClientRect()]));
}
function jouerDeplacements(init, fin, layout, decalInit, decalFin, options) {
  layout.forEach((l, e) => {
    const a = init.get(e);
    const b = fin.get(e);
    if (!a || !b) return;
    const frame = (r, decal) => {
      const f = { transform: "translate(" + (r.left - l.left) + "px," + (r.top - (l.top + decal)) + "px)" };
      if (e.classList.contains("collision-controle")) f.width = r.width + "px";
      return f;
    };
    e.animate([frame(a, decalInit), frame(b, decalFin)], options);
  });
}
// Bouton « Message » (mobile) : sa largeur change avec la classe cb-grand (203 px en pleine page, largeur du bandeau sinon) ; elle est pilotee
// en px (doigt puis animation) pour ne pas sauter (22/10). Largeur « bandeau » mesuree bandeau ouvert, meme si le bandeau est replie ensuite.
function largeurMessageBandeau() {
  const b = messageOuvrirBtn;
  if (!b || b.hidden) return null;
  const el = collisionDiscussion;
  const grand = el.classList.contains("cb-grand"), replie = el.classList.contains("collapsed");
  el.classList.remove("cb-grand", "collapsed");
  const w = b.getBoundingClientRect();
  el.classList.toggle("cb-grand", grand);
  el.classList.toggle("collapsed", replie);
  return w;
}
function basculerGrandAnime(actif, etaitReplie) {
  const el = collisionDiscussion;
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const visible = el.offsetParent !== null;
  const mobile = window.matchMedia(REQUETE_MOBILE).matches;
  const btnCollisions = mobile ? collisionInfoPanelToggle : null;
  const btnMessage = mobile && messageOuvrirBtn && !messageOuvrirBtn.hidden ? messageOuvrirBtn : null;
  if (messageOuvrirBtn) { messageOuvrirBtn.style.width = ""; messageOuvrirBtn.style.transform = ""; } // le suivi du doigt laisse la main a l'animation
  const avancement = progressionDoigtGrand;
  const decalDoigt = decalageDoigtGrand;
  progressionDoigtGrand = 0;
  decalageDoigtGrand = 0;
  suiviBoutonGrand = null;
  if (btnCollisions) { btnCollisions.style.transform = ""; btnCollisions.style.height = ""; } // le suivi du doigt (pleine page) laisse la main a l'animation
  if (actif) figerZone3dMobile();
  if (grandEnAnimation || reduit || !visible) { classesEchangesGrand(actif, etaitReplie); if (!actif) liberer3dMobile(); return; }
  const options = { duration: 280, easing: (!actif && easingGlisseGrand) || "ease" };
  const glisse = !actif && !!easingGlisseGrand; // fermeture au doigt : le mouvement part avec 1 image d'avance (cf AVANCE_RELACHEMENT)
  easingGlisseGrand = null;
  // Laptop : la 3D (#collisionViewerSlot) se reduit en meme temps jusqu'a sa place de photo, en haut a gauche.
  const laptop = window.matchMedia("(min-width: 769px)").matches;
  const slot = collisionViewerSlot;
  const relatif = () => {
    const base = collisionLeft.getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    return { left: (r.left - base.left) + "px", top: (r.top - base.top) + "px", width: r.width + "px", height: r.height + "px" };
  };
  if (actif) {
    const r0 = el.getBoundingClientRect();
    const s0 = relatif();
    const m0 = laptop ? mesurerBandeauGrand() : null;
    const b0 = btnCollisions && btnCollisions.getBoundingClientRect();
    const mr0 = btnMessage ? btnMessage.getBoundingClientRect() : null;
    classesEchangesGrand(true, etaitReplie);
    const b1 = btnCollisions && btnCollisions.getBoundingClientRect();
    const mr1 = btnMessage ? btnMessage.getBoundingClientRect() : null;
    const r1 = el.getBoundingClientRect();
    const s1 = relatif();
    const m1 = laptop ? mesurerBandeauGrand() : null;
    const decalage = r0.top - r1.top;
    if (decalage <= 0) return;
    grandEnAnimation = true;
    if (laptop) {
      slot.animate([s0, s1], options);
      jouerDeplacements(m0, m1, m1, decalage, 0, options);
    }
    // Mobile : le bouton « Collisions » glisse de sa place sous la photo jusqu'a la ligne du bouton « Message » (translation, jamais de saut).
    if (btnCollisions) btnCollisions.animate([{ transform: "translateY(" + (b0.top - b1.top) + "px)", height: b0.height + "px" }, { transform: "translateY(0px)", height: b1.height + "px" }], options);
    if (mr0 && mr1 && mr0.width > 0 && mr1.width > 0) btnMessage.animate([{ width: mr0.width + "px", transform: "translateX(" + (mr0.left - mr1.left) + "px)" }, { width: mr1.width + "px", transform: "translateX(0px)" }], options); // largeur et abscisse du bandeau -> pleine page
    const anim = el.animate([{ top: decalage + "px" }, { top: "0px" }], options);
    anim.onfinish = anim.oncancel = () => { grandEnAnimation = false; window.dispatchEvent(new Event("resize")); };
  } else {
    const r1 = el.getBoundingClientRect();
    const sPhoto = relatif();
    const mGrand = laptop ? mesurerBandeauGrand() : null;
    const bGrand = btnCollisions && btnCollisions.getBoundingClientRect();
    const mrGrand = btnMessage ? btnMessage.getBoundingClientRect() : null;
    const mrNormal = btnMessage && !etaitReplie ? largeurMessageBandeau() : null; // retour au bandeau replie : le bouton sort de l'ecran avec la fiche puis disparait, largeur laissee telle quelle (evite un chevauchement avec « Collisions »)
    classesEchangesGrand(false, etaitReplie, !mobile);
    const r0 = el.getBoundingClientRect();
    const sNormal = relatif();
    const mNormal = laptop ? mesurerBandeauGrand() : null;
    const bNormal = btnCollisions && btnCollisions.getBoundingClientRect();
    classesEchangesGrand(true, etaitReplie, !mobile);
    const decalage = r0.top - r1.top;
    if (decalage <= 0) { classesEchangesGrand(false, etaitReplie); liberer3dMobile(); return; }
    grandEnAnimation = true;
    if (laptop) {
      slot.animate([sPhoto, sNormal], options);
      jouerDeplacements(mGrand, mNormal, mGrand, 0, decalage, options);
    }
    // Fermeture au doigt (mobile) : la fiche est ancree par le bas (inset: 0), seul `top` bouge. Le decalage du doigt est donc repris directement
    // dans `top` (de decalDoigt a decalage) au lieu d'une resorption de `transform` en sens inverse : le bouton « Message », colle au bas de la fiche,
    // ne depend plus de deux animations qui s'annulent (au flick, courbe tres raide, le moindre ecart de phase entre elles faisait balancer le bouton).
    // Si le doigt a depasse la course de la fiche (decalDoigt > decalage), repli sur l'ancien chemin (resorption + compensation).
    const prise = mobile && glisse && decalDoigt > 0 && decalDoigt <= decalage;
    glisseGrandPrise = prise;
    const anim = el.animate([{ top: (prise ? decalDoigt : 0) + "px" }, { top: decalage + "px" }], options);
    if (glisse) anim.currentTime = AVANCE_RELACHEMENT;
    // Mobile : le bouton « Message » passe de sa largeur de pleine page a celle du bandeau en continu (depart a l'avancement du doigt).
    if (mrGrand && mrNormal && mrGrand.width > 0 && mrNormal.width > 0) {
      const dl = mrNormal.left - mrGrand.left;
      // Le bouton est colle au bas de la fiche : la fermeture ne le deplace pas (la fiche se raccourcit par le haut, `top`), seul le decalage du doigt
      // (decalDoigt, resorbe vers 0 pendant l'animation) l'entraine. On le compense pour qu'il reste fixe a l'ecran, et on ne garde que l'ecart
      // reel entre ses deux positions (dv), parcouru en continu avec la meme courbe.
      const dv = mrNormal.top - mrGrand.top;
      const animMsg = btnMessage.animate([{ width: (mrGrand.width + avancement * (mrNormal.width - mrGrand.width)) + "px", transform: "translate(" + avancement * dl + "px," + (avancement * dv - (prise ? 0 : decalDoigt)) + "px)" }, { width: mrNormal.width + "px", transform: "translate(" + dl + "px," + dv + "px)" }], options);
      if (glisse) animMsg.currentTime = AVANCE_RELACHEMENT;
    }
    // Mobile : le bouton « Collisions » part de l'avancement de la fiche (meme proportion de sa course) puis rejoint sa place sous la photo, meme duree et meme courbe.
    if (btnCollisions) {
      const animBtn = btnCollisions.animate([{ transform: "translateY(" + avancement * (bNormal.top - bGrand.top) + "px)", height: (bGrand.height + avancement * (bNormal.height - bGrand.height)) + "px" }, { transform: "translateY(" + (bNormal.top - bGrand.top) + "px)", height: bNormal.height + "px" }], options);
      if (glisse) animBtn.currentTime = AVANCE_RELACHEMENT;
    }
    anim.onfinish = anim.oncancel = () => {
      classesEchangesGrand(false, etaitReplie);
      liberer3dMobile();
      grandEnAnimation = false;
      window.dispatchEvent(new Event("resize"));
    };
  }
}

// Fermeture au doigt de la pleine page (mobile) : le bouton « Collisions » avance vers sa place sous la photo dans la meme proportion que la fiche
// (sens constant, pas d'aller-retour au relachement : la fiche descend, le bouton remonte vers la photo).
function preparerSuiviBoutonGrand() {
  const btn = collisionInfoPanelToggle;
  const avant = btn.getBoundingClientRect();
  collisionDiscussion.classList.remove("cb-grand");
  const apres = btn.getBoundingClientRect();
  collisionDiscussion.classList.add("cb-grand");
  const mw0 = messageOuvrirBtn && !messageOuvrirBtn.hidden ? messageOuvrirBtn.getBoundingClientRect() : null;
  const mw1 = mw0 && mw0.width > 0 && !echangesGrandEtaitReplie ? largeurMessageBandeau() : null;
  suiviBoutonGrand = { parcours: Math.max(1, collisionViewerSlot.getBoundingClientRect().height), delta: apres.top - avant.top, h0: avant.height, h1: apres.height, mw0: mw0 ? mw0.width : 0, mw1: mw1 ? mw1.width : 0, dl: mw1 && mw0 ? mw1.left - mw0.left : 0, dv: mw1 && mw0 ? mw1.top - mw0.top : 0 };
}
function suivreBoutonGrand(dy) {
  const f = suiviBoutonGrand;
  if (!f) return;
  progressionDoigtGrand = Math.min(1, Math.max(0, dy / f.parcours));
  decalageDoigtGrand = dy;
  collisionInfoPanelToggle.style.transform = "translateY(" + progressionDoigtGrand * f.delta + "px)";
  if (f.mw0 > 0 && f.mw1 > 0) {
    messageOuvrirBtn.style.width = (f.mw0 + progressionDoigtGrand * (f.mw1 - f.mw0)) + "px";
    messageOuvrirBtn.style.transform = "translate(" + progressionDoigtGrand * f.dl + "px," + (progressionDoigtGrand * f.dv - dy) + "px)"; // - dy : annule la descente de la fiche, le bouton reste fixe a l'ecran
  }
  collisionInfoPanelToggle.style.height = (f.h0 + progressionDoigtGrand * (f.h1 - f.h0)) + "px"; // 44 px en pleine page, hauteur normale sous la photo
}

function ouvrirEchangesGrand() {
  if (!echangesGrandBtn || echangesGrandOuvert || !collisionDiscussion.classList.contains("cb")) return;
  echangesGrandOuvert = true;
  echangesGrandEtaitReplie = collisionDiscussion.classList.contains("collapsed");
  // Le plan est rendu AVANT l'animation : la 3D est alors encore grande (apres, elle n'est plus qu'une photo de 250 px et le plan
  // sortirait en basse resolution). Mis en cache par collision.
  if (collisionActiveClash && !collisionActiveClash.factice && window.matchMedia("(min-width: 769px)").matches) {
    try {
      genererPlanCollision(collisionActiveClash);
    } catch (e) {
      console.warn("[collision] plan impossible : " + e.message);
    }
  }
  basculerGrandAnime(true, echangesGrandEtaitReplie);
  majInfosCollision(collisionActiveClash);
  setTimeout(majPlanCollision, 400); // apres l'animation d'ouverture, pour ne pas la saccader
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
  fermerFicheElementCollision();
  echangesGrandOuvert = false;
  basculerGrandAnime(false, echangesGrandEtaitReplie);
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
  // Pleine page : un clic sur la photo de la 3D ramene a la vue normale.
  collisionViewerSlot.addEventListener("click", (e) => {
    if (!echangesGrandOuvert || window.matchMedia(REQUETE_MOBILE).matches) return;
    e.stopPropagation();
    if (clicQuiAFermeLaCarte === e) return; // ce clic vient de fermer la carte d'infos : on reste en pleine page
    fermerEchangesGrand(true);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !echangesGrandOuvert) return;
    if (ficheElementEl && !ficheElementEl.hidden) { fermerFicheElementCollision(); return; }
    if (e.target instanceof HTMLSelectElement) return;
    fermerEchangesGrand(true);
  });
})();

// Laptop (22/10) : defiler au bord de la liste des echanges change l'etat du bandeau, avec les fonctions existantes (animations inchangees).
// Ouvert : bas -> pleine page (ouvrirEchangesGrand), haut -> replie (basculerBandeauAnime) ; pleine page : haut -> ferme (fermerEchangesGrand),
// qui revient a l'etat d'origine memorise a l'ouverture (echangesGrandEtaitReplie). Le conteneur defilant est #discussionMessages (les filtres
// Tout / Commentaires / Modifications ne font que le re-remplir). Ecouteur pose seulement hors mobile (pointeur fin), jamais sur le tactile.
(function initDefilementBordBandeau() {
  if (!COLLISION_ECHANGES_GRAND || !COLLISION_BANDEAU) return;
  const PAUSE_GESTE = 150; // ms sans wheel : le geste suivant est un nouveau geste (l'inertie d'un geste precedent n'en est pas un)
  const SEUIL_CUMUL = 60; // px de deltaY cumules au bord, depuis un geste ayant commence au bord
  const VERROU_APRES = 400; // ms de verrou apres la fin de l'animation (inertie du pave)
  const mq = window.matchMedia("(min-width: 769px) and (pointer: fine)");
  let dernier = 0, sens = 0, arme = false, cumul = 0, verrouJusqua = 0;
  const auBord = (sensGeste) => {
    const el = discussionMessages;
    return sensGeste > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1 : el.scrollTop <= 0;
  };
  // Element defilant interne (hors #discussionMessages) qui peut encore defiler dans ce sens : il garde la molette.
  const defilableInterne = (cible, sensGeste) => {
    for (let n = cible; n && n !== discussionMessages; n = n.parentElement) {
      if (!(n instanceof HTMLElement)) continue;
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) {
        if (sensGeste > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
      }
    }
    return false;
  };
  const surWheel = (e) => {
    const maintenant = performance.now();
    const nouveauGeste = maintenant - dernier > PAUSE_GESTE;
    dernier = maintenant; // mis a jour a chaque evenement, meme ignore : l'inertie garde le geste "en cours"
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? discussionMessages.clientHeight : 1);
    if (Math.abs(px) < Math.abs(e.deltaX) || px === 0) return;
    const s = px > 0 ? 1 : -1;
    if (nouveauGeste || s !== sens) {
      sens = s;
      cumul = 0;
      arme = nouveauGeste && auBord(s); // le geste doit COMMENCER au bord ; un changement de sens en cours de geste ne l'arme pas
    }
    const actif = collisionDiscussion.classList.contains("cb") && !collisionDiscussion.hidden && !collisionDiscussion.classList.contains("collapsed");
    if (!actif || grandEnAnimation || bandeauEnAnimation || maintenant < verrouJusqua || document.querySelector(".collision-menu") || defilableInterne(e.target, s)) { arme = false; return; }
    if (!arme || !auBord(s)) { arme = false; return; }
    e.preventDefault(); // geste consomme
    cumul += Math.abs(px);
    if (cumul < SEUIL_CUMUL) return;
    arme = false;
    cumul = 0;
    verrouJusqua = maintenant + 300 + VERROU_APRES;
    if (echangesGrandOuvert) {
      if (s < 0) fermerEchangesGrand(false);
    } else if (s > 0) {
      ouvrirEchangesGrand();
    } else {
      basculerBandeauAnime(true);
    }
  };
  const maj = () => {
    if (mq.matches) discussionMessages.addEventListener("wheel", surWheel, { passive: false });
    else discussionMessages.removeEventListener("wheel", surWheel);
  };
  maj();
  mq.addEventListener("change", maj);
})();

discussionReplyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const texte = discussionReplyInput.value.trim();
  if (!texte || !currentDiscussionThread) return;

  currentDiscussionThread.discussion.push(COLLISION_PRIORITES ? { auteur: "Vous", texte, quand: new Date().toISOString() } : { auteur: "Vous", texte });
  renderDiscussionMessages(currentDiscussionThread);
  if (discussionMessages.lastElementChild) discussionMessages.lastElementChild.classList.add("apparition");
  discussionReplyInput.value = "";
  fermerMessage();
});

// Instruction BE -> Projeteur (portee depuis IES le 16/09) : copie le
// contexte 3D du fil source (meme mecanisme que "Nouvelle discussion",
// captureViewerState) dans un nouveau fil dedie a 2, plutot que d'ajouter le
// Projeteur au fil existant (qui reste multi-metiers). Le fil source garde
// une trace (assignedTo) pour que le Responsable Synthese sache que c'est
// desormais gere par le BE, sans avoir a suivre le fil dedie lui-meme.
function creerInstruction() {
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
    discussion: [{ auteur: "Vous (Bureau d'études)", texte: "Instruction issue du fil « " + source.zone + " » : à traiter.", quand: new Date().toISOString() }]
  };
  DISCUSSIONS.push(thread);
  source.assignedTo = "Bureau d'études";

  renderDiscussionsPage();
  renderProjeteurList();
  openThreadDetail(thread);
}
createInstructionBtn.addEventListener("click", creerInstruction);
filInstructionBtn.addEventListener("click", creerInstruction);

// Titre du couple courant (20/10) : un clic ouvre le menu des couples de maquettes (sans quitter la liste des collisions).
function fermerMenuCouples() {
  collisionCouplesMenu.hidden = true;
  collisionListTitle.setAttribute("aria-expanded", "false");
}
collisionListTitle.addEventListener("click", (e) => {
  e.stopPropagation();
  const ouvrir = collisionCouplesMenu.hidden;
  collisionCouplesMenu.hidden = !ouvrir;
  collisionListTitle.setAttribute("aria-expanded", String(ouvrir));
  if (ouvrir) animerEntreeListe(collisionCouplesMenu);
});
collisionCouplesMenu.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", fermerMenuCouples);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerMenuCouples(); });
// Le titre tient toujours sur une ligne : la police diminue jusqu'a ce que le texte rentre (drawer de 260 px sur ordinateur).
function ajusterTitreCollision() {
  if (collisionListTitle.hidden || !collisionListTitleText.clientWidth) return;
  let taille = 18;
  collisionListTitleText.style.fontSize = taille + "px";
  while (collisionListTitleText.scrollWidth > collisionListTitleText.clientWidth && taille > 9) {
    taille -= 0.5;
    collisionListTitleText.style.fontSize = taille + "px";
  }
}
new ResizeObserver(ajusterTitreCollision).observe(collisionListTitle);

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

// Fermeture des tiroirs mobiles (feuilles du bas) par glissement du doigt vers le bas (21/10). Partage entre "Afficher"
// et "Collisions" : le tiroir suit le doigt seulement si tout contenu defilable sous le doigt est en haut ; au
// relachement, on ferme via la fermeture existante (celle de la croix) si le geste est assez long ou rapide.
function enableDrawerSwipeToClose(drawer, closeFn, isOpen = () => drawer.classList.contains("open"), ignoreSel = 'input[type="range"]', swipeUpFn = null, hooks = null) {
  const mobile = window.matchMedia(REQUETE_MOBILE);
  let startX = 0, startY = 0, startT = 0, dy = 0, tracking = false, dragging = false, scrollers = [], upOk = false, up = 0, replie = false, upFn = swipeUpFn;
  const scrollersFrom = (el) => {
    const list = [];
    for (let n = el; n && n !== drawer.parentElement; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) list.push(n);
      if (n === drawer) break;
    }
    return list;
  };
  drawer.addEventListener("touchstart", (e) => {
    tracking = dragging = false;
    // Tiroir replie (hooks.replie) : seul un glissement vers le haut est suivi, il appelle hooks.ouvrirReplie.
    replie = !!(hooks && hooks.replie && hooks.replie());
    upFn = replie ? hooks.ouvrirReplie : swipeUpFn;
    if (!mobile.matches || e.touches.length !== 1 || !(replie || isOpen())) return;
    if (e.target.closest && e.target.closest(ignoreSel)) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; startT = e.timeStamp; dy = 0;
    scrollers = scrollersFrom(e.target);
    // Glissement vers le haut (pleine page) : par defaut seulement si rien ne defile sous le doigt ; hooks.hautPartout() (bandeau
    // ouvert, hors pleine page) l'autorise depuis n'importe ou, zone d'echanges et historique compris (22/10).
    const hautPartout = !!(hooks && hooks.hautPartout && hooks.hautPartout());
    upOk = !!upFn && (hautPartout || (scrollers.length === 0 && !(e.target.closest && e.target.closest("#discussionMessages"))));
    up = 0;
    tracking = true;
  }, { passive: true });
  drawer.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const mx = t.clientX - startX, my = t.clientY - startY;
    if (!dragging) {
      if (Math.abs(mx) > Math.abs(my) && Math.abs(mx) > 8) { tracking = false; return; }
      // Geste vers le haut autorise : on bloque le defilement natif des les premiers pixels (sinon la zone d'echanges defile avant le seuil).
      if (upOk && my < 0 && e.cancelable) e.preventDefault();
      if (my < -8) {
        if (!upOk) { tracking = false; return; }
        up = -my;
        if (e.cancelable) e.preventDefault();
        return;
      }
      up = 0;
      if (my <= 8) return;
      if (replie) { tracking = false; return; }
      if (scrollers.some((s) => s.scrollTop > 0)) { tracking = false; return; }
      dragging = true;
      drawer.style.transition = "none";
      if (hooks && hooks.debut) hooks.debut();
    }
    dy = Math.max(0, my);
    drawer.style.transform = "translateY(" + dy + "px)";
    if (hooks && hooks.suit) hooks.suit(dy);
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  let easingResorption = "ease";
  const finish = (e) => {
    if (!dragging) {
      const monte = tracking && upOk && up > 0 && e.type === "touchend";
      const dtUp = Math.max(1, e.timeStamp - startT);
      const faitUp = monte && ((up > 30 && up / dtUp > 0.5) || up > 80 || (replie ? up > 40 : up > drawer.clientHeight * 0.25));
      tracking = false; up = 0;
      if (faitUp) upFn();
      return;
    }
    tracking = dragging = false;
    const dt = Math.max(1, e.timeStamp - startT);
    const fast = dy > 30 && dy / dt > 0.5;
    const far = dy > 80 || dy > drawer.clientHeight * 0.25;
    drawer.style.transition = "";
    drawer.style.transform = "";
    if (!(fast || far) && hooks && hooks.annule) hooks.annule();
    if (fast || far) {
      const retour = closeFn(dy, dy / dt);
      if (retour === true) return; // la fermeture anime elle-meme a partir du decalage du doigt
      easingResorption = typeof retour === "string" ? retour : "ease";
      // Continuite : sans cela le panneau revient d'un coup a sa place avant de fermer (saut). Le decalage du doigt
      // se resorbe pendant la fermeture, avec la meme duree et la meme courbe, en s'ajoutant au mouvement de fermeture.
      // Tiroirs : la transition CSS de fermeture part deja de la position du doigt (dernier style calcule). Y ajouter le decalage
      // le comptait deux fois (saut de la valeur du decalage au relachement, mesure du 21/10) : on ne le resorbe qu'en l'absence de transition.
      if (drawer.getAnimations().some((an) => an.transitionProperty === "transform")) return;
      const d = parseFloat(getComputedStyle(drawer).transitionDuration) * 1000;
      const resorption = drawer.animate(
        [{ transform: "translateY(" + dy + "px)" }, { transform: "translateY(0px)" }],
        { duration: d > 0 ? d : 280, easing: easingResorption, composite: "add" }
      );
      if (easingResorption !== "ease") resorption.currentTime = AVANCE_RELACHEMENT; // meme avance que l'animation de fermeture (pleine page)
    }
  };
  drawer.addEventListener("touchend", finish, { passive: true });
  drawer.addEventListener("touchcancel", finish, { passive: true });
}
enableDrawerSwipeToClose(infoPanel, closeInfoPanelDrawer);
enableDrawerSwipeToClose(collisionInfoPanel, closeCollisionInfoPanelDrawer);
// Bandeau de collision (mobile) : grand ecran -> fermeture de la pleine page ; ouvert en partie -> repli.
enableDrawerSwipeToClose(
  collisionDiscussion,
  (dy, vitesse) => {
    if (echangesGrandOuvert) {
      // Pleine page : meme mouvement que la croix, mais la courbe demarre a la vitesse du doigt (pas de ralenti au relachement).
      const reste = Math.max(1, collisionViewerSlot.offsetHeight - dy);
      const pente = Math.min(3.3, Math.max(0.5, (vitesse || 0) * 280 / reste));
      const courbe = "cubic-bezier(0.3," + (pente * 0.3).toFixed(3) + ",0.5,1)";
      easingGlisseGrand = courbe;
      suivreBoutonGrand(dy);
      glisseGrandPrise = false;
      fermerEchangesGrand(false);
      return glisseGrandPrise ? true : courbe; // true : le decalage du doigt est deja repris par l'animation de `top` (basculerGrandAnime)
    }
    return animerFermetureBandeau(dy, vitesse);
  },
  () => !collisionDiscussion.hidden && collisionDiscussion.classList.contains("cb") && !collisionDiscussion.classList.contains("collapsed") && !bandeauEnAnimation,
  'input[type="range"], select, textarea, input',
  () => { if (!echangesGrandOuvert) ouvrirEchangesGrand(); },
  {
    debut: () => { if (echangesGrandOuvert) preparerSuiviBoutonGrand(); else preparerFermetureBandeau(); },
    // Pleine page : le bouton « Collisions » avance avec la fiche (22/10) ; bandeau ouvert : il suit le bord haut du bandeau qui descend.
    suit: (dy) => { if (echangesGrandOuvert) suivreBoutonGrand(dy); else suivreFermetureBandeau(dy); },
    annule: () => { suiviBoutonGrand = null; progressionDoigtGrand = 0; decalageDoigtGrand = 0; collisionInfoPanelToggle.style.transform = ""; collisionInfoPanelToggle.style.height = ""; if (messageOuvrirBtn) { messageOuvrirBtn.style.width = ""; messageOuvrirBtn.style.transform = ""; } annulerFermetureBandeau(); },
    // Bandeau replie : un glissement vers le haut l'ouvre (comme un appui sur la fleche) ; un second, depuis le bandeau ouvert, le passe en pleine page (swipeUpFn).
    hautPartout: () => !echangesGrandOuvert && !grandEnAnimation,
    replie: () => !collisionDiscussion.hidden && collisionDiscussion.classList.contains("cb") && collisionDiscussion.classList.contains("collapsed") && !bandeauEnAnimation && !echangesGrandOuvert && !grandEnAnimation,
    ouvrirReplie: () => collisionDiscussionToggle.click()
  }
);

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
// Ecriture GROUPEE des drapeaux de visibilite (20/10). Mesure (profil CPU Brave) : pour chaque objet dont la visibilite change, xeokit
// fait un gl.bufferSubData ; 14 000 appels pour l'Architecture, dont la file attend 5 a 9 s dans le processus graphique (images
// qui saccadent, fil principal gele des qu'un appel synchrone suit). Ici, pendant `changer`, l'ecriture graphique de chaque couche
// est coupee (les compteurs internes de xeokit sont mis a jour normalement), puis les drapeaux de toutes les parties des modeles
// touches sont ecrits en memoire et envoyes en UN envoi par couche (chemin "differe" que xeokit n'utilise qu'au chargement).
// S'appuie sur des champs internes de xeokit (layer._setFlags, mesh.portionId, entity._flags) : si l'un manque, repli sur la
// methode normale (objet par objet), plus lente mais correcte.
function ecritureGroupeeDrapeaux(modeles, changer) {
  const couches = new Set();
  modeles.forEach((m) => (m.layerList || []).forEach((l) => couches.add(l)));
  const compatible = modeles.length > 0 && [...couches].every((l) => typeof l._setFlags === "function" && typeof l.flushInitFlags === "function") &&
    modeles.every((m) => m.entityList.every((e) => e.meshes && e._flags !== undefined && e.meshes.every((me) => me.layer && me.portionId !== undefined)));
  if (!compatible) {
    changer();
    return;
  }
  const originaux = new Map();
  couches.forEach((l) => { originaux.set(l, l._setFlags); l._setFlags = () => {}; });
  try {
    changer();
  } finally {
    couches.forEach((l) => { l._setFlags = originaux.get(l); });
  }
  modeles.forEach((m) => m.entityList.forEach((e) => e.meshes.forEach((me) => {
    if (couches.has(me.layer)) me.layer._setFlags(me.portionId, e._flags, me._transparent, true);
  })));
  couches.forEach((l) => l.flushInitFlags());
  viewer.scene.glRedraw();
}

let dissolutionActive = null;
const DISSOLUTION_DUREE = 350;
const DISSOLUTION_BUDGET_MS = 9;
function melanger(tableau) {
  for (let i = tableau.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = tableau[i]; tableau[i] = tableau[j]; tableau[j] = t;
  }
  return tableau;
}
function changerVisibiliteAvecFondu(etats, apres) {
  if (dissolutionActive) dissolutionActive.annuler();
  const appliquerFinal = () => {
    MAQUETTES.forEach((m) => { if (etats.has(m.id)) m.shown = etats.get(m.id); });
    applyVisibility();
    if (apres) apres();
  };
  const animer = window.matchMedia("(min-width: 769px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Objets dont l'etat reel differe de l'etat voulu (les garde-corps mal places restent masques, cf applyVisibility).
  const aChanger = [];
  MAQUETTES.forEach((m) => {
    if (!m.model || !etats.has(m.id)) return;
    const veut = etats.get(m.id);
    m.model.entityList.forEach((entite) => {
      if (entite.visible === veut) return;
      if (veut && HOSPITAL_MISPLACED_RAILING_IDS.includes(entite.id)) return;
      aChanger.push([entite, veut]);
    });
  });
  if (!animer || aChanger.length === 0) {
    appliquerFinal();
    return;
  }
  melanger(aChanger);
  const modelesTouches = MAQUETTES.filter((m) => m.model && etats.has(m.id) && m.model.entityList.some((e) => e.visible !== etats.get(m.id))).map((m) => m.model);
  const debut = performance.now();
  let indice = 0;
  let annule = false;
  const etat = { annuler: () => { annule = true; dissolutionActive = null; } };
  dissolutionActive = etat;
  const pas = () => {
    if (annule) return;
    const t0 = performance.now();
    const voulu = Math.max(indice + 1, Math.ceil(Math.min(1, (t0 - debut) / DISSOLUTION_DUREE) * aChanger.length));
    const fin = Math.min(aChanger.length, voulu);
    // Un seul envoi graphique par couche et par image, quel que soit le nombre d'objets de ce paquet.
    ecritureGroupeeDrapeaux(modelesTouches, () => {
      for (; indice < fin; indice++) {
        const [entite, veut] = aChanger[indice];
        entite.visible = veut;
      }
    });
    if (indice < aChanger.length) requestAnimationFrame(pas);
    else {
      dissolutionActive = null;
      appliquerFinal();
    }
  };
  requestAnimationFrame(pas);
}

// Passage progressif du rendu fantome (X-ray) au rendu plein : les objets listes sont remis en fantome puis redeviennent pleins par
// paquets aleatoires, meme principe et meme duree que la dissolution des maquettes. apres : appelee a la fin. Annulable via dissolutionActive.
// Remet le materiau X-ray a sa valeur normale (apres le retrait progressif des fantomes).
function restaurerMateriauXrayApresDegel() {
  const mat = viewer.scene.xrayMaterial;
  const voulu = collisionXraySauvegarde || XRAY_MATERIAU_DEFAUT;
  mat.fillAlpha = voulu.fillAlpha;
  mat.edgeAlpha = voulu.edgeAlpha;
  mat.fillColor = voulu.fillColor;
  mat.edgeColor = voulu.edgeColor;
  collisionXraySauvegarde = null;
}
// xrayConserve : les objets sont encore en fantome (la remise a plat les a gardes), il n'y a donc rien a remettre en fantome avant de
// les retirer progressivement.
function degelerFantomesProgressivement(ids, apres, xrayConserve) {
  if (dissolutionActive) dissolutionActive.annuler();
  const entites = ids.map((id) => viewer.scene.objects[id]).filter(Boolean);
  const modeles = MAQUETTES.filter((maquette) => maquette.model).map((maquette) => maquette.model);
  const finir = () => {
    if (xrayConserve) restaurerMateriauXrayApresDegel();
    if (apres) apres();
  };
  if (entites.length === 0 || !window.matchMedia("(min-width: 769px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (xrayConserve && entites.length > 0) ecritureGroupeeDrapeaux(modeles, () => entites.forEach((entite) => { entite.xrayed = false; entite.pickable = true; }));
    finir();
    return;
  }
  if (!xrayConserve) ecritureGroupeeDrapeaux(modeles, () => entites.forEach((entite) => { entite.xrayed = true; }));
  melanger(entites);
  const debut = performance.now();
  let indice = 0;
  let annule = false;
  const etat = { annuler: () => { annule = true; dissolutionActive = null; } };
  dissolutionActive = etat;
  const pas = () => {
    if (annule) return;
    const voulu = Math.max(indice + 1, Math.ceil(Math.min(1, (performance.now() - debut) / DISSOLUTION_DUREE) * entites.length));
    const fin = Math.min(entites.length, voulu);
    ecritureGroupeeDrapeaux(modeles, () => {
      for (; indice < fin; indice++) {
        entites[indice].xrayed = false;
        entites[indice].pickable = true;
      }
    });
    if (indice < entites.length) requestAnimationFrame(pas);
    else {
      dissolutionActive = null;
      finir();
    }
  };
  requestAnimationFrame(pas);
}

// Applique d'un coup la visibilite voulue des maquettes (etats : id -> bool).
function definirMaquettesVisibles(etats) {
  if (dissolutionActive) dissolutionActive.annuler();
  MAQUETTES.forEach((m) => { if (etats.has(m.id)) m.shown = etats.get(m.id); });
  applyVisibility();
}

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
  // Vue a plat : une maquette cochee ou decochee recadre la vue sur celles qui sont presentes (pas pour un simple changement de niveau).
  if (vueAvantDessus && maquettesPresentes().map((m) => m.id).join(",") !== maquettesVueDessus) appliquerVueDessus();
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
  // La coupe de la page Discussions montre les niveaux du bâtiment : on la redessine dès qu'ils sont connus.
  renderDiscussionsPage();
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
downloadModalOverlay.addEventListener("click", (e) => {
  if (e.target === downloadModalOverlay) downloadModalOverlay.hidden = true;
});

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
  return window.matchMedia(REQUETE_MOBILE).matches;
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

// Lignes de la fiche "Info selection" d'un element (partagees entre le clic dans la 3D et le clic sur un element de la fiche de la
// collision en pleine page).
function rowsFicheEntite(entity) {
  const metaObject = viewer.metaScene.metaObjects[entity.id];
  const rows = [
    ["Nom", metaObject ? metaObject.name : entity.id],
    ["Type IFC", metaObject ? metaObject.type : "n/a"],
    ["Maquette", metaObject && metaObject.metaModels[0] ? labelForMaquette(metaObject.metaModels[0].id) : "n/a"],
    ["Niveau (IFC)", findNiveauIfc(entity.id) || "n/a"]
  ];
  return { rows, docs: DOCS_BY_ELEMENT[entity.id] || [] };
}

function showFiche(entity) {
  const { rows, docs } = rowsFicheEntite(entity);
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
      viewer.cameraFlight.flyTo(vueDepartCentree());
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
      // Toutes les maquettes sont chargees : la recolte automatique des vues 3D de la messagerie peut demarrer (serveur de dev seulement).
      if (import.meta.env.DEV) planifierRecolteAuto(1500);
      // Arrivee directe sur #collision : la detection unique s'ouvre une fois
      // les maquettes chargees.
      if (!document.getElementById("view-collision").hidden) {
        if (collisionDetail.hidden) ouvrirPageCollision();
        else if (detectionCourante) renderClashMarkers(CLASHES.filter((c) => c.detectionId === detectionCourante.id && !c.factice));
      }
      if (!CHARGEMENT_PROGRESSIF) {
        initialCameraState = getDefaultCameraState(projectKey);
        if (initialCameraState) {
          // duration 0 : la maquette apparait deja cadree, sans vol visible.
          viewer.cameraFlight.flyTo(Object.assign({}, vueDepartCentree(), { duration: 0 }));
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

    if (MAQUETTES[index].externe) { loadNextMaquette(index + 1); return; } // la maquette du plan 2D -> 3D se charge a part (voirPlanDansViewer)
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
      maquette.chargee = true;
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
  if (!document.getElementById("view-collision").hidden) ouvrirPageCollision();
}
// (20/10) Ne depend plus de CHARGEMENT_PROGRESSIF : sans web-ifc, c'est ce bloc qui lance le chargement.
if ((CHARGEMENT_SANS_ATTENDRE_WEBIFC || HOPITAL_SANS_WEBIFC) && projectSelect.value === HOSPITAL_PROJECT_KEY) {
  // Telechargement des XKT sans attendre web-ifc (WASM) : seul l'IFC en a besoin.
  xktLoader = new XKTLoaderPlugin(viewer);
  demarrerChargement();
}

// L'hopital n'utilise que des XKT : on n'initialise pas web-ifc (memoire du telephone).
if (!(HOPITAL_SANS_WEBIFC && projectSelect.value === HOSPITAL_PROJECT_KEY)) initialiserWebIfc().then(() => {
  ifcLoader = new WebIFCLoaderPlugin(viewer, { WebIFC, IfcAPI });
  if (!xktLoader) xktLoader = new XKTLoaderPlugin(viewer);
  demarrerChargement();
  // Arrivee directe (rechargement) sur #collision : la liste des collisions
  // s'affiche tout de suite, sans attendre la fin du chargement des maquettes
  // (sinon la page de choix de la paire reste visible pendant le chargement).
  // Les bulles sont recreees a la fin du chargement (point de collision verifie).
  if (!document.getElementById("view-collision").hidden) ouvrirPageCollision();
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

// Recolte des vues pour la messagerie (21/10, serveur de dev seulement) : http://localhost:5173/?vues=1. Le module n'existe pas dans la
// version construite (import.meta.env.DEV est faux, la branche est supprimee a la compilation).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("vues")) {
  import("./messagerie/recolteVues.js").then(({ installerRecolteVues }) => installerRecolteVues({
    nombre: 8,
    chargementTermine: () => loadingOverlay.classList.contains("hidden") && MAQUETTES.length > 0 && MAQUETTES.every((m) => m.model),
    collisions: () => CLASHES.filter((c) => c.detectionId === "hopital-arch-mep" && !c.factice),
    ouvrirPageCollision: () => {
      activateView("collision");
      openDetection(DETECTIONS.find((d) => d.id === "hopital-arch-mep"));
    },
    selectionner: (clash, surArrivee) => activateClash(clash, surArrivee),
    capturer: capturerVueJpeg,
    decrire: decrireClashPourVue
  }));
}
