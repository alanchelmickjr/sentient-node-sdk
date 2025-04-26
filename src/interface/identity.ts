/**
 * Uniquely identifies an entity.
 * Id is internal to the system whereas name is external to the system.
 */
export class Identity {
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  toString(): string {
    return `${this.id}:${this.name}`;
  }
}