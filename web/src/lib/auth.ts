import { scryptSync, randomBytes, timingSafeEqual, createHash } from "crypto";
import { getDb } from "./db";
import { cookies, headers } from "next/headers";
import { signJwt, verifyJwt, JwtPayload } from "./jwt";

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: "ADMIN" | "USER";
  isSuperAdmin: number;
  isActive: number;
  mustResetPassword: number;
  failedAttempts: number;
  lockedUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "USER";
  isSuperAdmin: boolean;
  isActive: boolean;
  mustResetPassword: boolean;
  impersonatedBy?: string | null;
  createdAt: number;
}

// 1. Password Hashing Utilities
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKeyBuffer = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKeyBuffer);
  } catch {
    return false;
  }
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 2. Settings Helpers
export function getSetting(key: string, defaultVal: string = ""): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : defaultVal;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return {
    selfSignupEnabled: settings.selfSignupEnabled === "true",
    rateLimitEnabled: settings.rateLimitEnabled === "true",
    rateLimitWindow: parseInt(settings.rateLimitWindow || "15", 10),
    rateLimitMaxAttempts: parseInt(settings.rateLimitMaxAttempts || "20", 10),
  };
}

export function isSetupNeeded(): boolean {
  const db = getDb();
  const countRow = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return countRow.count === 0;
}

// 3. User Registration & Setup
export function setupSuperAdmin(data: {
  email: string;
  username: string;
  displayName: string;
  password: string;
}): { user: SafeUser; accessToken: string; refreshToken: string } {
  const db = getDb();

  const countRow = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (countRow.count > 0) {
    throw new Error("Super Admin setup has already been completed. Please log in.");
  }

  const email = data.email.trim().toLowerCase();
  const username = data.username.trim().replace(/^@/, "");
  const displayName = data.displayName.trim() || username;

  if (!email || !username || !data.password) {
    throw new Error("Email, username, and password are required.");
  }

  const userId = `usr_super_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const passwordHash = hashPassword(data.password);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, email, username, displayName, passwordHash, role, isSuperAdmin, isActive, mustResetPassword, failedAttempts, lockedUntil, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, 1, 0, 0, NULL, ?, ?)
  `).run(userId, email, username, displayName, passwordHash, now, now);

  const safeUser: SafeUser = {
    id: userId,
    email,
    username,
    displayName,
    role: "ADMIN",
    isSuperAdmin: true,
    isActive: true,
    mustResetPassword: false,
    createdAt: now,
  };

  const tokens = issueAuthTokens(safeUser);
  return { user: safeUser, ...tokens };
}

export function registerUser(data: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  isAdminCreated?: boolean;
}): SafeUser {
  const db = getDb();

  if (isSetupNeeded()) {
    throw new Error("Super Admin setup required first.");
  }

  const email = data.email.trim().toLowerCase();
  const username = data.username.trim().replace(/^@/, "");
  const displayName = data.displayName.trim() || username;

  if (!email || !username || !data.password) {
    throw new Error("Email, username, and password are required.");
  }

  // Check self-signup permission if not admin created
  if (!data.isAdminCreated) {
    const signupAllowed = getSetting("selfSignupEnabled", "true") === "true";
    if (!signupAllowed) {
      throw new Error("Public self-registration is currently disabled by administrator.");
    }
  }

  // Check uniqueness
  const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingEmail) {
    throw new Error("An account with this email already exists.");
  }

  const existingUsername = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (existingUsername) {
    throw new Error("Username is already taken.");
  }

  const userId = `usr_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const passwordHash = hashPassword(data.password);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, email, username, displayName, passwordHash, role, isSuperAdmin, isActive, mustResetPassword, failedAttempts, lockedUntil, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'USER', 0, 1, 0, 0, NULL, ?, ?)
  `).run(userId, email, username, displayName, passwordHash, now, now);

  return {
    id: userId,
    email,
    username,
    displayName,
    role: "USER",
    isSuperAdmin: false,
    isActive: true,
    mustResetPassword: false,
    createdAt: now,
  };
}

// 4. Token Issuing & Rotation
export function issueAuthTokens(user: SafeUser): { accessToken: string; refreshToken: string } {
  const db = getDb();
  const now = Date.now();

  // 15 Minutes Access Token JWT
  const accessToken = signJwt(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    },
    15 * 60
  );

  // 7 Days Refresh Token
  const rawRefreshToken = `rt_${randomBytes(40).toString("hex")}`;
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const tokenId = `rtid_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

  db.prepare(`
    INSERT INTO refresh_tokens (id, userId, tokenHash, expiresAt, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenId, user.id, tokenHash, expiresAt, now);

  return { accessToken, refreshToken: rawRefreshToken };
}

export function rotateRefreshToken(rawRefreshToken: string): { user: SafeUser; accessToken: string; refreshToken: string } {
  const db = getDb();
  const now = Date.now();
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const rtRow = db.prepare(`
    SELECT rt.id, rt.userId, rt.expiresAt, u.*
    FROM refresh_tokens rt
    JOIN users u ON rt.userId = u.id
    WHERE rt.tokenHash = ? AND rt.expiresAt > ?
  `).get(tokenHash, now) as (UserRecord & { id: string; userId: string; expiresAt: number }) | undefined;

  if (!rtRow || !rtRow.isActive) {
    throw new Error("Invalid or expired refresh token. Please sign in again.");
  }

  // Delete used refresh token (Single-use token rotation)
  db.prepare("DELETE FROM refresh_tokens WHERE tokenHash = ?").run(tokenHash);

  const safeUser: SafeUser = {
    id: rtRow.userId,
    email: rtRow.email,
    username: rtRow.username,
    displayName: rtRow.displayName,
    role: rtRow.role,
    isSuperAdmin: Boolean(rtRow.isSuperAdmin),
    isActive: Boolean(rtRow.isActive),
    mustResetPassword: Boolean(rtRow.mustResetPassword),
    createdAt: rtRow.createdAt,
  };

  const tokens = issueAuthTokens(safeUser);
  return { user: safeUser, ...tokens };
}

export function authenticateUser(loginIdentifier: string, password: string): { user: SafeUser; accessToken: string; refreshToken: string } {
  const db = getDb();
  const identifier = loginIdentifier.trim().toLowerCase();
  const now = Date.now();

  const user = db.prepare(`
    SELECT * FROM users WHERE email = ? OR username = ? COLLATE NOCASE
  `).get(identifier, identifier) as UserRecord | undefined;

  if (!user) {
    throw new Error("Invalid email/username or password.");
  }

  if (!user.isActive) {
    throw new Error("Account has been deactivated. Please contact administrator.");
  }

  const rateLimitSettings = getAllSettings();

  // Check Lockout
  if (rateLimitSettings.rateLimitEnabled && user.lockedUntil && user.lockedUntil > now) {
    const minutesLeft = Math.ceil((user.lockedUntil - now) / 60000);
    throw new Error(`Account is temporarily locked due to failed attempts. Try again in ${minutesLeft} minute(s) or contact administrator.`);
  }

  const isValid = verifyPassword(password, user.passwordHash);

  if (!isValid) {
    if (rateLimitSettings.rateLimitEnabled) {
      const newAttempts = user.failedAttempts + 1;
      let lockUntil: number | null = null;

      if (newAttempts >= rateLimitSettings.rateLimitMaxAttempts) {
        lockUntil = now + rateLimitSettings.rateLimitWindow * 60 * 1000;
      }

      db.prepare(`
        UPDATE users SET failedAttempts = ?, lockedUntil = ?, updatedAt = ? WHERE id = ?
      `).run(newAttempts, lockUntil, now, user.id);

      if (lockUntil) {
        throw new Error(`Account has been locked due to ${newAttempts} failed attempts for ${rateLimitSettings.rateLimitWindow} minutes.`);
      }
    }
    throw new Error("Invalid email/username or password.");
  }

  // Reset failed attempts upon successful login
  db.prepare(`
    UPDATE users SET failedAttempts = 0, lockedUntil = NULL, updatedAt = ? WHERE id = ?
  `).run(now, user.id);

  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isSuperAdmin: Boolean(user.isSuperAdmin),
    isActive: Boolean(user.isActive),
    mustResetPassword: Boolean(user.mustResetPassword),
    createdAt: user.createdAt,
  };

  const tokens = issueAuthTokens(safeUser);
  return { user: safeUser, ...tokens };
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Try Bearer Token in Authorization header
  let accessToken = "";
  const authHeader = headerStore.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7).trim();
  }

  // 2. Try Cookie if no Bearer header
  if (!accessToken) {
    accessToken = cookieStore.get("devnix_access_token")?.value || "";
  }

  if (accessToken) {
    const payload = verifyJwt(accessToken);
    if (payload) {
      const db = getDb();
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId) as UserRecord | undefined;
      if (user && user.isActive) {
        return {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          isSuperAdmin: Boolean(user.isSuperAdmin),
          isActive: Boolean(user.isActive),
          mustResetPassword: Boolean(user.mustResetPassword),
          createdAt: user.createdAt,
        };
      }
    }
  }

  // 3. If access token expired or invalid, attempt refresh via Refresh Token cookie
  const refreshToken = cookieStore.get("devnix_refresh_token")?.value;
  if (refreshToken) {
    try {
      const db = getDb();
      const tokenHash = hashRefreshToken(refreshToken);
      const rtRow = db.prepare(`
        SELECT u.*
        FROM refresh_tokens rt
        JOIN users u ON rt.userId = u.id
        WHERE rt.tokenHash = ? AND rt.expiresAt > ?
      `).get(tokenHash, Date.now()) as UserRecord | undefined;

      if (rtRow && rtRow.isActive) {
        return {
          id: rtRow.id,
          email: rtRow.email,
          username: rtRow.username,
          displayName: rtRow.displayName,
          role: rtRow.role,
          isSuperAdmin: Boolean(rtRow.isSuperAdmin),
          isActive: Boolean(rtRow.isActive),
          mustResetPassword: Boolean(rtRow.mustResetPassword),
          createdAt: rtRow.createdAt,
        };
      }
    } catch {}
  }

  return null;
}

export function revokeRefreshToken(rawRefreshToken: string) {
  const db = getDb();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  db.prepare("DELETE FROM refresh_tokens WHERE tokenHash = ?").run(tokenHash);
}

export function revokeAllUserTokens(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM refresh_tokens WHERE userId = ?").run(userId);
}
