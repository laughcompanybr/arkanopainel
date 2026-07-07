/**
 * Preprocess/transform helpers for Zod schemas to defensively coerce
 * nullish/empty server payloads into safe client defaults, avoiding
 * deserialization failures when a nullable column comes back as null.
 */
import { z } from "zod";

/** Accepts string | null | undefined; returns string (default ""). */
export const zNullableString = (fallback = "") =>
  z.preprocess((v) => (v === null || v === undefined ? fallback : v), z.string());

/** Accepts number | string | null | undefined; returns number (default 0). */
export const zNullableNumber = (fallback = 0) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return fallback;
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return v;
  }, z.number());

/** Accepts boolean | null | undefined; returns boolean (default false). */
export const zNullableBoolean = (fallback = false) =>
  z.preprocess((v) => (v === null || v === undefined ? fallback : v), z.boolean());

/** Accepts array | null | undefined; returns array (default []). */
export const zNullableArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === null || v === undefined ? [] : v), z.array(schema));
