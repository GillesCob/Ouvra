// Retours des visiteurs (28/10) : le bouton « Remarque ou suggestion ? » de la barre de navigation ouvre une modale (Suggestion ou Remarque, message, e-mail facultatif) qui
// envoie un mail a Gilles par POST /api/retour (api/retour.js, relais/httpRetour.js). Reponse a l'appel final de la presentation (« retours, cas d'usage, essais »).
// Pas de compte, pas de profil : la page d'origine est ajoutee toute seule. Le CSS (src/retourVisiteur.css) est importe par main.js, ce module reste importable sous Node.
//  - logique pure en haut (corpsRetour, libellePage, messageEchec, envoyerRetour : testees) ; modale DOM en bas (creerRetourVisiteur), meme apparence que les modales IA
//    (classes regles-ia-fond / regles-ia-carte de src/reglesIA.css) ;
//  - tout texte passe par textContent ; un champ « site » invisible sert de piege a robots (rempli, la route ignore le retour sans erreur).

export const MESSAGE_MAX = 1000; // meme plafond que relais/entreeRetour.js
const DELAI_ENVOI_MS = 12000;
const ICONE_VALIDE = '<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>';

const LIBELLES_PAGES = { accueil: "Accueil", viewer: "Viewer", collision: "Collision", discussions: "Discussions", quantitatif: "Quantitatif", plan3d: "2D → 3D", projeteur: "Todo", admin: "Admin" };
export const libellePage = (vue) => (vue ? LIBELLES_PAGES[vue] || String(vue) : "Application");

// Texte d'aide du champ selon le choix : une remarque decrit une difficulte (ce qu'on attendait, ce qui s'est affiche), une suggestion se raconte (a quoi elle sert).
const PLACEHOLDERS = {
  bug: "Tu as rencontré une difficulté lors de ta navigation dans Ouvra ? Indique ce que tu attendais et ce qui s'est affiché à la place.",
  idee: "Ta proposition de fonctionnalité et ce qu'elle permettrait de faire"
};
export const placeholderRetour = (type) => PLACEHOLDERS[type] || PLACEHOLDERS.idee;

export function corpsRetour({ type, message, contact = "", page = "", site = "" }) {
  return { type, message: String(message || "").trim().slice(0, MESSAGE_MAX), contact: String(contact || "").trim(), page, site: String(site || "") };
}

// Message affiche pour un echec : celui du serveur quand il est clair (validation, limite), sinon une phrase simple. Jamais de detail technique.
export function messageEchec(statut, corps) {
  const serveur = corps && typeof corps === "object" && typeof corps.message === "string" && corps.message ? corps.message : "";
  if (statut === 400 || statut === 413 || statut === 429) return serveur || "Ton retour n'a pas pu être envoyé. Vérifie-le puis réessaie.";
  if (statut === 503) return "L'envoi des retours n'est pas disponible pour le moment.";
  if (statut === 0) return "Pas de connexion : ton retour n'est pas parti. Réessaie quand le réseau revient.";
  return "Ton retour n'a pas pu être envoyé. Réessaie dans un moment.";
}

// fetch est injecte pour les tests. Rend { ok: true } ou { ok: false, message }.
export async function envoyerRetour(corps, { fetch: appel = (...a) => globalThis.fetch(...a), delaiMs = DELAI_ENVOI_MS } = {}) {
  const controle = typeof AbortController === "function" ? new AbortController() : null;
  const minuteur = controle ? setTimeout(() => controle.abort(), delaiMs) : null;
  try {
    const reponse = await appel("/api/retour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps), signal: controle ? controle.signal : undefined });
    if (reponse.ok) return { ok: true };
    let json = null;
    try { json = await reponse.json(); } catch { /* corps absent ou pas du JSON : message simple */ }
    return { ok: false, message: messageEchec(reponse.status, json) };
  } catch {
    return { ok: false, message: messageEchec(0, null) };
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

// ---------- Modale ----------
function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

// declencheurs : les boutons « Remarque ou suggestion ? » (barre et menu ☰) ; pageCourante() : nom de la vue affichee (« viewer », « discussions »...).
export function creerRetourVisiteur({ declencheurs, pageCourante }) {
  let declencheur = null; // l'exemplaire du bouton qui a ouvert la modale : il reprend le focus a la fermeture
  let fond = null;
  let ouverte = false;
  let envoiEnCours = false;
  let champs = null;

  function construire() {
    fond = creer("div", "regles-ia-fond retour-fond");
    fond.hidden = true;
    const carte = creer("div", "regles-ia-carte retour-carte");
    carte.setAttribute("role", "dialog");
    carte.setAttribute("aria-modal", "true");
    carte.setAttribute("aria-labelledby", "retourTitre");
    const titre = creer("h2", "retour-titre", "Une suggestion, une remarque ?");
    titre.id = "retourTitre";

    const formulaire = creer("form", "retour-formulaire");
    formulaire.noValidate = true;
    const groupe = creer("div", "retour-types");
    groupe.setAttribute("role", "radiogroup");
    groupe.setAttribute("aria-label", "Type de retour");
    // Pastille qui glisse sous le choix actif : meme composant visuel que #navbarThumb de la barre de navigation (src/style.css), placee comme placerPastilleNavbar (src/main.js).
    const pastille = creer("span", "retour-pastille");
    pastille.setAttribute("aria-hidden", "true");
    groupe.appendChild(pastille);
    const radios = {};
    [["idee", "Suggestion"], ["bug", "Remarque"]].forEach(([valeur, libelle], i) => {
      const label = creer("label", "retour-type");
      const radio = creer("input");
      radio.type = "radio";
      radio.name = "type";
      radio.value = valeur;
      radio.checked = i === 0;
      radios[valeur] = radio;
      label.append(radio, creer("span", null, libelle));
      groupe.appendChild(label);
    });
    const labelMessage = creer("label", "retour-label", "Ton retour");
    const message = creer("textarea", "retour-message");
    message.rows = 5;
    message.maxLength = MESSAGE_MAX;
    message.placeholder = placeholderRetour("idee");
    labelMessage.appendChild(message);
    const compteur = creer("p", "retour-compteur");
    compteur.setAttribute("aria-hidden", "true");
    const labelContact = creer("label", "retour-label", "Ton e-mail (facultatif, seulement si tu veux une réponse)");
    const contact = creer("input", "retour-contact");
    contact.type = "email";
    contact.autocomplete = "email";
    contact.maxLength = 120;
    labelContact.appendChild(contact);
    const piege = creer("input", "retour-piege"); // invisible pour une personne : un robot le remplit
    piege.type = "text";
    piege.name = "site";
    piege.tabIndex = -1;
    piege.autocomplete = "off";
    piege.setAttribute("aria-hidden", "true");
    const etat = creer("p", "retour-etat");
    etat.setAttribute("role", "status");
    etat.hidden = true;
    const actions = creer("div", "retour-actions");
    const envoyer = creer("button", "regles-ia-valider btn-principal", "Envoyer");
    envoyer.type = "submit";
    const fermerBtn = creer("button", "regles-ia-bascule", "Fermer");
    fermerBtn.type = "button";
    actions.append(envoyer, fermerBtn);
    formulaire.append(groupe, labelMessage, compteur, labelContact, piege, etat, actions);

    // Ecran de remerciement (28/10) : pas de titre de modale, une icone, « Merci ! », une ligne, un lien pour envoyer un autre retour, et la croix de fermeture du design
    // des modales de la messagerie (.msg-croix de src/messagerie/messagerie.css) : plus de gros bouton « Fermer ». Echap et un clic sur le fond ferment aussi.
    const merci = creer("div", "retour-merci");
    merci.hidden = true;
    const icone = creer("span", "retour-merci-icone");
    icone.setAttribute("aria-hidden", "true");
    icone.innerHTML = ICONE_VALIDE;
    const merciTitre = creer("p", "retour-merci-titre", "Merci !");
    merciTitre.id = "retourMerciTitre";
    const merciTexte = creer("p", "retour-merci-texte", "Ton retour est bien parti.");
    const autre = creer("button", "regles-ia-lien", "Envoyer un autre retour");
    autre.type = "button";
    merci.append(icone, merciTitre, merciTexte, autre);
    const croix = creer("button", "retour-croix", "\u2715");
    croix.type = "button";
    croix.setAttribute("aria-label", "Fermer");
    croix.hidden = true;

    carte.append(titre, formulaire, merci, croix);
    fond.appendChild(carte);
    document.body.appendChild(fond);
    champs = { carte, titre, formulaire, radios, message, compteur, contact, piege, etat, envoyer, merci, croix, autre, groupe, pastille };

    // Le choix change : le texte d'aide suit, la pastille glisse sous le nouveau choix.
    Object.values(radios).forEach((radio) => radio.addEventListener("change", () => {
      champs.message.placeholder = placeholderRetour(radio.value);
      placerPastille();
    }));
    window.addEventListener("resize", () => { if (ouverte) placerPastille(); });
    const majCompteur = () => { compteur.textContent = message.value.length + " / " + MESSAGE_MAX; };
    message.addEventListener("input", majCompteur);
    majCompteur();
    fermerBtn.addEventListener("click", () => fermer());
    croix.addEventListener("click", () => fermer());
    autre.addEventListener("click", () => { afficherFormulaire(); champs.message.focus({ preventScroll: true }); }); // un autre retour : le formulaire revient, vide
    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
    document.addEventListener("keydown", (e) => {
      if (!ouverte) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); return; }
      if (e.key === "Tab") boucleFocus(e);
    }, true);
    formulaire.addEventListener("submit", (e) => { e.preventDefault(); soumettre(); });
  }

  // Comme placerPastilleNavbar : la premiere pose se fait sans transition (la pastille ne traverse pas la modale), les suivantes glissent.
  let pastillePosee = false;
  function placerPastille() {
    const actif = champs.radios.idee.checked ? champs.radios.idee : champs.radios.bug;
    const cible = actif.closest("label");
    if (!cible || !cible.offsetWidth) return;
    const { pastille } = champs;
    if (!pastillePosee) pastille.style.transition = "none";
    pastille.style.width = cible.offsetWidth + "px";
    pastille.style.transform = "translateX(" + cible.offsetLeft + "px)";
    if (!pastillePosee) {
      void pastille.offsetWidth;
      pastille.style.transition = "";
      pastillePosee = true;
    }
  }

  function boucleFocus(e) {
    const cibles = [...champs.carte.querySelectorAll("button, input:not(.retour-piege), textarea")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!cibles.length) return;
    const premier = cibles[0];
    const dernier = cibles[cibles.length - 1];
    if (e.shiftKey && (document.activeElement === premier || !champs.carte.contains(document.activeElement))) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }

  function afficherEtat(texte) {
    champs.etat.textContent = texte;
    champs.etat.hidden = !texte;
  }

  async function soumettre() {
    if (envoiEnCours) return;
    const type = champs.radios.idee.checked ? "idee" : "bug";
    const corps = corpsRetour({ type, message: champs.message.value, contact: champs.contact.value, page: libellePage(pageCourante()), site: champs.piege.value });
    if (!corps.message) { afficherEtat("Écris ton retour avant de l'envoyer."); champs.message.focus(); return; }
    envoiEnCours = true;
    champs.envoyer.disabled = true;
    champs.envoyer.textContent = "Envoi…";
    afficherEtat("");
    const resultat = await envoyerRetour(corps);
    envoiEnCours = false;
    champs.envoyer.disabled = false;
    champs.envoyer.textContent = "Envoyer";
    if (!ouverte) return; // fermee pendant l'envoi : rien a afficher
    if (resultat.ok) {
      champs.formulaire.hidden = true;
      champs.titre.hidden = true; // pas de titre de modale sur l'ecran de remerciement
      champs.merci.hidden = false;
      champs.croix.hidden = false;
      champs.carte.setAttribute("aria-labelledby", "retourMerciTitre");
      champs.croix.focus({ preventScroll: true });
    } else {
      afficherEtat(resultat.message);
    }
  }

  // Le formulaire, vide, avec son titre : a l'ouverture et quand on choisit « Envoyer un autre retour ».
  function afficherFormulaire() {
    champs.titre.hidden = false;
    champs.carte.setAttribute("aria-labelledby", "retourTitre");
    champs.formulaire.hidden = false;
    champs.merci.hidden = true;
    champs.croix.hidden = true;
    champs.message.value = "";
    champs.contact.value = "";
    champs.piege.value = "";
    champs.radios.idee.checked = true;
    champs.message.placeholder = placeholderRetour("idee");
    champs.compteur.textContent = "0 / " + MESSAGE_MAX;
    afficherEtat("");
    pastillePosee = false;
    placerPastille();
  }

  function ouvrir() {
    if (!fond) construire();
    afficherFormulaire();
    fond.hidden = false;
    ouverte = true;
    pastillePosee = false; // la modale vient d'apparaitre : la pastille se repose sans glisser
    placerPastille();
    champs.message.focus({ preventScroll: true });
  }

  function fermer() {
    if (!ouverte) return;
    ouverte = false;
    fond.hidden = true;
    if (declencheur && document.contains(declencheur)) declencheur.focus({ preventScroll: true });
  }

  declencheurs.forEach((bouton) => bouton.addEventListener("click", () => {
    declencheur = bouton;
    const navigation = document.getElementById("navbarLinks");
    if (navigation) navigation.classList.remove("open"); // menu mobile : replie avant d'ouvrir la modale
    ouvrir();
  }));

  return { ouvrir, fermer, ouverte: () => ouverte };
}
