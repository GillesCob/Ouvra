// Point d'entree des Discussions par commande en langage naturel (24/10, interaction revue le 25/10) : l'onglet « IA » de la liste des discussions
// (#discussionsIABtn, troisieme onglet du groupe Individuel / Groupes / IA, construit par src/messagerie/messagerie.js).
//  - Choisir l'onglet IA ouvre DIRECTEMENT la modale de demande en mode VOCAL (micro pret, jamais d'ecoute automatique), avec « Écrire ma demande » pour
//    basculer en texte sans perdre la phrase : c'est la modale COMMUNE des IA d'Ouvra (src/iaSaisie.js), ici seulement parametree.
//  - Le panneau de gauche (#msgIAPanneau) ne garde que « Nouvelle demande » (rouvre la modale en vocal) ; les discussions trouvees s'affichent dessous
//    (src/messagerie/messagerie.js). Les phrases toutes faites n'y sont plus (28/10) : elles vivent dans la modale (« Proposition d'instruction »).
//  - Apres l'envoi, le resultat est applique tout de suite (proposer) : la modale se ferme et le bandeau « Est-ce bien votre demande ? »
//    (src/discussionsIABandeau.js) prend le relais. « Non » rouvre la modale en mode texte avec la phrase (reformuler).
// Module sans dependance a main.js : tout passe par les parametres de creerDiscussionsIA.
//   panneau : l'element #msgIAPanneau ; retourFocus : element qui reprend le focus quand la modale se ferme ; exemples : [{ demande }] ; exempleRapport : { libelle, surClic } du lien « Voir un exemple de rapport » de la modale (facultatif) ;
//   historique : { lister() -> [{ id, nom, creeLe }], ouvrir(entree) } (28/10) : cartes cliquables des syntheses deja creees, sous « Nouvelle demande » ;
//   traiter(phrase) : promesse de { ok, ... } (src/discussionsIAPipeline.js), ne rejette jamais ;
//   proposer(retour, phrase) : applique le resultat, rend { ok: true } ou { ok: false, message }

import "./discussionsIA.css";
import { creerIASaisie, PHRASE_MAX } from "./iaSaisie.js";
import { dateSynthese } from "./discussionsIAHistorique.js";

const PLACEHOLDER_TEXTE = "Ex. : échanges avec Sophie Lambert";
const MESSAGE_PHRASE_VIDE = "Écrire ce qui est recherché, par exemple « montre-moi tous les échanges avec Sophie Lambert ».";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerDiscussionsIA({ panneau, retourFocus = null, exemples, traiter, proposer, exempleRapport = null, historique = null }) {
  const saisie = creerIASaisie({
    exemples,
    libelle: "Recherche dans les discussions par l'IA",
    placeholder: PLACEHOLDER_TEXTE,
    messageVide: MESSAGE_PHRASE_VIDE,
    retourFocus,
    lienBas: exempleRapport,
    async surEnvoi(phrase, { annule }) {
      const retour = await traiter(phrase);
      // Modale fermee depuis l'envoi : le resultat est abandonne, rien ne s'applique a l'insu de l'utilisateur.
      if (annule()) return { ok: false };
      if (!retour.ok) return { ok: false, message: retour.message };
      const application = proposer(retour, phrase);
      return application.ok ? { ok: true } : { ok: false, message: application.message }; // ok : le bandeau a deja pris le focus (« Oui »)
    }
  });

  // ---------- Panneau de gauche : « Nouvelle demande » ----------
  const nouvelle = creer("button", "msg-ia-nouvelle", "Nouvelle demande");
  nouvelle.type = "button";
  nouvelle.addEventListener("click", () => { if (!saisie.ouvert()) saisie.ouvrir(); });
  panneau.append(nouvelle);

  // ---------- Historique des syntheses (28/10) : une carte cliquable par synthese (nom + date), un appui rouvre le rapport ----------
  const histo = creer("section", "msg-ia-histo");
  const histoTitre = creer("h3", "msg-ia-histo-titre", "Synthèses précédentes");
  histoTitre.id = "msgIAHistoTitre";
  const histoListe = creer("ul", "msg-ia-histo-liste");
  histoListe.setAttribute("aria-labelledby", "msgIAHistoTitre");
  histo.append(histoTitre, histoListe);
  if (historique) panneau.append(histo);

  function majHistorique() {
    if (!historique) return;
    const entrees = historique.lister();
    histoListe.textContent = "";
    histo.hidden = !entrees.length;
    for (const entree of entrees) {
      const li = creer("li", "msg-ia-histo-item");
      const carte = creer("button", "msg-ia-histo-carte");
      carte.type = "button";
      carte.append(creer("span", "msg-ia-histo-nom", entree.nom), creer("span", "msg-ia-histo-date", dateSynthese(entree)));
      carte.addEventListener("click", () => historique.ouvrir(entree));
      li.appendChild(carte);
      histoListe.appendChild(li);
    }
  }
  majHistorique();

  return {
    ouvrir: () => { if (!saisie.ouvert()) saisie.ouvrir(); },
    fermer: () => saisie.fermer(),
    ouvert: saisie.ouvert,
    reformuler: (phrase) => saisie.reformuler(phrase),
    majHistorique
  };
}
