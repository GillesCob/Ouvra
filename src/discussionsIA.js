// Point d'entree des Discussions par commande en langage naturel (24/10, interaction revue le 25/10) : l'onglet « IA » de la liste des discussions
// (#discussionsIABtn, troisieme onglet du groupe Individuel / Groupes / IA, construit par src/messagerie/messagerie.js).
//  - Choisir l'onglet IA ouvre DIRECTEMENT la modale de demande en mode VOCAL (micro pret, jamais d'ecoute automatique), avec « Écrire ma demande » pour
//    basculer en texte sans perdre la phrase : c'est la modale COMMUNE des IA d'Ouvra (src/iaSaisie.js), ici seulement parametree.
//  - Le panneau de gauche (#msgIAPanneau) garde « Nouvelle demande » (rouvre la modale en vocal) et les phrases toutes faites (un clic ouvre le mode texte
//    avec la phrase ecrite) ; les discussions trouvees s'affichent dessous (src/messagerie/messagerie.js).
//  - Apres l'envoi, le resultat est applique tout de suite (proposer) : la modale se ferme et le bandeau « Est-ce bien votre demande ? »
//    (src/discussionsIABandeau.js) prend le relais. « Non » rouvre la modale en mode texte avec la phrase (reformuler).
// Module sans dependance a main.js : tout passe par les parametres de creerDiscussionsIA.
//   panneau : l'element #msgIAPanneau ; retourFocus : element qui reprend le focus quand la modale se ferme ; exemples : [{ demande }] ;
//   traiter(phrase) : promesse de { ok, ... } (src/discussionsIAPipeline.js), ne rejette jamais ;
//   proposer(retour, phrase) : applique le resultat, rend { ok: true } ou { ok: false, message }

import "./discussionsIA.css";
import { creerIASaisie, PHRASE_MAX } from "./iaSaisie.js";

const PLACEHOLDER_TEXTE = "Ex. : montre-moi tous les échanges avec Sophie Lambert";
const MESSAGE_PHRASE_VIDE = "Écris ce que tu cherches, par exemple « montre-moi tous les échanges avec Sophie Lambert ».";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerDiscussionsIA({ panneau, retourFocus = null, exemples, traiter, proposer }) {
  const saisie = creerIASaisie({
    exemples,
    libelle: "Recherche dans les discussions par l'IA",
    placeholder: PLACEHOLDER_TEXTE,
    messageVide: MESSAGE_PHRASE_VIDE,
    retourFocus,
    async surEnvoi(phrase, { annule }) {
      const retour = await traiter(phrase);
      // Modale fermee depuis l'envoi : le resultat est abandonne, rien ne s'applique a l'insu de l'utilisateur.
      if (annule()) return { ok: false };
      if (!retour.ok) return { ok: false, message: retour.message };
      const application = proposer(retour, phrase);
      return application.ok ? { ok: true } : { ok: false, message: application.message }; // ok : le bandeau a deja pris le focus (« Oui »)
    }
  });

  // ---------- Panneau de gauche : « Nouvelle demande » et phrases toutes faites ----------
  const nouvelle = creer("button", "msg-ia-nouvelle", "Nouvelle demande");
  nouvelle.type = "button";
  nouvelle.addEventListener("click", () => { if (!saisie.ouvert()) saisie.ouvrir(); });
  const phrases = creer("details", "msg-ia-phrases");
  phrases.append(creer("summary", null, "Phrases toutes faites"));
  const liste = creer("ul");
  exemples.forEach((exemple) => {
    const li = creer("li");
    const b = creer("button", "msg-ia-phrase", exemple.demande);
    b.type = "button";
    b.addEventListener("click", () => saisie.reformuler(exemple.demande.slice(0, PHRASE_MAX)));
    li.appendChild(b);
    liste.appendChild(li);
  });
  phrases.appendChild(liste);
  panneau.append(nouvelle, phrases);

  return {
    ouvrir: () => { if (!saisie.ouvert()) saisie.ouvrir(); },
    fermer: () => saisie.fermer(),
    ouvert: saisie.ouvert,
    reformuler: (phrase) => saisie.reformuler(phrase)
  };
}
