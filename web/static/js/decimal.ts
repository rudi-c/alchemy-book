export const BASE = 256;
export const DIVISOR = 16;

// Calculate (n1 - n2) where n1 > n2
export function subtractGreaterThan(n1: number[], n2: number[]): number[] {
    let carry = 0;
    const diff: number[] = Array(n1.length);
    for (let i = n1.length - 1; i >= 0; i--) {
        const d1 = n1[i] - carry;
        const d2 = n2[i];
        if (d1 < d2) {
            carry = 1;
            diff[i] = d1 + BASE - d2;
        } else {
            carry = 0;
            diff[i] = d1 - d2;
        }
    }
    return diff;
}

// Calculate (n1 + n2) where we are guaranteed that n2 << n1 such that
// (n1 + n2) will not have more digits than n1.
export function addNoCarry(n1: number[], n2: number[]): number[] {
    let carry = 0;
    const diff: number[] = Array(n1.length);
    for (let i = n1.length - 1; i >= 0; i--) {
        const sum = n1[i] + n2[i] + carry;
        carry = Math.floor(sum / BASE);
        diff[i] = (sum % BASE);
    }
    if (carry !== 0) {
        throw new Error("there should be no carry");
    }
    return diff;
}

// Calculate (dividend / divisor) assuming (BASE % divisor == 0) and
// do integer truncation (don't add more digits)
export function pseudoIntegerDivision(dividend: number[], divisor: number): number[] {
    if (BASE % divisor !== 0) {
        throw new Error("expected divisor to be a factor of base");
    }
    let carry = 0;
    return dividend.map(digit => {
        const twoDigits = digit * BASE / divisor;
        const newDigit = Math.floor(twoDigits / BASE) + carry;
        carry = twoDigits % BASE;
        return newDigit;
    });
}

// Pad n1 and n2 with 0s at the end such that they have the same
// number of digits.
export function matchDigits(n1: number[], n2: number[]): void {
    for (let i = n1.length; i < n2.length; i++) {
        n1.push(0);
    }
    for (let i = n2.length; i < n1.length; i++) {
        n2.push(0);
    }
}

export function needsNewDigit(n: number[], requiredGap: number): boolean {
    if (n[n.length - 1] < requiredGap) {
        const leadingZeroes =
            n.slice(0, n.length - 1)
             .every(digit => digit === 0);
        return leadingZeroes;
    }
    return false;
}
