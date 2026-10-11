import type { TFunction } from 'i18next';

const DEFAULT_MIME_TYPE = 'image/png';
const DATA_URL_PATTERN = /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+$/;

const copyToArrayBuffer = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert to DataURL'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const toDataUrl = (input: Blob | Uint8Array, mimeType: string = DEFAULT_MIME_TYPE): Promise<string> => {
  const resolvedMimeType = mimeType ?? DEFAULT_MIME_TYPE;

  const blob = input instanceof Blob ? input : new Blob([copyToArrayBuffer(input)], { type: resolvedMimeType });

  return readAsDataUrl(blob);
};

export const isDataUrl = (value: unknown): value is string => {
  return typeof value === 'string' && DATA_URL_PATTERN.test(value);
};

export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const toUint8Array = async (
  t: TFunction<'translation', undefined>,
  input: Blob | File | ArrayBuffer | Uint8Array | null
) => {
  if (!input) return null;

  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof Blob) {
    const arrayBuffer = await input.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  throw new Error(t('error.unsupportedImage'));
};
