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
exports.initLayoutsController = void 0;
const service = __importStar(require("../../shared/services/layouts"));
const database_1 = require("../database");
const functions_1 = require("../utils/functions");
const initLayoutsController = (app) => {
    app.get('/api/layouts', functions_1.requireDB, async (req, res) => res.json(await service.getAllLayouts(database_1.dbInstance, (0, functions_1.parseFilter)(req.query.filter))));
    app.post('/api/layouts', functions_1.requireDB, async (req, res) => res.json(await service.addLayout(database_1.dbInstance, req.body)));
    app.put('/api/layouts', functions_1.requireDB, async (req, res) => res.json(await service.updateLayout(database_1.dbInstance, req.body)));
    app.delete('/api/layouts/:id', functions_1.requireDB, async (req, res) => res.json(await service.deleteLayout(database_1.dbInstance, Number(req.params.id))));
    app.get('/api/layouts/export/:id', functions_1.requireDB, async (req, res) => {
        const result = await service.exportLayout(database_1.dbInstance, Number(req.params.id));
        res.json(result);
    });
};
exports.initLayoutsController = initLayoutsController;
