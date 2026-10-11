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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPresetsController = void 0;
const presetsService = __importStar(require("../../shared/services/presets"));
const dataUrlFunctions_1 = require("../../shared/utils/dataUrlFunctions");
const database_1 = require("../database");
const functions_1 = require("../utils/functions");
const initPresetsController = (app) => {
    app.get('/api/presets', functions_1.requireDB, async (req, res) => {
        const filter = (0, functions_1.parseFilter)(req.query.filter);
        const result = await presetsService.getAllPresets(database_1.dbInstance, filter);
        res.json((0, dataUrlFunctions_1.encodeResultPreset)(result));
    });
    app.post('/api/presets', functions_1.requireDB, async (req, res) => {
        const result = await presetsService.addPreset(database_1.dbInstance, (0, dataUrlFunctions_1.decodePreset)(req.body));
        res.json((0, dataUrlFunctions_1.encodeResultPreset)(result));
    });
    app.put('/api/presets', functions_1.requireDB, async (req, res) => {
        const result = await presetsService.updatePreset(database_1.dbInstance, (0, dataUrlFunctions_1.decodePreset)(req.body));
        res.json((0, dataUrlFunctions_1.encodeResultPreset)(result));
    });
    app.delete('/api/presets/:id', functions_1.requireDB, async (req, res) => {
        const result = await presetsService.deletePreset(database_1.dbInstance, Number(req.params.id));
        res.json(result);
    });
    app.post('/api/presets/batch', functions_1.requireDB, async (req, res) => {
        const result = await presetsService.batchAddPreset(database_1.dbInstance, req.body);
        res.json(result);
    });
};
exports.initPresetsController = initPresetsController;
