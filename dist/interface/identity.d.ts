/**
 * Uniquely identifies an entity.
 * Id is internal to the system whereas name is external to the system.
 */
export declare class Identity {
    id: string;
    name: string;
    constructor(id: string, name: string);
    toString(): string;
}
