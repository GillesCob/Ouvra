// Messagerie de la page Discussions (interrupteur DISCUSSIONS_MESSAGERIE de src/main.js).
// Specification fonctionnelle : mockup Projets/Ouvra/mockups/ouvra-discussions-messagerie.html.
//
// creerMessagerie(options) renvoie l'API que main.js branche sur la navigation :
//   preparer()                       charge les donnees (une seule fois) et le compteur de la navbar
//   surVueActivee(nomVue)            appelee a chaque changement de page
//   nouveauSujetDepuisViewer(vue)    bouton « Nouvelle discussion » du Viewer
// options : { racine, lienNavbar, capturerVue(), allerA(nomVue), ouvrirDansViewer(vue), glisserPourFermer(element, fermer, estOuvert) }
import "./messagerie.css";
import {
  MOI, LIBELLES_STATUT, STATUTS_ACTIFS, TAILLE_PAQUET,
  dernierMessage, nonLusConv, activiteConv, filActif, ouvrirFil, fermerRepere, ajouterMessage,
  changerStatut, ajouterPersonne, ajouterAuGroupe, basculerUrgence, estUrgent, convAUrgent, cloturer, rouvrir, creerSujet, creerConversation, vueOrigine, sujetsClos, sujetsTries, convParId
} from "./messagerieDonnees.js";
import { echapper, heureMinute, cleJour, libelleJour, heureCourte, initiales, prenom } from "./format.js";
import { imageVue, chargerBanque, attribuerBanque } from "./vuesMessagerie.js";
import { requeteMention, filtrerPersonnes, occurrences } from "./mentions.js";

const ICONE_APPAREIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICONE_LOUPE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const VERBES_JOURNAL = { ouverture: "ouvert le sujet", cloture: "clos le sujet", reouverture: "rouvert le sujet" };
const MOBILE = "(max-width: 768px)";

export function creerMessagerie({ racine, lienNavbar, capturerVue, allerA, ouvrirDansViewer, glisserPourFermer }) {
  let personnes = {};
  let conversations = [];
  let monte = false;
  let demarre = false;
  let premierAffichage = true;
  let defilementMemorise = 0;
  let vuePendante = null;
  let priseDeVueEnCours = false;
  let dialogueEnAttente = null;
  let declencheurDialogue = null;
  let vueDialogue = null;
  let vuesAffichees = [];
  let vuesPeriment = false; // des vues ont change pendant que la page etait masquee : le fil affiche est a redessiner
  const etat = { onglet: "individuel", convId: null, sujetId: null, recherche: "" };

  const $ = (id) => document.getElementById(id);
  const mobile = () => window.matchMedia(MOBILE).matches;
  const instant = () => new Date();
  const personne = (id) => personnes[id] || { nom: id, role: "", teinte: 150 };

  // ---------- Squelette et donnees ----------
  function bati() {
    racine.innerHTML =
      '<aside class="msg-lateral" aria-label="Conversations">' +
        '<div class="msg-onglets" role="tablist" aria-label="Type de conversation">' +
          '<span class="msg-onglets-thumb" aria-hidden="true"></span>' +
          '<button type="button" role="tab" id="msgOngletIndividuel" data-act="onglet" data-v="individuel" aria-selected="true" aria-controls="msgListe">Individuel <span class="msg-badge" id="msgBadgeIndividuel" hidden></span></button>' +
          '<button type="button" role="tab" id="msgOngletGroupe" data-act="onglet" data-v="groupe" aria-selected="false" aria-controls="msgListe">Groupes <span class="msg-badge" id="msgBadgeGroupe" hidden></span></button>' +
        "</div>" +
        '<div class="msg-liste" id="msgListe" role="tabpanel" aria-labelledby="msgOngletIndividuel"></div>' +
        '<div class="msg-demo">Échanges fictifs, pour la démonstration</div>' +
      "</aside>" +
      '<section class="msg-volet" id="msgVolet" aria-label="Conversation"><p class="msg-volet-vide">Choisissez une conversation.</p></section>' +
      '<div class="msg-dialogue" id="msgDialogue" hidden></div>' +
      '<div class="msg-feuille-fond" id="msgFeuille" hidden><div class="msg-feuille" id="msgFeuilleCarte" role="dialog" aria-modal="true"></div></div>';
    if (glisserPourFermer) glisserPourFermer($("msgFeuilleCarte"), fermerFeuille, () => $("msgFeuille").classList.contains("ouvert"));
    const observateurOnglets = new ResizeObserver(placerPastilleOnglets);
    racine.querySelectorAll('.msg-onglets [role="tab"]').forEach((b) => observateurOnglets.observe(b));
    racine.addEventListener("click", surClic);
    racine.addEventListener("input", surSaisie);
    racine.addEventListener("keydown", surTouche);
    racine.addEventListener("change", surChangement);
    // Liste des mentions (@) : un appui dessus ne doit pas retirer le focus du champ (clavier iOS ouvert) ni le fermer avant le clic.
    // pointerdown n'est pas annule (sinon WebKit supprime aussi le clic tactile) : seul mousedown l'est, et un drapeau protege la liste d'un focusout.
    racine.addEventListener("pointerdown", (e) => {
      if (!e.target.closest("#msgMentions")) return;
      appuiSurMentions = true;
      setTimeout(() => { appuiSurMentions = false; }, 800);
    });
    racine.addEventListener("mousedown", (e) => { if (e.target.closest("#msgMentions")) e.preventDefault(); });
    ["pointercancel", "click"].forEach((type) => racine.addEventListener(type, () => { appuiSurMentions = false; }));
    racine.addEventListener("focusout", (e) => { if (e.target.id === "msgSaisie" && !appuiSurMentions) fermerMentions(); });
    racine.addEventListener("keyup", (e) => { if (e.target.id === "msgSaisie" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) majMentions(); });
    document.addEventListener("keydown", surEchap);
    // Menu « ⋯ » (mobile) : l'appui qui le ferme en dehors est un clic neutre (rien d'autre ne se declenche).
    document.addEventListener("pointerdown", (e) => {
      const menu = $("msgMenu");
      if (!menu || menu.hidden || !window.matchMedia("(max-width: 768px)").matches) return;
      if (e.target.closest("#msgOptions, #msgMenu")) return;
      fermerMenu();
      absorberGesteNeutre();
    }, true);
    EVENEMENTS_ABSORBES.forEach((type) => {
      document.addEventListener(type, (e) => {
        if (!gesteNeutre) return;
        if (type === "pointerup") terminerGesteNeutre();
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      }, true);
    });
    ["pointercancel", "touchcancel"].forEach((type) => document.addEventListener(type, terminerGesteNeutre, true));
    monte = true;
  }

  // Chargement paresseux : le module de demonstration (et ses 130 Ko de textes) n'est telecharge qu'a la premiere utilisation.
  async function preparer() {
    if (demarre) return;
    demarre = true;
    if (!monte) bati();
    // Donnees FICTIVES (a retirer avant toute demonstration publique) : voir donneesDemo.js. Sans elles, la messagerie s'ouvre vide.
    const { construireDemo } = await import("./donneesDemo.js");
    const donnees = construireDemo(instant());
    personnes = donnees.personnes;
    conversations = donnees.conversations;
    majBadges();
    if (!racine.closest(".view").hidden) afficher();
    await rechargerVues();
  }

  // Vues 3D recoltees (public/images/vues/index.json) : attribuees aux prises de vue de demonstration. Rappelee par main.js a la fin de la
  // recolte automatique du premier chargement pour remplacer les vignettes « en preparation ».
  async function rechargerVues() {
    if (!conversations.length) return;
    const banque = await chargerBanque();
    if (!banque.length) return;
    if (!attribuerBanque(conversations, banque)) return;
    // Page masquee : le fil affiche garde ses anciennes vignettes tant qu'on ne le redessine pas, voir afficher().
    vuesPeriment = true;
    if (!racine.closest(".view").hidden) {
      rendreListe();
      if (etat.convId) rendreFilCourant(true);
      vuesPeriment = false;
    }
  }

  // ---------- Page affichee / quittee ----------
  function surVueActivee(nomVue) {
    if (nomVue === "discussions") {
      if (!demarre) preparer();
      else afficher();
      return;
    }
    // Quitter la page ferme la modale restee ouverte : sinon elle reapparait a l'arrivee suivante sur Discussions.
    if (dialogueOuvert()) { declencheurDialogue = null; rouvrirFeuilleApresDialogue = false; fermerDialogue(); }
    if (priseDeVueEnCours && nomVue !== "viewer") annulerPriseDeVue(false);
    if (nomVue !== "viewer") retourConversationActif = false;
    montrerBandeau(priseDeVueEnCours && nomVue === "viewer");
    montrerBandeauRetour(retourConversationActif && !priseDeVueEnCours && nomVue === "viewer");
  }

  function afficher() {
    if (!monte || !conversations.length) return;
    montrerBandeau(false);
    montrerBandeauRetour(false);
    if (premierAffichage) {
      premierAffichage = false;
      rendreListe();
      if (!mobile()) ouvrirConversation("sophie", null);
    } else {
      rendreListe();
      if (vuesPeriment) {
        vuesPeriment = false;
        if (etat.convId) rendreFilCourant(true);
      }
      const volet = $("msgScroller");
      if (volet) {
        volet.scrollTop = defilementMemorise;
        synchroniserBoutonBas();
      }
    }
    // Retour d'une prise de vue : la vue validee reste visible en piece jointe, le curseur va dans le champ (la page peut s'afficher apres la validation)
    rendreVuePendante();
    if (vuePendante && $("msgSaisie")) $("msgSaisie").focus();
    if (dialogueEnAttente) {
      const attente = dialogueEnAttente;
      dialogueEnAttente = null;
      ouvrirDialogueSujet(attente);
    }
  }

  // ---------- Liste des conversations ----------
  function majBadges() {
    let individuel = 0;
    let groupe = 0;
    conversations.forEach((c) => { if (c.type === "individuel") individuel += nonLusConv(c); else groupe += nonLusConv(c); });
    [["msgBadgeIndividuel", individuel], ["msgBadgeGroupe", groupe]].forEach(([id, n]) => {
      const el = $(id);
      if (!el) return;
      el.hidden = n === 0;
      el.textContent = n > 99 ? "99+" : String(n);
    });
    majBadgeNavbar(individuel + groupe);
  }

  function majBadgeNavbar(total) {
    if (!lienNavbar) return;
    let badge = lienNavbar.querySelector(".msg-badge-nav");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "msg-badge msg-badge-nav";
      lienNavbar.appendChild(badge);
    }
    badge.hidden = total === 0;
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.title = total + (total > 1 ? " messages non lus" : " message non lu");
  }

  function avatarConv(c, classe) {
    const teinte = c.type === "groupe" ? 150 : personne(c.membres.find((m) => m !== MOI)).teinte;
    return '<span class="msg-av ' + (c.type === "groupe" ? "groupe " : "") + (classe || "") + '" style="--h:' + teinte + '" aria-hidden="true">' + echapper(initiales(c.nom.replace(" : ", " "))) + "</span>";
  }
  function avatarPersonne(id, classe) {
    return '<span class="msg-av ' + (classe || "") + '" style="--h:' + personne(id).teinte + '" aria-hidden="true">' + echapper(initiales(personne(id).nom)) + "</span>";
  }

  function ligneConv(c) {
    const n = nonLusConv(c);
    const dm = dernierMessage(c.principal);
    const quiPrefixe = !dm ? "" : (c.type === "groupe" && dm.auteur !== MOI ? prenom(personne(dm.auteur).nom) + " : " : (dm.auteur === MOI ? "Vous : " : ""));
    const apercu = dm ? quiPrefixe + (dm.texte || "Prise de vue").replace(/^@Vous /, "") : "Aucun message"; // conversation neuve (« + » de la liste)
    const urgent = convAUrgent(c) ? '<span class="msg-badge msg-badge-urgent" title="Sujet urgent" aria-label="Sujet urgent">!</span>' : "";
    const mention = c.principal.mentions ? '<span class="msg-badge msg-badge-mention" title="Vous êtes mentionné" aria-label="Vous êtes mentionné">@</span>' : "";
    return '<button type="button" class="msg-conv' + (c.type === "groupe" ? " msg-conv-groupe" : "") + (n ? " non-lu" : "") + (c.id === etat.convId ? " actif" : "") + '" data-act="conversation" data-id="' + echapper(c.id) + '"' +
      (c.id === etat.convId ? ' aria-current="true"' : "") + ">" +
      avatarConv(c) +
      '<span class="msg-conv-nom">' + echapper(c.nom) + "</span>" +
      '<span class="msg-conv-heure">' + heureCourte(activiteConv(c), instant()) + "</span>" +
      '<span class="msg-conv-apercu">' + echapper(apercu) + "</span>" +
      '<span class="msg-conv-droite">' + urgent + mention + (n ? '<span class="msg-badge" aria-label="' + n + ' non lus">' + (n > 99 ? "99+" : n) + "</span>" : "") + "</span>" +
      "</button>";
  }

  function rendreListe() {
    const items = conversations
      .filter((c) => c.type === etat.onglet)
      .sort((a, b) => {
        const ua = nonLusConv(a) > 0;
        const ub = nonLusConv(b) > 0;
        if (ua !== ub) return ua ? -1 : 1;
        return activiteConv(b) - activiteConv(a);
      });
    const html = items.length ? items.map(ligneConv).join("") : '<div class="msg-vide">Aucune conversation.</div>';
    // « + » en tete de liste, nouvelle conversation 1 a 1 (Individuel) ou nouveau groupe (Groupes).
    const plus = '<div class="msg-liste-tete"><button type="button" class="msg-liste-plus" data-act="plus-conversation" aria-label="' +
      (etat.onglet === "groupe" ? "Nouveau groupe" : "Nouvelle conversation") + '">+</button></div>';
    $("msgListe").innerHTML = plus + html;
    majBadges();
  }

  // Bascule Individuel / Groupes : meme fonctionnement que Niveaux / Maquettes du drawer du Viewer. La pastille glisse tout de suite sous
  // l'onglet choisi (0,3 s, position et largeur mesurees sur le bouton), la liste s'efface en descendant de 8 px, change, puis revient.
  let pastillePosee = false;
  function placerPastilleOnglets() {
    const thumb = racine.querySelector(".msg-onglets-thumb");
    const actif = racine.querySelector('.msg-onglets [aria-selected="true"]');
    if (!thumb || !actif || !actif.offsetWidth) return;
    if (!pastillePosee) thumb.style.transition = "none";
    thumb.style.width = actif.offsetWidth + "px";
    thumb.style.transform = "translateX(" + actif.offsetLeft + "px)";
    if (!pastillePosee) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
      pastillePosee = true;
    }
  }

  let minuteurOnglet = null;
  function choisirOnglet(onglet) {
    const change = onglet !== etat.onglet;
    etat.onglet = onglet;
    [["individuel", "msgOngletIndividuel"], ["groupe", "msgOngletGroupe"]].forEach(([cle, id]) => $(id).setAttribute("aria-selected", String(cle === onglet)));
    $("msgListe").setAttribute("aria-labelledby", onglet === "individuel" ? "msgOngletIndividuel" : "msgOngletGroupe");
    placerPastilleOnglets();
    if (!change || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rendreListe();
      return;
    }
    const liste = $("msgListe");
    liste.classList.add("msg-liste-sortie");
    clearTimeout(minuteurOnglet);
    minuteurOnglet = setTimeout(() => {
      rendreListe();
      liste.classList.remove("msg-liste-sortie");
      liste.classList.add("msg-liste-entree");
      void liste.offsetHeight;
      liste.classList.remove("msg-liste-entree");
    }, 300);
  }

  // ---------- Volet de conversation ----------
  function filCourant() {
    const c = convParId(conversations, etat.convId);
    if (!c) return null;
    const fil = filActif(c, etat.sujetId);
    return fil ? { c, fil, sujet: etat.sujetId ? fil : null } : null;
  }

  // Sous-titre de l'en-tete : prenoms des membres d'un groupe (mis a jour quand des personnes rejoignent), role de l'interlocuteur en 1 a 1.
  const sousTitreEntete = (c) => c.type === "groupe" ? c.membres.map((m) => prenom(personne(m).nom)).join(", ") : c.sousTitre;

  function batirVolet(c) {
    $("msgVolet").innerHTML =
      '<div class="msg-entete">' +
        '<button type="button" class="msg-icone msg-retour" data-act="retour" aria-label="Retour à la liste des conversations">&larr;</button>' +
        avatarConv(c) +
        '<div class="msg-titre"><b>' + echapper(c.nom) + "</b><span>" +
          echapper(sousTitreEntete(c)) + "</span></div>" +
        '<button type="button" class="msg-icone" data-act="recherche-conv" aria-label="Rechercher dans la conversation" aria-expanded="false" aria-controls="msgBarreRecherche">' + ICONE_LOUPE + "</button>" +
        '<button type="button" class="msg-icone msg-options" id="msgOptions" data-act="options" aria-label="Options de la conversation" aria-haspopup="true" aria-expanded="false" aria-controls="msgMenu">&hellip;</button>' +
        '<div class="msg-menu" id="msgMenu" hidden>' +
          '<button type="button" id="msgMenuInfos" data-act="infos" aria-haspopup="dialog">Participants</button>' +
          '<button type="button" data-act="nouveau-sujet">+ Nouveau sujet</button>' +
          '<button type="button" id="msgMenuHistorique" data-act="historique" hidden>Historique</button>' +
        "</div>" +
      "</div>" +
      '<div class="msg-barre-recherche" id="msgBarreRecherche" hidden><input id="msgChampRecherche" type="search" placeholder="Rechercher dans cette conversation" aria-label="Rechercher dans cette conversation" autocomplete="off" /><span id="msgNbResultats" aria-live="polite"></span></div>' +
      '<div class="msg-sujets"><span class="msg-sujets-lbl">Sujets</span><div class="msg-bande" id="msgBande"></div>' +
        '<button type="button" class="msg-ajout" id="msgInfosSujet" data-act="infos-sujet" aria-haspopup="dialog" aria-label="Infos du sujet" title="Infos du sujet" hidden>&hellip;</button>' +
        '<button type="button" class="msg-ajout" id="msgHistorique" data-act="historique" hidden>Sujets clôturés</button>' +
        '<button type="button" class="msg-ajout" id="msgAjoutSujet" data-act="nouveau-sujet">+ Sujet</button></div>' +
      '<div class="msg-zone-fil"><div class="msg-defile" id="msgScroller" tabindex="-1"></div>' +
        '<button type="button" class="msg-bas" id="msgBas" data-act="bas" aria-label="Aller au dernier message" hidden>&darr;</button></div>' +
      '<div class="msg-vue-pendante" id="msgVuePendante" hidden></div>' +
      '<div class="msg-composer"><div class="msg-mentions" id="msgMentions" role="listbox" aria-label="Personnes à mentionner" hidden></div><button type="button" class="msg-icone" id="msgBoutonVue" data-act="prendre-vue" aria-label="Prendre une vue dans le Viewer" title="Prendre une vue dans le Viewer">' + ICONE_APPAREIL + "</button>" +
        '<textarea id="msgSaisie" rows="1" placeholder="Écrire un message" aria-label="Écrire un message" aria-autocomplete="list" aria-controls="msgMentions"></textarea>' +
        '<button type="button" class="msg-envoyer" id="msgEnvoyer" data-act="envoyer">Envoyer</button></div>';
    $("msgScroller").addEventListener("scroll", () => {
      if (racine.offsetParent !== null) defilementMemorise = $("msgScroller").scrollTop;
      synchroniserBoutonBas();
    }, { passive: true });
  }

  // Le sujet choisi defile doucement tout a gauche de la bande (juste apres le titre « Sujets »), en 0,3 s quelle que soit la distance ;
  // si la bande ne peut pas defiler assez loin, elle s'arrete en butee. Un nouveau choix reprend depuis la position courante.
  let animationBande = 0;
  function sujetActifEnPremier() {
    const bande = $("msgBande");
    const actif = bande && bande.querySelector(".msg-pastille.actif");
    if (!actif) return;
    cancelAnimationFrame(animationBande);
    const depart = bande.scrollLeft;
    const cible = Math.max(0, Math.min(actif.offsetLeft, bande.scrollWidth - bande.clientWidth));
    if (Math.abs(cible - depart) < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bande.scrollLeft = cible;
      return;
    }
    const debut = performance.now();
    const pas = (maintenant) => {
      const k = Math.min(1, (maintenant - debut) / 300);
      bande.scrollLeft = depart + (cible - depart) * (1 - Math.pow(1 - k, 3));
      if (k < 1) animationBande = requestAnimationFrame(pas);
    };
    animationBande = requestAnimationFrame(pas);
  }

  function rendreBande(c) {
    let html = '<button type="button" class="msg-pastille' + (!etat.sujetId ? " actif" : "") + (c.principal.nonLus ? " a-du-neuf" : "") + '" data-act="sujet" data-s="" aria-pressed="' + (!etat.sujetId) + '">Principal' +
      (c.principal.nonLus && etat.sujetId ? '<span class="msg-badge">' + c.principal.nonLus + "</span>" : "") + "</button>";
    sujetsTries(c, etat.sujetId).forEach((s) => {
      if (s.statut === "clos" && s.id !== etat.sujetId) return;
      html += '<button type="button" class="msg-pastille' + (etat.sujetId === s.id ? " actif" : "") + (s.nonLus ? " a-du-neuf" : "") + (s.statut === "clos" ? " clos" : "") + '" data-act="sujet" data-s="' + echapper(s.id) + '" aria-pressed="' + (etat.sujetId === s.id) + '">' +
        '<span class="msg-point st-' + s.statut + '" title="' + LIBELLES_STATUT[s.statut] + '"></span><span class="msg-sr">' + LIBELLES_STATUT[s.statut] + ", </span># " + echapper(s.titre) +
        (estUrgent(s) ? '<span class="msg-urgent">Urgent</span>' : "") +
        (s.nonLus ? '<span class="msg-badge" aria-label="' + s.nonLus + ' non lus">' + s.nonLus + "</span>" : "") + "</button>";
    });
    $("msgBande").innerHTML = html;
    const nbClos = c.sujets.filter((s) => s.statut === "clos").length;
    const bouton = $("msgHistorique");
    bouton.hidden = nbClos === 0;
    bouton.textContent = "Sujets clôturés (" + nbClos + ")";
    const entree = $("msgMenuHistorique");
    entree.hidden = nbClos === 0;
    entree.textContent = "Sujets clôturés (" + nbClos + ")"; // menu « ⋯ » : mobile seulement (la barre « Sujets » porte le meme libelle sur laptop)
  }

  function htmlVue(m) {
    if (!m.vue) return "";
    vuesAffichees.push(m);
    return '<button type="button" class="msg-vue" data-act="agrandir" data-vp="' + (vuesAffichees.length - 1) + '" title="Ouvrir cette vue dans le Viewer">' + imageVue(m.vue) + "</button>";
  }

  function htmlJournal(m, dansSujet) {
    const qui = m.auteur === MOI ? "Vous avez" : prenom(personne(m.auteur).nom) + " a";
    if (m.genre === "statut") return '<div class="msg-journal">' + echapper(qui) + " passé le statut à <b>" + LIBELLES_STATUT[m.statut] + "</b></div>";
    if (m.genre === "urgence") return '<div class="msg-journal">' + echapper(qui) + (m.urgent ? " marqué le sujet urgent" : " retiré l'urgence") + "</div>";
    if (m.genre === "ajout") return '<div class="msg-journal">' + echapper(qui) + " ajouté " + echapper(prenom(personne(m.personne).nom)) + " au sujet, qui voit tout l'historique</div>";
    const lien = dansSujet ? "" : ' <button type="button" data-act="ouvrir-sujet" data-s="' + echapper(m.sujetId) + '"># ' + echapper(m.titre) + "</button>";
    // Les tagues ne sont rappeles que si le sujet ne concerne qu'une partie du groupe.
    const conv = convParId(conversations, etat.convId);
    const tagues = m.genre === "ouverture" && !dansSujet && m.tagues && m.tagues.length && conv && m.tagues.length < conv.membres.filter((p) => p !== MOI).length
      ? " &middot; tagués : " + m.tagues.map((p) => echapper(prenom(personne(p).nom))).join(", ") : "";
    return '<div class="msg-journal">' + echapper(qui) + " " + VERBES_JOURNAL[m.genre] + lien + tagues + "</div>";
  }

  // Texte d'un message en HTML, avec les mentions d'autres personnes (ids du message) en orange comme @Vous ; le texte entre deux mentions
  // et chaque mention passent par texteSimple, donc la recherche surligne aussi dans une mention.
  function texteHtml(texte, recherche, mentions) {
    const occ = occurrences(texte, (mentions || []).map((id) => ({ id, nom: personne(id).nom })));
    if (!occ.length) return texteSimple(texte, recherche);
    let html = "";
    let pos = 0;
    occ.forEach((o) => {
      html += texteSimple(texte.slice(pos, o.debut), recherche) + '<span class="msg-mention">' + texteSimple(texte.slice(o.debut, o.fin), recherche) + "</span>";
      pos = o.fin;
    });
    return html + texteSimple(texte.slice(pos), recherche);
  }

  // Texte brut en HTML : echappe, @Vous en orange, termes recherches surlignes (on decoupe le texte brut, jamais le HTML).
  function texteSimple(texte, recherche) {
    const mention = (t) => echapper(t).replace(/@Vous/g, '<span class="msg-mention">@Vous</span>');
    if (!recherche) return mention(texte);
    const morceaux = texte.split(new RegExp("(" + recherche.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"));
    return morceaux.map((p, i) => (i % 2 ? "<mark>" + echapper(p) + "</mark>" : mention(p))).join("");
  }

  function rendreMessages(garderDefilement) {
    const cur = filCourant();
    if (!cur) return;
    const { c, fil, sujet } = cur;
    const zone = $("msgScroller");
    vuesAffichees = [];
    const recherche = etat.recherche.trim().toLowerCase();
    const messages = recherche ? fil.messages.filter((m) => !m.systeme && (m.texte || "").toLowerCase().includes(recherche)) : fil.messages;
    $("msgNbResultats").textContent = recherche ? messages.length + (messages.length > 1 ? " résultats" : " résultat") : "";

    const total = messages.length;
    const visibles = recherche ? total : Math.min(total, fil.affiches);
    const debut = total - visibles;
    let html = "";
    if (debut > 0) html += '<button type="button" class="msg-plus-ancien" data-act="plus-ancien">Charger les ' + Math.min(TAILLE_PAQUET, debut) + " messages précédents (" + debut + " en tout)</button>";

    let jour = "";
    let precedent = null;
    const reperePos = recherche ? -1 : fil.reperePos;
    for (let i = debut; i < total; i++) {
      const m = messages[i];
      const cle = cleJour(m.quand);
      if (cle !== jour) {
        // Un conteneur par jour : le repere de date (sticky) est limite a son jour, le suivant le repousse.
        if (jour) html += "</div>";
        html += '<div class="msg-groupe-jour"><div class="msg-jour"><span>' + echapper(libelleJour(m.quand, instant())) + "</span></div>";
        jour = cle;
        precedent = null;
      }
      if (i === reperePos && fil.repereNb > 0) {
        html += '<div class="msg-repere" id="msgRepere">' + fil.repereNb + (fil.repereNb > 1 ? " nouveaux messages" : " nouveau message") + "</div>";
        precedent = null;
      }
      if (m.systeme) {
        html += htmlJournal(m, !!sujet);
        precedent = null;
        continue;
      }
      const moi = m.auteur === MOI;
      const premier = !precedent || precedent.auteur !== m.auteur || (m.quand - precedent.quand) > 5 * 60000;
      const afficheAuteur = c.type === "groupe" && !moi && premier;
      const texte = texteHtml(m.texte || "", recherche, m.mentions);
      const heure = '<span class="msg-heure">' + heureMinute(m.quand) + "</span>";
      html += '<div class="msg-ligne' + (moi ? " moi" : "") + (premier ? " premier" : "") + '">' +
        (moi ? "" : '<span class="msg-av-place">' + (c.type === "groupe" && premier ? avatarPersonne(m.auteur, "pt") : "") + "</span>") +
        '<div class="msg-bulle">' + (afficheAuteur ? '<div class="msg-qui">' + echapper(personne(m.auteur).nom) + "</div>" : "") +
        // L'heure est a la fin du texte (et non avant) : sinon la largeur de la bulle ignore sa place et coupe les messages courts.
        htmlVue(m) + (texte ? '<div class="msg-texte">' + texte + heure + "</div>" : heure) + "</div></div>";
      precedent = m;
    }
    if (jour) html += "</div>";
    if (!messages.length) html += '<div class="msg-vide">Aucun message.</div>';

    const ancienneHauteur = zone.scrollHeight;
    const ancienHaut = zone.scrollTop;
    zone.innerHTML = html;
    if (garderDefilement) zone.scrollTop = ancienHaut + (zone.scrollHeight - ancienneHauteur);
    synchroniserBoutonBas();
  }

  function allerAuRepere() {
    const zone = $("msgScroller");
    const repere = $("msgRepere");
    zone.scrollTop = repere ? repere.offsetTop - 70 : zone.scrollHeight;
    defilementMemorise = zone.scrollTop;
    synchroniserBoutonBas();
  }
  function synchroniserBoutonBas() {
    const zone = $("msgScroller");
    const bouton = $("msgBas");
    if (!zone || !bouton) return;
    bouton.hidden = (zone.scrollHeight - zone.scrollTop - zone.clientHeight) < 160;
  }
  function allerAuDernier() {
    const zone = $("msgScroller");
    zone.scrollTop = zone.scrollHeight;
    defilementMemorise = zone.scrollTop;
    synchroniserBoutonBas();
  }

  // Membres du groupe pas encore dans le sujet (moi exclu) : n'importe quel tague peut en ajouter, il voit tout l'historique. Jamais en 1 a 1.
  function membresAjoutables(c, s) {
    return c.type !== "groupe" ? [] : c.membres.filter((p) => p !== MOI && !s.tagues.includes(p));
  }

  // Personnes listees dans « Infos du sujet » : en groupe, seulement Vous et les tagues du sujet (jamais les autres membres) ; en 1 a 1, l'interlocuteur.
  function participantsSujet(c, s) {
    return c.type === "groupe" ? c.membres.filter((p) => p === MOI || s.tagues.includes(p)) : c.membres.filter((p) => p !== MOI);
  }

  // Personnes que le « + » des Participants peut ajouter au groupe : toutes celles qui n'en sont pas encore membres (jamais en 1 a 1).
  function personnesAjoutablesGroupe(c) {
    return c.type !== "groupe" ? [] : Object.keys(personnes).filter((p) => p !== MOI && !c.membres.includes(p));
  }
  // Un seul flux d'ajout (« Valider (n) »), deux cibles : le sujet ouvert (tags) ou, sans sujet, le groupe (membres).
  const candidatsAjout = (cur) => cur.sujet ? membresAjoutables(cur.c, cur.sujet) : personnesAjoutablesGroupe(cur.c);

  // Etat du sujet ouvert pour le composeur (sujet clos : saisie bloquee) et bouton « ... » de la barre « Sujets » (laptop, sujet ouvert seulement).
  // Les infos du sujet vivent dans la carte mobile ou la modale laptop (meme rendu : htmlFeuille).
  function rendreNoteSujet() {
    const cur = filCourant();
    const saisie = $("msgSaisie");
    const envoyer = $("msgEnvoyer");
    const boutonVue = $("msgBoutonVue");
    majMenuInfos();
    // Bouton « ... » laptop : sujet ouvert (Infos du sujet) ou conversation de groupe sans sujet (Participants) ; masque en individuel sans sujet.
    const boutonInfos = $("msgInfosSujet");
    boutonInfos.hidden = !carteDisponible();
    const libelleInfos = libelleCarteInfos();
    boutonInfos.setAttribute("aria-label", libelleInfos);
    boutonInfos.title = libelleInfos;
    const clos = !!cur.sujet && cur.sujet.statut === "clos";
    saisie.disabled = clos;
    envoyer.disabled = clos;
    boutonVue.disabled = clos;
    saisie.placeholder = clos ? "Sujet clos : rouvrez-le pour répondre" : "Écrire un message";
  }

  // Carte « Infos du sujet » (ou « Participants » hors sujet) : feuille qui monte du bas sur mobile, modale centree sur laptop (meme rendu).
  // Les boutons gardent les data-act existants (urgence, rouvrir, ouvrir-ajout, agrandir-origine) : surClic les traite pareil.
  function htmlPersonne(id) {
    const p = personne(id);
    return "<li>" + avatarPersonne(id, "pt") + '<span class="msg-fiche-nom">' + echapper(p.nom) + (p.role ? "<span>" + echapper(p.role) + "</span>" : "") + "</span></li>";
  }
  // Dernier element de la liste des personnes : rond « + » (meme composant pour un sujet et pour les Participants d'un groupe).
  const htmlPlusPersonne = () => '<li class="msg-fiche-plus"><button type="button" class="msg-acteur-plus" data-act="ouvrir-ajout"><span class="msg-av pt msg-av-plus" aria-hidden="true">+</span><span class="msg-fiche-nom">Ajouter une personne</span></button></li>';
  // Statut du sujet : bouton a deux lignes + menu personnalise (meme style que Priorite / Statut de la page Collision), « Clôturer » est une option du menu.
  const htmlControleStatut = (statut) =>
    '<button type="button" id="msgStatutFeuille" class="collision-trigger msg-statut-trigger" data-act="statut-menu" aria-haspopup="listbox" aria-expanded="false" aria-label="Statut du sujet : ' + LIBELLES_STATUT[statut] + '">' +
    '<span class="msg-point st-' + statut + '" aria-hidden="true"></span><span class="collision-trigger-texte"><span class="collision-trigger-lib">Statut</span><span class="collision-trigger-val">' + LIBELLES_STATUT[statut] + '</span></span>' +
    '<span class="collision-trigger-chevron" aria-hidden="true"></span></button>';
  let menuStatut = null;
  function fermerMenuStatut(rendreFocus) {
    if (!menuStatut) return;
    menuStatut.remove();
    menuStatut = null;
    document.removeEventListener("pointerdown", surClicHorsMenuStatut, true);
    document.removeEventListener("keydown", surToucheMenuStatut, true);
    const declencheur = $("msgStatutFeuille");
    if (declencheur) { declencheur.setAttribute("aria-expanded", "false"); if (rendreFocus) declencheur.focus(); }
  }
  // Un appui sur le fond sombre qui ferme le menu ne ferme pas aussi la modale : le clic qui suit est absorbe (surClic).
  let clicFondAbsorbe = false;
  function surClicHorsMenuStatut(e) {
    const declencheur = $("msgStatutFeuille");
    if (!menuStatut || menuStatut.contains(e.target) || (declencheur && declencheur.contains(e.target))) return;
    if (e.target === $("msgDialogue") || e.target === $("msgFeuille")) { clicFondAbsorbe = true; setTimeout(() => { clicFondAbsorbe = false; }, 500); }
    fermerMenuStatut();
  }
  function surToucheMenuStatut(e) {
    if (!menuStatut) return;
    const options = Array.from(menuStatut.querySelectorAll(".collision-menu-option"));
    const i = options.indexOf(document.activeElement);
    if (e.key === "Escape") { e.stopPropagation(); fermerMenuStatut(true); }
    else if (e.key === "Tab") fermerMenuStatut();
    else if (e.key === "ArrowDown") { e.preventDefault(); options[(i + 1) % options.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); options[(i <= 0 ? options.length : i) - 1].focus(); }
    else if (e.key === "Home") { e.preventDefault(); options[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); options[options.length - 1].focus(); }
  }
  function ouvrirMenuStatut(declencheur) {
    if (menuStatut) { fermerMenuStatut(); return; }
    const cur = filCourant();
    if (!cur || !cur.sujet) return;
    const menu = document.createElement("div");
    menu.className = "collision-menu msg-statut-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Statut du sujet");
    const option = (valeur, libelle, classePoint, courant) =>
      '<button type="button" class="collision-menu-option" role="option" data-act="choisir-statut" data-valeur="' + valeur + '" aria-selected="' + courant + '">' +
      '<span class="msg-point ' + classePoint + '" aria-hidden="true"></span><span class="collision-menu-texte">' + libelle + '</span><span class="collision-menu-coche" aria-hidden="true">' + (courant ? "\u2713" : "") + "</span></button>";
    menu.innerHTML = '<div class="collision-menu-titre">Statut</div>' +
      STATUTS_ACTIFS.map((k) => option(k, LIBELLES_STATUT[k], "st-" + k, k === cur.sujet.statut)).join("") +
      '<div class="msg-statut-separation" role="separator"></div>' + option("cloturer", "Clôturer", "st-clos", false);
    menu.style.visibility = "hidden";
    racine.appendChild(menu);
    const r = declencheur.getBoundingClientRect();
    const mh = menu.offsetHeight;
    const mw = Math.max(menu.offsetWidth, r.width);
    menu.style.top = (window.innerHeight - r.bottom >= mh + 8 ? r.bottom + 6 : Math.max(8, r.top - mh - 6)) + "px";
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + "px";
    menu.style.minWidth = mw + "px";
    menu.style.visibility = "";
    menuStatut = menu;
    declencheur.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", surClicHorsMenuStatut, true);
    document.addEventListener("keydown", surToucheMenuStatut, true);
    (menu.querySelector('[aria-selected="true"]') || menu.querySelector(".collision-menu-option")).focus({ preventScroll: true });
  }
  function choisirStatut(valeur) {
    const cur = filCourant();
    fermerMenuStatut();
    if (!cur || !cur.sujet || cur.sujet.statut === "clos") return;
    if (valeur === "cloturer") cloturer(cur.c, cur.sujet, instant());
    else if (valeur !== cur.sujet.statut) changerStatut(cur.c, cur.sujet, valeur, instant());
    else { $("msgStatutFeuille").focus(); return; }
    rafraichirApresChangement();
    const declencheur = $("msgStatutFeuille");
    if (declencheur) declencheur.focus();
  }
  function htmlFeuille() {
    const cur = filCourant();
    if (!cur) return "";
    const c = cur.c;
    const membres = c.type === "groupe" ? c.membres : c.membres.filter((m) => m !== MOI);
    if (!cur.sujet) {
      // Dernier « acteur » factice d'un groupe : rond « + » qui ouvre l'ajout de personnes ; absent quand tout le monde est deja membre.
      const plus = personnesAjoutablesGroupe(c).length ? htmlPlusPersonne() : "";
      return '<div class="msg-fiche-tete"><h3>Participants</h3></div><div class="msg-feuille-corps"><ul class="msg-fiche-liste">' + membres.map((m) => htmlPersonne(m)).join("") + plus + "</ul></div>";
    }
    const s = cur.sujet;
    const clos = s.statut === "clos";
    const origine = vueOrigine(s);
    let tete = "<h3># " + echapper(s.titre) + "</h3>" +
      '<div class="msg-fiche-badges"><span class="msg-badge-statut"><span class="msg-point st-' + s.statut + '"></span>' + LIBELLES_STATUT[s.statut] + "</span>" +
      (s.urgent && !clos ? '<span class="msg-urgent">Urgent</span>' : "") + "</div>";
    let corps = "";
    if (origine) {
      corps += '<div class="msg-fiche-bloc"><span class="msg-etiquette">Lieu</span>' +
        '<button type="button" class="msg-origine" data-act="agrandir-origine"><span class="msg-origine-img">' + imageVue(origine.vue) + "</span><span>Vue d'origine</span></button></div>";
    }
    corps += '<div class="msg-fiche-bloc"><span class="msg-etiquette">Personnes</span><ul class="msg-fiche-liste">' +
      participantsSujet(c, s).map((m) => htmlPersonne(m)).join("") + (!clos && membresAjoutables(c, s).length ? htmlPlusPersonne() : "") + "</ul></div>";
    // Tete et actions restent fixes, seul le corps (lieu, personnes) defile si la liste est longue.
    let actions = '<div class="msg-fiche-actions">';
    if (clos) actions += '<button type="button" class="msg-feuille-btn" data-act="rouvrir">Rouvrir</button>';
    else {
      actions += '<button type="button" class="msg-urgent-bouton" data-act="urgence" aria-pressed="' + !!s.urgent + '">Urgent</button>' + htmlControleStatut(s.statut);
    }
    return '<div class="msg-fiche-tete">' + tete + '</div><div class="msg-feuille-corps">' + corps + "</div>" + actions + "</div>";
  }

  let minuteurFeuille = 0;
  const libelleCarteInfos = () => { const cur = filCourant(); return cur && cur.sujet ? "Infos du sujet" : "Participants"; };
  // La carte existe pour un sujet, ou pour les participants d'un groupe ; jamais pour une conversation individuelle sans sujet.
  function carteDisponible() {
    const cur = filCourant();
    return !!cur && (!!cur.sujet || cur.c.type === "groupe");
  }
  // Defilement du corps de la carte memorise avant un sous-ecran (« + Personne »), restitue au retour instantane.
  let defilementCorpsFeuille = 0;
  // instantane : retour depuis un sous-ecran, la carte reprend sa place sans rejouer la montee (seule la premiere ouverture l'anime).
  function ouvrirFeuille(instantane) {
    if (!mobile() || !carteDisponible()) return;
    const fond = $("msgFeuille");
    clearTimeout(minuteurFeuille);
    if (instantane === true) fond.classList.add("sans-anim");
    $("msgFeuilleCarte").innerHTML = htmlFeuille() + '<button type="button" class="msg-croix" data-act="fermer-feuille" aria-label="Fermer">\u2715</button>';
    $("msgFeuilleCarte").setAttribute("aria-label", filCourant().sujet ? "Infos du sujet" : "Participants");
    fond.hidden = false;
    void fond.offsetHeight;
    fond.classList.add("ouvert");
    if (instantane === true) {
      const corps = $("msgFeuilleCarte").querySelector(".msg-feuille-corps");
      if (corps) corps.scrollTop = defilementCorpsFeuille;
      void fond.offsetHeight;
      fond.classList.remove("sans-anim");
    }
    $("msgFeuilleCarte").querySelector(".msg-croix").focus({ preventScroll: true });
  }
  function fermerFeuille(immediat) {
    fermerMenuStatut();
    const fond = $("msgFeuille");
    if (!fond || fond.hidden) return;
    fond.classList.remove("ouvert");
    clearTimeout(minuteurFeuille);
    if (immediat === true || window.matchMedia("(prefers-reduced-motion: reduce)").matches) fond.hidden = true;
    else minuteurFeuille = setTimeout(() => { fond.hidden = true; }, 350);
  }
  // Apres un changement (urgence, cloture...) : le contenu de la carte ouverte est redessine sur place, sans rejouer l'animation.
  function majFeuille() {
    const fond = $("msgFeuille");
    if (!fond || fond.hidden || !fond.classList.contains("ouvert")) return;
    if (!mobile() || !carteDisponible()) { fermerFeuille(true); return; }
    const y = $("msgFeuilleCarte").scrollTop;
    $("msgFeuilleCarte").innerHTML = htmlFeuille() + '<button type="button" class="msg-croix" data-act="fermer-feuille" aria-label="Fermer">\u2715</button>';
    $("msgFeuilleCarte").scrollTop = y;
  }
  // Menu « ⋯ » : la premiere ligne est « Infos du sujet » quand un sujet est ouvert, « Participants » sinon.
  function majMenuInfos() {
    const entree = $("msgMenuInfos");
    const cur = filCourant();
    if (entree) {
      entree.textContent = cur && cur.sujet ? "Infos du sujet" : "Participants";
      // Conversation individuelle sans sujet : un seul autre participant, deja connu par l'en-tete, donc pas d'entree.
      entree.hidden = !carteDisponible();
    }
    majFeuille();
    majInfosLaptop();
  }

  // Laptop : modale « Infos du sujet » (meme contenu que la carte mobile, redessine sur place a chaque changement).
  const infosLaptopOuverte = () => dialogueOuvert() && !!$("msgDialogue").querySelector(".msg-carte-infos");
  function htmlCarteInfos() {
    return htmlFeuille() + '<button type="button" class="msg-croix" data-act="fermer-dialogue" aria-label="Fermer">\u2715</button>';
  }
  function ouvrirInfosLaptop(declencheur) {
    if (mobile() || !carteDisponible()) return;
    ouvrirDialogue(htmlFeuille(), libelleCarteInfos(), declencheur);
    $("msgDialogue").querySelector(".msg-carte").classList.add("msg-carte-infos");
  }
  function majInfosLaptop() {
    if (!infosLaptopOuverte()) return;
    if (mobile() || !carteDisponible()) { fermerDialogue(); return; }
    const carte = $("msgDialogue").querySelector(".msg-carte");
    carte.setAttribute("aria-label", libelleCarteInfos());
    const y = carte.scrollTop;
    const actif = document.activeElement && carte.contains(document.activeElement) ? document.activeElement.dataset.act || document.activeElement.id : "";
    carte.innerHTML = htmlCarteInfos();
    carte.scrollTop = y;
    const retour = actif && carte.querySelector('[data-act="' + actif + '"], #' + actif);
    if (retour) retour.focus({ preventScroll: true });
  }

  function rendreFilCourant(garderDefilement) {
    const cur = filCourant();
    if (!cur) return;
    rendreBande(cur.c);
    const sousTitre = racine.querySelector(".msg-entete .msg-titre span");
    if (sousTitre) sousTitre.textContent = sousTitreEntete(cur.c);
    rendreNoteSujet();
    rendreMessages(garderDefilement);
    rendreVuePendante();
  }

  function rafraichirApresChangement() {
    rendreFilCourant(false);
    rendreListe();
    allerAuDernier();
  }

  // Ouvrir une conversation (et eventuellement un sujet) : les non lus passent a zero dans les listes, le repere reste dans le fil.
  function ouvrirConversation(convId, sujetId) {
    clearTimeout(minuteurSujet);
    racine.querySelectorAll(".msg-fil-sortie").forEach((z) => z.classList.remove("msg-fil-sortie"));
    const avant = filCourant();
    if (avant) fermerRepere(avant.fil);
    const memeConv = etat.convId === convId;
    etat.convId = convId;
    etat.sujetId = sujetId || null;
    etat.recherche = "";
    const c = convParId(conversations, convId);
    if (!c) return;
    const voletPret = memeConv && !!$("msgScroller");
    if (!voletPret) batirVolet(c);
    racine.classList.add("volet-ouvert");
    const afficher = () => {
      $("msgBarreRecherche").hidden = true;
      $("msgChampRecherche").value = "";
      fermerMentions();
      const fil = filCourant().fil;
      ouvrirFil(fil);
      vuePendante = null;
      rendreFilCourant(false);
      rendreListe();
      allerAuRepere();
    };
    const zones = voletPret ? [racine.querySelector(".msg-zone-fil")] : [];
    if (!voletPret || avant === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches || (avant && avant.sujet === filCourant().sujet)) {
      afficher();
      sujetActifEnPremier();
      return;
    }
    // Meme conversation, autre sujet : la pastille glisse tout de suite, le fil attend (sortie 0,3 s, changement, retour 0,3 s).
    rendreBande(c);
    sujetActifEnPremier();
    zones.forEach((z) => z.classList.add("msg-fil-sortie"));
    minuteurSujet = setTimeout(() => {
      afficher();
      // Le bouton « … » (laptop) apparait avec afficher() et retrecit la bande apres le calcul de la butee : on recale (sans effet si deja en place).
      sujetActifEnPremier();
      zones.forEach((z) => {
        z.classList.remove("msg-fil-sortie");
        z.classList.add("msg-fil-entree");
        void z.offsetHeight;
        z.classList.remove("msg-fil-entree");
      });
    }, 300);
  }
  let minuteurSujet = null;

  // ---------- Envoi ----------
  function envoyerMessage() {
    const cur = filCourant();
    if (!cur || (cur.sujet && cur.sujet.statut === "clos")) return;
    const saisie = $("msgSaisie");
    const texte = saisie.value.trim();
    if (!texte && !vuePendante) return;
    // Personnes notifiees : celles dont « @Nom » figure encore, en entier, dans le texte envoye.
    const mentions = Array.from(new Set(occurrences(texte, mentionnables().map((id) => ({ id, nom: personne(id).nom }))).map((o) => o.id)));
    ajouterMessage(cur.fil, { auteur: MOI, quand: instant(), texte, vue: vuePendante || undefined, mentions: mentions.length ? mentions : undefined });
    vuePendante = null;
    saisie.value = "";
    fermerMentions();
    ajusterSaisie(saisie);
    rendreVuePendante();
    rendreMessages(false);
    rendreListe();
    allerAuDernier();
  }

  function ajusterSaisie(champ) {
    champ.style.height = "auto";
    champ.style.height = Math.min(champ.scrollHeight, 120) + "px";
  }

  // ---------- Mentions (@) dans le composeur ----------
  // « @ » en debut de mot ouvre la liste des personnes mentionnables : membres du groupe, interlocuteur d'un 1 a 1, ou personnes taguees du
  // sujet ouvert, sans Vous. Meme table de personnes que « + Personne ». La liste ne prend jamais le focus du champ.
  let mentionCourante = null; // { debut, ids, actif }
  let appuiSurMentions = false;

  function mentionnables() {
    const cur = filCourant();
    if (!cur) return [];
    return (cur.sujet ? cur.sujet.tagues : cur.c.membres).filter((p) => p !== MOI);
  }

  function fermerMentions() {
    mentionCourante = null;
    const liste = $("msgMentions");
    if (!liste) return;
    liste.hidden = true;
    liste.innerHTML = "";
    $("msgSaisie").removeAttribute("aria-activedescendant");
  }

  function rendreMentions() {
    const { ids, actif } = mentionCourante;
    const liste = $("msgMentions");
    liste.innerHTML = ids.map((id, i) => '<button type="button" role="option" tabindex="-1" id="msgMention' + i + '" class="msg-mention-option' + (i === actif ? " actif" : "") +
      '" data-act="mention" data-p="' + echapper(id) + '" aria-selected="' + (i === actif) + '"><b>' + echapper(personne(id).nom) + "</b><span>" + echapper(personne(id).role) + "</span></button>").join("");
    liste.hidden = false;
    $("msgSaisie").setAttribute("aria-activedescendant", "msgMention" + actif);
    const option = $("msgMention" + actif);
    if (option) option.scrollIntoView({ block: "nearest" });
  }

  function majMentions() {
    const saisie = $("msgSaisie");
    if (!saisie || saisie.disabled || saisie.selectionStart !== saisie.selectionEnd) { fermerMentions(); return; }
    const req = requeteMention(saisie.value, saisie.selectionStart);
    const ids = req ? filtrerPersonnes(mentionnables(), (id) => personne(id).nom, req.requete) : [];
    if (!ids.length) { fermerMentions(); return; }
    const memeRequete = mentionCourante && mentionCourante.debut === req.debut && mentionCourante.requete === req.requete;
    mentionCourante = { debut: req.debut, requete: req.requete, ids, actif: memeRequete ? mentionCourante.actif : 0 };
    rendreMentions();
  }

  function choisirMention(id) {
    const saisie = $("msgSaisie");
    if (!mentionCourante || !mentionCourante.ids.includes(id)) return;
    saisie.setRangeText("@" + personne(id).nom + " ", mentionCourante.debut, saisie.selectionStart, "end");
    fermerMentions();
    ajusterSaisie(saisie);
    saisie.focus({ preventScroll: true });
  }

  // Touches de la liste ouverte (flèches, Entrée ou Tab pour choisir, Échap pour fermer) ; renvoie true si la touche est consommee.
  function toucheMentions(e) {
    if (!mentionCourante || e.isComposing) return false;
    const n = mentionCourante.ids.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      mentionCourante.actif = (mentionCourante.actif + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      rendreMentions();
    } else if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
      choisirMention(mentionCourante.ids[mentionCourante.actif]);
    } else if (e.key === "Escape") {
      fermerMentions();
      e.stopPropagation();
    } else return false;
    e.preventDefault();
    return true;
  }

  // ---------- Dialogues (nouveau sujet, historique, agrandissement) ----------
  function ouvrirDialogue(html, libelle, declencheur) {
    const boite = $("msgDialogue");
    declencheurDialogue = declencheur || document.activeElement;
    boite.hidden = false;
    boite.innerHTML = '<div class="msg-carte" role="dialog" aria-modal="true" aria-label="' + echapper(libelle) + '">' + html +
      '<button type="button" class="msg-croix" data-act="fermer-dialogue" aria-label="Fermer">\u2715</button></div>';
    const premierChamp = boite.querySelector("[autofocus], input, textarea, button");
    if (premierChamp) premierChamp.focus();
  }
  function fermerDialogue() {
    fermerMenuStatut();
    const boite = $("msgDialogue");
    if (boite.hidden) return;
    boite.hidden = true;
    boite.innerHTML = "";
    if (declencheurDialogue && document.contains(declencheurDialogue) && declencheurDialogue.focus) declencheurDialogue.focus();
    declencheurDialogue = null;
    if (rouvrirFeuilleApresDialogue) { rouvrirFeuilleApresDialogue = false; if (mobile()) ouvrirFeuille(true); else ouvrirInfosLaptop($("msgInfosSujet")); }
  }
  const dialogueOuvert = () => !!$("msgDialogue") && !$("msgDialogue").hidden;

  // Conversations avec non lus d'abord, puis le reste dans l'ordre de la liste (meme tri que rendreListe).
  function conversationsParPriorite() {
    return conversations.slice().sort((a, b) => {
      const ua = nonLusConv(a) > 0;
      const ub = nonLusConv(b) > 0;
      if (ua !== ub) return ua ? -1 : 1;
      return activiteConv(b) - activiteConv(a);
    });
  }

  // On peut cocher plusieurs personnes puis « Valider » ; fermer (croix, Annuler, fond) ramene a la carte « Infos du sujet »
  // quand l'ajout en vient (carte sur mobile, modale « Infos du sujet » sur laptop).
  let rouvrirFeuilleApresDialogue = false;
  function majBoutonValiderAjout() {
    const n = $("msgDialogue").querySelectorAll('[data-act="choisir-ajout"][aria-pressed="true"]').length;
    const b = $("msgDialogue").querySelector('[data-act="valider-ajout"]');
    if (!b) return;
    b.textContent = n > 0 ? "Valider (" + n + ")" : "Valider";
    b.disabled = n === 0;
  }
  function validerAjoutPersonnes() {
    const cur = filCourant();
    if (!cur || (cur.sujet && cur.sujet.statut === "clos")) return;
    const candidats = candidatsAjout(cur);
    const choisis = Array.from($("msgDialogue").querySelectorAll('[data-act="choisir-ajout"][aria-pressed="true"]')).map((b) => b.dataset.p)
      .filter((p) => candidats.includes(p));
    if (!choisis.length) return;
    if (cur.sujet) choisis.forEach((p) => ajouterPersonne(cur.sujet, p, instant()));
    else ajouterAuGroupe(cur.c, choisis);
    rafraichirApresChangement();
    fermerDialogue();
  }
  function ouvrirDialogueAjout(declencheur, depuisFeuille) {
    const cur = filCourant();
    if (!cur || (!cur.sujet && cur.c.type !== "groupe")) return;
    // Mobile et laptop (aligne le 22/10) : sélection multiple puis « Valider (n) ».
    rouvrirFeuilleApresDialogue = !!depuisFeuille;
    ouvrirDialogue(
      "<h3>Ajouter des personnes " + (cur.sujet ? "au sujet" : "au groupe") + "</h3>" +
      '<div class="msg-tags">' + candidatsAjout(cur).map((p) =>
        '<button type="button" data-act="choisir-ajout" data-p="' + echapper(p) + '" aria-pressed="false">' + avatarPersonne(p, "pt") + echapper(personne(p).nom) + "</button>").join("") + "</div>" +
      '<p class="msg-aide">Les personnes ajoutées verront tout l\'historique ' + (cur.sujet ? "de la conversation" : "du groupe") + " et recevront les nouveaux messages.</p>" +
      '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Annuler</button><button type="button" class="msg-envoyer" data-act="valider-ajout" disabled>Valider</button></div>',
      "Ajouter des personnes", declencheur);
  }

  function htmlVueJointe(vue) {
    return vue ? '<div><span class="msg-etiquette">Prise de vue jointe</span><div class="msg-vue-jointe">' + imageVue(vue) + "</div></div>" : "";
  }

  // Sujets non clos de la conversation, avec leur statut : les sujets clos ne sont jamais proposes.
  function optionsSujetsOuverts(c) {
    return '<option value="">Conversation principale</option>' + c.sujets.filter((s) => s.statut !== "clos").map((s) =>
      '<option value="' + echapper(s.id) + '"># ' + echapper(s.titre) + " (" + LIBELLES_STATUT[s.statut] + (s.nonLus ? ", " + s.nonLus + " non lus" : "") + ")</option>").join("");
  }

  // Contenu de la carte du dialogue : mode « sujet » (nouveau sujet) ou « conversation » (ajouter la vue a un fil existant).
  function htmlDialogueSujet(mode, convId, vue, choixConversation) {
    const existant = mode === "conversation";
    const bascule = choixConversation
      ? '<div class="msg-bascule">' +
        '<button type="button" data-act="mode-dialogue" data-v="sujet" aria-pressed="' + !existant + '">Nouveau sujet</button>' +
        '<button type="button" data-act="mode-dialogue" data-v="conversation" aria-pressed="' + existant + '">Conversation existante</button></div>'
      : "";
    if (existant) {
      const c = convParId(conversations, convId);
      return "<h3>Ajouter la vue à une conversation</h3>" + bascule +
        '<div><label for="msgAjConv">Conversation</label><select id="msgAjConv">' +
        conversationsParPriorite().map((k) => {
          const n = nonLusConv(k);
          return '<option value="' + echapper(k.id) + '"' + (k.id === convId ? " selected" : "") + ">" + echapper(k.nom) + (n ? " : " + n + " non lus" : "") + "</option>";
        }).join("") + "</select></div>" +
        '<div><label for="msgAjSujet">Où l\'ajouter</label><select id="msgAjSujet">' + optionsSujetsOuverts(c) + "</select></div>" +
        '<div><label for="msgAjMessage">Message (facultatif)</label><textarea id="msgAjMessage"></textarea></div>' +
        htmlVueJointe(vue) +
        '<p class="msg-aide">Les sujets clos ne sont pas proposés : rouvrez-les d\'abord depuis leur conversation.</p>' +
        '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Annuler</button><button type="button" class="msg-envoyer" data-act="ajouter-vue">Ajouter la vue</button></div>';
    }
    return "<h3>Nouveau sujet</h3>" + bascule +
      (choixConversation ? '<div><label for="msgNsConv">Conversation</label><select id="msgNsConv">' +
        conversations.map((c) => '<option value="' + echapper(c.id) + '"' + (c.id === convId ? " selected" : "") + ">" + echapper(c.nom) + "</option>").join("") + "</select></div>" : "") +
      '<div><label for="msgNsTitre">Titre</label><input id="msgNsTitre" placeholder="Ex. Collision gaine / poutre axe C" autocomplete="off" /></div>' +
      '<div><label for="msgNsMessage">Premier message</label><textarea id="msgNsMessage"></textarea></div>' +
      '<div class="msg-case"><button type="button" id="msgNsUrgent" class="msg-urgent-bouton" data-act="bascule-urgent-ns" aria-pressed="false">Urgent</button></div>' +
      htmlVueJointe(vue) +
      '<div id="msgNsTags"></div>' +
      '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Annuler</button><button type="button" class="msg-envoyer" data-act="creer-sujet">Créer le sujet</button></div>';
  }

  // Apres (re)dessin de la carte : tags du mode « sujet », focus sur le premier champ du mode actif.
  function activerDialogueSujet(mode) {
    const boite = $("msgDialogue");
    if (mode === "conversation") {
      $("msgAjConv").focus();
      return;
    }
    rendreTags(boite.dataset.convId);
    const champ = $("msgNsTitre");
    if (champ) champ.focus();
  }

  function ouvrirDialogueSujet({ convId, vue, choixConversation, declencheur }) {
    const idDefaut = convId || (conversations.find((c) => c.general) || conversations.find((c) => c.type === "groupe") || conversations[0]).id;
    const selection = { convId: idDefaut, vue: vue || null, choixConversation: !!choixConversation };
    ouvrirDialogue(htmlDialogueSujet("sujet", idDefaut, selection.vue, selection.choixConversation), "Nouveau sujet", declencheur);
    $("msgDialogue").dataset.convId = selection.convId;
    $("msgDialogue").dataset.choix = selection.choixConversation ? "1" : "";
    vueDialogue = selection.vue;
    activerDialogueSujet("sujet");
  }

  // Bascule « Nouveau sujet » / « Conversation existante » : la carte est redessinee, la conversation choisie est conservee.
  function changerModeDialogue(mode) {
    const boite = $("msgDialogue");
    const carte = boite.querySelector(".msg-carte");
    carte.setAttribute("aria-label", mode === "conversation" ? "Ajouter la vue à une conversation" : "Nouveau sujet");
    carte.innerHTML = htmlDialogueSujet(mode, boite.dataset.convId, vueDialogue, true);
    activerDialogueSujet(mode);
  }

  // « Liste de noms » en francais : A, B et C.
  function listeNoms(noms) {
    return noms.length > 1 ? noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1] : noms.join("");
  }

  // Depuis un 1 a 1, ajouter des tiers deplace le sujet vers le plus petit groupe qui reunit tout le monde (le 1 a 1 reste prive).
  function groupePour(c, ajoutes) {
    const besoin = c.membres.concat(ajoutes);
    return conversations.filter((g) => g.type === "groupe" && besoin.every((p) => g.membres.includes(p)))
      .sort((x, y) => x.membres.length - y.membres.length)[0] || null;
  }

  // Mobile et laptop (aligne le 22/10), depuis « + Sujet » ou le menu « ⋯ » : le sujet est toujours cree dans la conversation courante (groupe ou 1 a 1), aucun choix de personnes ni phrase de placement.
  // Depuis le Viewer (choix de la conversation proposé), la modale garde ses tags.
  function sujetDansConversationCourante() {
    return $("msgDialogue").dataset.choix !== "1";
  }

  function personnesTaguees() {
    return Array.from($("msgDialogue").querySelectorAll('#msgTags [aria-pressed="true"]')).map((b) => b.dataset.p);
  }

  function majOuSujet() {
    const zone = $("msgNsOu");
    if (!zone) return;
    const c = convParId(conversations, $("msgDialogue").dataset.convId);
    const interlocuteur = personne(c.membres.find((p) => p !== MOI)).nom;
    const ajoutes = personnesTaguees();
    const groupe = ajoutes.length && groupePour(c, ajoutes);
    if (!ajoutes.length) zone.textContent = "Sujet avec " + interlocuteur + ". Il apparaît sous la conversation principale.";
    else if (!groupe) zone.textContent = "Aucun groupe ne réunit ces personnes.";
    // Mobile : seul le placement est indique, les personnes choisies sont deja visibles au-dessus.
    else if (mobile()) zone.textContent = "Votre conversation reste privée : le sujet s'ouvrira dans le groupe « " + groupe.nom + " ».";
    else zone.textContent = "Votre conversation reste privée : le sujet s'ouvrira dans le groupe « " + groupe.nom + " », avec " + listeNoms([interlocuteur].concat(ajoutes.map((p) => personne(p).nom))) + " tagués.";
  }

  function boutonsTags(ids) {
    return ids.map((p) => '<button type="button" data-act="tag" data-p="' + echapper(p) + '" aria-pressed="false">' + avatarPersonne(p, "pt") + echapper(personne(p).nom) + "</button>").join("");
  }

  function rendreTags(convId) {
    const c = convParId(conversations, convId);
    const autres = c.membres.filter((m) => m !== MOI);
    // Sujet dans la conversation courante (22/10, laptop et mobile) : aucune phrase de placement, le conteneur est masque pour ne pas ajouter d'espace (gap de la carte).
    if (sujetDansConversationCourante()) {
      $("msgNsTags").innerHTML = "";
      $("msgNsTags").hidden = true;
      return;
    }
    if (c.type === "groupe") {
      $("msgNsTags").innerHTML = '<span class="msg-etiquette">Taguer les personnes concernées</span><div class="msg-tags" id="msgTags">' + boutonsTags(autres) +
        '</div><p class="msg-aide">Seules les personnes taguées voient ce sujet.</p>';
      return;
    }
    const absents = Object.keys(personnes).filter((p) => !c.membres.includes(p));
    $("msgNsTags").innerHTML = (absents.length ? '<span class="msg-etiquette">Ajouter une personne (facultatif)</span><div class="msg-tags" id="msgTags">' + boutonsTags(absents) + "</div>" : "") +
      '<p class="msg-aide" id="msgNsOu"></p>';
    majOuSujet();
  }

  function creerSujetDepuisDialogue() {
    const boite = $("msgDialogue");
    const c = convParId(conversations, boite.dataset.convId);
    if (!c) return;
    const titre = $("msgNsTitre").value.trim() || "Nouveau sujet";
    const texte = $("msgNsMessage").value.trim() || titre;
    const autres = c.membres.filter((m) => m !== MOI);
    const choisies = personnesTaguees();
    const ajoutes = c.type === "individuel" ? choisies : [];
    // Mobile depuis « ⋯ » : sujet dans la conversation courante, tout le groupe est concerne (aucun tag a choisir).
    const tagues = c.type === "groupe" ? (sujetDansConversationCourante() ? autres : choisies) : autres.concat(ajoutes);
    // Avec des personnes ajoutees depuis un 1 a 1, le sujet s'ouvre dans le groupe qui les reunit ; le 1 a 1 ne recoit rien.
    const cible = ajoutes.length ? groupePour(c, ajoutes) : c;
    if (!cible) return;
    const sujet = creerSujet(cible, { titre, texte, tagues, vue: vueDialogue, quand: instant(), urgent: $("msgNsUrgent").getAttribute("aria-pressed") === "true" });
    declencheurDialogue = null;
    fermerDialogue();
    choisirOnglet(cible.type);
    ouvrirConversation(cible.id, sujet.id);
  }

  function ajouterVueDepuisDialogue() {
    const c = convParId(conversations, $("msgAjConv").value);
    if (!c) return;
    const sujetId = $("msgAjSujet").value || null;
    const fil = filActif(c, sujetId);
    if (!fil || fil.statut === "clos") return;
    const texte = $("msgAjMessage").value.trim();
    if (!texte && !vueDialogue) return;
    ajouterMessage(fil, { auteur: MOI, quand: instant(), texte, vue: vueDialogue || undefined });
    declencheurDialogue = null;
    fermerDialogue();
    choisirOnglet(c.type);
    ouvrirConversation(c.id, sujetId);
  }

  function nouveauSujetDepuisViewer(vue) {
    dialogueEnAttente = { vue, choixConversation: true };
    if (!demarre) preparer();
    allerA("discussions");
  }

  // ---------- Mobile : « + » de la liste (nouvelle conversation 1 a 1 / nouveau groupe) ----------
  // Personnes avec qui aucune conversation 1 a 1 n'existe encore (meme source que « + Personne » : la table des personnes).
  function contactsSansConversation() {
    const avec = new Set();
    conversations.filter((c) => c.type === "individuel").forEach((c) => c.membres.forEach((m) => avec.add(m)));
    return Object.keys(personnes).filter((p) => p !== MOI && !avec.has(p));
  }
  const boutonsPersonnes = (ids, act) => ids.map((p) =>
    '<button type="button" data-act="' + act + '" data-p="' + echapper(p) + '"' + (act === "choisir-membre" ? ' aria-pressed="false"' : "") + ">" + avatarPersonne(p, "pt") + echapper(personne(p).nom) + "</button>").join("");
  const sansAccent = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function ouvrirDialoguePlus(declencheur) {
    if (etat.onglet === "groupe") {
      ouvrirDialogue(
        "<h3>Nouveau groupe</h3>" +
        '<div><label for="msgGrNom">Nom du groupe</label><input id="msgGrNom" maxlength="60" autocomplete="off" /></div>' +
        '<div><span class="msg-etiquette">Personnes</span><div class="msg-tags" id="msgGrPersonnes">' + boutonsPersonnes(Object.keys(personnes).filter((p) => p !== MOI), "choisir-membre") + "</div></div>" +
        '<div class="msg-vide" id="msgGrDoublon" role="alert" hidden></div>' +
        '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Annuler</button><button type="button" class="msg-envoyer" data-act="creer-groupe" disabled>Valider</button></div>',
        "Nouveau groupe", declencheur);
      return;
    }
    const ids = contactsSansConversation();
    ouvrirDialogue(
      "<h3>Nouvelle conversation</h3>" +
      (ids.length
        ? '<input id="msgNcQ" type="search" placeholder="Rechercher une personne" aria-label="Rechercher une personne" autocomplete="off" />' +
          '<div class="msg-tags" id="msgNcListe">' + boutonsPersonnes(ids, "demarrer-conversation") + "</div>"
        : '<div class="msg-vide">Vous avez déjà une conversation avec toutes les personnes.</div>') +
      '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Annuler</button></div>',
      "Nouvelle conversation", declencheur);
    // Mobile : le champ de recherche ne prend pas le focus a l'ouverture (sur iPhone, le clavier cacherait la liste). Laptop : focus sur le champ.
    if (mobile()) $("msgDialogue").querySelector(".msg-croix").focus({ preventScroll: true });
    else if ($("msgNcQ")) $("msgNcQ").focus();
  }

  function filtrerContacts(q) {
    const cle = sansAccent(q.trim());
    $("msgNcListe").querySelectorAll("button").forEach((b) => { b.style.display = sansAccent(b.textContent).includes(cle) ? "" : "none"; });
  }

  function demarrerConversation(p) {
    if (!contactsSansConversation().includes(p)) return;
    const conv = creerConversation({ id: p, type: "individuel", nom: personne(p).nom, membres: [MOI, p], sousTitre: personne(p).role, quand: instant() });
    conversations.push(conv);
    declencheurDialogue = null;
    fermerDialogue();
    choisirOnglet("individuel");
    ouvrirConversation(conv.id, null);
  }

  // Groupe existant (y compris cree pendant la session) qui a exactement les memes membres que la selection, sans tenir compte de l'ordre.
  function groupeAvecMembres(ids) {
    const cle = (liste) => liste.filter((p) => p !== MOI).sort().join("|");
    const voulu = cle(ids);
    return conversations.find((c) => c.type === "groupe" && cle(c.membres.slice()) === voulu) || null;
  }

  const personnesChoisies = () => Array.from($("msgDialogue").querySelectorAll('[data-act="choisir-membre"][aria-pressed="true"]')).map((b) => b.dataset.p).filter((p) => personnes[p] && p !== MOI);

  const conversationIndividuelle = (p) => conversations.find((c) => c.type === "individuel" && c.membres.includes(p)) || null;
  const prenomDe = (p) => personne(p).nom.split(" ")[0];

  function majBoutonCreerGroupe() {
    const boite = $("msgDialogue");
    const choisis = personnesChoisies();
    const n = choisis.length;
    const b = boite.querySelector('[data-act="creer-groupe"]');
    if (!b) return;
    const seul = n === 1 ? choisis[0] : null;
    const convSeul = seul ? conversationIndividuelle(seul) : null;
    const doublon = n > 1 ? groupeAvecMembres(choisis) : null;
    const avis = $("msgGrDoublon");
    avis.hidden = !doublon && !seul;
    avis.textContent = doublon ? "Un groupe existe déjà avec ces personnes : " + doublon.nom + ". Pour échanger sur un autre sujet, utilisez les sujets de ce groupe."
      : seul ? (convSeul ? "Vous avez déjà une conversation avec " + prenomDe(seul) + "." : "Cela ouvrira une conversation avec " + prenomDe(seul) + ".") : "";
    b.textContent = seul ? (convSeul ? "Ouvrir la conversation" : "Valider") : n > 0 ? "Valider (" + n + ")" : "Valider";
    b.disabled = seul ? false : n === 0 || !$("msgGrNom").value.trim() || !!doublon;
  }

  function creerGroupeDepuisDialogue() {
    const nom = $("msgGrNom").value.trim();
    const choisis = personnesChoisies();
    // Une seule personne : jamais un groupe, on ouvre (ou crée) la conversation 1 to 1.
    if (choisis.length === 1) {
      const existante = conversationIndividuelle(choisis[0]);
      if (existante) {
        declencheurDialogue = null;
        fermerDialogue();
        choisirOnglet("individuel");
        ouvrirConversation(existante.id, null);
      } else demarrerConversation(choisis[0]);
      return;
    }
    if (!nom || !choisis.length || groupeAvecMembres(choisis)) return;
    const quand = instant();
    conversations.push(creerConversation({ id: "g" + quand.getTime(), type: "groupe", nom, membres: [MOI].concat(choisis), sousTitre: (choisis.length + 1) + " participants", quand }));
    declencheurDialogue = null;
    fermerDialogue();
    choisirOnglet("groupe");
  }

  function ouvrirHistorique() {
    const cur = filCourant();
    const clos = sujetsClos(cur.c);
    // Mobile et laptop (aligne le 22/10) : « Sujets clôturés », la liste seule, sans recherche ni bouton « Fermer » (croix, Échap et clic hors carte ferment).
    ouvrirDialogue(
      "<h3>Sujets clôturés (" + clos.length + ")</h3>" + '<div class="msg-histo" id="msgHistoListe"></div>',
      "Sujets clôturés", $("msgHistorique"));
    $("msgHistoListe").innerHTML = clos.map((s) =>
      '<button type="button" class="msg-histo-ligne" data-act="ouvrir-clos" data-s="' + echapper(s.id) + '"><b># ' + echapper(s.titre) + "</b><span>Clos par " + echapper(personne(s.closPar).nom) + " le " +
      s.closLe.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " &middot; " + s.messages.length + " messages</span></button>").join("") || '<div class="msg-vide">Aucun sujet clôturé.</div>';
  }

  // ---------- Prises de vue : piece jointe en attente, menu, mode « prendre une vue dans le Viewer » ----------
  function copieVue(vue) {
    return { seed: vue.seed, niveau: vue.niveau, modeles: vue.modeles, image: vue.image, etat: vue.etat };
  }

  function rendreVuePendante() {
    const zone = $("msgVuePendante");
    if (!zone) return;
    if (!vuePendante) {
      zone.hidden = true;
      zone.innerHTML = "";
      return;
    }
    zone.hidden = false;
    zone.innerHTML = '<span class="msg-puce-vue"><span class="msg-puce-img">' + imageVue(vuePendante) + "</span><span>Prise de vue jointe</span></span>" +
      '<button type="button" class="msg-retirer" data-act="retirer-vue" aria-label="Retirer la prise de vue">&times;</button>';
  }

  // Bandeau affiche sur le Viewer pendant la prise de vue.
  let bandeau = null;
  function creerBandeau() {
    bandeau = document.createElement("div");
    bandeau.id = "msgBandeauVue";
    bandeau.setAttribute("role", "region");
    bandeau.setAttribute("aria-label", "Prise de vue pour la messagerie");
    bandeau.hidden = true;
    bandeau.innerHTML = '<span>Cadre la maquette puis valide la vue</span><button type="button" data-act="valider">Valider</button><button type="button" data-act="annuler">Annuler</button>';
    bandeau.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "valider") validerPriseDeVue();
      else annulerPriseDeVue(true);
    });
    document.body.appendChild(bandeau);
  }
  function montrerBandeau(visible) {
    if (visible && !bandeau) creerBandeau();
    if (bandeau) bandeau.hidden = !visible;
    document.body.classList.toggle("msg-vue-actif", visible); // mobile : decale la barre d'outils du Viewer sous le bandeau
  }

  // Bandeau « vue de la conversation » : affiche sur le Viewer ouvert depuis une vue de conversation, avec retour direct.
  // Meme emplacement et meme composant visuel que le bandeau de prise de vue, les deux modes sont exclusifs.
  let retourConversationActif = false;
  let bandeauRetour = null;
  // Contexte de depart memorise a l'appui sur une image : { convId, sujetId, message }.
  let departVue = null;
  // distanceBas : position du fil (distance au bas) pour la restituer au retour ; feuille : la carte « Infos du sujet » etait ouverte.
  function memoriserDepart(message, feuille) {
    const zone = $("msgScroller");
    departVue = { convId: etat.convId, sujetId: etat.sujetId, message: message || null, feuille: !!feuille, distanceBas: zone ? zone.scrollHeight - zone.scrollTop : null };
  }
  // Remet le fil a la position memorisee (a defaut : en bas), apres le rendu du fil.
  function restaurerDefilement(distanceBas) {
    const viser = () => {
      const zone = $("msgScroller");
      if (!zone) return;
      zone.scrollTop = distanceBas == null ? zone.scrollHeight : Math.max(0, zone.scrollHeight - distanceBas);
      defilementMemorise = zone.scrollTop;
      synchroniserBoutonBas();
    };
    viser();
    setTimeout(viser, 400);
  }
  // Fait defiler le fil jusqu'a l'image du message (apres le rendu du fil, qui peut etre differe de 0,3 s lors d'un changement de sujet).
  function montrerMessageDeVue(message) {
    const viser = () => {
      const i = vuesAffichees.indexOf(message);
      const bouton = i < 0 ? null : racine.querySelector('.msg-vue[data-vp="' + i + '"]');
      if (!bouton) return;
      bouton.scrollIntoView({ block: "center" });
      defilementMemorise = $("msgScroller").scrollTop;
      synchroniserBoutonBas();
    };
    viser();
    setTimeout(viser, 400);
  }
  function montrerBandeauRetour(visible) {
    if (visible && !bandeauRetour) {
      bandeauRetour = document.createElement("div");
      bandeauRetour.id = "msgBandeauRetour";
      bandeauRetour.setAttribute("role", "region");
      bandeauRetour.setAttribute("aria-label", "Vue d'une conversation");
      bandeauRetour.hidden = true;
      bandeauRetour.innerHTML = '<button type="button" data-act="retour-conversation">\u2190 Retour à la conversation</button>';
      bandeauRetour.addEventListener("click", (e) => {
        if (!e.target.closest('[data-act="retour-conversation"]')) return;
        retourConversationActif = false;
        montrerBandeauRetour(false);
        allerA("discussions");
        // Retour exactement au point de depart : conversation, sujet, et message de l'image visible.
        const depart = departVue || { convId: etat.convId, sujetId: etat.sujetId, message: null };
        if (depart.convId) {
          ouvrirConversation(depart.convId, depart.sujetId);
          if (depart.message) montrerMessageDeVue(depart.message);
          else restaurerDefilement(depart.distanceBas);
          if (depart.feuille) { if (mobile()) ouvrirFeuille(true); else ouvrirInfosLaptop($("msgInfosSujet")); }
        }
      });
      document.body.appendChild(bandeauRetour);
    }
    if (!bandeauRetour) return;
    bandeauRetour.hidden = !visible;
    document.body.classList.toggle("msg-retour-actif", visible); // decale la barre d'outils du Viewer sous le bandeau
  }
  // Appelee par main.js : vrai quand le Viewer vient d'etre ouvert sur une vue de conversation, faux des qu'on quitte cet etat.
  function vueDeConversation(actif) {
    retourConversationActif = actif;
    montrerBandeauRetour(actif && !priseDeVueEnCours);
  }

  function demarrerPriseDeVue() {
    priseDeVueEnCours = true;
    allerA("viewer");
    // Le bandeau apparait quand la page Viewer est effectivement affichee (surVueActivee).
  }
  function validerPriseDeVue() {
    vuePendante = capturerVue();
    priseDeVueEnCours = false;
    montrerBandeau(false);
    allerA("discussions");
    // Retour dans la conversation : la vue validee s'affiche en piece jointe et le curseur est dans le champ pour la commenter.
    rendreVuePendante();
    const saisie = $("msgSaisie");
    if (saisie) saisie.focus();
  }
  function annulerPriseDeVue(retour) {
    priseDeVueEnCours = false;
    montrerBandeau(false);
    if (retour) allerA("discussions");
  }

  // ---------- Evenements ----------
  // Geste neutre : pendant l'appui qui ferme le menu, les evenements pointeur/tactile/souris/clic sont absorbes (capture sur document),
  // le drapeau est retire 400 ms apres la fin du geste (garde-fou a 5 s).
  let gesteNeutre = false;
  let gesteNeutreTimer = 0;
  const EVENEMENTS_ABSORBES = ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "mousedown", "mousemove", "mouseup", "click", "dblclick", "contextmenu"];
  function absorberGesteNeutre() {
    gesteNeutre = true;
    clearTimeout(gesteNeutreTimer);
    gesteNeutreTimer = setTimeout(() => { gesteNeutre = false; }, 5000);
  }
  function terminerGesteNeutre() {
    if (!gesteNeutre) return;
    clearTimeout(gesteNeutreTimer);
    gesteNeutreTimer = setTimeout(() => { gesteNeutre = false; }, 400);
  }

  function fermerMenu() {
    const menu = $("msgMenu");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    $("msgOptions").setAttribute("aria-expanded", "false");
  }

  function surClic(e) {
    if (clicFondAbsorbe && (e.target === $("msgDialogue") || e.target === $("msgFeuille"))) { clicFondAbsorbe = false; return; }
    // Clic sur le fond sombre autour d'un dialogue : on le ferme (comme Échap)
    if (e.target === $("msgDialogue")) { fermerDialogue(); return; }
    // Clic sur le fond de la carte « Infos du sujet » : on la ferme.
    if (e.target === $("msgFeuille")) { fermerFeuille(); return; }
    const cible = e.target.closest("[data-act]");
    // Menu « ⋯ » (mobile) : un appui en dehors le ferme ; le choix d'une entree le ferme aussi.
    if (!e.target.closest("#msgOptions, #msgMenu")) fermerMenu();
    if (e.target.id === "msgSaisie") majMentions();
    if (!cible || !racine.contains(cible)) return;
    const act = cible.dataset.act;
    if (cible.closest("#msgMenu")) fermerMenu();
    const cur = filCourant();
    switch (act) {
      case "onglet": choisirOnglet(cible.dataset.v); break;
      case "conversation": ouvrirConversation(cible.dataset.id, null); break;
      case "retour": racine.classList.remove("volet-ouvert"); break;
      case "options": {
        const ouvrir = $("msgMenu").hidden;
        $("msgMenu").hidden = !ouvrir;
        cible.setAttribute("aria-expanded", String(ouvrir));
        break;
      }
      case "infos": ouvrirFeuille(); break;
      case "infos-sujet": ouvrirInfosLaptop(cible); break;
      case "fermer-feuille": fermerFeuille(); $("msgOptions").focus(); break;
      case "recherche-conv": {
        const barre = $("msgBarreRecherche");
        barre.hidden = !barre.hidden;
        cible.setAttribute("aria-expanded", String(!barre.hidden));
        if (!barre.hidden) $("msgChampRecherche").focus();
        else { etat.recherche = ""; $("msgChampRecherche").value = ""; rendreMessages(false); allerAuRepere(); }
        break;
      }
      case "sujet": ouvrirConversation(etat.convId, cible.dataset.s || null); break;
      case "ouvrir-sujet": ouvrirConversation(etat.convId, cible.dataset.s); break;
      case "vers-principal": ouvrirConversation(etat.convId, null); break;
      case "plus-ancien": cur.fil.affiches += TAILLE_PAQUET; rendreMessages(true); break;
      case "bas": allerAuDernier(); break;
      case "agrandir": { const m = vuesAffichees[Number(cible.dataset.vp)]; memoriserDepart(m); ouvrirDansViewer(m.vue); break; }
      case "agrandir-origine": {
        const depuisInfos = !!cible.closest("#msgFeuille, .msg-carte-infos");
        fermerFeuille(true);
        if (cible.closest(".msg-carte-infos")) { declencheurDialogue = null; fermerDialogue(); }
        memoriserDepart(null, depuisInfos);
        ouvrirDansViewer(vueOrigine(cur.sujet).vue);
        break;
      }
      case "urgence": {
        if (!cur.sujet || cur.sujet.statut === "clos") break;
        const dansCarte = !!cible.closest("#msgFeuille, .msg-carte-infos");
        basculerUrgence(cur.sujet, instant());
        rafraichirApresChangement();
        const bouton = dansCarte ? racine.querySelector('#msgFeuilleCarte [data-act="urgence"], .msg-carte-infos [data-act="urgence"]') : null;
        if (bouton) bouton.focus();
        break;
      }
      case "statut-menu": ouvrirMenuStatut(cible); break;
      case "choisir-statut": choisirStatut(cible.dataset.valeur); break;
      case "rouvrir": rouvrir(cur.c, cur.sujet, instant()); rafraichirApresChangement(); break;
      case "historique": ouvrirHistorique(); break;
      case "ouvrir-clos": {
        const id = cible.dataset.s;
        declencheurDialogue = null;
        fermerDialogue();
        ouvrirConversation(etat.convId, id);
        break;
      }
      case "nouveau-sujet": ouvrirDialogueSujet({ convId: etat.convId, declencheur: cible }); break;
      case "creer-sujet": creerSujetDepuisDialogue(); break;
      case "bascule-urgent-ns": cible.setAttribute("aria-pressed", String(cible.getAttribute("aria-pressed") !== "true")); break;
      case "mode-dialogue": if (cible.getAttribute("aria-pressed") !== "true") changerModeDialogue(cible.dataset.v); break;
      case "ajouter-vue": ajouterVueDepuisDialogue(); break;
      case "tag": cible.setAttribute("aria-pressed", String(cible.getAttribute("aria-pressed") !== "true")); majOuSujet(); break;
      case "ouvrir-ajout": {
        const depuisFeuille = !!cible.closest("#msgFeuille");
        const depuisInfos = !!cible.closest(".msg-carte-infos");
        if (depuisFeuille) {
          const corps = $("msgFeuilleCarte").querySelector(".msg-feuille-corps");
          defilementCorpsFeuille = corps ? corps.scrollTop : 0;
          fermerFeuille(true);
        }
        ouvrirDialogueAjout(depuisFeuille ? $("msgOptions") : depuisInfos ? $("msgInfosSujet") : cible, depuisFeuille || depuisInfos);
        break;
      }
      case "choisir-ajout": cible.setAttribute("aria-pressed", String(cible.getAttribute("aria-pressed") !== "true")); majBoutonValiderAjout(); break;
      case "valider-ajout": validerAjoutPersonnes(); break;
      case "plus-conversation": ouvrirDialoguePlus(cible); break;
      case "demarrer-conversation": demarrerConversation(cible.dataset.p); break;
      case "choisir-membre": cible.setAttribute("aria-pressed", String(cible.getAttribute("aria-pressed") !== "true")); majBoutonCreerGroupe(); break;
      case "creer-groupe": creerGroupeDepuisDialogue(); break;
      case "fermer-dialogue": fermerDialogue(); break;
      case "mention": choisirMention(cible.dataset.p); break;
      case "envoyer": envoyerMessage(); break;
      case "prendre-vue": demarrerPriseDeVue(); break;
      case "retirer-vue": vuePendante = null; rendreVuePendante(); break;
      default: break;
    }
  }

  function surSaisie(e) {
    const id = e.target.id;
    if (id === "msgChampRecherche") {
      etat.recherche = e.target.value;
      rendreMessages(false);
      if (!etat.recherche) allerAuRepere();
    } else if (id === "msgSaisie") { ajusterSaisie(e.target); majMentions(); }
    else if (id === "msgNcQ") filtrerContacts(e.target.value);
    else if (id === "msgGrNom") majBoutonCreerGroupe();
  }

  function surChangement(e) {
    if (e.target.id === "msgNsConv") {
      $("msgDialogue").dataset.convId = e.target.value;
      rendreTags(e.target.value);
    } else if (e.target.id === "msgAjConv") {
      $("msgDialogue").dataset.convId = e.target.value;
      $("msgAjSujet").innerHTML = optionsSujetsOuverts(convParId(conversations, e.target.value));
    }
  }

  function surTouche(e) {
    if (e.target.id === "msgSaisie" && toucheMentions(e)) return;
    if (e.target.id === "msgSaisie" && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      envoyerMessage();
      return;
    }
    // Piege du focus dans le dialogue ouvert.
    if (e.key === "Tab" && dialogueOuvert()) {
      const focalisables = Array.from($("msgDialogue").querySelectorAll("button:not([disabled]), input, textarea, select"));
      if (!focalisables.length) return;
      const premier = focalisables[0];
      const dernier = focalisables[focalisables.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    }
  }

  function surEchap(e) {
    if (e.key !== "Escape" || racine.closest(".view").hidden) return;
    if ($("msgFeuille") && !$("msgFeuille").hidden) { fermerFeuille(); $("msgOptions").focus(); return; }
    if ($("msgMenu") && !$("msgMenu").hidden) { fermerMenu(); $("msgOptions").focus(); return; }
    if (dialogueOuvert()) { fermerDialogue(); return; }
  }

  return { preparer, surVueActivee, vueDeConversation, nouveauSujetDepuisViewer, rechargerVues, priseDeVueEnCours: () => priseDeVueEnCours };
}
