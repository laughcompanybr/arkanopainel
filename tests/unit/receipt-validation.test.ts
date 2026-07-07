import { describe, expect, it } from "vitest";
import {
  RECEIPT_MAX_BYTES,
  ReceiptValidationException,
  sanitizeReceiptPath,
  validateReceiptMetadata,
} from "../../src/features/finance/receipt-validation";


describe("sanitizeReceiptPath", () => {
  it("returns null for empty input", () => {
    expect(sanitizeReceiptPath(null)).toBeNull();
    expect(sanitizeReceiptPath(undefined)).toBeNull();
    expect(sanitizeReceiptPath("")).toBeNull();
    expect(sanitizeReceiptPath("   ")).toBeNull();
  });

  it("rejects traversal and absolute paths", () => {
    expect(() => sanitizeReceiptPath("../evil.pdf")).toThrow(ReceiptValidationException);
    expect(() => sanitizeReceiptPath("/etc/passwd.pdf")).toThrow(/inválido/);
    expect(() => sanitizeReceiptPath("receipts/../secret.pdf")).toThrow(/inválido/);
  });

  it("rejects overly long paths", () => {
    const long = "receipts/" + "a".repeat(600) + ".pdf";
    expect(() => sanitizeReceiptPath(long)).toThrow(/inválido/);
  });

  it("rejects disallowed extensions", () => {
    expect(() => sanitizeReceiptPath("receipts/x.exe")).toThrow(/Extensão/);
    expect(() => sanitizeReceiptPath("receipts/x.svg")).toThrow(/Extensão/);
    expect(() => sanitizeReceiptPath("receipts/x")).toThrow(/Extensão/);
  });

  it("accepts allowed extensions and trims", () => {
    expect(sanitizeReceiptPath("  receipts/a.pdf  ")).toBe("receipts/a.pdf");
    for (const ext of ["png", "jpg", "jpeg", "webp", "gif", "heic", "pdf"]) {
      expect(sanitizeReceiptPath(`receipts/x.${ext}`)).toBe(`receipts/x.${ext}`);
    }
  });
});

describe("validateReceiptMetadata", () => {
  it("rejects empty files", () => {
    expect(() => validateReceiptMetadata("a.pdf", { size: 0, mime: "application/pdf" }))
      .toThrow(/vazio/);
    expect(() => validateReceiptMetadata("a.pdf", { size: null, mime: "application/pdf" }))
      .toThrow(/vazio/);
  });

  it("rejects files over 10MB", () => {
    expect(() =>
      validateReceiptMetadata("a.pdf", { size: RECEIPT_MAX_BYTES + 1, mime: "application/pdf" }),
    ).toThrow(/10MB/);
  });

  it("rejects disallowed mime types even with valid extension", () => {
    expect(() =>
      validateReceiptMetadata("a.pdf", { size: 100, mime: "application/x-msdownload" }),
    ).toThrow(/não permitido/);
    expect(() =>
      validateReceiptMetadata("a.png", { size: 100, mime: "image/svg+xml" }),
    ).toThrow(/não permitido/);
  });

  it("accepts all valid mime types", () => {
    for (const mime of [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
      "image/heic",
      "application/pdf",
    ]) {
      expect(() => validateReceiptMetadata("f.pdf", { size: 100, mime })).not.toThrow();
    }
  });

  it("falls back to extension when mime is missing", () => {
    expect(() => validateReceiptMetadata("a.pdf", { size: 100, mime: null })).not.toThrow();
    expect(() => validateReceiptMetadata("a.png", { size: 100, mime: "" })).not.toThrow();
    expect(() => validateReceiptMetadata("a.exe", { size: 100, mime: null })).toThrow(
      /não permitido/,
    );
  });

  it("attaches structured error codes for the client", () => {
    try {
      validateReceiptMetadata("a.pdf", { size: RECEIPT_MAX_BYTES + 1, mime: "application/pdf" });
    } catch (e) {
      expect(e).toBeInstanceOf(ReceiptValidationException);
      expect((e as ReceiptValidationException).code).toBe("too_large");
    }
    try {
      validateReceiptMetadata("a.pdf", { size: 100, mime: "text/html" });
    } catch (e) {
      expect((e as ReceiptValidationException).code).toBe("invalid_mime");
    }
  });
});
