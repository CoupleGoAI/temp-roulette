(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // React Bits Grainient, adapted to plain WebGL2 so this static page has no runtime dependencies.
  function initGrainient() {
    const canvas = document.getElementById("grainientBg");
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      canvas.hidden = true;
      return;
    }

    const vertexSource = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `#version 300 es
      precision highp float;

      uniform vec2 iResolution;
      uniform float iTime;
      out vec4 fragColor;

      #define S(a,b,t) smoothstep(a,b,t)

      mat2 Rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }

      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
        return fract(sin(p) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        float n = mix(
          mix(
            dot(-1.0 + 2.0 * hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)),
            u.x
          ),
          mix(
            dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)),
            u.x
          ),
          u.y
        );
        return 0.5 + 0.5 * n;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        float ratio = iResolution.x / iResolution.y;
        vec2 tuv = uv - 0.5;

        float t = iTime * 0.18;
        float degree = noise(vec2(t * 0.12, tuv.x * tuv.y) * 2.2);

        tuv.y *= 1.0 / ratio;
        tuv *= Rot(radians((degree - 0.5) * 300.0 + 180.0));
        tuv.y *= ratio;

        float warpTime = t * 1.6;
        tuv.x += sin(tuv.y * 5.2 + warpTime) / 34.0;
        tuv.y += sin(tuv.x * 7.4 + warpTime) / 18.0;

        vec3 pink = vec3(0.957, 0.545, 0.651);
        vec3 orchid = vec3(0.800, 0.482, 0.910);
        vec3 plum = vec3(0.118, 0.071, 0.188);
        vec3 deep = vec3(0.169, 0.102, 0.263);

        float blendX = (tuv * Rot(radians(-18.0))).x;
        vec3 layer1 = mix(plum, pink, S(-0.48, 0.24, blendX));
        vec3 layer2 = mix(deep, orchid, S(-0.38, 0.38, blendX));
        vec3 col = mix(layer1, layer2, S(0.38, -0.44, tuv.y));

        float glowA = 1.0 - smoothstep(0.0, 0.62, length(uv - vec2(0.20, 0.18)));
        float glowB = 1.0 - smoothstep(0.0, 0.58, length(uv - vec2(0.84, 0.82)));
        col += pink * glowA * 0.11;
        col += orchid * glowB * 0.12;

        float grain = fract(sin(dot(uv * iResolution.xy * 0.45, vec2(12.9898, 78.233))) * 43758.5453);
        col += (grain - 0.5) * 0.035;

        col = (col - 0.5) * 1.12 + 0.5;
        col = clamp(col, 0.0, 1.0);
        fragColor = vec4(col, 1.0);
      }
    `;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Grainient shader failed:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) {
      canvas.hidden = true;
      return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Grainient program failed:", gl.getProgramInfoLog(program));
      canvas.hidden = true;
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "iResolution");
    const time = gl.getUniformLocation(program, "iTime");
    const started = performance.now();

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(innerWidth * dpr));
      const height = Math.max(1, Math.floor(innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
    }

    function render(now) {
      resize();
      gl.uniform1f(time, (now - started) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion) requestAnimationFrame(render);
    }

    addEventListener("resize", resize, { passive: true });
    render(performance.now());
  }

  function initConfetti() {
    const canvas = document.getElementById("confetti");
    if (!canvas) return () => {};

    const ctx = canvas.getContext("2d");
    const palette = ["#f48ba6", "#f9b5c8", "#cc7be8", "#dda8f0", "#ffffff", "#b94f70"];
    let particles = [];
    let raf = null;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      particles = particles.filter((p) => p.life > 0);

      for (const p of particles) {
        p.vx *= 0.992;
        p.vy = p.vy * 0.994 + 0.17;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        p.life -= 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.min(1, p.life / 28);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.48, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size * 0.28, p.size, p.size * 0.56);
        }
        ctx.restore();
      }

      if (particles.length) raf = requestAnimationFrame(frame);
      else {
        raf = null;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
      }
    }

    addEventListener("resize", resize, { passive: true });
    resize();

    return function burst(origin) {
      if (reducedMotion) return;

      const x = origin?.x ?? innerWidth / 2;
      const y = origin?.y ?? innerHeight * 0.42;

      for (let i = 0; i < 150; i++) {
        const angle = -Math.PI + Math.random() * Math.PI;
        const speed = 4.5 + Math.random() * 8.5;
        particles.push({
          x: x + (Math.random() - 0.5) * 60,
          y: y + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.8,
          size: 5 + Math.random() * 7,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.32,
          life: 70 + Math.floor(Math.random() * 40),
          color: palette[Math.floor(Math.random() * palette.length)],
          round: Math.random() < 0.24,
        });
      }

      if (raf == null) raf = requestAnimationFrame(frame);
    };
  }

  function initWinnerMoment() {
    const overlay = document.getElementById("winnerMoment");
    const title = document.getElementById("winnerMomentTitle");
    let timer = null;

    return function showWinnerMoment(label) {
      if (!overlay || !title) return;
      title.textContent = label;
      overlay.classList.remove("is-active");
      void overlay.offsetWidth;
      overlay.classList.add("is-active");
      clearTimeout(timer);
      timer = setTimeout(() => overlay.classList.remove("is-active"), 1050);
    };
  }

  initGrainient();
  window.burstConfetti = initConfetti();
  window.showWinnerMoment = initWinnerMoment();
})();