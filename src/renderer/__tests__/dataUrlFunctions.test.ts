import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { base64ToBytes, isDataUrl, toDataUrl, toUint8Array } from '../shared/utils/dataUrlFunctions';

const fakeT = ((key: string) => `T:${key}`) as unknown as TFunction;

describe('isDataUrl', () => {
  it('accepts only well-formed base64 data urls', () => {
    expect(isDataUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isDataUrl('data:text/plain;base64,')).toBe(false);
    expect(isDataUrl('data:image/png;base64,***')).toBe(false);
    expect(isDataUrl('http://x')).toBe(false);
    expect(isDataUrl(5)).toBe(false);
    expect(isDataUrl(null)).toBe(false);
  });
});

describe('base64ToBytes', () => {
  it('decodes base64 into raw bytes', () => {
    expect(Array.from(base64ToBytes('AQIDBA=='))).toEqual([1, 2, 3, 4]);
  });

  it('returns an empty array for an empty payload', () => {
    expect(Array.from(base64ToBytes(''))).toEqual([]);
  });
});

describe('toDataUrl', () => {
  it('encodes bytes with the default png mime type', async () => {
    await expect(toDataUrl(new Uint8Array([1, 2, 3]))).resolves.toBe('data:image/png;base64,AQID');
  });

  it('honours the mime type argument for raw bytes', async () => {
    await expect(toDataUrl(new Uint8Array([7, 8]), 'image/webp')).resolves.toBe('data:image/webp;base64,Bwg=');
  });

  it('keeps the blob mime type when given a blob', async () => {
    const blob = new Blob([new Uint8Array([7, 8])], { type: 'image/jpeg' });

    await expect(toDataUrl(blob, 'image/webp')).resolves.toBe('data:image/jpeg;base64,Bwg=');
  });
});

describe('toUint8Array', () => {
  it('returns null for empty input', async () => {
    await expect(toUint8Array(fakeT, null)).resolves.toBeNull();
  });

  it('passes typed arrays through', async () => {
    await expect(toUint8Array(fakeT, new Uint8Array([4, 5]))).resolves.toEqual(new Uint8Array([4, 5]));
  });

  it('wraps array buffers', async () => {
    await expect(toUint8Array(fakeT, new Uint8Array([6]).buffer)).resolves.toEqual(new Uint8Array([6]));
  });

  it('reads blobs', async () => {
    await expect(toUint8Array(fakeT, new Blob([new Uint8Array([9])]))).resolves.toEqual(new Uint8Array([9]));
  });

  it('rejects unsupported inputs with the translated message', async () => {
    await expect(toUint8Array(fakeT, 'bad' as never)).rejects.toThrow('T:error.unsupportedImage');
  });
});
