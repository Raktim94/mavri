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
exports.initUnitsController = void 0;
const unitsService = __importStar(require("../../shared/services/units"));
const database_1 = require("../database");
const functions_1 = require("../utils/functions");
const initUnitsController = (app) => {
    app.get('/api/units', functions_1.requireDB, async (req, res) => {
        const filter = (0, functions_1.parseFilter)(req.query.filter);
        const result = await unitsService.getAllUnits(database_1.dbInstance, filter);
        res.json(result);
    });
    app.post('/api/units', functions_1.requireDB, async (req, res) => {
        const result = await unitsService.addUnit(database_1.dbInstance, req.body);
        res.json(result);
    });
    app.put('/api/units', functions_1.requireDB, async (req, res) => {
        const result = await unitsService.updateUnit(database_1.dbInstance, req.body);
        res.json(result);
    });
    app.delete('/api/units/:id', functions_1.requireDB, async (req, res) => {
        const result = await unitsService.deleteUnit(database_1.dbInstance, Number(req.params.id));
        res.json(result);
    });
    app.post('/api/units/batch', functions_1.requireDB, async (req, res) => {
        const result = await unitsService.batchAddUnit(database_1.dbInstance, req.body);
        res.json(result);
    });
};
exports.initUnitsController = initUnitsController;
