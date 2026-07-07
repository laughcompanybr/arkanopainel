/**
 * Pure server-side validation for receipt uploads. Extracted so it can be
 * unit-tested without hitting Supabase storage.
 */

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/i;
export const RECEIPT_ALLOWED_EXT = /\.(png|jpe?g|webp|gif|heic|pdf)$/i;
export const RECEIPT_ALLOWED_DESCRIPTION =
  "Aceitos: PNG, JPG, WEBP, GIF, HEIC ou PDF, até 10MB.";

export type ReceiptValidationError =
  | "invalid_path"
  | "invalid_extension"
  | "not_found"
  | "empty_file"
  | "too_large"
  | "invalid_mime";

export class ReceiptValidationException extends Error {
  code: ReceiptValidationError;
  constructor(code: ReceiptValidationError, message: string) {
    super(message);
    this.code = code;
    this.name = "ReceiptValidationException";
  }
}

export function sanitizeReceiptPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const clean = String(path).trim();
  if (!clean) return null;
  if (clean.length > 500 || clean.includes("..") || clean.startsWith("/")) {
    throw new ReceiptValidationException("invalid_path", "Caminho de comprovante inválido");
  }
  if (!RECEIPT_ALLOWED_EXT.test(clean)) {
    throw new ReceiptValidationException(
      "invalid_extension",
      "Extensão de comprovante não permitida (use imagem ou PDF)",
    );
  }
  return clean;
}

/**
 * Validate metadata reported by the storage backend for a stored receipt.
 * Mime is preferred; when absent (some storage providers omit it) we fall
 * back to the file extension.
 */
export function validateReceiptMetadata(
  fileName: string,
  meta: { size: number | null | undefined; mime: string | null | undefined },
): void {
  const size = Number(meta.size ?? 0);
  if (!size) {
    throw new ReceiptValidationException("empty_file", "Comprovante está vazio");
  }
  if (size > RECEIPT_MAX_BYTES) {
    throw new ReceiptValidationException("too_large", "Comprovante excede 10MB");
  }
  const mime = String(meta.mime ?? "").trim();
  if (mime) {
    if (!RECEIPT_ALLOWED_MIME.test(mime)) {
      throw new ReceiptValidationException(
        "invalid_mime",
        "Tipo de arquivo do comprovante não permitido",
      );
    }
  } else if (!RECEIPT_ALLOWED_EXT.test(fileName)) {
    throw new ReceiptValidationException(
      "invalid_mime",
      "Tipo de arquivo do comprovante não permitido",
    );
  }
}
