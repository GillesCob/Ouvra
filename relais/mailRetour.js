// Mail d'un retour de visiteur (28/10) : construction PURE puis envoi par l'API REST de Resend (https://resend.com/docs/api-reference/emails/send-email :
// POST https://api.resend.com/emails, en-tete Authorization: Bearer <cle>, champs from, to, subject, text). Texte brut seulement : aucun HTML venant d'un visiteur.
// Pas de reply_to : le contact eventuel est ecrit dans le texte (le nom exact du champ n'est pas confirme par la documentation lue).
// La cle n'est lue que par api/retour.js (variable d'environnement de l'hebergeur) ; ni la cle ni le detail d'une erreur Resend ne ressortent d'ici.

const ENDPOINT = "https://api.resend.com/emails";
const LIBELLES = { bug: "bug", idee: "idée" };
const uneLigne = (t) => String(t || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

export function construireMail({ type, message, page = "", contact = "" }, { expediteur, destinataire }) {
  const libelle = LIBELLES[type] || "retour";
  const lignes = ["Type : " + libelle, "Page : " + (uneLigne(page) || "non précisée"), "Contact : " + (uneLigne(contact) || "non précisé"), "", message];
  return { from: expediteur, to: destinataire, subject: "Ouvra, retour (" + libelle + ")" + (uneLigne(page) ? " : " + uneLigne(page) : ""), text: lignes.join("\n") };
}

// fetch est injecte (les tests n'ont aucun reseau). Rend { ok: true } ou { ok: false } : jamais le corps de la reponse de Resend.
export async function envoyerMail(mail, { cle, fetch: appel = (...a) => globalThis.fetch(...a) }) {
  try {
    const reponse = await appel(ENDPOINT, {
      method: "POST",
      headers: { Authorization: "Bearer " + cle, "Content-Type": "application/json" },
      body: JSON.stringify(mail)
    });
    return reponse && reponse.ok ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}
