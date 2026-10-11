// Package secrets encrypts values that must be read back later (webhook
// signing secrets) with AES-256-GCM. The key lives next to the database file,
// never inside it, or comes from ENCRYPTION_KEY. The stored format is
// base64(iv).base64(tag).base64(ciphertext), the one the TypeScript server wrote.
package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	keyBytes = 32
	ivBytes  = 12
	tagBytes = 16
)

// Box holds where the key comes from.
type Box struct {
	Dir    string // directory of the database; the key file is Dir/.encryption_key
	EnvKey string // ENCRYPTION_KEY, if set

	mu  sync.Mutex
	key []byte
}

func (b *Box) loadKey() ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.key != nil {
		return b.key, nil
	}
	if len(b.EnvKey) >= 32 {
		head := b.EnvKey
		if len(head) > 64 {
			head = head[:64]
		}
		if raw, err := hex.DecodeString(head); err == nil && len(raw) == keyBytes {
			b.key = raw
		} else {
			b.key = []byte(b.EnvKey)[:keyBytes]
		}
		return b.key, nil
	}
	path := filepath.Join(b.Dir, ".encryption_key")
	if data, err := os.ReadFile(path); err == nil {
		if text := strings.TrimSpace(string(data)); len(text) == keyBytes*2 {
			if raw, err := hex.DecodeString(text); err == nil {
				b.key = raw
				return b.key, nil
			}
		}
	}
	key := make([]byte, keyBytes)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(b.Dir, 0o700); err == nil {
		// Best effort, like the original: without it the secrets would not
		// survive a restart, but the server keeps working.
		_ = os.WriteFile(path, []byte(hex.EncodeToString(key)), 0o600)
	}
	b.key = key
	return key, nil
}

func (b *Box) aead() (cipher.AEAD, error) {
	key, err := b.loadKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// Encrypt seals plaintext with a fresh random IV.
func (b *Box) Encrypt(plaintext string) (string, error) {
	gcm, err := b.aead()
	if err != nil {
		return "", err
	}
	iv := make([]byte, ivBytes)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nil, iv, []byte(plaintext), nil) // ciphertext || tag
	ct, tag := sealed[:len(sealed)-tagBytes], sealed[len(sealed)-tagBytes:]
	enc := base64.StdEncoding.EncodeToString
	return enc(iv) + "." + enc(tag) + "." + enc(ct), nil
}

// ErrUnreadable covers a wrong key, a damaged value and tampering alike.
var ErrUnreadable = errors.New("secrets: cannot decrypt")

// Decrypt reverses Encrypt.
func (b *Box) Decrypt(encoded string) (string, error) {
	parts := strings.Split(encoded, ".")
	if len(parts) < 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return "", ErrUnreadable
	}
	dec := base64.StdEncoding.DecodeString
	iv, err1 := dec(parts[0])
	tag, err2 := dec(parts[1])
	ct, err3 := dec(parts[2])
	if err1 != nil || err2 != nil || err3 != nil || len(iv) != ivBytes {
		return "", ErrUnreadable
	}
	gcm, err := b.aead()
	if err != nil {
		return "", ErrUnreadable
	}
	plain, err := gcm.Open(nil, iv, append(ct, tag...), nil)
	if err != nil {
		return "", ErrUnreadable
	}
	return string(plain), nil
}
