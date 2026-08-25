import crypto from "crypto";

const ENCRYPTION_SECRET = process.env.DEVNIX_SECRET_KEY || "devnix-super-secure-default-encryption-secret-key-32b!";
// 32-byte key derived via SHA-256
const KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();

/**
 * Encrypt plain text using AES-256-GCM
 * Returns format: iv:authTag:cipherHex
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt cipher text from AES-256-GCM
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) return "";
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}
