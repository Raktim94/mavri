import { createContext, useContext } from 'react';
import type { Row } from './api';

export const SettingsContext = createContext<Row>({});
export const useSettings = () => useContext(SettingsContext);
/** A feature is on unless settings say otherwise (or are not loaded yet). */
export const featureOn = (s: Row, key: string) => s[key] !== false && s[key] !== 0;
