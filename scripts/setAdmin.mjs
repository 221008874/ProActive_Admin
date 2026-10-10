// Grants the admin custom claim that firestore.rules checks.
//
//   node scripts/setAdmin.mjs admin@example.com
//   node scripts/setAdmin.mjs admin@example.com --revoke
//
// IMPORTANT: run this BEFORE deploying the rules that require the claim.
// A signed-in admin without the claim gets permission-denied on every write.
//
// The user must sign out and back in afterwards: custom claims live in the ID
// token, which is cached until refresh.

import fs from "node:fs";
import * as admin from "firebase-admin";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: node scripts/setAdmin.mjs <admin-email> [--revoke]");
  process.exit(1);
}

const keyPath = process.env.SERVICE_ACCOUNT;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("Set SERVICE_ACCOUNT to the path of your service account key JSON.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });

let user;
try {
  user = await admin.auth().getUserByEmail(email);
} catch (e) {
  console.error(`No auth user with email ${email}. Create one in the Firebase console first.`);
  process.exit(1);
}

const existing = user.customClaims ?? {};
console.log(`uid=${user.uid}  existing claims=${JSON.stringify(existing)}`);

const claims = revoke ? { ...existing, admin: false } : { ...existing, admin: true };
await admin.auth().setCustomUserClaims(user.uid, claims);

console.log(`${revoke ? "revoked" : "granted"} admin claim for ${email} (${user.uid})`);
console.log("Ask them to sign out and sign in again for the token to refresh.");
process.exit(0);