/**
 * script.js — Benchmark Controller: JavaScript vs WebAssembly
 * ════════════════════════════════════════════════════════════
 *
 * Alur kerja:
 *  1. Saat halaman dimuat, coba muat modul WebAssembly dari factorial.wasm
 *     melalui glue code factorial.js (output dari emcc).
 *  2. Setiap klik tombol menjalankan benchmark di sisi JS atau WASM,
 *     mengukur waktu dengan performance.now() (presisi sub-milidetik).
 *  3. Hasil ditampilkan di UI dan dilog ke area console.
 *
 * CATATAN PENGUKURAN:
 *  - performance.now() memberikan timestamp float64 dalam milidetik
 *    dengan presisi hingga mikro-detik (tergantung browser/OS).
 *  - console.time() hanya akurat hingga milidetik — kurang cocok
 *    untuk benchmark singkat, maka kita pakai performance.now().
 */

'use strict';

/* ══════════════════════════════════════════════
   BAGIAN 1 — IMPLEMENTASI JAVASCRIPT MURNI
   Fungsi benchmark yang ditulis ulang di JS untuk
   perbandingan langsung dengan versi WebAssembly.
   ══════════════════════════════════════════════ */

/**
 * Hitung faktorial secara iteratif (JS).
 * @param {number} n
 * @returns {number}
 */
function js_factorial(n) {
  let result = 1.0;
  for (let i = 1; i <= n; i++) result *= i;
  return result;
}

/**
 * Hitung fibonacci ke-n secara iteratif, diulang sebanyak `iterations`.
 * Pendekatan iteratif dipilih agar bisa dikomparasi fair dengan versi C.
 * @param {number} n
 * @param {number} iterations
 * @returns {BigInt}
 */
function js_fibonacci(n, iterations) {
  let result = 0n;
  for (let iter = 0; iter < iterations; iter++) {
    let a = 0n, b = 1n;
    for (let i = 2; i <= n; i++) {
      const c = a + b;
      a = b;
      b = c;
    }
    result = b;
  }
  return result;
}

/**
 * Loop matematika berat: sqrt + sin + cos dalam jutaan iterasi.
 * Ini benchmark paling representatif karena melibatkan floating-point
 * intensif — area di mana WASM biasanya unggul signifikan.
 * @param {number} iterations
 * @returns {number}
 */
function js_math_loop(iterations) {
  let result = 0.0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i) + Math.cos(i);
  }
  return result;
}

/* ══════════════════════════════════════════════
   BAGIAN 2 — KONFIGURASI BENCHMARK
   ══════════════════════════════════════════════ */

/**
 * BENCHMARK_CONFIGS mendefinisikan tiga jenis benchmark beserta
 * parameter yang disesuaikan agar eksekusi tidak terlalu lama
 * maupun terlalu singkat (target: 200ms–2000ms per run).
 */
const BENCHMARK_CONFIGS = {
  factorial: {
    label:       'Factorial (iteratif)',
    description: 'Hitung faktorial dari N secara berulang',
    jsRunner: (cfg) => {
      // Ulangi N kali agar durasi terukur dengan baik
      for (let i = 0; i < cfg.reps; i++) js_factorial(cfg.n);
      return js_factorial(cfg.n);
    },
    wasmRunner: (mod, cfg) => {
      const fn = mod.cwrap('bench_factorial', 'number', ['number']);
      let r;
      for (let i = 0; i < cfg.reps; i++) r = fn(cfg.n);
      return r;
    },
    params: {
      low:    { n: 100,  reps: 200000, label: '100! × 200k' },
      medium: { n: 1000, reps: 100000, label: '1000! × 100k' },
      high:   { n: 5000, reps: 50000,  label: '5000! × 50k'  },
    },
  },
  fibonacci: {
    label:       'Fibonacci (iteratif)',
    description: 'Hitung Fib(N) berulang sebagai beban CPU',
    jsRunner: (cfg) => {
      return js_fibonacci(cfg.n, cfg.iterations);
    },
    wasmRunner: (mod, cfg) => {
      const fn = mod.cwrap('bench_fibonacci', 'number', ['number', 'number']);
      return fn(cfg.n, cfg.iterations);
    },
    params: {
      low:    { n: 30,  iterations: 500000,  label: 'Fib(30) × 500k' },
      medium: { n: 40,  iterations: 200000,  label: 'Fib(40) × 200k' },
      high:   { n: 60,  iterations: 100000,  label: 'Fib(60) × 100k' },
    },
  },
  math_loop: {
    label:       'Heavy Math Loop',
    description: 'sqrt + sin + cos dalam loop besar (floating-point intensif)',
    jsRunner: (cfg) => {
      return js_math_loop(cfg.iterations);
    },
    wasmRunner: (mod, cfg) => {
      const fn = mod.cwrap('bench_math_loop', 'number', ['number']);
      return fn(cfg.iterations);
    },
    params: {
      low:    { iterations: 1000000,  label: '1 juta iterasi'  },
      medium: { iterations: 5000000,  label: '5 juta iterasi'  },
      high:   { iterations: 15000000, label: '15 juta iterasi' },
    },
  },
};

/* ══════════════════════════════════════════════
   BAGIAN 3 — STATE APLIKASI
   ══════════════════════════════════════════════ */

const state = {
  wasmModule:  null,   // modul WebAssembly yang sudah dimuat
  wasmLoading: false,  // apakah sedang memuat WASM
  wasmReady:   false,  // apakah WASM sudah siap dipakai
  jsTime:      null,   // hasil waktu JS (ms)
  wasmTime:    null,   // hasil waktu WASM (ms)
  running:     false,  // apakah benchmark sedang berjalan
};

/* ══════════════════════════════════════════════
   BAGIAN 4 — REFERENSI DOM ELEMENT
   ══════════════════════════════════════════════ */

const $  = (id) => document.getElementById(id);

const DOM = {
  benchmarkSelect: $('benchmark-select'),
  intensitySelect: $('intensity-select'),
  btnJs:           $('btn-run-js'),
  btnWasm:         $('btn-run-wasm'),
  btnAll:          $('btn-run-all'),
  btnReset:        $('btn-reset'),
  // JS result panel
  jsTime:          $('js-time'),
  jsMeta:          $('js-meta'),
  jsProgress:      $('js-progress'),
  jsCard:          $('js-card'),
  // WASM result panel
  wasmTime:        $('wasm-time'),
  wasmMeta:        $('wasm-meta'),
  wasmProgress:    $('wasm-progress'),
  wasmCard:        $('wasm-card'),
  // Comparison panel
  compCard:        $('comparison-card'),
  compBody:        $('comparison-body'),
  // Log panel
  logArea:         $('log-area'),
  wasmStatus:      $('wasm-status'),
};

/* ══════════════════════════════════════════════
   BAGIAN 5 — LOGGER
   ══════════════════════════════════════════════ */

/**
 * Tulis pesan ke area log di UI sekaligus ke browser console.
 * @param {string} msg  - pesan teks
 * @param {'ok'|'info'|'warn'|'error'|''} type - warna log
 */
function log(msg, type = '') {
  const now   = new Date();
  const ts    = `${String(now.getHours()).padStart(2,'0')}:` +
                `${String(now.getMinutes()).padStart(2,'0')}:` +
                `${String(now.getSeconds()).padStart(2,'0')}`;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-ts">[${ts}]</span>` +
                    `<span class="log-msg ${type}">${msg}</span>`;
  DOM.logArea.appendChild(entry);
  DOM.logArea.scrollTop = DOM.logArea.scrollHeight;

  // Mirror ke browser DevTools console
  const consoleFn = type === 'error' ? console.error
                  : type === 'warn'  ? console.warn
                  : console.log;
  consoleFn(`[Benchmark] ${msg}`);
}

/* ══════════════════════════════════════════════
   BAGIAN 6 — MUAT MODUL WEBASSEMBLY
   ══════════════════════════════════════════════ */

/**
 * Muat modul WebAssembly dari file factorial.wasm melalui glue JS.
 *
 * Jika file factorial.js (hasil emcc) tidak tersedia, kita fallback
 * ke mode demo menggunakan fetch + WebAssembly.instantiate langsung.
 *
 * Dalam proyek nyata: emcc menghasilkan factorial.js yang berisi
 * helper `createModule()` untuk memuat factorial.wasm secara async.
 */
async function loadWasm() {
  if (state.wasmLoading || state.wasmReady) return;
  state.wasmLoading = true;

  DOM.wasmStatus.textContent = 'Memuat...';
  log('Mencoba memuat modul WebAssembly...', 'info');

  // ── Coba muat via Emscripten glue script (factorial.js) ──────────
  try {
    // Cek apakah factorial.js tersedia (hasil emcc)
    const scriptEl = document.createElement('script');
    scriptEl.src   = 'factorial.js';

    await new Promise((resolve, reject) => {
      scriptEl.onload  = resolve;
      scriptEl.onerror = reject;
      document.head.appendChild(scriptEl);
    });

    // Inisialisasi module via createModule() yang diekspos emcc
    const mod = await createModule(); // eslint-disable-line no-undef
    state.wasmModule = mod;
    state.wasmReady  = true;
    state.wasmLoading = false;

    DOM.wasmStatus.textContent = '✓ Ready';
    DOM.wasmStatus.style.color = 'var(--accent-win)';
    DOM.btnWasm.disabled       = false;
    DOM.btnAll.disabled        = false;
    log('WebAssembly modul berhasil dimuat dari factorial.js', 'ok');
    return;

  } catch (_) {
    // factorial.js tidak tersedia — gunakan mode demo
    log('factorial.js tidak ditemukan. Menggunakan demo mode (simulasi WASM).', 'warn');
    log('→ Compile factorial.c dengan emcc untuk hasil nyata.', 'warn');
  }

  // ── DEMO MODE: Simulasi WASM dengan overhead yang disimulasikan ───
  // Dalam demo mode, kita membuat "modul" palsu yang menjalankan
  // fungsi C yang di-port ke JS, namun dengan karakteristik berbeda.
  //
  // PENTING: Ini BUKAN WASM nyata. Untuk mendapatkan hasil perbandingan
  // yang akurat, kompilasi factorial.c menggunakan emcc seperti dijelaskan
  // di komentar factorial.c.
  state.wasmModule = createDemoWasmModule();
  state.wasmReady  = true;
  state.wasmLoading = false;

  DOM.wasmStatus.textContent = '⚠ Demo';
  DOM.wasmStatus.style.color = 'var(--accent-js)';
  DOM.btnWasm.disabled = false;
  DOM.btnAll.disabled  = false;
  log('Demo mode aktif — bukan WASM asli', 'warn');
}

/**
 * Buat modul WebAssembly simulasi untuk keperluan demo.
 * Modul ini meniru antarmuka yang sama dengan output emcc
 * (metode cwrap), sehingga kode benchmark tidak perlu diubah.
 */
function createDemoWasmModule() {
  // Implementasi demo menggunakan typed array dan operasi integer
  // yang lebih dekat ke perilaku native untuk mensimulasikan
  // karakteristik WASM (tidak ada BigInt overhead seperti JS fibonacci).
  const impls = {
    bench_factorial: (n) => {
      let r = 1.0;
      for (let i = 1; i <= n; i++) r *= i;
      return r;
    },
    bench_fibonacci: (n, iterations) => {
      let result = 0;
      // Gunakan typed array Int32Array untuk mensimulasikan operasi WASM
      // yang bekerja pada memori linear (lebih cepat untuk integer)
      const buf = new Int32Array(2);
      for (let iter = 0; iter < iterations; iter++) {
        buf[0] = 0; buf[1] = 1;
        for (let i = 2; i <= n; i++) {
          const c = buf[0] + buf[1];
          buf[0] = buf[1];
          buf[1] = c;
        }
        result = buf[1];
      }
      return result;
    },
    bench_math_loop: (iterations) => {
      // Gunakan Float64Array seperti memori linear WASM
      const buf = new Float64Array(1);
      for (let i = 0; i < iterations; i++) {
        buf[0] += Math.sqrt(i) * Math.sin(i) + Math.cos(i);
      }
      return buf[0];
    },
  };

  // Implementasi cwrap() — sama persis dengan API Emscripten
  return {
    cwrap: (funcName, _returnType, _argTypes) => {
      if (!impls[funcName]) throw new Error(`Demo: fungsi ${funcName} tidak ditemukan`);
      return impls[funcName];
    },
  };
}

/* ══════════════════════════════════════════════
   BAGIAN 7 — RUNNER BENCHMARK
   ══════════════════════════════════════════════ */

/**
 * Format angka milidetik menjadi string yang mudah dibaca.
 * @param {number} ms
 * @returns {{ value: string, unit: string }}
 */
function formatTime(ms) {
  if (ms < 1)      return { value: (ms * 1000).toFixed(2), unit: 'µs' };
  if (ms < 1000)   return { value: ms.toFixed(2),          unit: 'ms' };
  return               { value: (ms / 1000).toFixed(3),    unit: 's'  };
}

/**
 * Jalankan benchmark JavaScript dan update UI.
 */
async function runJsBenchmark() {
  const benchKey   = DOM.benchmarkSelect.value;
  const intensity  = DOM.intensitySelect.value;
  const bench      = BENCHMARK_CONFIGS[benchKey];
  const params     = bench.params[intensity];

  setLoading('js', true);
  log(`[JS] Menjalankan ${bench.label} — ${params.label}`, 'info');

  // Yield ke event loop agar UI sempat update sebelum benchmark berjalan
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 16)));

  const t0     = performance.now();
  const result = bench.jsRunner(params);
  const t1     = performance.now();
  const elapsed = t1 - t0;

  state.jsTime = elapsed;
  const fmt    = formatTime(elapsed);

  setLoading('js', false);
  updateCard('js', fmt, params.label, elapsed);
  log(`[JS] Selesai: ${fmt.value}${fmt.unit} | hasil: ${typeof result === 'bigint' ? result.toString().slice(0,12) + '...' : result.toFixed ? result.toFixed(4) : result}`, 'ok');

  updateComparison();
}

/**
 * Jalankan benchmark WebAssembly dan update UI.
 */
async function runWasmBenchmark() {
  if (!state.wasmReady) {
    log('WASM belum siap. Tunggu sebentar...', 'warn');
    return;
  }

  const benchKey  = DOM.benchmarkSelect.value;
  const intensity = DOM.intensitySelect.value;
  const bench     = BENCHMARK_CONFIGS[benchKey];
  const params    = bench.params[intensity];

  setLoading('wasm', true);
  log(`[WASM] Menjalankan ${bench.label} — ${params.label}`, 'info');

  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 16)));

  const t0      = performance.now();
  const result  = bench.wasmRunner(state.wasmModule, params);
  const t1      = performance.now();
  const elapsed = t1 - t0;

  state.wasmTime = elapsed;
  const fmt      = formatTime(elapsed);

  setLoading('wasm', false);
  updateCard('wasm', fmt, params.label, elapsed);
  log(`[WASM] Selesai: ${fmt.value}${fmt.unit} | hasil: ${typeof result === 'number' ? result.toFixed(4) : result}`, 'ok');

  updateComparison();
}

/**
 * Jalankan JS kemudian WASM secara berurutan.
 */
async function runAllBenchmarks() {
  log('── Menjalankan semua benchmark ──', '');
  await runJsBenchmark();
  await runWasmBenchmark();
  log('── Selesai ──', 'ok');
}

/* ══════════════════════════════════════════════
   BAGIAN 8 — UPDATE UI
   ══════════════════════════════════════════════ */

/**
 * Tampilkan/sembunyikan state loading pada kartu hasil.
 * @param {'js'|'wasm'} which
 * @param {boolean} loading
 */
function setLoading(which, loading) {
  const timeEl = which === 'js' ? DOM.jsTime : DOM.wasmTime;
  if (loading) {
    timeEl.innerHTML = '<span class="spinner"></span> Running…';
    timeEl.classList.add('loading');
  } else {
    timeEl.classList.remove('loading');
  }
  setButtonsDisabled(loading);
}

/**
 * Update konten kartu hasil benchmark.
 * @param {'js'|'wasm'} which
 * @param {{ value: string, unit: string }} fmt
 * @param {string} paramLabel
 * @param {number} elapsedMs
 */
function updateCard(which, fmt, paramLabel, elapsedMs) {
  const timeEl = which === 'js' ? DOM.jsTime : DOM.wasmTime;
  const metaEl = which === 'js' ? DOM.jsMeta : DOM.wasmMeta;

  timeEl.innerHTML = `${fmt.value}<span class="unit">${fmt.unit}</span>`;
  metaEl.textContent = `${paramLabel} | ${elapsedMs.toFixed(3)} ms`;
}

/**
 * Hitung dan tampilkan perbandingan kecepatan JS vs WASM.
 */
function updateComparison() {
  if (state.jsTime === null || state.wasmTime === null) return;

  const jsMs   = state.jsTime;
  const wasmMs = state.wasmTime;

  DOM.compCard.classList.add('ready');
  DOM.compBody.classList.add('has-data');

  // Tentukan siapa yang lebih cepat dan berapa kali lipatnya
  const faster  = wasmMs < jsMs ? 'wasm' : 'js';
  const ratio   = faster === 'wasm'
    ? (jsMs / wasmMs).toFixed(2)
    : (wasmMs / jsMs).toFixed(2);
  const speedClass = faster === 'wasm' ? 'faster-wasm' : 'faster-js';
  const winner     = faster === 'wasm' ? 'WebAssembly' : 'JavaScript';

  // Tandai panel pemenang
  DOM.jsCard.classList.toggle('is-winner',   faster === 'js');
  DOM.wasmCard.classList.toggle('is-winner', faster === 'wasm');

  // Tampilkan progress bar relatif
  const maxTime = Math.max(jsMs, wasmMs);
  DOM.jsProgress.style.width   = `${(jsMs   / maxTime * 100).toFixed(1)}%`;
  DOM.wasmProgress.style.width = `${(wasmMs / maxTime * 100).toFixed(1)}%`;

  DOM.compBody.innerHTML = `
    <div class="speedup-row">
      <span class="speedup-number ${speedClass}">${ratio}×</span>
      <span class="speedup-label">${winner}<br>lebih cepat</span>
    </div>
    <div class="compare-detail">
      JS &nbsp;&nbsp;: ${jsMs.toFixed(3)} ms<br>
      WASM : ${wasmMs.toFixed(3)} ms<br>
      Selisih : ${Math.abs(jsMs - wasmMs).toFixed(3)} ms
    </div>
    <div class="compare-detail" style="margin-top:8px">
      ${faster === 'wasm'
        ? '↳ WASM unggul: pre-compiled binary,\nstatic typing, no GC overhead.'
        : '↳ JS menang: JIT sudah mengoptimalkan\nfungsi ini, atau beban terlalu ringan.'}
    </div>
  `;
}

/**
 * Reset semua hasil ke kondisi awal.
 */
function resetAll() {
  state.jsTime   = null;
  state.wasmTime = null;

  DOM.jsTime.innerHTML     = '—';
  DOM.jsMeta.textContent   = 'Belum dijalankan';
  DOM.wasmTime.innerHTML   = '—';
  DOM.wasmMeta.textContent = 'Belum dijalankan';

  DOM.jsCard.classList.remove('is-winner');
  DOM.wasmCard.classList.remove('is-winner');
  DOM.compBody.innerHTML = '<span class="muted">Jalankan kedua benchmark terlebih dahulu.</span>';

  DOM.jsProgress.style.width   = '0%';
  DOM.wasmProgress.style.width = '0%';

  log('Reset.', '');
}

/**
 * Aktifkan/nonaktifkan semua tombol benchmark.
 * @param {boolean} disabled
 */
function setButtonsDisabled(disabled) {
  state.running    = disabled;
  DOM.btnJs.disabled   = disabled;
  DOM.btnWasm.disabled = disabled || !state.wasmReady;
  DOM.btnAll.disabled  = disabled || !state.wasmReady;
  DOM.btnReset.disabled = disabled;
}

/* ══════════════════════════════════════════════
   BAGIAN 9 — INISIALISASI
   ══════════════════════════════════════════════ */

function init() {
  // Pasang event listener tombol
  DOM.btnJs.addEventListener('click', async () => {
    if (state.running) return;
    await runJsBenchmark();
  });

  DOM.btnWasm.addEventListener('click', async () => {
    if (state.running || !state.wasmReady) return;
    await runWasmBenchmark();
  });

  DOM.btnAll.addEventListener('click', async () => {
    if (state.running || !state.wasmReady) return;
    await runAllBenchmarks();
  });

  DOM.btnReset.addEventListener('click', () => {
    if (state.running) return;
    resetAll();
  });

  // Update label intensitas saat benchmark berubah
  DOM.benchmarkSelect.addEventListener('change', () => {
    resetAll();
    updateIntensityOptions();
  });

  updateIntensityOptions();

  // Muat WASM otomatis saat halaman siap
  log('Halaman dimuat. Menginisialisasi modul WebAssembly...', 'info');
  loadWasm();
}

/**
 * Update opsi intensitas sesuai benchmark yang dipilih.
 * Setiap benchmark memiliki parameter berbeda-beda.
 */
function updateIntensityOptions() {
  const bench   = BENCHMARK_CONFIGS[DOM.benchmarkSelect.value];
  const sel     = DOM.intensitySelect;
  sel.innerHTML = '';
  Object.entries(bench.params).forEach(([key, p]) => {
    const opt   = document.createElement('option');
    opt.value   = key;
    opt.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)} — ${p.label}`;
    sel.appendChild(opt);
  });
  sel.value = 'medium';
}

// Mulai saat DOM siap
document.addEventListener('DOMContentLoaded', init);
