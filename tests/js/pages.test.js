// Contrôles statiques des pages : aucun script externe sans version figée, CSP de l'admin restreinte.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..", "..");
const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith(".html"));

test("aucune page ne charge de script depuis un autre site", () => {
  for (const f of pages) {
    const html = fs.readFileSync(path.join(RACINE, f), "utf8");
    for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      assert.doesNotMatch(m[1], /^(https?:)?\/\//, `${f} charge un script externe : ${m[1]}`);
    }
  }
});

test("les scripts locaux référencés existent", () => {
  for (const f of pages) {
    const html = fs.readFileSync(path.join(RACINE, f), "utf8");
    for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(RACINE, m[1].split("?")[0])), `${f} : fichier manquant ${m[1]}`);
    }
  }
});

test("la CSP de l'admin n'autorise que le site et le projet Supabase", () => {
  const html = fs.readFileSync(path.join(RACINE, "admin.html"), "utf8");
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /\*|unsafe-inline|unsafe-eval|jsdelivr/);
  const projet = fs.readFileSync(path.join(RACINE, "supabase-config.js"), "utf8").match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
  assert.ok(csp.includes(`connect-src ${projet}`), "connect-src doit viser le projet de supabase-config.js");
});
