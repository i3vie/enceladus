import { Decimal } from "@prisma/client/runtime/client";

const MONEY_RE = /^-?\d+(?:\.\d+)?$/;

export function parseMoney(raw: string | undefined, maxScale = 2): Decimal | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!MONEY_RE.test(trimmed)) return null;

    try {
        const value = new Decimal(trimmed);
        if (!value.isFinite()) return null;
        if (value.decimalPlaces() > maxScale) return null;
        return value;
    } catch {
        return null;
    }
}
