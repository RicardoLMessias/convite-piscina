const canvas = document.querySelector('#water-3d-canvas');
const gl = canvas?.getContext('webgl', {
  antialias: false,
  alpha: false,
  premultipliedAlpha: false,
});

let width = 1;
let height = 1;
let dpr = 1;
let frameId = 0;
let lastFrameTime = 0;
const FRAME_INTERVAL = 1000 / 30;

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform float u_time;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float poolCaustics(vec2 uv, vec3 normal) {
    vec2 p = uv + normal.xy * 0.16;
    p.x += sin(u_time * 0.24 + p.y * 3.0) * 0.025;
    p.y += u_time * 0.028 + cos(u_time * 0.2 + p.x * 2.2) * 0.018;

    vec2 q = p * vec2(7.0, 5.6);
    float flow = noise(q * 0.28 + vec2(u_time * 0.018, -u_time * 0.014));
    q += vec2(flow - 0.5, 0.5 - flow) * 0.72;

    float lineA = abs(sin(q.x + sin(q.y * 1.45 + u_time * 0.32) * 1.18));
    float lineB = abs(sin(q.y * 1.22 + cos(q.x * 1.26 - u_time * 0.28) * 1.12));
    float web = min(lineA, lineB);

    float bright = 1.0 - smoothstep(0.0, 0.07, web);
    float soft = (1.0 - smoothstep(0.0, 0.2, web)) * 0.28;
    return bright + soft;
  }

  float waveHeight(vec2 uv) {
    vec2 p = uv;
    float aspect = u_resolution.x / u_resolution.y;
    p.x *= aspect;

    float h = 0.0;
    h += sin(p.x * 4.2 + u_time * 0.34 + sin(p.y * 3.0)) * 0.024;
    h += sin(p.y * 5.0 - u_time * 0.3 + cos(p.x * 3.3)) * 0.018;
    h += sin((p.x - p.y) * 8.5 - u_time * 0.36) * 0.009;
    return h;
  }

  void main() {
    vec2 uv = v_uv;
    vec2 texel = 1.0 / u_resolution;

    float h = waveHeight(uv);
    float hx = waveHeight(uv + vec2(texel.x * 2.0, 0.0));
    float hy = waveHeight(uv + vec2(0.0, texel.y * 2.0));

    vec3 normal = normalize(vec3((h - hx) * 4.2, (h - hy) * 4.2, 1.0));
    vec3 lightDir = normalize(vec3(-0.28, -0.62, 0.9));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(normal, halfDir), 0.0), 80.0);
    float caustic = poolCaustics(uv, normal);

    vec3 shallow = vec3(0.07, 0.76, 0.93);
    vec3 deep = vec3(0.0, 0.42, 0.74);
    vec3 color = mix(shallow, deep, uv.y * 0.36 + h * 0.46);

    color += vec3(0.1, 0.28, 0.34) * diffuse;
    color += vec3(0.82, 1.0, 0.96) * caustic * 0.22;
    color += vec3(1.0) * specular * 0.5;
    color += vec3(0.24, 0.72, 0.86) * fresnel * 0.16;

    float vignette = distance(uv, vec2(0.5));
    color *= 1.0 - vignette * 0.26;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

function createProgram() {
  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  return program;
}

function resize() {
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  const nextDpr = Math.min(window.devicePixelRatio || 1, 1.2);

  if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;

  width = nextWidth;
  height = nextHeight;
  dpr = nextDpr;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

if (!gl) {
  document.body.classList.add('no-webgl');
} else {
  const program = createProgram();
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function render(timeMs) {
    frameId = requestAnimationFrame(render);
    if (timeMs - lastFrameTime < FRAME_INTERVAL) return;

    lastFrameTime = timeMs;
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, timeMs * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      return;
    }

    lastFrameTime = 0;
    frameId = requestAnimationFrame(render);
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (!document.hidden) {
    frameId = requestAnimationFrame(render);
  }
}
