"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initImportExportController = void 0;
const multer_1 = __importDefault(require("multer"));
const pako_1 = require("pako");
const importExportService = __importStar(require("../../shared/services/importExport"));
const database_1 = require("../database");
const functions_1 = require("../utils/functions");
const upload = (0, multer_1.default)();
const initImportExportController = (app) => {
    app.get('/api/export', functions_1.requireDB, async (_req, res) => {
        const result = await importExportService.exportAllData(database_1.dbInstance);
        res.json(result);
    });
    app.post('/api/import', functions_1.requireDB, upload.single('file'), async (req, res) => {
        if (!req.file)
            return res.status(400).json({ success: false, key: 'error.invalidFile' });
        try {
            const decompressed = (0, pako_1.ungzip)(req.file.buffer, { toText: true });
            const parsed = JSON.parse(decompressed);
            const result = await importExportService.importAllData(database_1.dbInstance, parsed);
            res.json(result);
        }
        catch {
            res.status(400).json({ success: false, key: 'error.invalidFile' });
        }
    });
};
exports.initImportExportController = initImportExportController;
