/*
 * Functional-style list operations for convenience and code clarity.
 * Use only on small arrays!
 */
export function cons<T>(head: T, rest: T[]): T[] {
    return [head].concat(rest);
}

export function head<T>(list: T[]): T {
    return list[0];
}

export function rest<T>(list: T[]): T[] {
    return list.slice(1);
}
