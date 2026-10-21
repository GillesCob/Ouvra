// Messagerie de la page Discussions (interrupteur DISCUSSIONS_MESSAGERIE de src/main.js).
// Specification fonctionnelle : mockup Projets/Ouvra/mockups/ouvra-discussions-messagerie.html.
//
// creerMessagerie(options) renvoie l'API que main.js branche sur la navigation :
//   preparer()                       charge les donnees (une seule fois) et le compteur de la navbar
//   surVueActivee(nomVue)            appelee a chaque changement de page
//   nouveauSujetDepuisViewer(vue)    bouton « Nouvelle discussion » du Viewer
// options : { racine, lienNavbar, capturerVue(), allerA(nomVue), ouvrirDansViewer(vue) }
import "./messagerie.css";
import {
  MOI, LIBELLES_STATUT, STATUTS_ACTIFS, TAILLE_PAQUET,
  dernierMessage, nonLusConv, activiteConv, filActif, ouvrirFil, fermerRepere, ajouterMessage,
  changerStatut, ajouterPersonne, basculerUrgence, estUrgent, convAUrgent, cloturer, rouvrir, creerSujet, vueOrigine, sujetsClos, sujetsTries, convParId
} from "./messagerieDonnees.js";
import { echapper, heureMinute, cleJour, libelleJour, heureCourte, dateHeure, initiales, prenom } from "./format.js";
import { imageVue, legendeVue, chargerBanque, attribuerBanque } from "./vuesMessagerie.js";

const ICONE_APPAREIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICONE_LOUPE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const VERBES_JOURNAL = { ouverture: "ouvert le sujet", cloture: "clos le sujet", reouverture: "rouvert le sujet" };
const MOBILE = "(max-width: 768px)";

export function creerMessagerie({ racine, lienNavbar, capturerVue, allerA, ouvrirDansViewer }) {
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
  const etat = { onglet: "individuel", seulementNonLus: false, q: "", convId: null, sujetId: null, recherche: "" };

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
        '<div class="msg-outils">' +
          '<input id="msgRecherche" type="search" placeholder="Rechercher" aria-label="Rechercher une conversation" autocomplete="off" />' +
          '<button type="button" class="msg-filtre" id="msgNonLus" data-act="non-lus" aria-pressed="false">Non lus</button>' +
        "</div>" +
        '<div class="msg-liste" id="msgListe" role="tabpanel" aria-labelledby="msgOngletIndividuel"></div>' +
        '<div class="msg-demo">Échanges fictifs, pour la démonstration</div>' +
      "</aside>" +
      '<section class="msg-volet" id="msgVolet" aria-label="Conversation"><p class="msg-volet-vide">Choisissez une conversation.</p></section>' +
      '<div class="msg-dialogue" id="msgDialogue" hidden></div>';
    const observateurOnglets = new ResizeObserver(placerPastilleOnglets);
    racine.querySelectorAll('.msg-onglets [role="tab"]').forEach((b) => observateurOnglets.observe(b));
    racine.addEventListener("click", surClic);
    racine.addEventListener("input", surSaisie);
    racine.addEventListener("keydown", surTouche);
    racine.addEventListener("change", surChangement);
    document.addEventListener("click", fermerMenuVueSiExterieur);
    document.addEventListener("keydown", surEchap);
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
    if (priseDeVueEnCours && nomVue !== "viewer") annulerPriseDeVue(false);
    montrerBandeau(priseDeVueEnCours && nomVue === "viewer");
  }

  function afficher() {
    if (!monte || !conversations.length) return;
    montrerBandeau(false);
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
    const quiPrefixe = c.type === "groupe" && dm.auteur !== MOI ? prenom(personne(dm.auteur).nom) + " : " : (dm.auteur === MOI ? "Vous : " : "");
    const apercu = quiPrefixe + (dm.texte || "Prise de vue").replace(/^@Vous /, "");
    const urgent = convAUrgent(c) ? '<span class="msg-badge msg-badge-urgent" title="Sujet urgent" aria-label="Sujet urgent">!</span>' : "";
    const mention = c.principal.mentions ? '<span class="msg-badge msg-badge-mention" title="Vous êtes mentionné" aria-label="Vous êtes mentionné">@</span>' : "";
    return '<button type="button" class="msg-conv' + (n ? " non-lu" : "") + (c.id === etat.convId ? " actif" : "") + '" data-act="conversation" data-id="' + echapper(c.id) + '"' +
      (c.id === etat.convId ? ' aria-current="true"' : "") + ">" +
      avatarConv(c) +
      '<span class="msg-conv-nom">' + echapper(c.nom) + "</span>" +
      '<span class="msg-conv-heure">' + heureCourte(activiteConv(c), instant()) + "</span>" +
      '<span class="msg-conv-apercu">' + echapper(apercu) + "</span>" +
      '<span class="msg-conv-droite">' + urgent + mention + (n ? '<span class="msg-badge" aria-label="' + n + ' non lus">' + (n > 99 ? "99+" : n) + "</span>" : "") + "</span>" +
      "</button>";
  }

  function rendreListe() {
    const q = etat.q.trim().toLowerCase();
    const items = conversations
      .filter((c) => c.type === etat.onglet && (!q || c.nom.toLowerCase().includes(q)) && (!etat.seulementNonLus || nonLusConv(c) > 0))
      .sort((a, b) => {
        const ua = nonLusConv(a) > 0;
        const ub = nonLusConv(b) > 0;
        if (ua !== ub) return ua ? -1 : 1;
        return activiteConv(b) - activiteConv(a);
      });
    const nouveaux = items.filter((c) => nonLusConv(c) > 0);
    const anciens = items.filter((c) => nonLusConv(c) === 0);
    let html = "";
    if (!items.length) html = '<div class="msg-vide">Aucune conversation.</div>';
    if (nouveaux.length) html += '<div class="msg-liste-titre nouveau">Nouveaux messages</div>' + nouveaux.map(ligneConv).join("");
    if (anciens.length) html += (nouveaux.length ? '<div class="msg-liste-titre">Plus anciens</div>' : "") + anciens.map(ligneConv).join("");
    $("msgListe").innerHTML = html;
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

  // Le nouveau sujet doit etre visible dans la liste : recherche et filtre « Non lus » remis a zero.
  function reinitialiserFiltres() {
    etat.q = "";
    etat.seulementNonLus = false;
    $("msgRecherche").value = "";
    $("msgNonLus").setAttribute("aria-pressed", "false");
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

  function batirVolet(c) {
    $("msgVolet").innerHTML =
      '<div class="msg-entete">' +
        '<button type="button" class="msg-icone msg-retour" data-act="retour" aria-label="Retour à la liste des conversations">&larr;</button>' +
        avatarConv(c) +
        '<div class="msg-titre"><b>' + echapper(c.nom) + "</b><span>" +
          (c.type === "groupe" ? echapper(c.membres.map((m) => prenom(personne(m).nom)).join(", ")) : echapper(c.sousTitre)) + "</span></div>" +
        '<button type="button" class="msg-icone" data-act="recherche-conv" aria-label="Rechercher dans la conversation" aria-expanded="false" aria-controls="msgBarreRecherche">' + ICONE_LOUPE + "</button>" +
      "</div>" +
      '<div class="msg-barre-recherche" id="msgBarreRecherche" hidden><input id="msgChampRecherche" type="search" placeholder="Rechercher dans cette conversation" aria-label="Rechercher dans cette conversation" autocomplete="off" /><span id="msgNbResultats" aria-live="polite"></span></div>' +
      '<div class="msg-sujets"><span class="msg-sujets-lbl">Sujets</span><div class="msg-bande" id="msgBande"></div>' +
        '<button type="button" class="msg-ajout" id="msgHistorique" data-act="historique" hidden>Historique</button>' +
        '<button type="button" class="msg-ajout" id="msgAjoutSujet" data-act="nouveau-sujet">+ Sujet</button></div>' +
      '<div class="msg-note-sujet" id="msgNoteSujet" hidden></div>' +
      '<div class="msg-zone-fil"><div class="msg-defile" id="msgScroller" tabindex="-1"></div>' +
        '<button type="button" class="msg-bas" id="msgBas" data-act="bas" aria-label="Aller au dernier message" hidden>&darr;</button></div>' +
      '<div class="msg-vue-pendante" id="msgVuePendante" hidden></div>' +
      '<div class="msg-menu-vue" id="msgMenuVue" role="menu" hidden></div>' +
      '<div class="msg-composer"><button type="button" class="msg-icone" id="msgBoutonVue" data-act="menu-vue" aria-label="Joindre une prise de vue" aria-haspopup="true" aria-expanded="false" title="Joindre une prise de vue">' + ICONE_APPAREIL + "</button>" +
        '<textarea id="msgSaisie" rows="1" placeholder="Écrire un message" aria-label="Écrire un message"></textarea>' +
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
    bouton.textContent = "Historique (" + nbClos + ")";
  }

  function htmlVue(m) {
    if (!m.vue) return "";
    vuesAffichees.push(m);
    return '<button type="button" class="msg-vue" data-act="agrandir" data-vp="' + (vuesAffichees.length - 1) + '" title="Agrandir la prise de vue">' + imageVue(m.vue) +
      '<span class="msg-vue-legende">' + echapper(legendeVue(m.vue)) + "</span></button>";
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

  // Texte d'un message en HTML : echappe, @Vous en orange, termes recherches surlignes (on decoupe le texte brut, jamais le HTML).
  function texteHtml(texte, recherche) {
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
        html += '<div class="msg-jour"><span>' + echapper(libelleJour(m.quand, instant())) + "</span></div>";
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
      const texte = texteHtml(m.texte || "", recherche);
      const heure = '<span class="msg-heure">' + heureMinute(m.quand) + "</span>";
      html += '<div class="msg-ligne' + (moi ? " moi" : "") + (premier ? " premier" : "") + '">' +
        (moi ? "" : '<span class="msg-av-place">' + (c.type === "groupe" && premier ? avatarPersonne(m.auteur, "pt") : "") + "</span>") +
        '<div class="msg-bulle">' + (afficheAuteur ? '<div class="msg-qui">' + echapper(personne(m.auteur).nom) + "</div>" : "") +
        // L'heure est a la fin du texte (et non avant) : sinon la largeur de la bulle ignore sa place et coupe les messages courts.
        htmlVue(m) + (texte ? '<div class="msg-texte">' + texte + heure + "</div>" : heure) + "</div></div>";
      precedent = m;
    }
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

  // Bandeau du sujet ouvert : titre, taggues, statut, Cloturer / Rouvrir, vue d'origine.
  function rendreNoteSujet() {
    const cur = filCourant();
    const note = $("msgNoteSujet");
    const saisie = $("msgSaisie");
    const envoyer = $("msgEnvoyer");
    const boutonVue = $("msgBoutonVue");
    if (!cur.sujet) {
      note.hidden = true;
      saisie.disabled = false;
      envoyer.disabled = false;
      boutonVue.disabled = false;
      saisie.placeholder = "Écrire un message";
      return;
    }
    const s = cur.sujet;
    const clos = s.statut === "clos";
    const origine = vueOrigine(s);
    const boutonOrigine = origine
      ? '<button type="button" class="msg-origine" data-act="agrandir-origine" title="Agrandir la prise de vue d\'origine"><span class="msg-origine-img">' + imageVue(origine.vue) + "</span><span>Vue d'origine</span></button>"
      : "";
    note.hidden = false;
    note.className = "msg-note-sujet" + (clos ? " clos" : "");
    if (clos) {
      note.innerHTML = boutonOrigine + "<span><b># " + echapper(s.titre) + "</b> &middot; clos par " + echapper(personne(s.closPar).nom) + " le " + dateHeure(s.closLe) + " &middot; " + s.messages.length + " messages</span>" +
        '<button type="button" class="msg-bouton-petit" data-act="rouvrir">Rouvrir</button><button type="button" class="msg-lien" data-act="vers-principal">&larr; Principal</button>';
    } else {
      note.innerHTML = boutonOrigine + "<span><b># " + echapper(s.titre) + "</b>" + (s.urgent ? ' <span class="msg-urgent">Urgent</span>' : "") + " &middot; tagués : " + echapper(s.tagues.map((p) => personne(p).nom).join(", ")) + "</span>" +
        '<select id="msgStatut" aria-label="Statut du sujet">' + STATUTS_ACTIFS.map((k) => '<option value="' + k + '"' + (s.statut === k ? " selected" : "") + ">" + LIBELLES_STATUT[k] + "</option>").join("") + "</select>" +
        '<button type="button" class="msg-bouton-petit msg-bascule-urgent" data-act="urgence" aria-pressed="' + !!s.urgent + '">Urgent</button>' +
        (membresAjoutables(cur.c, s).length ? '<button type="button" class="msg-bouton-petit" data-act="ouvrir-ajout">+ Personne</button>' : "") +
        '<button type="button" class="msg-bouton-petit" data-act="cloturer">Clôturer</button><button type="button" class="msg-lien" data-act="vers-principal">&larr; Principal</button>';
    }
    saisie.disabled = clos;
    envoyer.disabled = clos;
    boutonVue.disabled = clos;
    saisie.placeholder = clos ? "Sujet clos : rouvrez-le pour répondre" : "Écrire un message";
  }

  function rendreFilCourant(garderDefilement) {
    const cur = filCourant();
    if (!cur) return;
    rendreBande(cur.c);
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
      const fil = filCourant().fil;
      ouvrirFil(fil);
      vuePendante = null;
      rendreFilCourant(false);
      rendreListe();
      allerAuRepere();
    };
    const zones = voletPret ? [$("msgNoteSujet"), racine.querySelector(".msg-zone-fil")] : [];
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
    ajouterMessage(cur.fil, { auteur: MOI, quand: instant(), texte, vue: vuePendante || undefined });
    vuePendante = null;
    saisie.value = "";
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

  // ---------- Dialogues (nouveau sujet, historique, agrandissement) ----------
  function ouvrirDialogue(html, libelle, declencheur) {
    const boite = $("msgDialogue");
    declencheurDialogue = declencheur || document.activeElement;
    fermerMenuVue();
    boite.hidden = false;
    boite.innerHTML = '<div class="msg-carte" role="dialog" aria-modal="true" aria-label="' + echapper(libelle) + '">' + html + "</div>";
    const premierChamp = boite.querySelector("[autofocus], input, textarea, button");
    if (premierChamp) premierChamp.focus();
  }
  function fermerDialogue() {
    const boite = $("msgDialogue");
    if (boite.hidden) return;
    boite.hidden = true;
    boite.innerHTML = "";
    if (declencheurDialogue && document.contains(declencheurDialogue) && declencheurDialogue.focus) declencheurDialogue.focus();
    declencheurDialogue = null;
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

  function ouvrirDialogueAjout(declencheur) {
    const cur = filCourant();
    if (!cur || !cur.sujet) return;
    ouvrirDialogue(
      "<h3>Ajouter une personne au sujet</h3>" +
      '<div class="msg-tags">' + membresAjoutables(cur.c, cur.sujet).map((p) =>
        '<button type="button" data-act="ajouter-personne" data-p="' + echapper(p) + '">' + avatarPersonne(p, "pt") + echapper(personne(p).nom) + "</button>").join("") + "</div>" +
      '<p class="msg-aide">La personne ajoutée voit tout l\'historique du sujet et reçoit les nouveaux messages.</p>' +
      '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Annuler</button></div>',
      "Ajouter une personne", declencheur);
  }

  function ajouterPersonneDepuisDialogue(p) {
    const cur = filCourant();
    if (!cur || !cur.sujet || cur.sujet.statut === "clos" || !membresAjoutables(cur.c, cur.sujet).includes(p)) return;
    ajouterPersonne(cur.sujet, p, instant());
    fermerDialogue();
    rafraichirApresChangement();
  }

  function htmlVueJointe(vue) {
    return vue ? '<div><span class="msg-etiquette">Prise de vue jointe</span><div class="msg-vue-jointe">' + imageVue(vue) + '<span class="msg-vue-legende">' + echapper(legendeVue(vue)) + "</span></div></div>" : "";
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
      '<div class="msg-case"><input type="checkbox" id="msgNsUrgent" /><label for="msgNsUrgent">Urgent</label></div>' +
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
    else zone.textContent = "Votre conversation reste privée : le sujet s'ouvrira dans le groupe « " + groupe.nom + " », avec " + listeNoms([interlocuteur].concat(ajoutes.map((p) => personne(p).nom))) + " tagués.";
  }

  function boutonsTags(ids) {
    return ids.map((p) => '<button type="button" data-act="tag" data-p="' + echapper(p) + '" aria-pressed="false">' + avatarPersonne(p, "pt") + echapper(personne(p).nom) + "</button>").join("");
  }

  function rendreTags(convId) {
    const c = convParId(conversations, convId);
    const autres = c.membres.filter((m) => m !== MOI);
    if (c.type === "groupe") {
      $("msgNsTags").innerHTML = '<span class="msg-etiquette">Taguer les personnes concernées</span><div class="msg-tags" id="msgTags">' + boutonsTags(autres) +
        '</div><p class="msg-aide">Seules les personnes taguées voient ce sujet et son ouverture. Les autres membres du groupe n\'en voient rien.</p>';
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
    const tagues = c.type === "groupe" ? choisies : autres.concat(ajoutes);
    // Avec des personnes ajoutees depuis un 1 a 1, le sujet s'ouvre dans le groupe qui les reunit ; le 1 a 1 ne recoit rien.
    const cible = ajoutes.length ? groupePour(c, ajoutes) : c;
    if (!cible) return;
    const sujet = creerSujet(cible, { titre, texte, tagues, vue: vueDialogue, quand: instant(), urgent: $("msgNsUrgent").checked });
    declencheurDialogue = null;
    fermerDialogue();
    reinitialiserFiltres();
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
    reinitialiserFiltres();
    choisirOnglet(c.type);
    ouvrirConversation(c.id, sujetId);
  }

  function nouveauSujetDepuisViewer(vue) {
    dialogueEnAttente = { vue, choixConversation: true };
    if (!demarre) preparer();
    allerA("discussions");
  }

  function ouvrirHistorique() {
    const cur = filCourant();
    const clos = sujetsClos(cur.c);
    ouvrirDialogue(
      "<h3>Historique : sujets clos (" + clos.length + ")</h3>" +
      '<input id="msgHistQ" type="search" placeholder="Rechercher un sujet clos" aria-label="Rechercher un sujet clos" autocomplete="off" /><div class="msg-histo" id="msgHistoListe"></div>' +
      '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="fermer-dialogue">Fermer</button></div>',
      "Historique des sujets", $("msgHistorique"));
    const remplir = () => {
      const q = $("msgHistQ").value.trim().toLowerCase();
      $("msgHistoListe").innerHTML = clos.filter((s) => !q || s.titre.toLowerCase().includes(q)).map((s) =>
        '<button type="button" class="msg-histo-ligne" data-act="ouvrir-clos" data-s="' + echapper(s.id) + '"><b># ' + echapper(s.titre) + "</b><span>Clos par " + echapper(personne(s.closPar).nom) + " le " +
        s.closLe.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " &middot; " + s.messages.length + " messages</span></button>").join("") || '<div class="msg-vide">Aucun sujet clos.</div>';
    };
    remplir();
    $("msgHistQ").addEventListener("input", remplir);
  }

  function agrandirVue(m) {
    const cur = filCourant();
    const verrouille = cur && cur.sujet && cur.sujet.statut === "clos";
    const qui = m.auteur === MOI ? "vous" : personne(m.auteur).nom;
    const reel = !!m.vue.etat;
    ouvrirDialogue(
      "<h3>Prise de vue : " + echapper(legendeVue(m.vue)) + "</h3>" +
      '<div class="msg-grande-vue">' + imageVue(m.vue) + "</div>" +
      '<p class="msg-aide">Prise par ' + echapper(qui) + " le " + dateHeure(m.quand) + ". " +
      (reel ? "« Ouvrir dans le Viewer » rétablit le même angle et les mêmes maquettes." : "La vue 3D est en préparation : « Ouvrir dans le Viewer » ouvre simplement le Viewer pour l'instant.") + "</p>" +
      '<div class="msg-rangee"><button type="button" class="msg-fantome" data-act="ouvrir-viewer">Ouvrir dans le Viewer</button>' +
      '<button type="button" class="msg-primaire" data-act="joindre-vue"' + (verrouille ? " disabled" : "") + ">Joindre à ma réponse</button></div>",
      "Prise de vue", document.activeElement);
    vueDialogue = m.vue;
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
    zone.innerHTML = '<span class="msg-puce-vue"><span class="msg-puce-img">' + imageVue(vuePendante) + "</span><span>Prise de vue jointe : " + echapper(legendeVue(vuePendante)) + "</span></span>" +
      '<button type="button" class="msg-retirer" data-act="retirer-vue" aria-label="Retirer la prise de vue">&times;</button>';
  }

  function fermerMenuVue() {
    const menu = $("msgMenuVue");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    const bouton = $("msgBoutonVue");
    if (bouton) bouton.setAttribute("aria-expanded", "false");
  }
  function fermerMenuVueSiExterieur(e) {
    const menu = $("msgMenuVue");
    if (menu && !menu.hidden && !e.target.closest("#msgMenuVue, #msgBoutonVue")) fermerMenuVue();
  }

  function basculerMenuVue() {
    const menu = $("msgMenuVue");
    if (!menu.hidden) { fermerMenuVue(); return; }
    const cur = filCourant();
    const origine = cur.sujet && vueOrigine(cur.sujet);
    menu.innerHTML = '<button type="button" role="menuitem" data-act="prendre-vue">Prendre une vue dans le Viewer<span>Cadre la maquette, puis valide la vue</span></button>' +
      (origine ? '<button type="button" role="menuitem" data-act="vue-origine">Reprendre la vue d\'origine du sujet<span>' + echapper(legendeVue(origine.vue)) + "</span></button>" : "");
    menu.hidden = false;
    $("msgBoutonVue").setAttribute("aria-expanded", "true");
    const premier = menu.querySelector("button");
    if (premier) premier.focus();
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
  }

  function demarrerPriseDeVue() {
    fermerMenuVue();
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
  function surClic(e) {
    // Clic sur le fond sombre autour d'un dialogue : on le ferme (comme Échap)
    if (e.target === $("msgDialogue")) { fermerDialogue(); return; }
    const cible = e.target.closest("[data-act]");
    if (!cible || !racine.contains(cible)) return;
    const act = cible.dataset.act;
    const cur = filCourant();
    switch (act) {
      case "onglet": choisirOnglet(cible.dataset.v); break;
      case "non-lus":
        etat.seulementNonLus = !etat.seulementNonLus;
        cible.setAttribute("aria-pressed", String(etat.seulementNonLus));
        rendreListe();
        break;
      case "conversation": ouvrirConversation(cible.dataset.id, null); break;
      case "retour": racine.classList.remove("volet-ouvert"); break;
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
      case "agrandir": agrandirVue(vuesAffichees[Number(cible.dataset.vp)]); break;
      case "agrandir-origine": agrandirVue(vueOrigine(cur.sujet)); break;
      case "cloturer": cloturer(cur.c, cur.sujet, instant()); rafraichirApresChangement(); break;
      case "urgence": {
        if (!cur.sujet || cur.sujet.statut === "clos") break;
        basculerUrgence(cur.sujet, instant());
        rafraichirApresChangement();
        const bouton = $("msgNoteSujet").querySelector('[data-act="urgence"]');
        if (bouton) bouton.focus();
        break;
      }
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
      case "mode-dialogue": if (cible.getAttribute("aria-pressed") !== "true") changerModeDialogue(cible.dataset.v); break;
      case "ajouter-vue": ajouterVueDepuisDialogue(); break;
      case "tag": cible.setAttribute("aria-pressed", String(cible.getAttribute("aria-pressed") !== "true")); majOuSujet(); break;
      case "ouvrir-ajout": ouvrirDialogueAjout(cible); break;
      case "ajouter-personne": ajouterPersonneDepuisDialogue(cible.dataset.p); break;
      case "fermer-dialogue": fermerDialogue(); break;
      case "envoyer": envoyerMessage(); break;
      case "menu-vue": basculerMenuVue(); break;
      case "prendre-vue": demarrerPriseDeVue(); break;
      case "vue-origine": {
        const origine = vueOrigine(cur.sujet);
        fermerMenuVue();
        if (origine) { vuePendante = copieVue(origine.vue); rendreVuePendante(); $("msgSaisie").focus(); }
        break;
      }
      case "retirer-vue": vuePendante = null; rendreVuePendante(); break;
      case "joindre-vue": {
        const vue = vueDialogue;
        declencheurDialogue = null;
        fermerDialogue();
        vuePendante = copieVue(vue);
        rendreVuePendante();
        $("msgSaisie").focus();
        break;
      }
      case "ouvrir-viewer": {
        const vue = vueDialogue;
        declencheurDialogue = null;
        fermerDialogue();
        ouvrirDansViewer(vue);
        break;
      }
      default: break;
    }
  }

  function surSaisie(e) {
    const id = e.target.id;
    if (id === "msgRecherche") { etat.q = e.target.value; rendreListe(); }
    else if (id === "msgChampRecherche") {
      etat.recherche = e.target.value;
      rendreMessages(false);
      if (!etat.recherche) allerAuRepere();
    } else if (id === "msgSaisie") ajusterSaisie(e.target);
  }

  function surChangement(e) {
    if (e.target.id === "msgStatut") {
      const cur = filCourant();
      changerStatut(cur.c, cur.sujet, e.target.value, instant());
      rafraichirApresChangement();
    } else if (e.target.id === "msgNsConv") {
      $("msgDialogue").dataset.convId = e.target.value;
      rendreTags(e.target.value);
    } else if (e.target.id === "msgAjConv") {
      $("msgDialogue").dataset.convId = e.target.value;
      $("msgAjSujet").innerHTML = optionsSujetsOuverts(convParId(conversations, e.target.value));
    }
  }

  function surTouche(e) {
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
    if (dialogueOuvert()) { fermerDialogue(); return; }
    const menu = $("msgMenuVue");
    if (menu && !menu.hidden) { fermerMenuVue(); const b = $("msgBoutonVue"); if (b) b.focus(); }
  }

  return { preparer, surVueActivee, nouveauSujetDepuisViewer, rechargerVues, priseDeVueEnCours: () => priseDeVueEnCours };
}
