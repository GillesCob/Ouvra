// 2D -> 3D (25/10) : choix et controle du fichier de plan importe (src/plan3d/importPlan.js). Le rendu du PDF et le decodage d'image demandent un navigateur : testes a la main.
import test from "node:test";
import assert from "node:assert/strict";
import { typeFichier, verifierFichier, TAILLE_MAX_OCTETS } from "../src/plan3d/importPlan.js";

const f = (name, type, size = 1000) => ({ name, type, size });

test("typeFichier reconnait PDF et images par type MIME ou extension", () => {
  assert.equal(typeFichier(f("plan.pdf", "application/pdf")), "pdf");
  assert.equal(typeFichier(f("PLAN.PDF", "")), "pdf");
  assert.equal(typeFichier(f("plan.png", "image/png")), "image");
  assert.equal(typeFichier(f("photo.JPG", "")), "image");
  assert.equal(typeFichier(f("scan.jpeg", "image/jpeg")), "image");
});

test("typeFichier refuse le reste, y compris les entrees vides", () => {
  assert.equal(typeFichier(f("plan.dwg", "")), null);
  assert.equal(typeFichier(f("plan.svg", "image/svg+xml")), null);
  assert.equal(typeFichier(null), null);
  assert.equal(typeFichier({}), null);
  assert.equal(typeFichier(undefined), null);
});

test("verifierFichier : format, fichier vide et fichier trop lourd", () => {
  assert.equal(verifierFichier(f("plan.pdf", "application/pdf")), null);
  assert.match(verifierFichier(f("plan.dwg", "")), /Format/);
  assert.match(verifierFichier(f("plan.png", "image/png", 0)), /vide/);
  assert.match(verifierFichier(f("plan.png", "image/png", TAILLE_MAX_OCTETS + 1)), /lourd/);
  assert.equal(verifierFichier(f("plan.png", "image/png", TAILLE_MAX_OCTETS)), null);
});

test("largeurRenduPdf : 2400 px au plus, reduite pour un telephone ou une page tres grande", async () => {
  const { largeurRenduPdf } = await import("../src/plan3d/importPlan.js");
  assert.equal(largeurRenduPdf(842, 595), 2400); // A4 paysage sur ordinateur
  assert.equal(largeurRenduPdf(842, 595, { telephone: true }), 1800);
  assert.equal(largeurRenduPdf(842, 5950), Math.floor(Math.sqrt((16e6 * 842) / 5950))); // page 10 fois plus haute : plafond de pixels
  const l = largeurRenduPdf(842, 5950, { telephone: true });
  assert.ok(l * ((l * 5950) / 842) <= 6e6 + 1e4);
  assert.equal(largeurRenduPdf(0, 0), 2400);
});
