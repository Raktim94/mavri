// Package scrypt implements the scrypt key derivation function (RFC 7914)
// using only the standard library.
//
// It exists because golang.org/x/crypto/scrypt could not be downloaded when
// this slice was written. Existing Mavri databases store passwords and API-key
// hashes produced by Node's crypto.scryptSync, so the output must match it
// bit for bit; scrypt_test.go checks that against Node-generated vectors.
// When module downloads work, prefer replacing this package with
// golang.org/x/crypto/scrypt (the vectors will validate the swap).
package scrypt

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"math/bits"
)

// MaxMemory mirrors Node's default scryptSync limit (32 MiB). Hashes that
// would need more are rejected, which also stops a crafted stored hash from
// forcing a huge allocation.
const MaxMemory = 32 << 20

// ErrParams reports invalid or too-expensive parameters.
var ErrParams = errors.New("scrypt: invalid parameters")

// Key derives keyLen bytes from password and salt. N must be a power of two
// greater than 1.
func Key(password, salt []byte, N, r, p, keyLen int) ([]byte, error) {
	if N <= 1 || N&(N-1) != 0 || r <= 0 || p <= 0 || keyLen <= 0 {
		return nil, ErrParams
	}
	if uint64(r)*uint64(p) >= 1<<30 || uint64(keyLen) > (1<<32-1)*32 {
		return nil, ErrParams
	}
	// Node's limit is on 128*N*r (+ working buffers); compare using 128*N*r + 128*r*p.
	need := 128*uint64(N)*uint64(r) + 128*uint64(r)*uint64(p)
	if need > MaxMemory {
		return nil, ErrParams
	}

	b, err := pbkdf2.Key(sha256.New, string(password), salt, 1, p*128*r)
	if err != nil {
		return nil, err
	}
	words := 32 * r
	xy := make([]uint32, 64*r)
	v := make([]uint32, 32*N*r)
	for i := 0; i < p; i++ {
		roMix(b[i*128*r:(i+1)*128*r], N, r, words, v, xy)
	}
	return pbkdf2.Key(sha256.New, string(password), b, 1, keyLen)
}

// roMix is the scryptROMix function, operating in place on one 128*r block.
func roMix(block []byte, N, r, words int, v, xy []uint32) {
	x := xy[:words]
	y := xy[words : 2*words]
	for i := 0; i < words; i++ {
		x[i] = binary.LittleEndian.Uint32(block[i*4:])
	}
	for i := 0; i < N; i++ {
		copy(v[i*words:(i+1)*words], x)
		blockMix(x, y, r)
	}
	for i := 0; i < N; i++ {
		// Integerify: low 64 bits of the last 64-byte block, little endian.
		j := int((uint64(x[(2*r-1)*16]) | uint64(x[(2*r-1)*16+1])<<32) & uint64(N-1))
		vj := v[j*words : (j+1)*words]
		for k := 0; k < words; k++ {
			x[k] ^= vj[k]
		}
		blockMix(x, y, r)
	}
	for i := 0; i < words; i++ {
		binary.LittleEndian.PutUint32(block[i*4:], x[i])
	}
}

// blockMix is scryptBlockMix: x is both input and output, y is scratch.
func blockMix(x, y []uint32, r int) {
	var t [16]uint32
	copy(t[:], x[(2*r-1)*16:2*r*16])
	for i := 0; i < 2*r; i++ {
		for k := 0; k < 16; k++ {
			t[k] ^= x[i*16+k]
		}
		salsa20_8(&t)
		// Even blocks go to the first half of the output, odd to the second.
		dst := (i/2 + (i%2)*r) * 16
		copy(y[dst:dst+16], t[:])
	}
	copy(x, y[:32*r])
}

func salsa20_8(b *[16]uint32) {
	x := *b
	for i := 0; i < 8; i += 2 {
		x[4] ^= bits.RotateLeft32(x[0]+x[12], 7)
		x[8] ^= bits.RotateLeft32(x[4]+x[0], 9)
		x[12] ^= bits.RotateLeft32(x[8]+x[4], 13)
		x[0] ^= bits.RotateLeft32(x[12]+x[8], 18)
		x[9] ^= bits.RotateLeft32(x[5]+x[1], 7)
		x[13] ^= bits.RotateLeft32(x[9]+x[5], 9)
		x[1] ^= bits.RotateLeft32(x[13]+x[9], 13)
		x[5] ^= bits.RotateLeft32(x[1]+x[13], 18)
		x[14] ^= bits.RotateLeft32(x[10]+x[6], 7)
		x[2] ^= bits.RotateLeft32(x[14]+x[10], 9)
		x[6] ^= bits.RotateLeft32(x[2]+x[14], 13)
		x[10] ^= bits.RotateLeft32(x[6]+x[2], 18)
		x[3] ^= bits.RotateLeft32(x[15]+x[11], 7)
		x[7] ^= bits.RotateLeft32(x[3]+x[15], 9)
		x[11] ^= bits.RotateLeft32(x[7]+x[3], 13)
		x[15] ^= bits.RotateLeft32(x[11]+x[7], 18)

		x[1] ^= bits.RotateLeft32(x[0]+x[3], 7)
		x[2] ^= bits.RotateLeft32(x[1]+x[0], 9)
		x[3] ^= bits.RotateLeft32(x[2]+x[1], 13)
		x[0] ^= bits.RotateLeft32(x[3]+x[2], 18)
		x[6] ^= bits.RotateLeft32(x[5]+x[4], 7)
		x[7] ^= bits.RotateLeft32(x[6]+x[5], 9)
		x[4] ^= bits.RotateLeft32(x[7]+x[6], 13)
		x[5] ^= bits.RotateLeft32(x[4]+x[7], 18)
		x[11] ^= bits.RotateLeft32(x[10]+x[9], 7)
		x[8] ^= bits.RotateLeft32(x[11]+x[10], 9)
		x[9] ^= bits.RotateLeft32(x[8]+x[11], 13)
		x[10] ^= bits.RotateLeft32(x[9]+x[8], 18)
		x[12] ^= bits.RotateLeft32(x[15]+x[14], 7)
		x[13] ^= bits.RotateLeft32(x[12]+x[15], 9)
		x[14] ^= bits.RotateLeft32(x[13]+x[12], 13)
		x[15] ^= bits.RotateLeft32(x[14]+x[13], 18)
	}
	for i := range b {
		b[i] += x[i]
	}
}
