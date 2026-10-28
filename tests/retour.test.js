// Retours des visiteurs (28/10) : formulaire « Bug ou idée ? » -> POST /api/retour -> un mail via Resend. Validation, mail, gestionnaire HTTP (sans reseau :
// le fetch est injecte). Aucune cle, aucun contenu de retour dans les journaux ni dans les reponses.
import test from "node:test";
import assert from "node:assert/strict";
import { validerEntreeRetour, MESSAGE_MAX } from "../relais/entreeRetour.js";
import { construireMail, envoyerMail } from "../relais/mailRetour.js";
import { creerGestionnaireRetour } from "../relais/httpRetour.js";

const valide = { type: "bug", message: "Le bouton ne répond pas sur la page Collision.", page: "Collision", contact: "visiteur@example.com", site: "" };
const ENV = { RESEND_API_KEY: "re_test", RETOUR_DESTINATAIRE: "moi@example.com", RETOUR_EXPEDITEUR: "Ouvra <retours@envoi.example.com>" };

test("validation : un retour complet est accepte, champs nettoyes", () => {
  const r = validerEntreeRetour({ ...valide, message: "  Le bouton ne répond pas.  " });
  assert.equal(r.ok, true);
  assert.equal(r.type, "bug");
  assert.equal(r.message, "Le bouton ne répond pas.");
  assert.equal(r.page, "Collision");
  assert.equal(r.contact, "visiteur@example.com");
  assert.equal(r.piege, false);
});

test("validation : type inconnu, message vide ou trop long, contact invalide, corps non objet -> refus avec message", () => {
  for (const mauvais of [{ ...valide, type: "autre" }, { ...valide, message: "   " }, { ...valide, message: "x".repeat(MESSAGE_MAX + 1) }, { ...valide, contact: "pas-un-mail" }, null, [], "texte", { ...valide, message: 12 }]) {
    const r = validerEntreeRetour(mauvais);
    assert.equal(r.ok, false);
    assert.equal(typeof r.message, "string");
  }
});

test("validation : page et contact facultatifs ; page tronquee et sans caractere de controle ; champ piege rempli signale", () => {
  const r = validerEntreeRetour({ type: "idee", message: "Une idée" });
  assert.equal(r.ok, true);
  assert.equal(r.page, "");
  assert.equal(r.contact, "");
  assert.equal(validerEntreeRetour({ ...valide, page: "Coll\nision" + "z".repeat(200) }).page.length <= 40, true);
  assert.equal(/[\r\n]/.test(validerEntreeRetour({ ...valide, page: "a\r\nb" }).page), false);
  assert.equal(validerEntreeRetour({ ...valide, site: "http://spam" }).piege, true);
});

test("mail : objet sur une ligne, texte brut avec type, page, contact et message ; aucun HTML", () => {
  const mail = construireMail({ type: "idee", message: "Ajouter un mode sombre.\nMerci.", page: "Viewer\r\nBcc: x@y.z", contact: "v@example.com" }, { expediteur: ENV.RETOUR_EXPEDITEUR, destinataire: ENV.RETOUR_DESTINATAIRE });
  assert.equal(mail.from, ENV.RETOUR_EXPEDITEUR);
  assert.equal(mail.to, ENV.RETOUR_DESTINATAIRE);
  assert.equal(/[\r\n]/.test(mail.subject), false);
  assert.match(mail.subject, /idée/);
  assert.match(mail.text, /Ajouter un mode sombre\.\nMerci\./);
  assert.match(mail.text, /v@example\.com/);
  assert.equal("html" in mail, false);
  assert.equal("reply_to" in mail, false);
});

test("envoyerMail : POST vers l'API Resend avec la cle en Bearer ; une reponse en erreur ou une panne -> ok false sans detail", async () => {
  const appels = [];
  const bon = await envoyerMail({ from: "a", to: "b", subject: "s", text: "t" }, { cle: "re_test", fetch: async (url, init) => { appels.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: "1" }) }; } });
  assert.equal(bon.ok, true);
  assert.equal(appels[0].url, "https://api.resend.com/emails");
  assert.equal(appels[0].init.method, "POST");
  assert.equal(appels[0].init.headers.Authorization, "Bearer re_test");
  assert.equal(JSON.parse(appels[0].init.body).subject, "s");
  const refus = await envoyerMail({}, { cle: "k", fetch: async () => ({ ok: false, status: 403, text: async () => "secret detail" }) });
  assert.deepEqual(refus, { ok: false });
  const panne = await envoyerMail({}, { cle: "k", fetch: async () => { throw new Error("reseau"); } });
  assert.deepEqual(panne, { ok: false });
});

const requete = (corps, { methode = "POST", ip = "1.2.3.4" } = {}) => new Request("http://localhost/api/retour", { method: methode, headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: methode === "POST" ? (typeof corps === "string" ? corps : JSON.stringify(corps)) : undefined });

test("gestionnaire : un retour valide envoie UN mail et repond ok, sans renvoyer le contenu", async () => {
  const envois = [];
  const gerer = creerGestionnaireRetour({ env: ENV, fetch: async (u, i) => { envois.push(JSON.parse(i.body)); return { ok: true, json: async () => ({ id: "1" }) }; }, journal: () => {} });
  const r = await gerer(requete(valide));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(envois.length, 1);
  assert.equal(envois[0].to, ENV.RETOUR_DESTINATAIRE);
});

test("gestionnaire : champ piege rempli -> ok silencieux, aucun mail", async () => {
  let envois = 0;
  const gerer = creerGestionnaireRetour({ env: ENV, fetch: async () => { envois += 1; return { ok: true }; }, journal: () => {} });
  const r = await gerer(requete({ ...valide, site: "http://spam" }));
  assert.equal(r.status, 200);
  assert.equal(envois, 0);
});

test("gestionnaire : methode, entree invalide, JSON casse, corps trop gros, configuration absente, panne Resend", async () => {
  const gerer = creerGestionnaireRetour({ env: ENV, fetch: async () => ({ ok: false, status: 500, text: async () => "detail interne" }), journal: () => {} });
  assert.equal((await gerer(requete(null, { methode: "GET" }))).status, 405);
  assert.equal((await gerer(requete({ ...valide, type: "x" }, { ip: "9.9.9.1" }))).status, 400);
  assert.equal((await gerer(requete("{pas du json", { ip: "9.9.9.2" }))).status, 400);
  assert.equal((await gerer(requete({ ...valide, message: "x".repeat(10000) }, { ip: "9.9.9.3" }))).status, 413);
  const panne = await gerer(requete(valide, { ip: "9.9.9.4" }));
  assert.equal(panne.status, 502);
  assert.equal(JSON.stringify(await panne.json()).includes("detail interne"), false);
  const sansCle = creerGestionnaireRetour({ env: { ...ENV, RESEND_API_KEY: "" }, fetch: async () => ({ ok: true }), journal: () => {} });
  const r = await sansCle(requete(valide, { ip: "9.9.9.5" }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "retours_indisponibles");
});

test("gestionnaire : limite par visiteur (3 par minute), un autre visiteur n'est pas touche", async () => {
  const gerer = creerGestionnaireRetour({ env: ENV, fetch: async () => ({ ok: true }), journal: () => {} });
  for (let i = 0; i < 3; i += 1) assert.equal((await gerer(requete(valide, { ip: "7.7.7.7" }))).status, 200);
  const refus = await gerer(requete(valide, { ip: "7.7.7.7" }));
  assert.equal(refus.status, 429);
  assert.ok(refus.headers.get("retry-after"));
  assert.equal((await gerer(requete(valide, { ip: "8.8.8.8" }))).status, 200);
});
