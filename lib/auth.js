import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "aj_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ALLOWED_UPLOAD_ROLES = new Set(["ADMIN", "COUPLE", "PHOTOGRAPHER"]);

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable.");
  }
  return secret;
}

function base64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user) {
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encoded = base64urlEncode(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;

  const [encoded, incomingSignature] = token.split(".");
  const expectedSignature = signPayload(encoded);

  const incomingBuffer = Buffer.from(incomingSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (incomingBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(incomingBuffer, expectedBuffer)) return null;

  const payload = JSON.parse(base64urlDecode(encoded));
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}

export function readSessionFromCookieStore(cookieStore) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function readSessionFromRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function canUpload(role) {
  return ALLOWED_UPLOAD_ROLES.has(role);
}

export function getAuthUsers() {
  const raw = process.env.AUTH_USERS_JSON || "[]";
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry) => ({
    email: String(entry.email || "").toLowerCase(),
    name: String(entry.name || ""),
    role: String(entry.role || "").toUpperCase(),
    passwordHash: String(entry.passwordHash || "")
  }));
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash.startsWith("scrypt$") && !passwordHash.startsWith("scrypt:")) return false;
  const parts = passwordHash.includes(":") ? passwordHash.split(":") : passwordHash.split("$");
  if (parts.length !== 3) return false;

  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");

  if (derivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}
