// Viewer par commande (24/10) : le bandeau « Est-ce bien votre demande ? », avec « Oui » et « Non ».
//
// Il s'affiche en haut de la zone 3D (#viewerWrap, a gauche du drawer sur ordinateur, sur toute la largeur sur mobile ou le drawer est une feuille du
// bas), au meme endroit et dans le meme style que les bandeaux « ← Retour a la conversation » (src/messagerie/messagerie.css)
// et « ← Retour a la regle » (src/reglesModale.css) : sous la barre de navigation, pleine largeur, fond de surface. Il les RECOUVRE le temps de la
// question (au-dessus d'eux, meme emplacement) ; fermé, le bandeau de retour est de nouveau visible, intact. Il redit ce qui a ete compris (relecture, entre guillemets francais)
// uniquement : jamais de compte rendu (nombre d'elements, criteres, effets).
// Accessibilite : role « alertdialog » non modal (une question urgente qui attend une reponse, annoncee a l'apparition), nom = la question, description
// = la relecture ; le focus va sur « Oui », sans piege (Tab quitte le bandeau, la page reste utilisable). La touche Echap ne tranche pas a la place de
// l'utilisateur. Le CSS vit dans src/commandesIA.css.
//
// Module sans dependance a main.js : tout passe par les parametres de creerCommandesBandeau.
//   surOui() : l'utilisateur confirme ; surNon() : il refuse (le bandeau est deja ferme quand ces rappels sont appeles)
//   conteneur : #viewerWrap (la zone 3D) ; le bandeau y est cale en haut, jamais sur le drawer ni sur le reste de l'ecran
//   retourFocus : element qui reprend le focus apres « Oui » (le bouton « IA »)

const QUESTION = "Est-ce bien votre demande ?";
const VARIABLE_HAUTEUR = "--commandes-bandeau-h";
const CLASSE_ACTIF = "commandes-confirm-actif";

// Reutilise par la page Quantitatif (28/10) : id, variable et classe du body changent (id = « quantitatifBandeau »), le squelette, le texte, le focus et le clavier restent les memes.
export function creerCommandesBandeau({ surOui, surNon, conteneur = null, retourFocus = null, id = "commandesBandeau", variable = VARIABLE_HAUTEUR, classeActif = CLASSE_ACTIF }) {
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
    return b;
  }

  function assurerSquelette() {
    if (racine) return;
    racine = creer("div");
    racine.id = id;
    racine.hidden = true;
    racine.setAttribute("role", "alertdialog");
    racine.setAttribute("aria-labelledby", id + "Question");
    racine.setAttribute("aria-describedby", id + "Texte");
    // Deux blocs : le titre fixe « Est-ce bien votre demande ? » sur sa ligne, puis dessous la demande entre guillemets (« Afficher les gaines du niveau 2 »).
    // Aucun compte rendu (nombre d'elements, effets).
    const corps = creer("p", "commandes-bandeau-corps");
    const question = creer("span", "commandes-bandeau-question", QUESTION);
    question.id = id + "Question";
    texte = creer("span", "commandes-bandeau-texte");
    texte.id = id + "Texte";
    corps.append(question, texte);
    const actions = creer("div", "commandes-bandeau-actions");
    actions.append(bouton("Oui", "oui"), bouton("Non", "non"));
    racine.append(corps, actions);
    // Les clics ne remontent pas : xeokit annule l'action par defaut d'un clic tant que le pointeur est reste sur le canevas 3D.
    racine.addEventListener("click", (e) => {
      e.stopPropagation();
      const cible = e.target.closest("[data-act]");
      if (!cible || racine.hidden) return;
      if (cible.dataset.act === "oui") { masquer(true); surOui(); }
      else { masquer(false); surNon(); }
    });
    (conteneur || document.body).appendChild(racine);
  }

  // Hauteur reelle du bandeau (variable selon la longueur du texte et la largeur) : la barre d'outils du Viewer descend d'autant.
  function mesurer() {
    if (racine && !racine.hidden) document.body.style.setProperty(variable, racine.offsetHeight + "px");
  }

  function montrer({ relecture }) {
    assurerSquelette();
    // Espaces insecables : le guillemet fermant reste collé au dernier mot, jamais seul sur une ligne.
    texte.textContent = relecture ? "«\u00a0" + relecture + "\u00a0»" : "";
    racine.hidden = false;
    document.body.classList.add(classeActif);
    mesurer();
    if (typeof ResizeObserver === "function" && !observateur) {
      observateur = new ResizeObserver(mesurer);
      observateur.observe(racine);
    }
    racine.querySelector('[data-act="oui"]').focus({ preventScroll: true });
  }

  // rendreFocus : « Oui » remet le focus sur retourFocus (le bouton « IA ») ; « Non » et la sortie du Viewer laissent le suivant le prendre.
  function masquer(rendreFocus = false) {
    if (!racine || racine.hidden) return;
    racine.hidden = true;
    document.body.classList.remove(classeActif);
    document.body.style.removeProperty(variable);
    if (rendreFocus && retourFocus && document.contains(retourFocus)) retourFocus.focus({ preventScroll: true });
  }

  return { montrer, masquer, visible: () => !!racine && !racine.hidden };
}
