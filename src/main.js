import { Viewer, WebIFCLoaderPlugin, XKTLoaderPlugin, SectionPlanesPlugin, Mesh, ReadableGeometry, PhongMaterial, buildSphereGeometry } from "@xeokit/xeokit-sdk";
import * as WebIFC from "web-ifc";

const loadingOverlay = document.getElementById("loadingOverlay");
const viewerCanvas = document.getElementById("viewerCanvas");
const niveauxList = document.getElementById("niveauxList");
const maquettesList = document.getElementById("maquettesList");
const fichePlaceholder = document.getElementById("fichePlaceholder");
const ficheContent = document.getElementById("ficheContent");
const recenterBtn = document.getElementById("recenterBtn");
const niveauxResetBtn = document.getElementById("niveauxResetBtn");
const maquettesResetBtn = document.getElementById("maquettesResetBtn");
const coupeToolbar = document.getElementById("coupeToolbar");
const coupeBtn = document.getElementById("coupeBtn");
const coupeToggleVisibilityBtn = document.getElementById("coupeToggleVisibilityBtn");
const coupeInvertBtn = document.getElementById("coupeInvertBtn");
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
const collisionsList = document.getElementById("collisionsList");
const collisionBackBtn = document.getElementById("collisionBackBtn");
const collisionInfoPanelToggle = document.getElementById("collisionInfoPanelToggle");
const collisionInfoPanelBackdrop = document.getElementById("collisionInfoPanelBackdrop");
const collisionInfoPanel = document.getElementById("collisionInfoPanel");
const discussionReplyForm = document.getElementById("discussionReplyForm");
const discussionReplyInput = document.getElementById("discussionReplyInput");
const discussionsThreadsList = document.getElementById("discussionsThreadsList");
const discussionsThreadsEmpty = document.getElementById("discussionsThreadsEmpty");
const discussionsListPane = document.getElementById("discussionsListPane");
const discussionsDetailPane = document.getElementById("discussionsDetailPane");
const collisionDiscussionTitle = document.getElementById("collisionDiscussionTitle");
const discussionsBackBtn = document.getElementById("discussionsBackBtn");
const threadSnapshotPane = document.getElementById("threadSnapshotPane");
const threadViewerPane = document.getElementById("threadViewerPane");
const threadToggleBtns = Array.from(document.querySelectorAll("#threadVisualToggle .thread-toggle-btn"));
const discussionsFilterBtns = Array.from(document.querySelectorAll("#discussionsTypeFilter .thread-toggle-btn"));
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

// Vue par defaut figee (05/09), valeurs relevees via la console DevTools sur
// une orientation validee par Gilles : plus fiable qu'un fit automatique sur
// la scene, qui peut legerement varier (angle par defaut de xeokit).
const DEFAULT_CAMERA_STATE = {
  eye: [1.3697083864615462, 16.764731675931436, 55.512816283417536],
  look: [30.30047599811991, -1.1681965485168886, -12.349389746978844],
  up: [0.09263274774816085, 0.971702521543951, -0.21728640930751625]
};

function activateView(viewName) {
  navLinks.forEach((l) => l.classList.toggle("active", l.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== "view-" + viewName;
  });
  if (viewName === "viewer") {
    viewViewer.insertBefore(viewerWrap, infoPanel);
    window.dispatchEvent(new Event("resize"));
    recenterTarget = null;
    newDiscussionBtn.hidden = false;
    coupeBtn.hidden = false;
    coupeToolbar.hidden = false;
  }
  try {
    localStorage.setItem("chantier-active-view", viewName);
  } catch (e) {
    // localStorage indisponible (navigation privee...), pas bloquant.
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
    // Revenir sur Viewer doit repartir d'un etat "neutre" et previsible :
    // equivalent a cliquer "Recentrer" (camera) et "Tout afficher" (niveaux,
    // les maquettes le sont deja via restoreAllModelsVisible ci-dessus).
    if (link.dataset.view === "viewer") {
      niveauxState.forEach((n) => {
        n.checked = true;
        if (n.checkboxEl) n.checkboxEl.checked = true;
      });
      applyVisibility();
      viewer.cameraFlight.flyTo(initialCameraState || DEFAULT_CAMERA_STATE);
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
document.addEventListener("click", (e) => {
  if (!navbarLinksEl.classList.contains("open")) return;
  if (navbarLinksEl.contains(e.target) || navbarToggle.contains(e.target)) return;
  navbarLinksEl.classList.remove("open");
});

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
const validViews = navLinks.map((l) => l.dataset.view).concat(["landing"]);

let savedView = "landing";
if (validViews.includes(hashView)) {
  savedView = hashView;
} else {
  try {
    savedView = localStorage.getItem("chantier-active-view") || "landing";
  } catch (e) {
    // localStorage indisponible, on reste sur "landing" par defaut.
  }
}
if (savedView !== "landing") {
  activateView(savedView);
}

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

viewer.scene.canvas.backgroundColor = [0.051, 0.055, 0.063];

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
const MAQUETTES = [
  { id: "archi", src: "/models/Projet_structure.ifc", label: "Maquette STR", color: "#c9d1d9", shown: true },
  { id: "toit", src: "/models/Toit_Metal_2.ifc", label: "Maquette TOITURE", color: "#e8935c", colorize: [0.91, 0.58, 0.36], shown: true },
  // Test de conversion IFC -> XKT (cf CDC section 4, item Maquettes) : Projet_Archi.ifc
  // (27 Mo) converti via @xeokit/xeokit-convert en Maquette_CEA.xkt (8.6 Mo), pour
  // comparer le temps de chargement au rechargement face aux 2 IFC bruts ci-dessus.
  { id: "cea", src: "/models/Maquette_CEA.xkt", label: "Maquette CEA", color: "#a371f7", format: "xkt", shown: true }
];

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
const DETECTIONS = [
  { id: "structure-toiture", modeles: ["archi", "toit"], label: "Structure ↔ Toiture métallique" }
];

const CLASHES = [
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
    discussion: []
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
const DISCUSSIONS = [
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
    ]
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
    ]
  }
];

// Pas de vrai annuaire de contacts pour ce POC : liste fixe des personnes
// deja utilisees dans les fils simules.
const KNOWN_PEOPLE = ["Julie Martin (BE Structure)", "Karim Haddad (Charpente)", "Sofia Benali (Coordination BIM)", "Léa Fontaine (BE Architecture)"];

// Un clash EST un fil de discussion (meme mecanisme), pas une copie : on
// garde les references reelles vers CLASHES/DISCUSSIONS pour qu'une reponse
// postee ici reste visible depuis la page Collision, et inversement.
function threadType(thread) {
  return CLASHES.includes(thread) ? "collision" : "discussion";
}

let discussionsTypeFilterValue = "tout";

function renderDiscussionsPage() {
  const threads = [...CLASHES, ...DISCUSSIONS]
    .filter((t) => t.auteur === CURRENT_USER || (t.tagged || []).includes(CURRENT_USER))
    .filter((t) => discussionsTypeFilterValue === "tout" || threadType(t) === discussionsTypeFilterValue);

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

    const badge = document.createElement("span");
    badge.className = "thread-type-badge " + type;
    badge.textContent = type === "collision" ? "Collision" : "Discussion";

    btn.append(main, badge);
    li.appendChild(btn);
    discussionsThreadsList.appendChild(li);
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

function openThreadDetail(thread) {
  discussionsListPane.hidden = true;
  discussionsDetailPane.hidden = false;
  currentThread = thread;
  setThreadVisualMode("apres", thread);

  // Bloc discussion partage avec Collision (cf showThreadDiscussion) :
  // deplace ici avant d'etre rempli, au cas ou il etait reste dans
  // #collisionLeft depuis la derniere detection consultee.
  discussionsDetailPane.appendChild(collisionDiscussion);
  showThreadDiscussion(thread);

  // Hash specifique au fil (#discussions/<id>) pour qu'un rechargement de
  // page reste sur ce fil precis, pas juste sur l'onglet Discussions.
  if (history.replaceState) {
    history.replaceState(null, "", "#discussions/" + thread.id);
  }
}

discussionsFilterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    discussionsFilterBtns.forEach((b) => b.classList.toggle("active", b === btn));
    discussionsTypeFilterValue = btn.dataset.filter;
    renderDiscussionsPage();
  });
});

discussionsBackBtn.addEventListener("click", () => {
  discussionsDetailPane.hidden = true;
  discussionsListPane.hidden = false;
  recenterTarget = null;
  restoreAllModelsVisible();
  renderDiscussionsPage();
  if (history.replaceState) {
    history.replaceState(null, "", "#discussions");
  }
});

renderDiscussionsPage();

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
    sectionPlanes.showControl(activeCoupeId);
    coupeBtn.textContent = "Désactiver la coupe";
    coupeBtn.classList.add("active");
    coupeToggleVisibilityBtn.hidden = false;
    coupeToggleVisibilityBtn.textContent = "Masquer le plan de coupe";
    coupeInvertBtn.hidden = false;
  }
}

// Repasse toutes les maquettes visibles, quel que soit ce qui les a masquees
// (une detection ou un fil de discussion). Appelee au clic de navbar et aux
// boutons "retour" des detections/fils, jamais depuis un point du script qui
// s'execute avant que MAQUETTES ne soit initialisee plus bas.
function restoreAllModelsVisible() {
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

function openDetection(detection) {
  collisionRecap.hidden = true;
  collisionDetail.hidden = false;

  collisionViewerSlot.appendChild(viewerWrap);
  collisionLeft.appendChild(collisionDiscussion);
  // Meme logique que dans un fil de discussion : ici on ne fait que
  // consulter une collision, pas de "Nouvelle discussion" ni de coupe.
  newDiscussionBtn.hidden = true;
  coupeToolbar.hidden = true;
  window.dispatchEvent(new Event("resize"));

  // Ouvert par defaut (sans effet visuel sur desktop, le panneau y est deja
  // toujours visible) : sur mobile, arriver ici doit montrer tout de suite
  // la liste des collisions a selectionner, pas un canvas vide avec un
  // bouton "Infos" a chercher.
  collisionInfoPanel.classList.add("open");
  collisionInfoPanelBackdrop.hidden = false;

  // Ne montre que les maquettes de cette detection (ex. Maquette CEA hors
  // sujet d'une comparaison structure/toiture, masquee ici) : avant le rendu
  // des cases a cocher, pour qu'elles refletent l'etat a jour des l'entree.
  const subset = MAQUETTES.filter((m) => detection.modeles.includes(m.id));
  MAQUETTES.forEach((m) => { m.shown = detection.modeles.includes(m.id); });
  applyVisibility();
  renderMaquetteRows(collisionMaquettesList, subset);

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
  });

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "collision-item";
  btn.dataset.clashId = clash.id;
  btn.addEventListener("click", () => activateClash(clash));

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

  btn.append(zone, meta);
  li.append(toggle, btn);
  return li;
}

function renderCollisionsList(clashes) {
  collisionsList.innerHTML = "";

  const actives = clashes.filter((c) => c.statut !== "ecarte");
  const ecartes = clashes.filter((c) => c.statut === "ecarte");

  actives.forEach((clash) => collisionsList.appendChild(buildCollisionItem(clash)));

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
  if (clash.ifcPoint) return ifcPointToViewer(clash.ifcPoint);
  // Repli si jamais un clash n'a pas de point IfcClash precalcule.
  const [aabbA, aabbB] = clash.entityIds.map((id) => viewer.scene.getAABB([id]));
  return [0, 1, 2].map((axis) => {
    const min = Math.max(aabbA[axis], aabbB[axis]);
    const max = Math.min(aabbA[axis + 3], aabbB[axis + 3]);
    return (min + max) / 2;
  });
}

function flyToClash(clash) {
  const center = clashCenter(clash);
  // Distance fixe et courte (unites du modele = metres) plutot qu'un calcul
  // base sur la taille des elements : un poteau/une poutre peut etre long,
  // mais on veut un plan rapproche sur le point de croisement, pas sur
  // l'element entier.
  const dist = 2.2;
  const rad = (clash.angle || 0) * Math.PI / 180;

  const eye = [
    center[0] + Math.sin(rad) * dist,
    center[1] + dist * 0.3,
    center[2] + Math.cos(rad) * dist
  ];

  viewer.cameraFlight.flyTo({ eye, look: center, up: [0, 1, 0], duration: 1.2 });
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
const CLASH_MARKER_RADIUS = 0.18;
const CLASH_MARKER_RADIUS_ACTIVE = 0.32;
const CLASH_MARKER_OPACITY = 0.2;
const CLASH_MARKER_OPACITY_ACTIVE = 0.55;

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

function clearClashElementColors() {
  if (colorizedClashEntityIds.length === 0) return;
  viewer.scene.setObjectsColorized(colorizedClashEntityIds, null);
  colorizedClashEntityIds = [];
}

function highlightClashElements(clash) {
  clearClashElementColors();
  const [idA, idB] = clash.entityIds;
  viewer.scene.setObjectsColorized([idA], CLASH_ELEMENT_COLOR_A);
  viewer.scene.setObjectsColorized([idB], CLASH_ELEMENT_COLOR_B);
  colorizedClashEntityIds = [idA, idB];
}

let currentDiscussionThread = null;

function renderDiscussionMessages(thread) {
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

function isThreadOpen(thread) {
  return threadType(thread) === "collision" ? thread.statut !== "ecarte" : thread.open;
}

// Bloc "Discussion" (#collisionDiscussion, avec sa liste de messages et son
// formulaire) partage entre Collision et Discussions : un seul jeu de
// html/css/js, deplace physiquement dans le DOM au moment de l'usage (meme
// principe que #viewerWrap deplace entre Viewer/Collision/fil).
function showThreadDiscussion(thread) {
  currentDiscussionThread = thread;
  const isOpen = isThreadOpen(thread);

  // Titre du fil a la place du generique "Discussion" (Collision et
  // Discussions partagent tous les deux un champ "zone" sur leur thread).
  // Retronque par CSS (text-overflow), classe "expanded" retiree a chaque
  // nouveau fil pour ne pas garder un vieux deplie.
  collisionDiscussionTitle.textContent = thread.zone;
  collisionDiscussionTitle.classList.remove("expanded");

  if (thread.discussion.length === 0 && !isOpen) {
    collisionDiscussion.hidden = true;
    return;
  }

  collisionDiscussion.hidden = false;
  renderDiscussionMessages(thread);

  discussionReplyForm.hidden = !isOpen;
  discussionReplyInput.value = "";
}

function selectClash(clash) {
  flyToClash(clash);
  highlightClashMarker(clash);
  highlightClashElements(clash);
  recenterTarget = () => flyToClash(clash);
  showThreadDiscussion(clash);
}

// Point d'entree commun pour selectionner un clash, que ce soit via la
// ligne de la liste ou un clic direct sur sa bulle 3D dans le viewer.
function activateClash(clash) {
  collisionsList.querySelectorAll(".collision-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.clashId === clash.id);
  });
  selectClash(clash);
  closeCollisionInfoPanelDrawer();
}

// Titre tronque (CSS) si trop long pour la largeur du panneau discussion :
// un clic affiche le titre complet, un reclic retronque.
collisionDiscussionTitle.addEventListener("click", () => {
  collisionDiscussionTitle.classList.toggle("expanded");
});

discussionReplyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const texte = discussionReplyInput.value.trim();
  if (!texte || !currentDiscussionThread) return;

  currentDiscussionThread.discussion.push({ auteur: "Vous", texte });
  renderDiscussionMessages(currentDiscussionThread);
  discussionReplyInput.value = "";
});

function goBackToDetections() {
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

renderDetections();

const maquetteCountEls = new Map();

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

    li.append(checkbox, swatch, name, count);
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
}

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

function renderNiveaux() {
  if (!viewer.metaScene.metaModels["cea"]) return;

  // Le rendu peut se re-declencher a chaque maquette qui termine son
  // chargement (elles arrivent dans un ordre pas garanti) : on repart de zero
  // a chaque fois, mais en conservant l'etat coche choisi par l'utilisateur
  // entre-temps, plutot que de le reinitialiser silencieusement.
  const previousChecked = new Map(niveauxState.map((n) => [n.name, n.checked]));

  niveauxList.innerHTML = "";
  niveauxState.length = 0;

  const niveaux = NIVEAU_MAPPING.map((entry) => {
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

  showSelection([["Niveau", target.name]], DOCS_BY_NIVEAU[target.name] || []);
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

function showSelection(rows, docs) {
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

ficheSheetClose.addEventListener("click", closeFicheSheet);

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

  // Mobile : evite d'obliger a ouvrir le tiroir "☰ Infos" en entier juste
  // pour voir la fiche d'un element tape, une modale discrete en bas
  // d'ecran suffit (memes donnees que le tiroir).
  if (isMobileViewport()) {
    renderFicheInto(ficheSheetContent, ficheSheetDocs, rows, docs);
    openFicheSheet();
  }
}

function clearFiche() {
  fichePlaceholder.hidden = false;
  ficheContent.hidden = true;
  ficheContent.innerHTML = "";
  ficheDocs.innerHTML = "";
  collisionFichePlaceholder.hidden = false;
  collisionFicheContent.hidden = true;
  collisionFicheContent.innerHTML = "";
  collisionFicheDocs.innerHTML = "";
  closeFicheSheet();
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

function setCoupePickingMode(on) {
  coupePickingMode = on;
  coupeBtn.classList.toggle("active", on);
  coupeBtn.textContent = on ? "Cliquez sur une surface..." : (activeCoupeId ? "Désactiver la coupe" : "Créer une coupe");
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
  coupeBtn.textContent = "Créer une coupe";
  coupeBtn.classList.remove("active");
}

coupeInvertBtn.addEventListener("click", () => {
  if (!activeCoupeId) return;
  sectionPlanes.flipSectionPlanes();
});

coupeBtn.addEventListener("click", () => {
  if (activeCoupeId) {
    destroyActiveCoupe();
    return;
  }
  // Retire le 04/09 : reutiliser un element deja selectionne ne donnait pas
  // une position fiable. On repasse par un clic explicite sur la maquette
  // a chaque fois, dans tous les cas.
  setCoupePickingMode(!coupePickingMode);
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
function createCoupeFromHit(hit) {
  activeCoupeId = "coupe-surface";
  // Sens inverse de la normale de surface par defaut (demande explicite du
  // 04/09) : coupe ce qui est devant la surface visee, pas derriere.
  const dir = [-hit.worldNormal[0], -hit.worldNormal[1], -hit.worldNormal[2]];
  sectionPlanes.createSectionPlane({ id: activeCoupeId, pos: hit.worldPos, dir });
  sectionPlanes.showControl(activeCoupeId);
  coupeBtn.textContent = "Désactiver la coupe";
  coupeBtn.classList.add("active");
  coupeToggleVisibilityBtn.hidden = false;
  coupeToggleVisibilityBtn.textContent = "Masquer le plan de coupe";
  coupeInvertBtn.hidden = false;
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

IfcAPI.Init().then(() => {
  const ifcLoader = new WebIFCLoaderPlugin(viewer, { WebIFC, IfcAPI });
  const xktLoader = new XKTLoaderPlugin(viewer);
  let loadedCount = 0;

  MAQUETTES.forEach((maquette) => {
    const model = maquette.format === "xkt"
      ? xktLoader.load({ id: maquette.id, src: maquette.src, edges: true })
      : ifcLoader.load({ id: maquette.id, src: maquette.src, excludeTypes: ["IfcSpace"], edges: true });

    maquette.model = model;

    model.on("loaded", () => {
      if (maquette.colorize) {
        model.colorize = maquette.colorize;
      }

      const countText = model.numEntities.toLocaleString("fr-FR") + " éléments";
      (maquetteCountEls.get(maquette.id) || []).forEach((el) => { el.textContent = countText; });

      // Rappelee a chaque chargement (pas seulement celui de la CEA, source
      // des niveaux) : les 3 maquettes chargent en parallele, l'ordre reel
      // d'arrivee n'est pas garanti. renderNiveaux() sort tout de suite si
      // la CEA n'est pas encore prete, et se re-declenche correctement des
      // qu'elle l'est, meme si une autre maquette a fini avant.
      renderNiveaux();

      loadedCount++;
      if (loadedCount === MAQUETTES.length) {
        loadingOverlay.classList.add("hidden");
        viewer.cameraFlight.flyTo(DEFAULT_CAMERA_STATE);
        initialCameraState = DEFAULT_CAMERA_STATE;
      }
    });

    model.on("error", (msg) => {
      loadingOverlay.classList.add("error");
      loadingOverlay.textContent = "Erreur de chargement (" + maquette.label + ") : " + msg;
    });
  });
});
