'use strict';
/* WebGL blue aurora light-beam backdrop (ported from the DIU UI design).
   - Pauses when the tab is hidden, honours prefers-reduced-motion (renders one still frame).
   - Pixel budget keeps the thin beam core crisp without melting integrated GPUs.
   - Falls back to the CSS background if WebGL is unavailable. */
(() => {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  let ready = false;
  if (!gl) { document.documentElement.classList.add('no-webgl'); return; }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOME_PIXELS = 2300000;   // landing page: razor-sharp beam
  const APP_PIXELS = 1100000;    // workspace pages: cheaper, content matters more
  const FRAME_MS = 1000 / 58;    // cap very high refresh-rate displays; 60Hz draws every frame
  const MIN_QUALITY = 0.12;      // adaptive floor (fraction of the pixel budget)
  let quality = 1;               // adaptive multiplier, lowered when frames run slow

  function budget() { return document.body.classList.contains('is-home') ? HOME_PIXELS : APP_PIXELS; }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth * dpr, h = window.innerHeight * dpr;
    const k = Math.min(1, Math.sqrt((budget() * quality) / (w * h)));
    canvas.width = Math.max(2, Math.floor(w * k));
    canvas.height = Math.max(2, Math.floor(h * k));
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (ready) draw(performance.now());
  }

  const vertexSource = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragmentSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    float hash(vec2 st) { return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123); }

    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(st);
        st = st * 2.02 + vec2(3.1, 1.7);
        amplitude *= 0.5;
      }
      return value;
    }

    vec3 G(vec3 d, float s) { return exp(-(d * d) / (2.0 * s * s)); }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= aspect;
      float t = u_time;

      vec3 deep = vec3(0.000, 0.002, 0.012);
      vec3 rise = vec3(0.001, 0.006, 0.030);
      vec3 col = mix(rise, deep, smoothstep(-1.0, 1.0, p.y));

      float shimmer = 0.0035 * sin(p.y * 5.0 + t * 0.7) + 0.0018 * sin(p.y * 13.0 - t * 1.3);
      float bx = -0.1 + 0.03 * sin(t * 0.22) + shimmer;
      float dx = p.x - bx;
      float d = abs(dx);

      float e1 = pow(0.5 + 0.5 * sin(p.y * 2.4 - t * 0.85), 5.0);
      float e2 = pow(0.5 + 0.5 * sin(p.y * 1.3 + t * 0.50 + 1.7), 7.0);
      float energy = 0.88 + 0.75 * e1 + 0.45 * e2;

      float taper = (0.45 + 0.55 * smoothstep(-1.35, -0.35, p.y)) * (1.0 - 0.35 * smoothstep(0.5, 1.4, p.y));

      float w = 0.0020 * (1.0 + 0.55 * e1);
      vec3 dd = vec3(abs(dx - 0.0028), d, abs(dx + 0.0028));

      vec3 coreL = (w * w) / (dd * dd + w * w);
      vec3 beam = vec3(0.0);
      beam += coreL * vec3(0.95, 1.00, 1.15) * 1.15;
      beam += G(dd, 0.0060) * vec3(0.55, 0.85, 1.20) * 0.85;
      beam += G(dd, 0.0200) * vec3(0.22, 0.55, 1.05) * 0.60;
      beam += G(dd, 0.0600) * vec3(0.10, 0.34, 0.98) * 0.38;
      beam += G(dd, 0.1600) * vec3(0.05, 0.20, 0.82) * 0.24;
      beam += G(dd, 0.4200) * vec3(0.02, 0.10, 0.50) * 0.16;

      float pulse = 0.94 + 0.06 * sin(t * 0.6);
      vec3 add = beam * energy * taper * pulse;

      float sh1 = fbm(vec2(dx * 16.0, p.y * 0.5 - t * 0.10));
      float sh2 = noise(vec2(dx * 58.0 + 3.0, p.y * 0.9 - t * 0.22));
      float shafts = smoothstep(0.38, 0.88, sh1 * 0.7 + sh2 * 0.3) * exp(-d * 3.0);
      add += shafts * vec3(0.10, 0.34, 0.95) * 0.30 * taper;

      vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t * 0.020)),
                    fbm(p * 1.1 + vec2(5.2, 1.3) - vec2(0.0, t * 0.016)));
      float haze = fbm(p * 1.25 + 1.8 * q + vec2(t * 0.012, -t * 0.030));
      float smoke = smoothstep(0.25, 0.95, haze) * exp(-d * 1.8);
      add += smoke * mix(vec3(0.07, 0.24, 0.95), vec3(0.16, 0.78, 1.0), smoothstep(0.35, 0.9, haze)) * 0.17;

      float fy = 0.10 + 0.06 * sin(t * 0.19);
      float dy = p.y - fy;
      float streak = exp(-abs(dy) * 70.0) * exp(-d * 0.9);
      add += streak * vec3(0.10, 0.38, 1.00) * 0.34 * (0.85 + 0.15 * sin(t * 0.9));
      add += exp(-(d * d + dy * dy) / (2.0 * 0.022 * 0.022)) * vec3(0.70, 0.92, 1.00) * 0.55;
      add += exp(-(d * d + dy * dy) / (2.0 * 0.090 * 0.090)) * vec3(0.12, 0.40, 1.00) * 0.30;

      vec2 gp = vec2(p.x * 24.0, p.y * 24.0 - t * 0.35);
      vec2 cell = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float r = hash(cell);
      vec2 off = (vec2(hash(cell + 1.7), hash(cell + 4.3)) - 0.5) * 0.6;
      float star = step(0.955, r) * smoothstep(0.11, 0.0, length(f - off));
      float tw = 0.55 + 0.45 * sin(t * (0.8 + 2.2 * hash(cell + 9.1)) + r * 40.0);
      float lit = 1.0 + 7.0 * exp(-d * 7.0);
      add += star * tw * lit * mix(vec3(0.55, 0.78, 1.0), vec3(1.0), hash(cell + 2.2)) * 0.8;

      vec2 sp = vec2(dx * 60.0, p.y * 60.0 - t * 1.1);
      vec2 sc = floor(sp);
      vec2 sf = fract(sp) - 0.5;
      float sr = hash(sc + 11.0);
      float spark = step(0.93, sr) * smoothstep(0.10, 0.0, length(sf - (vec2(hash(sc + 3.0), hash(sc + 7.0)) - 0.5) * 0.5));
      spark *= exp(-d * 9.0) * (0.5 + 0.5 * sin(t * 3.0 + sr * 60.0));
      add += spark * vec3(0.75, 0.93, 1.0) * 1.4;

      add = 1.0 - exp(-add * 1.35);
      col += add * 0.95;

      col *= 1.0 - 0.5 * dot(uv - 0.5, uv - 0.5) * 1.6;
      col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Backdrop shader failed:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  let program, uTime, uRes;
  function build() {
    const vs = compile(vertexSource, gl.VERTEX_SHADER), fs = compile(fragmentSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return false;
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    uTime = gl.getUniformLocation(program, 'u_time');
    uRes = gl.getUniformLocation(program, 'u_resolution');
    return true;
  }
  if (!build()) { document.documentElement.classList.add('no-webgl'); return; }
  ready = true;

  const start = performance.now();
  let last = 0, raf = 0, stopped = false, slowSum = 0, slowN = 0;

  function draw(now) {
    const seconds = reduceMotion || stopped ? 12 : (now - start) / 1000;
    gl.uniform1f(uTime, seconds);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  // Adaptive quality: if frames average slower than ~26fps, shrink the render resolution (CSS scales it up).
  // If even the floor can't keep up, freeze on a still frame instead of janking the whole page.
  function adapt(dt) {
    slowSum += dt; slowN += 1;
    if (slowN < 24) return;
    const avg = slowSum / slowN; slowSum = 0; slowN = 0;
    if (avg <= 38) return;
    if (quality > MIN_QUALITY * 1.01) { quality = Math.max(MIN_QUALITY, quality * 0.62); resize(); }
    else if (avg > 90) { stopped = true; pause(); document.documentElement.classList.add('backdrop-still'); draw(performance.now()); }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    if (dt < FRAME_MS) return;
    if (last) adapt(Math.min(dt, 250));
    last = now;
    draw(now);
  }
  function play() { if (!reduceMotion && !stopped && !raf && !document.hidden && ready) { last = 0; raf = requestAnimationFrame(frame); } }
  function pause() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  window.addEventListener('resize', resize);
  // The app toggles body.is-home on navigation; re-budget the canvas when that happens.
  let lastBudget = budget();
  new MutationObserver(() => {
    if (budget() !== lastBudget) { lastBudget = budget(); resize(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // GPU resets happen (driver hiccups, tab backgrounding): rebuild GL state instead of reloading the page.
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; pause(); });
  canvas.addEventListener('webglcontextrestored', () => {
    if (build()) { ready = true; resize(); play(); } else document.documentElement.classList.add('no-webgl');
  });

  resize();
  play();
})();
