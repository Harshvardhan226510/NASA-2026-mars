/**
 * UI & Visualization Controller for Mars Skyline Visual Place Recognition (Skyline-VPR)
 */

import L from 'leaflet';
import {
  extractSkylineFromImage,
  matchSkylineProfile,
  refineLocationGrid,
  CANONICAL_MARS_SKYLINES,
  zScoreNormalize,
} from './skyline-vpr.js';
import './skyline-vpr.css';

export class SkylineVPRUI {
  constructor(host) {
    this.host = host;
    this.panel = document.getElementById('skyline-panel');
    this.lastResult = null;
    this.currentImage = null;
    this.elevationSampler = null;

    if (host.getElevationSampler) {
      host.getElevationSampler().then(s => {
        this.elevationSampler = s;
      }).catch(() => {});
    }

    // Overlays for 2D & 3D Maps
    const C = window.Cesium;
    if (C && host.viewer) {
      this.source = new C.CustomDataSource('Skyline Visual Place Recognition');
      host.viewer.dataSources.add(this.source);
    }
    this.layers = [host.map, host.mini].filter(Boolean).map(m => L.layerGroup().addTo(m));

    this.initDOM();
    this.initGroundViewCapture();
    this.loadPreset(CANONICAL_MARS_SKYLINES[0]?.id || 'GALE_FARAH_VALLIS');
  }

  open(show = true) {
    if (this.panel) this.panel.hidden = !show;
    if (show) this.host?.onOpen?.();
    const toggle = document.getElementById('skyline-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(show));
      toggle.setAttribute('aria-pressed', String(show));
    }
  }

  initDOM() {
    if (!this.panel) return;
    const close = this.panel.querySelector('#skyline-close');
    this.panel.innerHTML = `
      <div class="skyline-wrap">
        <header class="skyline-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m2 16 6-6 4 4 6-8 4 6"/>
              <circle cx="18" cy="6" r="2"/>
            </svg>
            Mars Skyline Geolocalization (VPR)
          </h2>
          <div class="skyline-badges">
            <span class="skyline-badge green">Candidate matching</span>


            <span class="skyline-badge">100% Offline</span>
          </div>
          <p class="skyline-intro" style="margin-top:8px;font-size:12px;color:#9cb5c4;">
            Compare a ground panorama’s horizon with the available Martian terrain profiles. Confirm the candidate position independently before using it.
          </p>
        </header>

        <!-- Image Input Section -->
        <section class="skyline-section">
          <div class="skyline-section-title">
            <span>1. Ground View Horizon Photo</span>
            <span class="skyline-badge">Skyline Camera</span>
          </div>

          <label style="font-size:11px;color:#8fb1c4;">Choose Benchmark Mars Basin or Upload Live Photo:</label>
          <select id="skyline-preset-select" class="skyline-preset-select">
            ${CANONICAL_MARS_SKYLINES.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            <option value="custom">Upload custom ground photo / screenshot…</option>
          </select>

          <div id="skyline-dropzone" class="skyline-dropzone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p>Drag & drop ground photo / panorama here or <span style="color:#38bdf8;text-decoration:underline;">browse</span></p>
            <small>Supports any camera photo, 360° panorama, or ground-view screenshot</small>
            <input type="file" id="skyline-file-input" class="skyline-file-input" accept="image/*">
          </div>

          <!-- Live Skyline Extraction Overlay Canvas -->
          <div class="skyline-canvas-box">
            <span>Detected Mountain Ridge Boundary (Neon Cyan = Extracted Skyline)</span>
            <canvas id="skyline-photo-canvas" class="skyline-canvas" width="360" height="150"></canvas>
          </div>

          <button type="button" id="skyline-run-btn" class="skyline-btn-run">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Localize Astronaut from Horizon
          </button>
        </section>

        <!-- Localization Telemetry & Comparison -->
        <section class="skyline-section" id="skyline-results-section" hidden>
          <div class="skyline-section-title">
            <span>2. Skyline Correlation & Heading</span>
            <span class="skyline-badge green" id="skyline-match-badge">Top candidate</span>
          </div>

          <!-- Dual Profile Comparison Chart -->
          <div class="skyline-canvas-box">
            <div class="skyline-chart-legend">
              <div class="skyline-legend-item">
                <span class="skyline-legend-dot" style="background:#38bdf8;"></span>
                <span>Observed Photo Skyline m(φ)</span>
              </div>
              <div class="skyline-legend-item">
                <span class="skyline-legend-dot" style="background:#f59e0b;"></span>
                <span>NASA DEM Predicted Horizon s(φ+α)</span>
              </div>
            </div>
            <canvas id="skyline-chart-canvas" class="skyline-chart-canvas" width="360" height="100"></canvas>
          </div>

          <!-- Detailed Flight Telemetry -->
          <div class="skyline-telemetry-box">
            <div class="skyline-telemetry-row">
              <span class="skyline-telemetry-label">Predicted Location:</span>
              <span class="skyline-telemetry-val highlight" id="skyline-loc-name">--</span>
            </div>
            <div class="skyline-telemetry-row">
              <span class="skyline-telemetry-label">Coordinates:</span>
              <span class="skyline-telemetry-val green" id="skyline-loc-coords">--</span>
            </div>
            <div class="skyline-telemetry-row">
              <span class="skyline-telemetry-label">Estimated Compass Heading:</span>
              <span class="skyline-telemetry-val accent" id="skyline-loc-heading">--</span>
            </div>
            <div class="skyline-telemetry-row">
              <span class="skyline-telemetry-label">Skyline match score:</span>
              <span class="skyline-telemetry-val green" id="skyline-loc-confidence">--</span>
            </div>
            <div class="skyline-telemetry-row">
              <span class="skyline-telemetry-label">Uncertainty Envelope:</span>
              <span class="skyline-telemetry-val" id="skyline-loc-uncertainty">Unavailable</span>
            </div>
          </div>

          <!-- Geomorphological Evidence Audit -->
          <div style="background:#0c1820;padding:8px 10px;border-radius:6px;border:1px solid #1a3444;font-size:11px;">
            <strong style="color:#7dd3fc;display:block;margin-bottom:4px;">Geomorphological Silhouette Evidence:</strong>
            <p id="skyline-loc-evidence" style="margin:0;color:#94a3b8;line-height:1.4;">--</p>
          </div>

          <!-- Top Candidates Distribution -->
          <div>
            <span style="font-size:11px;font-weight:600;color:#8fb1c4;text-transform:uppercase;">Top Basin Candidates:</span>
            <div id="skyline-candidates-list" class="skyline-candidates-list"></div>
          </div>

          <div class="skyline-actions-row">
            <button type="button" id="skyline-fly-btn" class="skyline-btn-run" style="background:#0284c7;border-color:#38bdf8;">
              Fly to Location on Map
            </button>
            <button type="button" id="skyline-route-btn" class="skyline-btn-secondary">
              Set as Route Origin
            </button>
          </div>

          <button type="button" id="skyline-export-btn" class="skyline-btn-secondary" style="width:100%;">
            Export Skyline Telemetry JSON
          </button>
        </section>

        <!-- Scientific References -->
        <details class="skyline-details">
          <summary>Scientific Literature & Mathematical Derivation</summary>
          <p>
            <strong>Planetary Curvature Correction</strong><br>
            At distance r, the Martian spherical surface curves downward by d(r) = r² / (2 · R_Mars). Elevation angle e(r, φ) = arctan([Z(r, φ) - Z₀ - h - d(r)] / r). The horizon angle s(p, φ) = max_r e(r, φ).
          </p>
          <p>
            <strong>Z-Score Pitch & Zoom Invariance</strong><br>
            s_norm(φ) = (s(φ) - μ) / σ. Subtracting mean μ cancels unknown camera tilt / horizon offset y₀. Dividing by σ cancels unknown camera focal length / VFOV zoom.
          </p>
          <p>
            <strong>Compass-Free Circular Matching</strong><br>
            Slides observed curve m(φ) circularly across 360° candidate candidate headings α ∈ [0°, 359°]. Ranks the sampled candidates and estimates a heading offset.
          </p>
          <p style="color:#38bdf8;">
            References: Cozman & Krotkov (CMU, 1995); Babacic, Lu, & Stachniss (Univ. of Bonn, 2022).
          </p>
        </details>
      </div>
    `;

    if (close) {
      this.panel.prepend(close);
      close.onclick = () => this.open(false);
    }
    this.bindEvents();
  }

  bindEvents() {
    const sel = document.getElementById('skyline-preset-select');
    sel?.addEventListener('change', () => {
      if (sel.value !== 'custom') {
        this.loadPreset(sel.value);
      }
    });

    const dropzone = document.getElementById('skyline-dropzone');
    const fileInput = document.getElementById('skyline-file-input');

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer?.files?.length) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target?.files?.length) {
        this.handleFileUpload(e.target.files[0]);
      }
    });

    const runBtn = document.getElementById('skyline-run-btn');
    runBtn?.addEventListener('click', () => this.runLocalization());

    const flyBtn = document.getElementById('skyline-fly-btn');
    flyBtn?.addEventListener('click', () => this.flyToPosition());

    const routeBtn = document.getElementById('skyline-route-btn');
    routeBtn?.addEventListener('click', () => this.setAsRouteOrigin());

    const exportBtn = document.getElementById('skyline-export-btn');
    exportBtn?.addEventListener('click', () => this.exportTelemetry());
  }

  initGroundViewCapture() {
    // Inject the "Capture 360° Ground Panorama" button into the ground controls navigation bar
    const groundHelp = document.getElementById('ground-help');
    if (groundHelp && !document.getElementById('ground-capture-360')) {
      const capBtn = document.createElement('button');
      capBtn.id = 'ground-capture-360';
      capBtn.type = 'button';
      capBtn.className = 'ground-capture-btn';
      capBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        📸 Capture 360° Panorama
      `;
      capBtn.onclick = () => this.capture360Panorama();
      groundHelp.appendChild(capBtn);
    }
  }

  waitForTilesLoaded(viewer, minWaitMs = 250, maxWaitMs = 1600) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let stableFrames = 0;

      const check = () => {
        // Because requestRenderMode is true, actively call requestRender and render
        viewer.scene.requestRender();
        try {
          viewer.scene.render();
        } catch {}

        const elapsed = performance.now() - startTime;
        const globe = viewer.scene.globe;
        const isLoaded = globe ? globe.tilesLoaded : true;

        if (isLoaded && elapsed >= minWaitMs) {
          stableFrames++;
          if (stableFrames >= 2) {
            resolve();
            return;
          }
        } else {
          stableFrames = 0;
        }

        if (elapsed >= maxWaitMs) {
          resolve();
          return;
        }

        requestAnimationFrame(check);
      };

      requestAnimationFrame(check);
    });
  }

  async capture360Panorama() {
    if (!this.host.viewer || !window.Cesium) {
      alert('Ground 360° Panorama capture requires the 3D globe view.');
      return;
    }

    const capBtn = document.getElementById('ground-capture-360');
    if (capBtn) {
      capBtn.disabled = true;
      capBtn.style.opacity = '0.7';
    }

    const viewer = this.host.viewer;
    const camera = viewer.camera;
    const C = window.Cesium;
    const originalPosition = C.Cartesian3.clone(camera.position);
    const originalHeading = camera.heading;
    const originalPitch = camera.pitch;
    const originalRoll = camera.roll;

    // Use 8 slices (45° per slice) for minimal perspective tangent distortion (<5%) and seamless cylindrical stitching
    const slices = 8;
    const sliceWidth = 450;
    const totalHeight = 450;
    const panoramaCanvas = document.createElement('canvas');
    panoramaCanvas.width = sliceWidth * slices; // 3600 px wide
    panoramaCanvas.height = totalHeight;
    const pCtx = panoramaCanvas.getContext('2d');

    const sliceAngleRad = (2 * Math.PI) / slices; // 45° = Math.PI / 4

    try {
      for (let i = 0; i < slices; i++) {
        if (capBtn) {
          capBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            ⏳ Sweeping (${i + 1}/${slices})...
          `;
        }

        // Heading centered so slice 0 covers [0°, 45°] (aligning column 0 with True North)
        const heading = (i + 0.5) * sliceAngleRad;
        camera.setView({
          destination: originalPosition,
          orientation: {
            heading,
            pitch: 0.0, // level gaze directly at horizon
            roll: 0.0,
          },
        });

        // Actively stream and wait for Cesium terrain meshes and imagery tiles to settle
        await this.waitForTilesLoaded(viewer, 250, 1600);

        // Crop the central 45° angular field of view from the WebGL canvas
        const webglCanvas = viewer.scene.canvas;
        const W = webglCanvas.width;
        const H = webglCanvas.height;
        const frustum = camera.frustum;
        const vfovRad = (frustum && Number.isFinite(frustum.fov)) ? frustum.fov : (Math.PI / 3);
        const halfSlice = sliceAngleRad / 2;
        const halfVfov = vfovRad / 2;

        const cropWidth = Math.min(W, H * (Math.tan(halfSlice) / Math.tan(halfVfov)));
        const cropHeight = H;
        const cropX = Math.max(0, Math.floor((W - cropWidth) / 2));
        const cropY = 0;

        pCtx.drawImage(
          webglCanvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          i * sliceWidth,
          0,
          sliceWidth,
          totalHeight
        );
      }

      if (capBtn) {
        capBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          ✅ Stitched 360°! Localizing...
        `;
      }

      // Set captured panorama as active image
      this.currentImage = panoramaCanvas;
      this.renderSkylineOverlay(panoramaCanvas);
      this.open(true);
      const sel = document.getElementById('skyline-preset-select');
      if (sel) sel.value = 'custom';
      this.runLocalization();
    } finally {
      // Always restore original camera position and orientation
      camera.setView({
        destination: originalPosition,
        orientation: {
          heading: originalHeading,
          pitch: originalPitch,
          roll: originalRoll,
        },
      });
      viewer.scene.requestRender();

      setTimeout(() => {
        if (capBtn) {
          capBtn.disabled = false;
          capBtn.style.opacity = '1';
          capBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            📸 Capture 360° Panorama
          `;
        }
      }, 1500);
    }
  }

  loadPreset(key) {
    const cand = CANONICAL_MARS_SKYLINES.find(c => c.id === key) || CANONICAL_MARS_SKYLINES[0];
    if (!cand) return;

    // Generate a synthetic high-contrast 360° ground image based on the candidate's skyline profile
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');

    // Fill dark Martian sky
    ctx.fillStyle = '#060a0e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw terrain silhouette
    ctx.fillStyle = key === 'VALLES_MARINERIS_IUS' ? '#b45309' : key === 'JEZERO_CRATER_DELTA' ? '#c2410c' : '#78350f';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    const degPerPixel = 60 / canvas.height; // 60° VFOV
    const y0 = canvas.height / 2;

    for (let x = 0; x < canvas.width; x++) {
      const angle = cand.profile[x];
      const y = Math.max(10, Math.min(canvas.height - 10, y0 - angle / degPerPixel));
      ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();

    this.currentImage = canvas;
    this.renderSkylineOverlay(canvas);
  }

  handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 360, 150);

        this.currentImage = canvas;
        this.renderSkylineOverlay(canvas);

        const sel = document.getElementById('skyline-preset-select');
        if (sel) sel.value = 'custom';

        this.runLocalization();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  renderSkylineOverlay(imageCanvas) {
    const displayCanvas = document.getElementById('skyline-photo-canvas');
    if (!displayCanvas) return;

    displayCanvas.width = 360;
    displayCanvas.height = 150;
    const ctx = displayCanvas.getContext('2d');

    // Draw the image
    ctx.drawImage(imageCanvas, 0, 0, 360, 150);

    // Extract the skyline boundary curve
    const extracted = extractSkylineFromImage(imageCanvas, { vfovDeg: 60 });
    this.lastExtracted = extracted;

    // Overlay glowing cyan line over the detected mountain horizon
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    for (let x = 0; x < 360; x++) {
      const y = extracted.rawHorizonRows[x];
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  runLocalization() {
    if (!this.lastExtracted) {
      if (this.currentImage) this.renderSkylineOverlay(this.currentImage);
      else return;
    }

    const match = matchSkylineProfile(this.lastExtracted.elevationAngles, CANONICAL_MARS_SKYLINES);

    // If real MOLA elevation sampler is available, perform fine local grid search (±1° in 0.25° steps)
    if (this.elevationSampler) {
      try {
        const refined = refineLocationGrid(
          this.lastExtracted.elevationAngles,
          match.bestMatch,
          this.elevationSampler,
          1.0,
          0.25
        );
        if (refined && (refined.mse <= match.bestMatch.mse || refined.confidence >= match.bestMatch.confidence)) {
          match.bestMatch = { ...match.bestMatch, ...refined };
          match.matchedHeadingDeg = refined.bestAzimuthDeg;
        }
      } catch (err) {
        console.warn('Fine grid refinement skipped:', err);
      }
    }

    this.lastResult = match;

    this.displayResults(match);
    this.updateMapOverlays(match);
  }

  displayResults(match) {
    const resultsSec = document.getElementById('skyline-results-section');
    if (resultsSec) resultsSec.hidden = false;

    const loc = match.bestMatch;

    const nameEl = document.getElementById('skyline-loc-name');
    if (nameEl) nameEl.textContent = loc.name;

    const coordsEl = document.getElementById('skyline-loc-coords');
    if (coordsEl) {
      const latFmt = `${Math.abs(loc.lat).toFixed(4)}°${loc.lat >= 0 ? 'N' : 'S'}`;
      const lonFmt = `${Math.abs(loc.lon).toFixed(4)}°${loc.lon >= 0 ? 'E' : 'W'}`;
      coordsEl.textContent = `${latFmt}, ${lonFmt}`;
    }

    const headingEl = document.getElementById('skyline-loc-heading');
    if (headingEl) {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const dirStr = dirs[Math.round(match.matchedHeadingDeg / 45) % 8];
      headingEl.textContent = `${match.matchedHeadingDeg}° (${dirStr})`;
    }

    const confEl = document.getElementById('skyline-loc-confidence');
    if (confEl) {
      confEl.textContent = `${Math.round(loc.confidence * 1000) / 10}% (ZNCC Correlation)`;
    }

    const uncertEl = document.getElementById('skyline-loc-uncertainty');
    if (uncertEl) {
      uncertEl.textContent = 'Positional uncertainty unavailable';
    }

    const evidEl = document.getElementById('skyline-loc-evidence');
    if (evidEl) {
      evidEl.textContent = loc.geomorphology;
    }

    // Render candidate probability bars
    const candList = document.getElementById('skyline-candidates-list');
    if (candList) {
      candList.innerHTML = match.candidates.slice(0, 4).map((c, i) => `
        <div class="skyline-cand-row">
          <div class="skyline-cand-header">
            <span>${c.name}</span>
            <span>${Math.round(c.confidence * 1000) / 10}%</span>
          </div>
          <div class="skyline-cand-bar">
            <div class="skyline-cand-fill ${i === 0 ? 'top' : ''}" style="width:${Math.round(c.confidence * 100)}%;"></div>
          </div>
        </div>
      `).join('');
    }

    // Draw dual profile comparison chart
    this.renderProfileChart(this.lastExtracted.elevationAngles, loc.candidateProfile, match.matchedHeadingDeg);
  }

  renderProfileChart(observedAngles, predictedCandidateProfile, headingDeg) {
    const chartCanvas = document.getElementById('skyline-chart-canvas');
    if (!chartCanvas) return;

    const w = 360;
    const h = 100;
    chartCanvas.width = w;
    chartCanvas.height = h;
    const ctx = chartCanvas.getContext('2d');

    ctx.fillStyle = '#050a0d';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#152530';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const obsNorm = zScoreNormalize(observedAngles);
    const predNorm = zScoreNormalize(predictedCandidateProfile);

    const yScale = h / 6.0; // ±3 standard deviations
    const yCenter = h / 2;

    // Draw predicted candidate profile (amber) with heading shift applied
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let x = 0; x < 360; x++) {
      const candIdx = (x + headingDeg) % 360;
      const val = predNorm[candIdx];
      const y = yCenter - val * yScale;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw observed photo profile (cyan)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let x = 0; x < 360; x++) {
      const val = obsNorm[x];
      const y = yCenter - val * yScale;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  updateMapOverlays(match) {
    const loc = match.bestMatch;

    // 1. Leaflet 2D Map Overlays
    this.layers.forEach(layer => {
      layer.clearLayers();

      // Distinctive Skyline Pin
      L.circleMarker([loc.lat, loc.lon], {
        radius: 8,
        color: '#38bdf8',
        fillColor: '#ffffff',
        fillOpacity: 0.95,
        weight: 2.5,
      }).bindPopup(`
        <strong>Mars skyline candidate</strong><br>
        Basin: ${loc.name}<br>
        Coordinates: ${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°<br>
        Estimated Heading: ${match.matchedHeadingDeg}°<br>
        Skyline match score: ${Math.round(loc.confidence * 100)}%
      `).addTo(layer);
    });

    // 2. Cesium 3D Globe Overlays
    if (this.source && window.Cesium) {
      const C = window.Cesium;
      this.source.entities.removeAll();

      this.source.entities.add({
        position: C.Cartesian3.fromDegrees(loc.lon, loc.lat, 0, this.host.viewer.scene.globe.ellipsoid),
        point: {
          pixelSize: 12,
          color: C.Color.CYAN,
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: `Skyline Match: ${loc.name}`,
          font: '13px sans-serif',
          fillColor: C.Color.WHITE,
          outlineColor: C.Color.BLACK,
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -22),
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
        },
      });

      this.host.viewer.scene?.requestRender();
    }
  }

  flyToPosition() {
    if (!this.lastResult) return;
    const loc = this.lastResult.bestMatch;

    if (this.host.viewer && window.Cesium) {
      const C = window.Cesium;
      this.host.viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(loc.lon, loc.lat, 18000, this.host.viewer.scene.globe.ellipsoid),
        duration: 2.2,
      });
    }

    if (this.host.map) {
      this.host.map.setView([loc.lat, loc.lon], 8);
    }
  }

  setAsRouteOrigin() {
    if (!this.lastResult) return;
    const loc = this.lastResult.bestMatch;

    if (this.host.setStart) {
      this.host.setStart([loc.lon, loc.lat]);
    } else if (this.host.routePlanner) {
      this.host.routePlanner.start = [loc.lon, loc.lat];
    }

    if (this.host.openRoute) {
      this.host.openRoute(true);
    }
    alert(`Skyline candidate [${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°] set as route origin.`);
  }

  exportTelemetry() {
    if (!this.lastResult) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.lastResult, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `mars-skyline-vpr-${Date.now()}.json`);
    dlAnchor.click();
  }
}
