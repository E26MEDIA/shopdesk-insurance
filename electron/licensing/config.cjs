/**
 * E26 license verification public key (Ed25519 SPKI PEM).
 * Replace with the key printed by `npm run db:seed` in admin/.
 * Or set LICENSE_SIGNING_PUBLIC_KEY in environment.
 */
module.exports.PUBLIC_KEY_PEM = process.env.LICENSE_SIGNING_PUBLIC_KEY
  ? process.env.LICENSE_SIGNING_PUBLIC_KEY.replace(/\\n/g, "\n")
  : `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAniD4zX5Psd+4kze1cRCM4JmXrLX1F1O8KNAtMgAnsfw=
-----END PUBLIC KEY-----`;

module.exports.LICENSE_API_URL =
  process.env.E26_LICENSE_API_URL ||
  "https://insurance.e26media.com/api/v1";

module.exports.SKIP_LICENSE = process.env.SHOPDESK_SKIP_LICENSE === "1";
