import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { VideurConfig } from "../config";
import { AppError } from "../errors";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class SecretStore {
  private key: Buffer | null = null;

  constructor(
    private readonly keyPath: string,
    private readonly envKey?: string,
  ) {}

  private ensureKey(): Buffer {
    if (this.key) return this.key;

    if (this.envKey) {
      const decoded = Buffer.from(this.envKey, "base64");
      if (decoded.length !== 32) throw new AppError("SECRET_KEY_INVALID", "VIDEUR_MASTER_KEY debe ser base64 de 32 bytes");
      this.key = decoded;
      return this.key;
    }

    if (existsSync(this.keyPath)) {
      const decoded = readFileSync(this.keyPath);
      if (decoded.length !== 32) throw new AppError("SECRET_KEY_INVALID", "La clave maestra debe tener 32 bytes");
      this.key = decoded;
      return this.key;
    }

    const key = randomBytes(32);
    mkdirSync(dirname(this.keyPath), { recursive: true, mode: 0o700 });
    writeFileSync(this.keyPath, key, { mode: 0o600 });
    try {
      chmodSync(this.keyPath, 0o600);
    } catch {
      // Windows no soporta chmod POSIX.
    }
    this.key = key;
    return key;
  }

  encrypt(plain: string): string {
    const key = this.ensureKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
  }

  decrypt(encoded: string): string {
    const [ivB64, tagB64, dataB64] = encoded.split(":");
    if (!ivB64 || !tagB64 || !dataB64) throw new AppError("SECRET_DECRYPT", "Formato de secreto inválido");
    const key = this.ensureKey();
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new AppError("SECRET_DECRYPT", "Secreto corrupto");
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch {
      throw new AppError("SECRET_DECRYPT", "No se pudo descifrar el secreto; ¿cambió la clave maestra?");
    }
  }

  hint(plain: string): string {
    const trimmed = plain.trim();
    if (trimmed.length <= 4) return "…";
    return `…${trimmed.slice(-4)}`;
  }
}

export function createSecretStore(config: VideurConfig, env: NodeJS.ProcessEnv = process.env): SecretStore {
  return new SecretStore(config.paths.masterKey, env.VIDEUR_MASTER_KEY);
}
