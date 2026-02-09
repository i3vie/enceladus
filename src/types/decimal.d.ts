declare module "@prisma/client/runtime/client" {
    interface Decimal {
        formatMoney(fractionDigits?: number): string;
    }
}

export {};
