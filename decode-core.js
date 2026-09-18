/* Códigos — núcleo de decodificación ZXing sobre ImageData (compartido por página y Web Worker) */
(function (root) {
  let reader = null;
  function getReader() {
    if (!reader) { reader = new ZXing.MultiFormatReader(); const h = new Map(); h.set(ZXing.DecodeHintType.TRY_HARDER, true); reader.setHints(h); }
    return reader;
  }
  // RGBA -> luminancia (Uint8ClampedArray)
  function toLum(rgba, w, h) {
    const n = w * h, lum = new Uint8ClampedArray(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) lum[i] = (rgba[j] * 77 + rgba[j + 1] * 151 + rgba[j + 2] * 28) >> 8;
    return lum;
  }
  function rotate90(lum, w, h) { // sentido horario
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = lum[y * w + x];
    return out;
  }
  function tryDecode(lum, w, h, invert) {
    let src = new ZXing.RGBLuminanceSource(lum, w, h);
    if (invert) src = new ZXing.InvertedLuminanceSource(src);
    const r = getReader();
    try { const res = r.decodeWithState(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src))); return {format: ZXing.BarcodeFormat[res.getBarcodeFormat()], text: res.getText()}; }
    catch (e) { return null; } finally { r.reset(); }
  }
  // opts: {invert:true, rotate:true} — intenta normal, invertido y rotado 90°
  function decodeImageData(rgba, w, h, opts) {
    opts = opts || {};
    const lum = toLum(rgba, w, h);
    let r = tryDecode(lum, w, h, false); if (r) return r;
    if (opts.invert !== false) { r = tryDecode(lum, w, h, true); if (r) return r; }
    if (opts.rotate !== false) { const rl = rotate90(lum, w, h); r = tryDecode(rl, h, w, false); if (r) return r; }
    return null;
  }
  root.ZXCore = {decodeImageData, toLum};
  // Modo worker
  if (typeof importScripts === 'function' && typeof postMessage === 'function') {
    self.onmessage = e => {
      const {id, buf, w, h, opts} = e.data;
      let res = null; try { res = decodeImageData(new Uint8ClampedArray(buf), w, h, opts); } catch (err) {}
      postMessage({id, res});
    };
  }
})(typeof self !== 'undefined' ? self : this);
