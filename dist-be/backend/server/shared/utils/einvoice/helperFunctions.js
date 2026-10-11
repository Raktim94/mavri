"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatXml = exports.formatDate = exports.xmlEscape = exports.splitAddress = void 0;
const date_fns_1 = require("date-fns");
const splitAddress = (addr) => {
    if (!addr)
        return {};
    const parts = addr.split(',').map(p => p.trim());
    const country = parts.pop();
    let postal = null;
    const postalRegex = /\b[A-Z]{0,2}-?\d{4,6}\b/;
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        const match = last?.match(postalRegex);
        if (match && match[0]) {
            postal = match[0];
            parts.pop();
        }
    }
    let street = null;
    for (let i = 0; i < parts.length; i++) {
        if (/\d/.test(parts[i])) {
            street = parts.splice(i, 1)[0];
            break;
        }
    }
    let countryCode = null;
    if (country && /^[A-Z]{2,3}$/.test(country)) {
        countryCode = country.length === 3 ? country.slice(0, 2) : undefined;
    }
    return {
        street: street ?? undefined,
        city: parts[0] ?? undefined,
        region: parts.slice(1).join(', ') ?? undefined,
        postalZone: postal ?? undefined,
        country: country ?? undefined,
        countryCode: countryCode ?? undefined
    };
};
exports.splitAddress = splitAddress;
const xmlEscape = (v) => {
    if (v === undefined || v === null)
        return '';
    const s = String(v);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\"/g, '&quot;')
        .replace(/'/g, '&apos;');
};
exports.xmlEscape = xmlEscape;
const formatDate = (date, pattern) => {
    if (!date)
        return '';
    const d = typeof date === 'string' ? (0, date_fns_1.parseISO)(date) : date;
    if (isNaN(d.getTime()))
        return '';
    return (0, date_fns_1.format)(d, pattern);
};
exports.formatDate = formatDate;
// Lightweight XML formatter to produce consistent indentation
const formatXml = (xml) => {
    xml = xml.trim();
    xml = xml.replace(/>\s*</g, '>\n<');
    const lines = xml.split('\n');
    let indent = 0;
    const formatted = lines
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
        const closingTag = /^<\/[^>]+>/;
        const openingTag = /^<[^\\/?][^>]*>$/;
        const selfClosing = /<[^>]+\/>$/;
        const declaration = /^<\?/;
        if (closingTag.test(line)) {
            indent = Math.max(indent - 1, 0);
        }
        const pad = '  '.repeat(indent);
        const out = pad + line;
        if (openingTag.test(line) && !selfClosing.test(line) && !declaration.test(line)) {
            indent++;
        }
        return out;
    })
        .join('\n');
    return formatted;
};
exports.formatXml = formatXml;
