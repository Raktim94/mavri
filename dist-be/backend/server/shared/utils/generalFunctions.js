"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromBase64 = void 0;
const fromBase64 = (value) => {
    if (!value || typeof value !== 'string')
        return null;
    try {
        return Buffer.from(value, 'base64');
    }
    catch {
        return null;
    }
};
exports.fromBase64 = fromBase64;
