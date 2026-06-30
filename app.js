// Application State
const state = {
  N: 8,                      // Number of sides
  inputMode: 'flat',         // 'flat' (flat-to-flat width) or 'corner' (corner-to-corner diameter)
  outerDimension: 300,       // mm or inches
  thickness: 10,             // mm or inches
  length: 6,                 // meters or feet
  orientationMode: 'flat-up', // 'flat-up', 'corner-up', 'custom'
  customAngle: 0,            // degrees
  materialPreset: 'steel',   // 'steel', 'aluminum', 'concrete', 'timber', 'custom'
  density: 7850,             // kg/m^3 or lb/ft^3
  yieldStrength: 250,        // MPa or ksi
  unitSystem: 'metric',      // 'metric' or 'imperial'
  
  // Design Loads
  bendingMoment: 50,         // kNm or kip-ft
  axialForce: 100,           // kN or kips (positive for compression)
  torsionalMoment: 20,       // kNm or kip-ft

  // Visuals
  activeTab: 'visualizer',
  theme: 'dark',
  stressVisualMode: 'elastic',
  
  // 3D Canvas orientation
  yaw: -0.6,
  pitch: 0.4
};

// Material Presets Database
const materials = {
  steel: { name: 'Structural Steel (S250)', densityMetric: 7850, densityImperial: 490, yieldMetric: 250, yieldImperial: 36 },
  sm490: { name: 'Steel SM490 YA/YB', densityMetric: 7850, densityImperial: 490, yieldMetric: 365, yieldImperial: 53 },
  custom: { name: 'Custom Steel', densityMetric: 7850, densityImperial: 490, yieldMetric: 250, yieldImperial: 36 }
};

// UI Element Cache
let el = {};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initEventListeners();
  updateMaterialValues();
  calculateAndRender();
});

function cacheElements() {
  const ids = [
    'theme-toggle', 'unit-toggle', 'print-btn',
    'sides-slider', 'sides-val',
    'input-mode-flat', 'input-mode-corner',
    'dim-label', 'dim-input', 'dim-unit',
    'thick-input', 'thick-unit', 'thick-warning',
    'len-input', 'len-unit',
    'orient-select', 'angle-slider-container', 'angle-slider', 'angle-val',
    'material-select', 'density-input', 'density-unit', 'yield-input', 'yield-unit',
    'moment-input', 'moment-unit',
    'axial-input', 'axial-unit',
    'torsion-input', 'torsion-unit',
    'tab-visualizer', 'tab-properties', 'tab-design', 'tab-math',
    'panel-visualizer', 'panel-properties', 'panel-design', 'panel-math',
    'stress-toggle-elastic', 'stress-toggle-plastic',
    'svg-container', 'canvas3d',
    'gauge-fill-vm', 'gauge-val-vm', 'util-status-vm',
    'gauge-fill-asce', 'gauge-val-asce', 'util-status-asce',
    'asce-w-val', 'asce-wt-val', 'asce-lim1-val', 'asce-lim2-val',
    'asce-fcr-val', 'asce-regime-val', 'asce-safety-val',
    'stress-bending-val', 'stress-axial-val', 'stress-torsion-val', 'stress-vm-val',
    'safety-factor-val', 'safety-status-val',
    'math-steps-container'
  ];
  
  ids.forEach(id => {
    el[id] = document.getElementById(id);
  });
}

function initEventListeners() {
  // Theme Toggle
  el['theme-toggle'].addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    const icon = el['theme-toggle'].querySelector('span');
    icon.textContent = state.theme === 'dark' ? 'light_mode' : 'dark_mode';
    calculateAndRender();
  });

  // Unit Toggle
  el['unit-toggle'].addEventListener('click', () => {
    state.unitSystem = state.unitSystem === 'metric' ? 'imperial' : 'metric';
    el['unit-toggle'].textContent = state.unitSystem === 'metric' ? 'Unit System: Metric' : 'Unit System: Imperial';
    convertInputsUnitSystem();
    updateUnitLabels();
    updateMaterialValues();
    calculateAndRender();
  });

  // Print Exporter
  el['print-btn'].addEventListener('click', () => {
    window.print();
  });

  // Sides Slider
  el['sides-slider'].addEventListener('input', (e) => {
    state.N = parseInt(e.target.value);
    el['sides-val'].textContent = state.N;
    calculateAndRender();
  });

  // Chips for Preset Shapes
  document.querySelectorAll('.preset-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelector('.preset-chips .chip.active')?.classList.remove('active');
      chip.classList.add('active');
      state.N = parseInt(chip.dataset.sides);
      el['sides-slider'].value = state.N;
      el['sides-val'].textContent = state.N;
      calculateAndRender();
    });
  });

  // Input Mode (Flat-to-Flat vs Corner-to-Corner)
  el['input-mode-flat'].addEventListener('click', () => {
    if (state.inputMode !== 'flat') {
      state.inputMode = 'flat';
      el['input-mode-corner'].classList.remove('active');
      el['input-mode-flat'].classList.add('active');
      el['dim-label'].textContent = 'Outer Width (flat-to-flat)';
      calculateAndRender();
    }
  });

  el['input-mode-corner'].addEventListener('click', () => {
    if (state.inputMode !== 'corner') {
      state.inputMode = 'corner';
      el['input-mode-flat'].classList.remove('active');
      el['input-mode-corner'].classList.add('active');
      el['dim-label'].textContent = 'Outer Diameter (corner-to-corner)';
      calculateAndRender();
    }
  });

  // Numeric Inputs
  const numericInputs = [
    { key: 'outerDimension', id: 'dim-input' },
    { key: 'thickness', id: 'thick-input' },
    { key: 'length', id: 'len-input' },
    { key: 'density', id: 'density-input' },
    { key: 'yieldStrength', id: 'yield-input' },
    { key: 'bendingMoment', id: 'moment-input' },
    { key: 'axialForce', id: 'axial-input' },
    { key: 'torsionalMoment', id: 'torsion-input' }
  ];

  numericInputs.forEach(item => {
    el[item.id].addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val <= 0) val = 0.1;
      state[item.key] = val;
      calculateAndRender();
    });
  });

  // Orientation Selector
  el['orient-select'].addEventListener('change', (e) => {
    state.orientationMode = e.target.value;
    if (state.orientationMode === 'custom') {
      el['angle-slider-container'].style.display = 'block';
    } else {
      el['angle-slider-container'].style.display = 'none';
    }
    calculateAndRender();
  });

  // Custom Angle Slider
  el['angle-slider'].addEventListener('input', (e) => {
    state.customAngle = parseFloat(e.target.value);
    el['angle-val'].textContent = state.customAngle + '°';
    calculateAndRender();
  });

  // Material Presets
  el['material-select'].addEventListener('change', (e) => {
    state.materialPreset = e.target.value;
    updateMaterialValues();
    calculateAndRender();
  });

  // Tab Switcher
  const tabs = ['visualizer', 'properties', 'design', 'math'];
  tabs.forEach(tab => {
    el[`tab-${tab}`].addEventListener('click', () => {
      document.querySelector('.tabs-nav .tab-btn.active').classList.remove('active');
      document.querySelector('.tab-content-wrapper .tab-panel.active').classList.remove('active');
      
      el[`tab-${tab}`].classList.add('active');
      el[`panel-${tab}`].classList.add('active');
      state.activeTab = tab;
      
      if (tab === 'visualizer') {
        // Redraw 3D Canvas since it might have layout shifts
        draw3D();
      }
    });
  });

  // Stress Overlay Toggle
  el['stress-toggle-elastic'].addEventListener('click', () => {
    state.stressVisualMode = 'elastic';
    el['stress-toggle-plastic'].classList.remove('active');
    el['stress-toggle-elastic'].classList.add('active');
    calculateAndRender();
  });

  el['stress-toggle-plastic'].addEventListener('click', () => {
    state.stressVisualMode = 'plastic';
    el['stress-toggle-elastic'].classList.remove('active');
    el['stress-toggle-plastic'].classList.add('active');
    calculateAndRender();
  });

  // 3D Canvas drag interactions
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  const dragStart = (x, y) => {
    isDragging = true;
    prevMouseX = x;
    prevMouseY = y;
  };

  const dragMove = (x, y) => {
    if (!isDragging) return;
    const dx = x - prevMouseX;
    const dy = y - prevMouseY;
    state.yaw += dx * 0.007;
    state.pitch += dy * 0.007;
    // Constrain pitch to avoid flipping upside down
    state.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, state.pitch));
    prevMouseX = x;
    prevMouseY = y;
    draw3D();
  };

  const dragEnd = () => { isDragging = false; };

  el['canvas3d'].addEventListener('mousedown', (e) => dragStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => dragMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', dragEnd);

  // Mobile touch support for 3D rotation
  el['canvas3d'].addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      dragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  });
  el['canvas3d'].addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      dragMove(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault(); // Stop scrolling
    }
  }, { passive: false });
  el['canvas3d'].addEventListener('touchend', dragEnd);
}

function updateUnitLabels() {
  const isM = state.unitSystem === 'metric';
  
  el['dim-unit'].textContent = isM ? 'mm' : 'in';
  el['thick-unit'].textContent = isM ? 'mm' : 'in';
  el['len-unit'].textContent = isM ? 'm' : 'ft';
  el['density-unit'].textContent = isM ? 'kg/m³' : 'lb/ft³';
  el['yield-unit'].textContent = isM ? 'MPa' : 'ksi';
  el['moment-unit'].textContent = isM ? 'kN·m' : 'kip·ft';
  el['axial-unit'].textContent = isM ? 'kN' : 'kips';
  el['torsion-unit'].textContent = isM ? 'kN·m' : 'kip·ft';
}

function updateMaterialValues() {
  const mat = materials[state.materialPreset];
  const isM = state.unitSystem === 'metric';
  
  if (state.materialPreset !== 'custom') {
    state.density = isM ? mat.densityMetric : mat.densityImperial;
    state.yieldStrength = isM ? mat.yieldMetric : mat.yieldImperial;
    
    el['density-input'].value = state.density;
    el['yield-input'].value = state.yieldStrength;
    el['density-input'].disabled = true;
    el['yield-input'].disabled = true;
  } else {
    el['density-input'].disabled = false;
    el['yield-input'].disabled = false;
  }
}

function convertInputsUnitSystem() {
  // Convert current input values between metric and imperial
  const isM = state.unitSystem === 'metric'; // note: this is the NEW unit system
  
  if (isM) {
    // Imperial to Metric
    state.outerDimension = Math.round(state.outerDimension * 25.4 * 10) / 10;
    state.thickness = Math.round(state.thickness * 25.4 * 10) / 10;
    state.length = Math.round(state.length * 0.3048 * 100) / 100;
    state.bendingMoment = Math.round(state.bendingMoment * 1.3558179 * 10) / 10;
    state.axialForce = Math.round(state.axialForce * 4.4482216 * 10) / 10;
    state.torsionalMoment = Math.round(state.torsionalMoment * 1.3558179 * 10) / 10;
  } else {
    // Metric to Imperial
    state.outerDimension = Math.round((state.outerDimension / 25.4) * 100) / 100;
    state.thickness = Math.round((state.thickness / 25.4) * 100) / 100;
    state.length = Math.round((state.length / 0.3048) * 10) / 10;
    state.bendingMoment = Math.round((state.bendingMoment / 1.3558179) * 10) / 10;
    state.axialForce = Math.round((state.axialForce / 4.4482216) * 10) / 10;
    state.torsionalMoment = Math.round((state.torsionalMoment / 1.3558179) * 10) / 10;
  }

  el['dim-input'].value = state.outerDimension;
  el['thick-input'].value = state.thickness;
  el['len-input'].value = state.length;
  el['moment-input'].value = state.bendingMoment;
  el['axial-input'].value = state.axialForce;
  el['torsion-input'].value = state.torsionalMoment;
}

// Coordinate clipping: Sutherland-Hodgman for y >= 0
function clipPolygonAboveXAxis(vertices) {
  const clipped = [];
  const n = vertices.length;
  if (n === 0) return [];
  
  for (let i = 0; i < n; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % n];
    
    const currentAbove = current.y >= 0;
    const nextAbove = next.y >= 0;
    
    if (currentAbove && nextAbove) {
      clipped.push({ x: next.x, y: next.y });
    } else if (currentAbove && !nextAbove) {
      const t = current.y / (current.y - next.y);
      const ix = current.x + t * (next.x - current.x);
      clipped.push({ x: ix, y: 0 });
    } else if (!currentAbove && nextAbove) {
      const t = current.y / (current.y - next.y);
      const ix = current.x + t * (next.x - current.x);
      clipped.push({ x: ix, y: 0 });
      clipped.push({ x: next.x, y: next.y });
    }
  }
  return clipped;
}

// Green's Theorem for Polygon Area, Centroid, and Second Moments
function getPolygonProperties(vertices) {
  const n = vertices.length;
  if (n < 3) return { area: 0, cx: 0, cy: 0, ix: 0, iy: 0 };
  
  let area = 0;
  let cx = 0;
  let cy = 0;
  let ix = 0;
  let iy = 0;
  
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    
    const factor = p1.x * p2.y - p2.x * p1.y;
    area += factor;
    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
    
    ix += (p1.y * p1.y + p1.y * p2.y + p2.y * p2.y) * factor;
    iy += (p1.x * p1.x + p1.x * p2.x + p2.x * p2.x) * factor;
  }
  
  area = area / 2.0;
  if (Math.abs(area) < 1e-15) {
    return { area: 0, cx: 0, cy: 0, ix: 0, iy: 0 };
  }
  
  cx = cx / (6.0 * area);
  cy = cy / (6.0 * area);
  
  ix = ix / 12.0;
  iy = iy / 12.0;
  
  const sign = Math.sign(area);
  const absArea = Math.abs(area);
  
  // Shift to Centroidal Axes using Parallel Axis Theorem
  let ix_c = Math.abs((ix - area * cy * cy) * sign);
  let iy_c = Math.abs((iy - area * cx * cx) * sign);
  
  return {
    area: absArea,
    cx: cx,
    cy: cy,
    ix: ix_c,
    iy: iy_c
  };
}

// Generate Vertices of a Regular Polygon Centered at (0, 0)
function generatePolygonVertices(N, R, thetaRad) {
  const vertices = [];
  for (let i = 0; i < N; i++) {
    const alpha = thetaRad + (i * 2 * Math.PI) / N;
    vertices.push({
      x: R * Math.cos(alpha),
      y: R * Math.sin(alpha)
    });
  }
  return vertices;
}

let calcResults = {}; // Global store for drawing sync

function calculateAndRender() {
  const N = state.N;
  const isM = state.unitSystem === 'metric';
  
  // Synchronize preset chips highlight with sides count
  document.querySelectorAll('.preset-chips .chip').forEach(chip => {
    if (parseInt(chip.dataset.sides) === N) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  
  // 1. Establish Geometry in System Base (SI: meters)
  let outerDim_m = 0;
  let thick_m = 0;
  if (isM) {
    outerDim_m = state.outerDimension / 1000;
    thick_m = state.thickness / 1000;
  } else {
    outerDim_m = state.outerDimension * 0.0254;
    thick_m = state.thickness * 0.0254;
  }
  
  const thetaRad = state.orientationMode === 'flat-up' ? (Math.PI / 2 - Math.PI / N) :
                   state.orientationMode === 'corner-up' ? (Math.PI / 2) :
                   (state.customAngle * Math.PI / 180);

  // Outer Circumradius Ro and Inradius ro
  let Ro_m = 0;
  let ro_m = 0;
  const cosPI_N = Math.cos(Math.PI / N);
  
  if (state.inputMode === 'flat') {
    ro_m = outerDim_m / 2;
    Ro_m = ro_m / cosPI_N;
  } else {
    Ro_m = outerDim_m / 2;
    ro_m = Ro_m * cosPI_N;
  }

  // Input Validation for Wall Thickness
  let validationError = false;
  if (thick_m >= ro_m) {
    validationError = true;
    el['thick-warning'].style.display = 'flex';
  } else {
    el['thick-warning'].style.display = 'none';
  }

  // Inner Inradius and Circumradius
  const ri_m = Math.max(0.0001, ro_m - thick_m);
  const Ri_m = ri_m / cosPI_N;

  // Generate 2D coordinates for integration
  const outerVertices = generatePolygonVertices(N, Ro_m, thetaRad);
  const innerVertices = generatePolygonVertices(N, Ri_m, thetaRad);

  // 2. Compute Solid Properties via Integrations
  const outerProps = getPolygonProperties(outerVertices);
  const innerProps = getPolygonProperties(innerVertices);

  // Tube Area & Moments
  const Area_m2 = outerProps.area - innerProps.area;
  const Ix_m4 = outerProps.ix - innerProps.ix;
  const Iy_m4 = outerProps.iy - innerProps.iy;
  const J_m4 = Ix_m4 + Iy_m4;
  const kx_m = Math.sqrt(Ix_m4 / Area_m2);
  const ky_m = Math.sqrt(Iy_m4 / Area_m2);

  // Distance to outermost fiber along bending plane (Y-axis)
  let ymax_m = 0;
  outerVertices.forEach(v => {
    if (Math.abs(v.y) > ymax_m) ymax_m = Math.abs(v.y);
  });
  
  // Section Moduli
  const S_m3 = Ix_m4 / ymax_m;

  // Plastic Section Moduli
  const outerClipped = clipPolygonAboveXAxis(outerVertices);
  const innerClipped = clipPolygonAboveXAxis(innerVertices);
  
  const outerClippedProps = getPolygonProperties(outerClipped);
  const innerClippedProps = getPolygonProperties(innerClipped);
  
  const Z_m3 = 2 * (outerClippedProps.area * outerClippedProps.cy - innerClippedProps.area * innerClippedProps.cy);

  // Bredt's Thin-Walled Torsion properties
  const Rm_m = (Ro_m + Ri_m) / 2;
  const rm_m = (ro_m + ri_m) / 2;
  const Am_m2 = N * rm_m * rm_m * Math.tan(Math.PI / N);
  const pm_m = 2 * N * rm_m * Math.tan(Math.PI / N);
  const Jt_m4 = (4 * Am_m2 * Am_m2 * thick_m) / pm_m;
  const Wt_m3 = 2 * Am_m2 * thick_m;

  // Perimeters
  const Po_m = 2 * N * ro_m * Math.tan(Math.PI / N);
  const Pi_m = 2 * N * ri_m * Math.tan(Math.PI / N);

  // Length and Weight calculations
  const len_m = isM ? state.length : state.length * 0.3048;
  const density_kg_m3 = isM ? state.density : state.density * 16.0185;
  const volume_m3 = Area_m2 * len_m;
  const mass_kg = volume_m3 * density_kg_m3;
  const mass_per_m = Area_m2 * density_kg_m3;

  // Storing computed values globally for rendering
  calcResults = {
    validationError,
    N, R_o: Ro_m, r_o: ro_m, R_i: Ri_m, r_i: ri_m, t: thick_m, L: len_m,
    Area: Area_m2, Ix: Ix_m4, Iy: Iy_m4, J: J_m4, kx: kx_m, ky: ky_m, ymax: ymax_m, S: S_m3, Z: Z_m3,
    Jt: Jt_m4, Wt: Wt_m3, Po: Po_m, Pi: Pi_m, Volume: volume_m3, Weight: mass_kg, WeightPerLength: mass_per_m,
    thetaRad
  };

  // 3. UI Display Output Conversions
  renderPropertiesCards();
  renderDesignChecks();
  renderStepByStepMath();
  
  // 4. Update Graphic Visualizations
  draw2DSVG();
  draw3D();
}

function renderPropertiesCards() {
  const isM = state.unitSystem === 'metric';
  const r = calcResults;

  // Unit text builders
  const areaUnit = isM ? 'cm²' : 'in²';
  const lenUnit = isM ? 'mm' : 'in';
  const inertiaUnit = isM ? 'cm⁴' : 'in⁴';
  const modUnit = isM ? 'cm³' : 'in³';
  
  // Multipliers from standard SI to Display units
  const areaFactor = isM ? 10000 : 1 / Math.pow(0.0254, 2);
  const lenFactor = isM ? 1000 : 1 / 0.0254;
  const inertiaFactor = isM ? 100000000 : 1 / Math.pow(0.0254, 4);
  const modFactor = isM ? 1000000 : 1 / Math.pow(0.0254, 3);
  
  const weightUnit = isM ? 'kg' : 'lb';
  const weightFactor = isM ? 1 : 2.20462;
  const wLUnit = isM ? 'kg/m' : 'lb/ft';
  const wLFactor = isM ? 1 : 2.20462 * 0.3048;

  // Format Helper
  const fmt = (val, dec = 2) => {
    if (r.validationError) return '—';
    return (val).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  
  const fmtSci = (val) => {
    if (r.validationError) return '—';
    if (val < 0.01) return val.toExponential(4);
    return fmt(val, 2);
  };

  // Card Content Data Mapping
  const cardData = {
    'val-area': { val: r.Area * areaFactor, unit: areaUnit },
    'val-ix': { val: r.Ix * inertiaFactor, unit: inertiaUnit },
    'val-iy': { val: r.Iy * inertiaFactor, unit: inertiaUnit },
    'val-j': { val: r.J * inertiaFactor, unit: inertiaUnit },
    'val-kx': { val: r.kx * lenFactor, unit: lenUnit },
    'val-ky': { val: r.ky * lenFactor, unit: lenUnit },
    'val-ymax': { val: r.ymax * lenFactor, unit: lenUnit },
    'val-s': { val: r.S * modFactor, unit: modUnit },
    'val-z': { val: r.Z * modFactor, unit: modUnit },
    'val-jt': { val: r.Jt * inertiaFactor, unit: inertiaUnit },
    'val-wt': { val: r.Wt * modFactor, unit: modUnit },
    'val-po': { val: r.Po * lenFactor, unit: lenUnit },
    'val-pi': { val: r.Pi * lenFactor, unit: lenUnit },
    'val-weight-len': { val: r.WeightPerLength * wLFactor, unit: wLUnit },
    'val-weight-total': { val: r.Weight * weightFactor, unit: weightUnit },
    'val-volume': { val: isM ? r.Volume : r.Volume * 35.3147, unit: isM ? 'm³' : 'ft³' }
  };

  for (const id in cardData) {
    const data = cardData[id];
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = `<span class="property-value">${fmtSci(data.val)}</span> <span class="property-unit">${data.unit}</span>`;
    }
  }
}

function renderDesignChecks() {
  const isM = state.unitSystem === 'metric';
  const r = calcResults;

  if (r.validationError) {
    el['gauge-fill-vm'].style.strokeDashoffset = 440;
    el['gauge-val-vm'].textContent = '—';
    el['util-status-vm'].textContent = 'INPUT ERROR';
    el['util-status-vm'].className = 'utilization-status warn';

    el['gauge-fill-asce'].style.strokeDashoffset = 440;
    el['gauge-val-asce'].textContent = '—';
    el['util-status-asce'].textContent = 'INPUT ERROR';
    el['util-status-asce'].className = 'utilization-status warn';
    return;
  }

  // 1. Establish Input Force Metrics in SI Base
  const moment_Nm = isM ? state.bendingMoment * 1000 : state.bendingMoment * 1355.8179;
  const axial_N = isM ? state.axialForce * 1000 : state.axialForce * 4448.2216;
  const torsion_Nm = isM ? state.torsionalMoment * 1000 : state.torsionalMoment * 1355.8179;
  const yield_Pa = isM ? state.yieldStrength * 1e6 : state.yieldStrength * 6.89476e6;
  const E_Pa = 200e9; // 200 GPa (29,000 ksi) for steel

  // Display conversions
  const stressDisplayFactor = isM ? 1e-6 : 1 / 6894760;
  const stressUnit = isM ? 'MPa' : 'ksi';
  const lenDisplayFactor = isM ? 1000 : 1 / 0.0254;
  const lenUnit = isM ? 'mm' : 'in';

  // ----------------------------------------------------
  // VON MISES YIELDING CHECK
  // ----------------------------------------------------
  const axialStress_Pa = axial_N / r.Area;
  const bendingStress_Pa = moment_Nm / r.S;
  const maxStress_Pa = Math.abs(axialStress_Pa) + bendingStress_Pa;
  const shearStress_Pa = torsion_Nm / r.Wt;

  // VM equivalent stress: S_vm = sqrt(S_max^2 + 3 * Tau^2)
  const vonMises_Pa = Math.sqrt(maxStress_Pa * maxStress_Pa + 3 * shearStress_Pa * shearStress_Pa);
  const vmUtilization = vonMises_Pa / yield_Pa;
  const vmSafetyFactor = vmUtilization > 0 ? 1 / vmUtilization : 999;
  const vmUtilPercent = Math.min(100, Math.round(vmUtilization * 100));

  // Render VM text values
  el['stress-bending-val'].textContent = (bendingStress_Pa * stressDisplayFactor).toFixed(1) + ' ' + stressUnit;
  el['stress-axial-val'].textContent = (axialStress_Pa * stressDisplayFactor).toFixed(1) + ' ' + stressUnit;
  el['stress-torsion-val'].textContent = (shearStress_Pa * stressDisplayFactor).toFixed(1) + ' ' + stressUnit;
  el['stress-vm-val'].textContent = (vonMises_Pa * stressDisplayFactor).toFixed(1) + ' ' + stressUnit;
  el['val-yield-check'].textContent = state.yieldStrength + ' ' + stressUnit;
  el['safety-factor-val'].textContent = vmSafetyFactor > 50 ? '> 50' : vmSafetyFactor.toFixed(2);

  // Render VM gauge
  const vmDashOffset = 440 - (440 * vmUtilPercent) / 100;
  el['gauge-fill-vm'].style.strokeDashoffset = vmDashOffset;
  el['gauge-val-vm'].textContent = vmUtilPercent + '%';

  let vmClass = 'pass';
  let vmStatus = 'SAFE';
  let vmGaugeColor = 'var(--accent)';
  if (vmUtilPercent >= 100) {
    vmClass = 'fail';
    vmStatus = 'YIELD FAILURE';
    vmGaugeColor = 'var(--danger)';
  } else if (vmUtilPercent > 85) {
    vmClass = 'warn';
    vmStatus = 'WARNING';
    vmGaugeColor = 'var(--warning)';
  }
  el['gauge-fill-vm'].style.stroke = vmGaugeColor;
  el['util-status-vm'].textContent = vmStatus;
  el['util-status-vm'].className = `utilization-status ${vmClass}`;
  el['safety-status-val'].textContent = vmStatus;
  el['safety-status-val'].className = vmClass;

  // ----------------------------------------------------
  // ASCE 48 STEEL DESIGN CODE CHECK
  // ----------------------------------------------------
  // 1. Calculate Clear Flat Width w of the side (with standard bend radius rb = 3t, total bend zone = 4t)
  const s_m = 2 * r.R_o * Math.sin(Math.PI / r.N);
  const T_bend_m = 4 * r.t * Math.tan(Math.PI / r.N);
  const w_flat_m = Math.max(0, s_m - 2 * T_bend_m);
  const wt_ratio = r.t > 0 ? w_flat_m / r.t : 0;

  // 2. Local Buckling allowable stress equations
  // Convert F_y to ksi units for standard empirical formulas
  const Fy_ksi = isM ? (state.yieldStrength / 6.89476) : state.yieldStrength;
  
  let W_lim1 = 240;
  let W_lim2 = 374;
  let C1 = 1.45;
  let C2 = 0.00129;
  let C3 = 104900;

  // Adjust coefficients based on number of sides (bend angles)
  if (r.N <= 8) {
    W_lim1 = 240;
    W_lim2 = 374;
    C1 = 1.45;
    C2 = 0.00129;
    C3 = 104900;
  } else if (r.N <= 12) {
    // 12-sided (dodecagonal)
    W_lim1 = 240;
    W_lim2 = 365;
    C1 = 1.57;
    C2 = 0.00238;
    C3 = 121000;
  } else {
    // 16-sided (hexdecagonal) or more
    W_lim1 = 240;
    W_lim2 = 365;
    C1 = 1.60;
    C2 = 0.0025;
    C3 = 125000;
  }

  const lim1 = W_lim1 / Math.sqrt(Fy_ksi);
  const lim2 = W_lim2 / Math.sqrt(Fy_ksi);

  let Fcr_ksi = Fy_ksi;
  let bucklingRegime = 'Compact';

  if (wt_ratio <= lim1) {
    Fcr_ksi = Fy_ksi;
    bucklingRegime = 'Compact (No local buckling)';
  } else if (wt_ratio <= lim2) {
    Fcr_ksi = Fy_ksi * (C1 - C2 * Math.sqrt(Fy_ksi) * wt_ratio);
    if (Fcr_ksi > Fy_ksi) Fcr_ksi = Fy_ksi;
    bucklingRegime = 'Non-Compact (Inelastic buckling)';
  } else {
    Fcr_ksi = C3 / (wt_ratio * wt_ratio);
    if (Fcr_ksi > Fy_ksi) Fcr_ksi = Fy_ksi;
    bucklingRegime = 'Slender (Elastic buckling)';
  }

  const Fcr_Pa = Fcr_ksi * 6.89476e6;
  const Fvt_Pa = 0.58 * yield_Pa; // ASCE 48 allowable shear limit

  // Combined Interaction Ratio: (f_a + f_b / F_cr)^2 + (f_v + f_t / F_vt)^2 <= 1.0
  const f_normal_Pa = Math.abs(axialStress_Pa) + bendingStress_Pa;
  const asceUR = Math.pow(f_normal_Pa / Fcr_Pa, 2) + Math.pow(shearStress_Pa / Fvt_Pa, 2);
  const asceUtilPercent = Math.min(100, Math.round(asceUR * 100));
  const asceSafetyMargin = asceUR > 0 ? (1 / asceUR).toFixed(2) : '> 50';

  // Render ASCE 48 UI elements
  el['asce-w-val'].textContent = (w_flat_m * lenDisplayFactor).toFixed(1) + ' ' + lenUnit;
  el['asce-wt-val'].textContent = wt_ratio.toFixed(1);
  el['asce-lim1-val'].textContent = lim1.toFixed(1);
  el['asce-lim2-val'].textContent = lim2.toFixed(1);
  el['asce-fcr-val'].textContent = (Fcr_Pa * stressDisplayFactor).toFixed(1) + ' ' + stressUnit;
  el['asce-regime-val'].textContent = bucklingRegime;
  el['asce-safety-val'].textContent = asceSafetyMargin;

  // Render ASCE gauge
  const asceDashOffset = 440 - (440 * asceUtilPercent) / 100;
  el['gauge-fill-asce'].style.strokeDashoffset = asceDashOffset;
  el['gauge-val-asce'].textContent = asceUtilPercent + '%';

  let asceClass = 'pass';
  let asceStatus = 'COMPLIANT';
  let asceGaugeColor = 'var(--accent)';
  if (asceUtilPercent >= 100) {
    asceClass = 'fail';
    asceStatus = 'ASCE BUCKLING FAILURE';
    asceGaugeColor = 'var(--danger)';
  } else if (asceUtilPercent > 85) {
    asceClass = 'warn';
    asceStatus = 'CODE WARNING';
    asceGaugeColor = 'var(--warning)';
  }
  el['gauge-fill-asce'].style.stroke = asceGaugeColor;
  el['util-status-asce'].textContent = asceStatus;
  el['util-status-asce'].className = `utilization-status ${asceClass}`;
}

function renderStepByStepMath() {
  const r = calcResults;
  if (r.validationError) {
    el['math-steps-container'].innerHTML = `
      <div class="info-alert">
        <span class="material-icons info-alert-icon">warning</span>
        <div>Please correct the wall thickness values to generate calculations.</div>
      </div>
    `;
    return;
  }

  const isM = state.unitSystem === 'metric';
  const unit = isM ? 'mm' : 'in';
  const unitSq = isM ? 'mm²' : 'in²';
  const unitCu = isM ? 'mm³' : 'in³';
  const unitQu = isM ? 'mm⁴' : 'in⁴';
  
  // Base display values in user units
  const outerFactor = isM ? 1000 : 1 / 0.0254;
  
  const N = r.N;
  const Ro_disp = r.R_o * outerFactor;
  const ro_disp = r.r_o * outerFactor;
  const Ri_disp = r.R_i * outerFactor;
  const ri_disp = r.r_i * outerFactor;
  const t_disp = r.t * outerFactor;
  
  const Area_disp = r.Area * Math.pow(outerFactor, 2);
  const Ix_disp = r.Ix * Math.pow(outerFactor, 4);
  const S_disp = r.S * Math.pow(outerFactor, 3);
  const Z_disp = r.Z * Math.pow(outerFactor, 3);

  let html = `
    <div class="derivation-card">
      <h3>Mathematical Derivation Breakdown</h3>
      <p style="margin-bottom:1.5rem; font-size:0.85rem; color:var(--text-muted);">
        All geometries are integrated using coordinate-based formulations, representing exact mathematical boundaries.
      </p>

      <!-- Geometry -->
      <div class="derivation-step">
        <div class="derivation-label">1. Outer & Inner Polygonal Radius</div>
        <div class="math-calc">
          <div>Number of sides: <strong>N = ${N}</strong></div>
          <div>Angle to flat: <strong>&phi; = &pi; / N = ${(180/N).toFixed(2)}°</strong></div>
          ${state.inputMode === 'flat' ? `
            <div>Outer Inradius (flat-to-center): <strong>r<sub>o</sub> = W<sub>o</sub> / 2 = ${ro_disp.toFixed(2)} ${unit}</strong></div>
            <div>Outer Circumradius (corner-to-center): <strong>R<sub>o</sub> = r<sub>o</sub> / cos(&pi;/N) = ${Ro_disp.toFixed(2)} ${unit}</strong></div>
          ` : `
            <div>Outer Circumradius (corner-to-center): <strong>R<sub>o</sub> = D<sub>o</sub> / 2 = ${Ro_disp.toFixed(2)} ${unit}</strong></div>
            <div>Outer Inradius (flat-to-center): <strong>r<sub>o</sub> = R<sub>o</sub> &middot; cos(&pi;/N) = ${ro_disp.toFixed(2)} ${unit}</strong></div>
          `}
          <div>Wall thickness: <strong>t = ${t_disp.toFixed(2)} ${unit}</strong></div>
          <div>Inner Inradius: <strong>r<sub>i</sub> = r<sub>o</sub> - t = ${ri_disp.toFixed(2)} ${unit}</strong></div>
          <div>Inner Circumradius: <strong>R<sub>i</sub> = r<sub>i</sub> / cos(&pi;/N) = ${Ri_disp.toFixed(2)} ${unit}</strong></div>
        </div>
      </div>

      <!-- Area -->
      <div class="derivation-step">
        <div class="derivation-label">2. Cross-Sectional Area (A)</div>
        <div class="math-formula">A = A<sub>outer</sub> - A<sub>inner</sub> = [ (N/2) &middot; R<sub>o</sub>² &middot; sin(2&pi;/N) ] - [ (N/2) &middot; R<sub>i</sub>² &middot; sin(2&pi;/N) ]</div>
        <div class="math-calc">
          <div>A<sub>outer</sub> = (${N}/2) &middot; (${Ro_disp.toFixed(2)})² &middot; sin(${(360/N).toFixed(1)}°) = <strong>${(outerProps.area * Math.pow(outerFactor, 2)).toFixed(1)} ${unitSq}</strong></div>
          <div>A<sub>inner</sub> = (${N}/2) &middot; (${Ri_disp.toFixed(2)})² &middot; sin(${(360/N).toFixed(1)}°) = <strong>${(innerProps.area * Math.pow(outerFactor, 2)).toFixed(1)} ${unitSq}</strong></div>
          <div>A = ${(outerProps.area * Math.pow(outerFactor, 2)).toFixed(1)} - ${(innerProps.area * Math.pow(outerFactor, 2)).toFixed(1)} = <strong>${Area_disp.toFixed(1)} ${unitSq}</strong></div>
        </div>
      </div>

      <!-- Moment of Inertia -->
      <div class="derivation-step">
        <div class="derivation-label">3. Moment of Inertia (I<sub>x</sub> = I<sub>y</sub>)</div>
        <div class="math-formula">I = I<sub>outer</sub> - I<sub>inner</sub> = [ (A<sub>outer</sub> &middot; R<sub>o</sub>²) / 12 ] &middot; [ 1 + 2 &middot; cos²(&pi;/N) ] - [ (A<sub>inner</sub> &middot; R<sub>i</sub>²) / 12 ] &middot; [ 1 + 2 &middot; cos²(&pi;/N) ]</div>
        <div class="math-calc">
          <div>Cos&phi; factor: <strong>[ 1 + 2 &middot; cos²(&pi;/${N}) ] = ${(1 + 2 * Math.pow(cosPI_N, 2)).toFixed(4)}</strong></div>
          <div>I<sub>outer</sub> = [ (${(outerProps.area * Math.pow(outerFactor, 2)).toFixed(1)} &middot; ${Ro_disp.toFixed(2)}²) / 12 ] &middot; ${(1 + 2 * Math.pow(cosPI_N, 2)).toFixed(4)} = <strong>${(outerProps.ix * Math.pow(outerFactor, 4)).toLocaleString(undefined, {maximumFractionDigits:0})} ${unitQu}</strong></div>
          <div>I<sub>inner</sub> = [ (${(innerProps.area * Math.pow(outerFactor, 2)).toFixed(1)} &middot; ${Ri_disp.toFixed(2)}²) / 12 ] &middot; ${(1 + 2 * Math.pow(cosPI_N, 2)).toFixed(4)} = <strong>${(innerProps.ix * Math.pow(outerFactor, 4)).toLocaleString(undefined, {maximumFractionDigits:0})} ${unitQu}</strong></div>
          <div>I<sub>x</sub> = I<sub>outer</sub> - I<sub>inner</sub> = <strong>${Ix_disp.toLocaleString(undefined, {maximumFractionDigits:0})} ${unitQu}</strong></div>
        </div>
      </div>

      <!-- Section Modulus -->
      <div class="derivation-step">
        <div class="derivation-label">4. Elastic Section Modulus (S<sub>x</sub>)</div>
        <div class="math-formula">S<sub>x</sub> = I<sub>x</sub> / y<sub>max</sub></div>
        <div class="math-calc">
          <div>Moment of Inertia (I<sub>x</sub>) = <strong>${Ix_disp.toLocaleString(undefined, {maximumFractionDigits:0})} ${unitQu}</strong></div>
          <div>Max fiber distance (y<sub>max</sub>) = <strong>${(r.ymax * outerFactor).toFixed(2)} ${unit}</strong></div>
          <div>S<sub>x</sub> = ${Ix_disp.toLocaleString(undefined, {maximumFractionDigits:0})} / ${(r.ymax * outerFactor).toFixed(2)} = <strong>${S_disp.toLocaleString(undefined, {maximumFractionDigits:0})} ${unitCu}</strong></div>
        </div>
      </div>

      <!-- Plastic Section Modulus -->
      <div class="derivation-step">
        <div class="derivation-label">5. Plastic Section Modulus (Z<sub>x</sub>)</div>
        <div class="math-formula">Z<sub>x</sub> = 2 &middot; &iint;<sub>y &ge; 0</sub> y &middot; dA = 2 &middot; [ A<sup>+</sup><sub>outer</sub> &middot; ȳ<sup>+</sup><sub>outer</sub> - A<sup>+</sup><sub>inner</sub> &middot; ȳ<sup>+</sup><sub>inner</sub> ]</div>
        <div class="math-calc">
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
            Calculated by clipping the top half of the outer and inner solid polygons at the neutral axis (y = 0):
          </div>
          <div>A<sup>+</sup><sub>outer</sub> &middot; ȳ<sup>+</sup><sub>outer</sub> = <strong>${(outerClippedProps.area * outerClippedProps.cy * Math.pow(outerFactor, 3)).toLocaleString(undefined, {maximumFractionDigits:0})} ${unitCu}</strong></div>
          <div>A<sup>+</sup><sub>inner</sub> &middot; ȳ<sup>+</sup><sub>inner</sub> = <strong>${(innerClippedProps.area * innerClippedProps.cy * Math.pow(outerFactor, 3)).toLocaleString(undefined, {maximumFractionDigits:0})} ${unitCu}</strong></div>
          <div>Z<sub>x</sub> = 2 &middot; [ ${(outerClippedProps.area * outerClippedProps.cy * Math.pow(outerFactor, 3)).toLocaleString(undefined, {maximumFractionDigits:0})} - ${(innerClippedProps.area * innerClippedProps.cy * Math.pow(outerFactor, 3)).toLocaleString(undefined, {maximumFractionDigits:0})} ] = <strong>${Z_disp.toLocaleString(undefined, {maximumFractionDigits:0})} ${unitCu}</strong></div>
          <div>Shape Factor (Z<sub>x</sub> / S<sub>x</sub>) = <strong>${(r.Z / r.S).toFixed(3)}</strong></div>
        </div>
      </div>

    </div>
  `;
  el['math-steps-container'].innerHTML = html;
}

// 2D SVG Rendering
function draw2DSVG() {
  const container = el['svg-container'];
  container.innerHTML = '';
  
  if (calcResults.validationError) {
    container.innerHTML = `<div style="color:var(--danger); font-size:0.85rem; text-align:center;">Cannot render: wall thickness exceeds polygon boundary.</div>`;
    return;
  }
  
  const w = container.clientWidth || 380;
  const h = 380;
  const center = w / 2;
  
  // Set scale factor to fit outer radius in the box with margin
  const margin = 55;
  const scale = (center - margin) / calcResults.R_o;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  
  // 1. Grid Axes
  const axisColor = 'var(--border-color)';
  const gridX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  gridX.setAttribute('x1', '10'); gridX.setAttribute('y1', center);
  gridX.setAttribute('x2', w - 10); gridX.setAttribute('y2', center);
  gridX.setAttribute('stroke', axisColor); gridX.setAttribute('stroke-dasharray', '4,4');
  svg.appendChild(gridX);
  
  const gridY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  gridY.setAttribute('x1', center); gridY.setAttribute('y1', '10');
  gridY.setAttribute('x2', center); gridY.setAttribute('y2', h - 10);
  gridY.setAttribute('stroke', axisColor); gridY.setAttribute('stroke-dasharray', '4,4');
  svg.appendChild(gridY);

  // Function to create string from point arrays
  const pointsStr = (pts) => pts.map(p => `${center + p.x * scale},${center - p.y * scale}`).join(' ');

  // 2. Outer and Inner Polygon Coordinates
  const outerPts = generatePolygonVertices(calcResults.N, calcResults.R_o, calcResults.thetaRad);
  const innerPts = generatePolygonVertices(calcResults.N, calcResults.R_i, calcResults.thetaRad);

  // 3. Hollow Tube Path (Even-Odd fill rule)
  const tubePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  const outerPathStr = 'M ' + outerPts.map(p => `${center + p.x * scale} ${center - p.y * scale}`).join(' L ') + ' Z';
  const innerPathStr = 'M ' + innerPts.map(p => `${center + p.x * scale} ${center - p.y * scale}`).join(' L ') + ' Z';
  
  tubePath.setAttribute('d', `${outerPathStr} ${innerPathStr}`);
  tubePath.setAttribute('fill', 'var(--primary-glow)');
  tubePath.setAttribute('fill-rule', 'evenodd');
  tubePath.setAttribute('stroke', 'var(--primary)');
  tubePath.setAttribute('stroke-width', '2.5');
  svg.appendChild(tubePath);

  // Draw Stress Overlays if active tab is Visualizer and overlay options are toggled
  const stressOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  stressOverlay.style.opacity = '0.7';
  
  if (state.activeTab === 'visualizer' && state.stressVisualMode) {
    const isElastic = state.stressVisualMode === 'elastic';
    const isM = state.unitSystem === 'metric';
    const yield_Pa = isM ? state.yieldStrength * 1e6 : state.yieldStrength * 6.89476e6;
    const moment_Nm = isM ? state.bendingMoment * 1000 : state.bendingMoment * 1355.8179;
    const axial_N = isM ? state.axialForce * 1000 : state.axialForce * 4448.2216;

    // Combined peak values for stress visual scale
    const axialStress = axial_N / calcResults.Area;
    const bendingStress = moment_Nm / calcResults.S;
    const peakStress = Math.abs(axialStress) + bendingStress;
    
    // Scale factor so that yield strength matches 45px extension width
    const stressScale = 45 / yield_Pa;
    
    // Draw stress blocks on the right side of the shape
    const rightMargin = center + calcResults.R_o * scale + 15;
    
    // Reference line
    const refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    refLine.setAttribute('x1', rightMargin); refLine.setAttribute('y1', center - calcResults.ymax * scale);
    refLine.setAttribute('x2', rightMargin); refLine.setAttribute('y2', center + calcResults.ymax * scale);
    refLine.setAttribute('stroke', 'var(--text-muted)');
    refLine.setAttribute('stroke-width', '1.5');
    stressOverlay.appendChild(refLine);

    if (isElastic) {
      // Elastic Stress (Linear)
      // Top stress (y = +ymax): compression (-) if moment is positive. Let's trace it.
      const topStress = axialStress - bendingStress;
      const bottomStress = axialStress + bendingStress;
      
      const topOffset = -topStress * stressScale; // negative stress is compression, shifts left/right
      const bottomOffset = -bottomStress * stressScale;
      
      const stressPathStr = `M ${rightMargin} ${center - calcResults.ymax * scale} 
                             L ${rightMargin + topOffset} ${center - calcResults.ymax * scale} 
                             L ${rightMargin + bottomOffset} ${center + calcResults.ymax * scale} 
                             L ${rightMargin} ${center + calcResults.ymax * scale} Z`;
      
      const sp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      sp.setAttribute('d', stressPathStr);
      sp.setAttribute('fill', peakStress > yield_Pa ? 'rgba(235, 94, 85, 0.25)' : 'rgba(160, 85, 45, 0.15)');
      sp.setAttribute('stroke', peakStress > yield_Pa ? 'var(--danger)' : 'var(--accent)');
      sp.setAttribute('stroke-width', '1.5');
      stressOverlay.appendChild(sp);
      
      // Label top stress
      const tLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tLabel.setAttribute('x', rightMargin + topOffset + (topOffset >= 0 ? 5 : -5));
      tLabel.setAttribute('y', center - calcResults.ymax * scale - 4);
      tLabel.setAttribute('text-anchor', topOffset >= 0 ? 'start' : 'end');
      tLabel.setAttribute('fill', 'var(--text-main)');
      tLabel.setAttribute('font-size', '9px');
      tLabel.setAttribute('font-family', 'var(--font-mono)');
      tLabel.textContent = `${(Math.abs(topStress) / 1e6).toFixed(1)} MPa`;
      stressOverlay.appendChild(tLabel);
      
      // Label bottom stress
      const bLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      bLabel.setAttribute('x', rightMargin + bottomOffset + (bottomOffset >= 0 ? 5 : -5));
      bLabel.setAttribute('y', center + calcResults.ymax * scale + 10);
      bLabel.setAttribute('text-anchor', bottomOffset >= 0 ? 'start' : 'end');
      bLabel.setAttribute('fill', 'var(--text-main)');
      bLabel.setAttribute('font-size', '9px');
      bLabel.setAttribute('font-family', 'var(--font-mono)');
      bLabel.textContent = `${(Math.abs(bottomStress) / 1e6).toFixed(1)} MPa`;
      stressOverlay.appendChild(bLabel);
    } else {
      // Plastic Stress (Blocks of +Fy and -Fy)
      const offsetTop = 45; // Max yield extension
      const offsetBottom = -45;
      
      const spTop = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      spTop.setAttribute('x', rightMargin);
      spTop.setAttribute('y', center - calcResults.ymax * scale);
      spTop.setAttribute('width', offsetTop);
      spTop.setAttribute('height', calcResults.ymax * scale);
      spTop.setAttribute('fill', 'rgba(235, 94, 85, 0.15)');
      spTop.setAttribute('stroke', 'var(--danger)');
      spTop.setAttribute('stroke-width', '1.5');
      stressOverlay.appendChild(spTop);
      
      const spBottom = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      spBottom.setAttribute('x', rightMargin + offsetBottom);
      spBottom.setAttribute('y', center);
      spBottom.setAttribute('width', Math.abs(offsetBottom));
      spBottom.setAttribute('height', calcResults.ymax * scale);
      spBottom.setAttribute('fill', 'rgba(160, 85, 45, 0.15)');
      spBottom.setAttribute('stroke', 'var(--accent)');
      spBottom.setAttribute('stroke-width', '1.5');
      stressOverlay.appendChild(spBottom);
    }
  }
  svg.appendChild(stressOverlay);

  // 4. Centroid Dot
  const centroid = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  centroid.setAttribute('cx', center);
  centroid.setAttribute('cy', center);
  centroid.setAttribute('r', '3.5');
  centroid.setAttribute('fill', 'var(--secondary)');
  centroid.setAttribute('stroke', 'var(--bg-app)');
  centroid.setAttribute('stroke-width', '1.5');
  svg.appendChild(centroid);

  // 5. Dimension Annotation Helper lines
  const dimColor = 'var(--text-muted)';
  
  // Outer flat width line
  const dLineY = center + calcResults.R_o * scale + 24;
  const dLineXLeft = center - calcResults.r_o * scale;
  const dLineXRight = center + calcResults.r_o * scale;
  
  const dimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  dimLine.setAttribute('x1', dLineXLeft); dimLine.setAttribute('y1', dLineY);
  dimLine.setAttribute('x2', dLineXRight); dimLine.setAttribute('y2', dLineY);
  dimLine.setAttribute('stroke', dimColor); dimLine.setAttribute('stroke-width', '1');
  svg.appendChild(dimLine);
  
  // Outer dimension arrow tips
  const arrowL = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrowL.setAttribute('d', `M ${dLineXLeft + 6} ${dLineY - 3} L ${dLineXLeft} ${dLineY} L ${dLineXLeft + 6} ${dLineY + 3}`);
  arrowL.setAttribute('fill', 'none'); arrowL.setAttribute('stroke', dimColor);
  svg.appendChild(arrowL);
  
  const arrowR = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrowR.setAttribute('d', `M ${dLineXRight - 6} ${dLineY - 3} L ${dLineXRight} ${dLineY} L ${dLineXRight - 6} ${dLineY + 3}`);
  arrowR.setAttribute('fill', 'none'); arrowR.setAttribute('stroke', dimColor);
  svg.appendChild(arrowR);

  // Dimension label
  const dimText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  dimText.setAttribute('x', center);
  dimText.setAttribute('y', dLineY - 6);
  dimText.setAttribute('text-anchor', 'middle');
  dimText.setAttribute('fill', 'var(--text-main)');
  dimText.setAttribute('font-size', '10px');
  dimText.setAttribute('font-weight', '600');
  dimText.setAttribute('font-family', 'var(--font-sans)');
  const dispVal = state.outerDimension;
  const dispUnit = state.unitSystem === 'metric' ? 'mm' : 'in';
  dimText.textContent = `${state.inputMode === 'flat' ? 'W' : 'D'} = ${dispVal} ${dispUnit}`;
  svg.appendChild(dimText);

  // Wall thickness indicator line (bottom-right edge)
  // Let's draw it on the right side horizontal axis
  const tLineXLeft = center + calcResults.r_i * scale;
  const tLineXRight = center + calcResults.r_o * scale;
  const tLineY = center;

  const tLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tLine.setAttribute('x1', tLineXLeft); tLine.setAttribute('y1', tLineY);
  tLine.setAttribute('x2', tLineXRight); tLine.setAttribute('y2', tLineY);
  tLine.setAttribute('stroke', 'var(--secondary)'); tLine.setAttribute('stroke-width', '1.5');
  svg.appendChild(tLine);
  
  const tText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  tText.setAttribute('x', (tLineXLeft + tLineXRight) / 2);
  tText.setAttribute('y', tLineY - 6);
  tText.setAttribute('text-anchor', 'middle');
  tText.setAttribute('fill', 'var(--secondary)');
  tText.setAttribute('font-size', '9px');
  tText.setAttribute('font-weight', '600');
  tText.setAttribute('font-family', 'var(--font-sans)');
  tText.textContent = `t=${state.thickness}`;
  svg.appendChild(tText);

  container.appendChild(svg);
}

// 3D Extrusion Rendering
function draw3D() {
  const canvas = el['canvas3d'];
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || 380;
  const h = 380;
  
  // Set resolution matches scale
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  
  ctx.clearRect(0, 0, w, h);
  
  if (calcResults.validationError) {
    ctx.font = '12px Inter';
    ctx.fillStyle = 'var(--danger)';
    ctx.textAlign = 'center';
    ctx.fillText('Cannot render: input errors present.', w / 2, h / 2);
    return;
  }

  const N = calcResults.N;
  const R_o = calcResults.R_o;
  const R_i = calcResults.R_i;
  const L = calcResults.L;
  const theta = calcResults.thetaRad;

  // Center axes of 3D projection
  const cx = w / 2;
  const cy = h / 2;

  // Automatically scaling depth projection
  const boxMax = Math.sqrt(R_o * R_o + (L / 2) * (L / 2));
  const scale = (0.35 * Math.min(w, h)) / boxMax;

  // Project 3D points
  const project = (x, y, z) => {
    // 1. Rotation on Y-axis (Yaw)
    const cosY = Math.cos(state.yaw);
    const sinY = Math.sin(state.yaw);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    
    // 2. Rotation on X-axis (Pitch)
    const cosX = Math.cos(state.pitch);
    const sinX = Math.sin(state.pitch);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    
    return {
      u: cx + scale * x1,
      v: cy - scale * y2,
      z: z2
    };
  };

  // Generate vertices in 3D: Front at z = -L/2, Back at z = L/2
  const OF_pts = []; // Outer Front
  const OB_pts = []; // Outer Back
  const IF_pts = []; // Inner Front
  const IB_pts = []; // Inner Back

  for (let i = 0; i < N; i++) {
    const alpha = theta + (i * 2 * Math.PI) / N;
    const ox = R_o * Math.cos(alpha);
    const oy = R_o * Math.sin(alpha);
    const ix = R_i * Math.cos(alpha);
    const iy = R_i * Math.sin(alpha);

    OF_pts.push(project(ox, oy, -L/2));
    OB_pts.push(project(ox, oy, L/2));
    IF_pts.push(project(ix, iy, -L/2));
    IB_pts.push(project(ix, iy, L/2));
  }

  // Create list of 3D polygonal faces for depth sorting
  const faces = [];

  // Helper for normal rotations
  const rotateNormalVec = (nx, ny, nz) => {
    const cosY = Math.cos(state.yaw);
    const sinY = Math.sin(state.yaw);
    const nx1 = nx * cosY - nz * sinY;
    const nz1 = nx * sinY + nz * cosY;
    
    const cosX = Math.cos(state.pitch);
    const sinX = Math.sin(state.pitch);
    const ny2 = ny * cosX - nz1 * sinX;
    const nz2 = ny * sinX + nz1 * cosX;
    
    return { x: nx1, y: ny2, z: nz2 };
  };

  // 1. Outer quads connecting Front to Back
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const normalAngle = theta + ((i + 0.5) * 2 * Math.PI) / N;
    const unrotatedNormal = { x: Math.cos(normalAngle), y: Math.sin(normalAngle), z: 0 };
    
    const pts = [OF_pts[i], OF_pts[next], OB_pts[next], OB_pts[i]];
    const depth = pts.reduce((sum, p) => sum + p.z, 0) / 4;
    
    faces.push({
      type: 'outer',
      points: pts,
      unrotatedNormal,
      depth
    });
  }

  // 2. Inner quads (inside the hollow cylinder, shaded darker)
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const normalAngle = theta + ((i + 0.5) * 2 * Math.PI) / N;
    const unrotatedNormal = { x: -Math.cos(normalAngle), y: -Math.sin(normalAngle), z: 0 };
    
    const pts = [IF_pts[i], IF_pts[next], IB_pts[next], IB_pts[i]];
    const depth = pts.reduce((sum, p) => sum + p.z, 0) / 4;
    
    faces.push({
      type: 'inner',
      points: pts,
      unrotatedNormal,
      depth
    });
  }

  // 3. Front cap (z = -L/2)
  const frontNormal = { x: 0, y: 0, z: -1 };
  const frontDepth = OF_pts.reduce((sum, p) => sum + p.z, 0) / N;
  faces.push({
    type: 'cap_front',
    outerPoints: OF_pts,
    innerPoints: IF_pts,
    unrotatedNormal: frontNormal,
    depth: frontDepth
  });

  // 4. Back cap (z = L/2)
  const backNormal = { x: 0, y: 0, z: 1 };
  const backDepth = OB_pts.reduce((sum, p) => sum + p.z, 0) / N;
  faces.push({
    type: 'cap_back',
    outerPoints: OB_pts,
    innerPoints: IB_pts,
    unrotatedNormal: backNormal,
    depth: backDepth
  });

  // Painter's Algorithm: Sort faces from back to front
  faces.sort((a, b) => b.depth - a.depth);

  // Directional Light Source vector in camera-space
  const lightVec = { x: -0.3, y: 0.5, z: -0.8 };
  // Normalize light
  const len = Math.sqrt(lightVec.x * lightVec.x + lightVec.y * lightVec.y + lightVec.z * lightVec.z);
  lightVec.x /= len; lightVec.y /= len; lightVec.z /= len;

  // Primary Theme Hues
  const themeHue = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hue')) || 224;

  // Render faces sequentially
  faces.forEach(face => {
    const rotNormal = rotateNormalVec(face.unrotatedNormal.x, face.unrotatedNormal.y, face.unrotatedNormal.z);
    
    // Half-Lambert lighting model mapping dot from [-1, 1] to [0.15, 1]
    const dot = rotNormal.x * lightVec.x + rotNormal.y * lightVec.y + rotNormal.z * lightVec.z;
    const brightness = 0.35 + 0.65 * Math.max(-1, Math.min(1, dot));

    if (face.type === 'outer') {
      // Shading Outer tube walls
      const sat = state.theme === 'dark' ? 40 : 50;
      const baseLight = state.theme === 'dark' ? 25 : 55;
      const lightness = baseLight + 30 * brightness;
      
      ctx.fillStyle = `hsl(${themeHue}, ${sat}%, ${lightness}%)`;
      ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(face.points[0].u, face.points[0].v);
      for (let k = 1; k < 4; k++) ctx.lineTo(face.points[k].u, face.points[k].v);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } 
    else if (face.type === 'inner') {
      // Hollow Interior wall (always dark ambient shading)
      const sat = state.theme === 'dark' ? 25 : 35;
      const baseLight = state.theme === 'dark' ? 12 : 35;
      const lightness = baseLight + 15 * brightness;
      
      ctx.fillStyle = `hsl(${themeHue}, ${sat}%, ${lightness}%)`;
      
      ctx.beginPath();
      ctx.moveTo(face.points[0].u, face.points[0].v);
      for (let k = 1; k < 4; k++) ctx.lineTo(face.points[k].u, face.points[k].v);
      ctx.closePath();
      ctx.fill();
    } 
    else if (face.type === 'cap_front' || face.type === 'cap_back') {
      // Render Hollow End Caps (Hollow rings with EvenOdd rule)
      const sat = state.theme === 'dark' ? 70 : 80;
      const baseLight = state.theme === 'dark' ? 40 : 45;
      const lightness = baseLight + 25 * brightness;
      
      ctx.fillStyle = `hsl(210, ${sat}%, ${lightness}%)`; // Highlight caps in primary accent blue
      ctx.strokeStyle = 'var(--primary)';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      
      // Outer polygon boundary path
      ctx.moveTo(face.outerPoints[0].u, face.outerPoints[0].v);
      for (let k = 1; k < N; k++) {
        ctx.lineTo(face.outerPoints[k].u, face.outerPoints[k].v);
      }
      ctx.closePath();
      
      // Inner polygon hole boundary path (reverse winding or handled by evenodd)
      ctx.moveTo(face.innerPoints[0].u, face.innerPoints[0].v);
      for (let k = 1; k < N; k++) {
        ctx.lineTo(face.innerPoints[k].u, face.innerPoints[k].v);
      }
      ctx.closePath();
      
      ctx.fill('evenodd');
      ctx.stroke();
    }
  });
}
