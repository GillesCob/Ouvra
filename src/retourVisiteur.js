// Retours des visiteurs (28/10) : le bouton « Donner mon avis » de la barre de navigation ouvre une modale (type Bug ou Idée, message, e-mail facultatif) qui
// envoie un mail a Gilles par POST /api/retour (api/retour.js, relais/httpRetour.js). Reponse a l'appel final de la presentation (« retours, cas d'usage, essais »).
// Pas de compte, pas de profil : la page d'origine est ajoutee toute seule. Le CSS (src/retourVisiteur.css) est importe par main.js, ce module reste importable sous Node.
//  - logique pure en haut (corpsRetour, libellePage, messageEchec, envoyerRetour : testees) ; modale DOM en bas (creerRetourVisiteur), meme apparence que les modales IA
//    (classes regles-ia-fond / regles-ia-carte de src/reglesIA.css) ;
//  - tout texte passe par textContent ; un champ « site » invisible sert de piege a robots (rempli, la route ignore le retour sans erreur).

export const MESSAGE_MAX = 1000; // meme plafond que relais/entreeRetour.js
const DELAI_ENVOI_MS = 12000;

const LIBELLES_PAGES = { accueil: "Accueil", viewer: "Viewer", collision: "Collision", discussions: "Discussions", quantitatif: "Quantitatif", plan3d: "2D → 3D", projeteur: "Todo", admin: "Admin" };
export const libellePage = (vue) => (vue ? LIBELLES_PAGES[vue] || String(vue) : "Application");

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

// declencheurs : les boutons « Donner mon avis » (barre et menu ☰) ; pageCourante() : nom de la vue affichee (« viewer », « discussions »...).
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
    const titre = creer("h2", "retour-titre", "Donner mon avis");
    titre.id = "retourTitre";
    const intro = creer("p", "retour-intro", "Un bug, une idée : dis-moi ce que tu as vu. Ça m'aide à améliorer Ouvra.");

    const formulaire = creer("form", "retour-formulaire");
    formulaire.noValidate = true;
    const groupe = creer("div", "retour-types");
    groupe.setAttribute("role", "radiogroup");
    groupe.setAttribute("aria-label", "Type de retour");
    const radios = {};
    [["bug", "Bug"], ["idee", "Idée"]].forEach(([valeur, libelle], i) => {
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
    message.placeholder = "Ce que tu as vu, ou ce que tu aimerais voir";
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
    const envoyer = creer("button", "regles-ia-valider", "Envoyer");
    envoyer.type = "submit";
    const fermerBtn = creer("button", "regles-ia-bascule", "Fermer");
    fermerBtn.type = "button";
    actions.append(envoyer, fermerBtn);
    formulaire.append(groupe, labelMessage, compteur, labelContact, piege, etat, actions);

    const merci = creer("div", "retour-merci");
    merci.hidden = true;
    const texteMerci = creer("p", "retour-merci-texte", "Merci, ton retour est bien parti.");
    texteMerci.setAttribute("role", "status");
    const fermerMerci = creer("button", "regles-ia-valider", "Fermer");
    fermerMerci.type = "button";
    merci.append(texteMerci, fermerMerci);

    carte.append(titre, intro, formulaire, merci);
    fond.appendChild(carte);
    document.body.appendChild(fond);
    champs = { carte, intro, formulaire, radios, message, compteur, contact, piege, etat, envoyer, merci, fermerMerci };

    const majCompteur = () => { compteur.textContent = message.value.length + " / " + MESSAGE_MAX; };
    message.addEventListener("input", majCompteur);
    majCompteur();
    fermerBtn.addEventListener("click", () => fermer());
    fermerMerci.addEventListener("click", () => fermer());
    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
    document.addEventListener("keydown", (e) => {
      if (!ouverte) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); return; }
      if (e.key === "Tab") boucleFocus(e);
    }, true);
    formulaire.addEventListener("submit", (e) => { e.preventDefault(); soumettre(); });
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
    const type = champs.radios.bug.checked ? "bug" : "idee";
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
      champs.intro.hidden = true;
      champs.merci.hidden = false;
      champs.fermerMerci.focus({ preventScroll: true });
    } else {
      afficherEtat(resultat.message);
    }
  }

  function ouvrir() {
    if (!fond) construire();
    champs.formulaire.hidden = false;
    champs.intro.hidden = false;
    champs.merci.hidden = true;
    champs.message.value = "";
    champs.contact.value = "";
    champs.piege.value = "";
    champs.radios.bug.checked = true;
    champs.compteur.textContent = "0 / " + MESSAGE_MAX;
    afficherEtat("");
    fond.hidden = false;
    ouverte = true;
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
