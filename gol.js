/* Conway's Game of Life background
 * Responsive, throttled for performance, pauses on tab blur, reduced motion aware.
 */
(function(){
  const canvas = document.getElementById('gol-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height, cols, rows, cellSize; // simulation cell size (grid resolution)
  let zoomScale = 1; // visual scale applied to canvas
  const minZoom = 1.0; // do not allow zooming out below 1.0x
  const maxZoom = 5;
  let grid, buffer;
  let animationId = null;
  let running = true;
  let lastFrame = 0;
  let targetFPS = 30; // adjustable
  let liveColor = '#d8d8d8ff'; // black live cells
  let deadColor = '#ffffff'; // white background for dead cells
  let density = 0.1; // default initial live cell probability (one quarter)
  let generation = 0;
  function countPopulation(){
    let pop = 0;
    for (let i=0;i<grid.length;i++) pop += grid[i];
    return pop;
  }
  function updateStats(){
    const popEl = document.getElementById('gol-pop');
    const genEl = document.getElementById('gol-gen');
    const zoomEl = document.getElementById('gol-zoom');
    if (popEl) popEl.textContent = countPopulation();
    if (genEl) genEl.textContent = generation;
    if (zoomEl) zoomEl.textContent = (zoomScale.toFixed(1)+'x');
    updateControlsState();
  }

  function initGrid() {
    grid = new Uint8Array(cols * rows);
    buffer = new Uint8Array(cols * rows);
    for (let i=0;i<grid.length;i++) {
      grid[i] = Math.random() < density ? 1 : 0;
    }
  }

  let maskRect = null; // bounding rectangle of main content

  function updateMask() {
    const main = document.getElementById('main-content');
    if (main) {
      const r = main.getBoundingClientRect();
      maskRect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    } else {
      maskRect = null;
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    // choose smaller cell size for finer appearance
  cellSize = 2; // fixed resolution for simulation
    cols = Math.floor(width / cellSize);
    rows = Math.floor(height / cellSize);
    initGrid();
    updateMask();
    // run a few evolution steps so initial pattern isn't purely random noise
    for (let i=0;i<2;i++) step();
    draw(); // immediate draw so user sees pattern instantly
  }

  function step() {
    generation++;
    for (let r=0;r<rows;r++) {
      for (let c=0;c<cols;c++) {
        const idx = r*cols + c;
        let liveNeighbors = 0;
        // iterate neighbors
        for (let dr=-1;dr<=1;dr++) {
          for (let dc=-1;dc<=1;dc++) {
            if (dr===0 && dc===0) continue;
            let nr = r + dr;
            let nc = c + dc;
            if (nr<0) nr = rows-1; else if (nr>=rows) nr = 0; // wrap
            if (nc<0) nc = cols-1; else if (nc>=cols) nc = 0; // wrap
            liveNeighbors += grid[nr*cols + nc];
          }
        }
        const alive = grid[idx] === 1;
        let nextAlive = alive;
        if (alive && (liveNeighbors < 2 || liveNeighbors > 3)) nextAlive = false;
        else if (!alive && liveNeighbors === 3) nextAlive = true;
        buffer[idx] = nextAlive ? 1 : 0;
      }
    }
    // swap
    const tmp = grid; grid = buffer; buffer = tmp;
  }

  function draw() {
    ctx.fillStyle = deadColor;
    ctx.fillRect(0,0,width,height);
    ctx.fillStyle = liveColor;
    for (let r=0;r<rows;r++) {
      for (let c=0;c<cols;c++) {
        if (grid[r*cols + c]) {
          const x = c*cellSize;
          const y = r*cellSize;
          // Adjust masking to account for zoom scale: maskRect stores screen-space coords.
          // We divide by zoomScale to compare with unscaled simulation coordinates.
          if (maskRect) {
            const zx = x * zoomScale;
            const zy = y * zoomScale;
            if (zx + cellSize*zoomScale > maskRect.left && zx < maskRect.right && zy + cellSize*zoomScale > maskRect.top && zy < maskRect.bottom) {
              continue; // skip drawing inside masked region
            }
          }
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
    updateStats();
  }

  function animate(ts) {
    if (!running) return;
    if (ts - lastFrame > 1000/targetFPS) {
      step();
      draw();
      lastFrame = ts;
    }
    animationId = requestAnimationFrame(animate);
  }

  function pause() {
    running = false;
    if (animationId) cancelAnimationFrame(animationId);
  }
  function play() {
    if (!running) running = true;
    animationId = requestAnimationFrame(animate); // always ensure a frame is queued
  }

  function forceStart() {
    running = true;
    animationId = requestAnimationFrame(animate);
  }

  // Visibility handling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else play();
  });

  // Reduced motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }

  // Debounced resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); }, 150);
  });

  // Recalculate mask periodically in case layout shifts (e.g., images load)
  setTimeout(updateMask, 1000);
  setTimeout(updateMask, 3000);
  window.addEventListener('scroll', updateMask);

  // Allow manual speed change from console
  window.GOL = {
    setFPS: (fps) => { targetFPS = Math.max(1, Math.min(60, fps)); },
    pause, play, forceStart,
    reseed: () => { initGrid(); for (let i=0;i<2;i++) step(); draw(); play(); },
    setColors: (live, dead) => { if(live) liveColor = live; if(dead) deadColor = dead; draw(); },
    zoomIn: () => { zoomScale = Math.min(maxZoom, +(zoomScale + 0.2).toFixed(2)); applyZoom(); },
  zoomOut: () => { zoomScale = Math.max(minZoom, +(zoomScale - 0.2).toFixed(2)); applyZoom(); },
    stepOnce: () => { step(); draw(); },
    resetZoom: () => { zoomScale = 1; applyZoom(); }
  };

  function applyZoom(){
    canvas.style.transform = `scale(${zoomScale})`;
    updateStats(); // also updates control states
  }

  function updateControlsState(){
    const zi = document.getElementById('gol-zoom-in');
    const zo = document.getElementById('gol-zoom-out');
    if (zi) zi.disabled = zoomScale >= maxZoom;
  if (zo) zo.disabled = zoomScale <= minZoom;
  }

  resize();
  play(); // schedule first frame immediately
  // Anchor zoom to top-left so masked region remains visually stable.
  canvas.style.transformOrigin = 'top left';
  canvas.style.transform = 'scale(1)';
  updateStats();

  // Heartbeat indicator (optional): update a CSS variable for potential UI use
  let hb = 0;
  setInterval(() => { if (running) { hb = (hb+1)%2; document.documentElement.style.setProperty('--gol-hb', hb); } }, 1000);
})();
