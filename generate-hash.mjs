import { randomBytes, scryptSync } from "node:crypto";

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

console.log(hashPassword("mannosalwa2026"));