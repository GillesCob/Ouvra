// Discussions par commande IA (24/10) : le bandeau « Est-ce bien votre demande ? », avec « Oui » et « Non », calque sur src/commandesBandeau.js (Viewer).
//
// Il s'affiche en haut de l'ecran, sous la barre de navigation, pleine largeur, fond de surface, comme les bandeaux « ← Retour a la conversation » et
// « Est-ce bien votre demande ? » du Viewer. Il redit ce qui a ete compris (relecture) et le compte rendu (discussions et messages trouves). Il passe
// AU-DESSUS du panneau du rapport (qui est une modale) : la question reste accessible tant que le rapport est ouvert. La page descend d'autant
// (variable CSS posee ici, regle dans src/discussionsIA.css).
// Accessibilite : role « alertdialog » non modal (une question urgente qui attend une reponse, annoncee a l'apparition), nom = la question, description
// = la relecture ; le focus va sur « Oui », sans piege (Tab quitte le bandeau). La touche Echap ne tranche pas a la place de l'utilisateur.
//
// Module sans dependance a main.js : surOui() / surNon() sont appeles une fois le bandeau ferme ; retourFocus : element qui reprend le focus apres « Oui ».

const QUESTION = "Est-ce bien votre demande ?";
const VARIABLE_HAUTEUR = "--discussions-bandeau-h";
const CLASSE_ACTIF = "discussions-confirm-actif";

export function creerDiscussionsBandeau({ surOui, surNon, retourFocus = null }) {
  let racine = null;
  let texte = null;
  let observateur = null;

  function creer(tag, classe, contenu) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (contenu != null) el.textContent = contenu;
    return el;
  }

  function bouton(libelle, action) {
    const b = creer("button", null, libelle);
    b.type = "button";
    b.dataset.act = action;
    if (action === "oui") b.classList.add("btn-principal"); // aspect commun des boutons pleins (src/boutonPrincipal.css)
    return b;
  }

  function assurerSquelette() {
    if (racine) return;
    racine = creer("div");
    racine.id = "discussionsBandeau";
    racine.hidden = true;
    racine.setAttribute("role", "alertdialog");
    racine.setAttribute("aria-labelledby", "discussionsBandeauQuestion");
    racine.setAttribute("aria-describedby", "discussionsBandeauTexte");
    const corps = creer("div", "discussions-bandeau-corps");
    const question = creer("p", "discussions-bandeau-question", QUESTION);
    question.id = "discussionsBandeauQuestion";
    texte = creer("p", "discussions-bandeau-texte");
    texte.id = "discussionsBandeauTexte";
    corps.append(question, texte);
    const actions = creer("div", "discussions-bandeau-actions");
    actions.append(bouton("Oui", "oui"), bouton("Non", "non"));
    racine.append(corps, actions);
    racine.addEventListener("click", (e) => {
      const cible = e.target.closest("[data-act]");
      if (!cible || racine.hidden) return;
      if (cible.dataset.act === "oui") { masquer(true); surOui(); }
      else { masquer(false); surNon(); }
    });
    document.body.appendChild(racine);
  }

  // Hauteur reelle du bandeau (variable selon la longueur du texte et la largeur) : la page descend d'autant.
  function mesurer() {
    if (racine && !racine.hidden) document.body.style.setProperty(VARIABLE_HAUTEUR, racine.offsetHeight + "px");
  }

  function montrer({ relecture, resume }) {
    assurerSquelette();
    texte.textContent = "";
    if (relecture) texte.appendChild(creer("span", "discussions-bandeau-relecture", relecture));
    if (resume) texte.appendChild(creer("span", "discussions-bandeau-resume", resume));
    racine.hidden = false;
    document.body.classList.add(CLASSE_ACTIF);
    mesurer();
    if (typeof ResizeObserver === "function" && !observateur) {
      observateur = new ResizeObserver(mesurer);
      observateur.observe(racine);
    }
    racine.querySelector('[data-act="oui"]').focus({ preventScroll: true });
  }

  // rendreFocus : « Oui » remet le focus sur retourFocus (le bouton « IA ») ; « Non » laisse la modale rouverte le prendre.
  function masquer(rendreFocus = false) {
    if (!racine || racine.hidden) return;
    racine.hidden = true;
    document.body.classList.remove(CLASSE_ACTIF);
    document.body.style.removeProperty(VARIABLE_HAUTEUR);
    if (rendreFocus && retourFocus && document.contains(retourFocus)) retourFocus.focus({ preventScroll: true });
  }

  return { montrer, masquer, visible: () => !!racine && !racine.hidden };
}
