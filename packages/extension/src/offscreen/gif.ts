// Small animated-GIF encoder: fixed 6x7x6 colour cube with ordered dithering and LZW compression.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.5));

export function palette(): Uint8Array {
  const p = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) {
    p[i++] = Math.round((r * 255) / 5);
    p[i++] = Math.round((g * 255) / 6);
    p[i++] = Math.round((b * 255) / 5);
  }
  return p;
}

export function quantize(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = BAYER[(y & 3) * 4 + (x & 3)]!;
      const r = Math.min(5, Math.max(0, Math.round((rgba[i * 4]! / 255) * 5 + d)));
      const g = Math.min(6, Math.max(0, Math.round((rgba[i * 4 + 1]! / 255) * 6 + d)));
      const b = Math.min(5, Math.max(0, Math.round((rgba[i * 4 + 2]! / 255) * 5 + d)));
      out[i] = r * 42 + g * 6 + b;
    }
  }
  return out;
}

class ByteWriter {
  chunks: Uint8Array[] = [];
  buf = new Uint8Array(1 << 16);
  len = 0;
  byte(b: number) {
    if (this.len === this.buf.length) this.flush();
    this.buf[this.len++] = b;
  }
  bytes(a: ArrayLike<number>) {
    for (let i = 0; i < a.length; i++) this.byte(a[i]!);
  }
  u16(v: number) {
    this.byte(v & 0xff);
    this.byte((v >> 8) & 0xff);
  }
  flush() {
    this.chunks.push(this.buf.slice(0, this.len));
    this.len = 0;
  }
  blob() {
    this.flush();
    return new Blob(this.chunks as BlobPart[], { type: "image/gif" });
  }
}

function lzw(indices: Uint8Array, out: ByteWriter) {
  const minCode = 8;
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let next = eoi + 1;
  let dict = new Map<number, number>();
  const block: number[] = [];
  let cur = 0;
  let bits = 0;
  const emit = (code: number) => {
    cur |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      block.push(cur & 0xff);
      cur >>>= 8;
      bits -= 8;
      if (block.length === 255) {
        out.byte(255);
        out.bytes(block);
        block.length = 0;
      }
    }
  };
  out.byte(minCode);
  emit(clear);
  let prefix = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      codeSize = minCode + 1;
      next = eoi + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) block.push(cur & 0xff);
  if (block.length) {
    out.byte(block.length);
    out.bytes(block);
  }
  out.byte(0);
}

export function encodeGif(frames: { indices: Uint8Array; delayMs: number }[], w: number, h: number): Blob {
  const out = new ByteWriter();
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  out.u16(w);
  out.u16(h);
  out.byte(0xf7); // global colour table, 256 entries
  out.byte(0);
  out.byte(0);
  out.bytes(palette());
  out.bytes([0x21, 0xff, 0x0b, ...Array.from("NETSCAPE2.0", (c) => c.charCodeAt(0)), 0x03, 0x01, 0x00, 0x00, 0x00]); // loop forever
  for (const f of frames) {
    out.bytes([0x21, 0xf9, 0x04, 0x00]);
    out.u16(Math.max(2, Math.round(f.delayMs / 10)));
    out.bytes([0x00, 0x00]);
    out.byte(0x2c);
    out.u16(0);
    out.u16(0);
    out.u16(w);
    out.u16(h);
    out.byte(0);
    lzw(f.indices, out);
  }
  out.byte(0x3b);
  return out.blob();
}
