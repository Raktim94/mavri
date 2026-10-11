"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDbLimiter = exports.requireDB = exports.parseFilter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const filterType_1 = require("../../shared/enums/filterType");
const database_1 = require("../database");
const parseFilter = (query) => {
    if (!query)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(query);
    }
    catch {
        return undefined;
    }
    if (!Array.isArray(parsed))
        return undefined;
    const result = [];
    for (const item of parsed) {
        if (typeof item !== 'object' || item === null)
            continue;
        const { type, value } = item;
        if (!Object.values(filterType_1.FilterType).includes(type))
            continue;
        if (typeof value !== 'string')
            continue;
        result.push({ type, value });
    }
    return result.length ? result : undefined;
};
exports.parseFilter = parseFilter;
const requireDB = (_req, res, next) => {
    if (!database_1.dbInstance) {
        return res.status(400).json({
            success: false,
            message: undefined,
            key: 'error.databaseNotInitialized'
        });
    }
    next();
};
exports.requireDB = requireDB;
exports.listDbLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: undefined,
        key: 'error.rateLimiter'
    }
});
