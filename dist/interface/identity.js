"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Identity = void 0;
/**
 * Uniquely identifies an entity.
 * Id is internal to the system whereas name is external to the system.
 */
class Identity {
    id;
    name;
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
    toString() {
        return `${this.id}:${this.name}`;
    }
}
exports.Identity = Identity;
//# sourceMappingURL=identity.js.map