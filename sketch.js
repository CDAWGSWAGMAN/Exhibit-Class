let stars = [];
let trail = [];
let maxTrail = 260;

let started = false;
let motionRunning = false;
let audioEnabled = false;
let appStage = "intro"; // intro | lesson | exhibit

let synth;
let gainNode;
let filterNode;
let panner;
let reverb;
let analyser;

let ambientOsc;
let ambientGain;
let noise;
let noiseFilter;
let noiseGain;

let lessonSynth;
let lessonGain;
let lessonPanner;
let lessonFilter;

let objectSelect;
let eccentricitySlider;
let pitchSlider;
let volumeSlider;
let panSlider;
let speedSlider;
let stopButton;
let startAudioButton;
let modeButton;
let homeButton;

let exhibitMode = 0;
// 0 = visual only
// 1 = audio only
// 2 = visual + audio

const modeNames = ["Visual Only", "Audio Only", "Visual + Audio"];

const objects = {
  Earth: {
    a: 190,
    e: 0.08,
    baseFreq: 180,
    color: [110, 170, 255],
    size: 15,
  },
  Mars: {
    a: 225,
    e: 0.16,
    baseFreq: 145,
    color: [255, 135, 90],
    size: 13,
  },
  Comet: {
    a: 255,
    e: 0.56,
    baseFreq: 230,
    color: [175, 255, 235],
    size: 10,
  },
  Asteroid: {
    a: 165,
    e: 0.3,
    baseFreq: 200,
    color: [220, 220, 220],
    size: 8,
  },
};

let orbit = {
  name: "Earth",
  theta: 0,
  a: 190,
  e: 0.08,
  baseFreq: 180,
  color: [110, 170, 255],
  size: 15,
};

let lessonOrbit = {
  theta: 0,
  baseFreq: 190,
  isDisturbed: false,
};

function setup() {
  createCanvas(windowWidth, windowHeight);

  for (let i = 0; i < 320; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      alpha: random(70, 255),
      twinkle: random(0.01, 0.04),
    });
  }

  setupControls();
  applyPreset("Earth");
  updateExhibitText();

  document.getElementById("beginButton").addEventListener("click", beginIntroFlow);
  document.getElementById("playNormalBtn").addEventListener("click", () => playLessonExample(false));
  document.getElementById("playDisturbedBtn").addEventListener("click", () => playLessonExample(true));
  document.getElementById("continueBtn").addEventListener("click", continueToExhibit);
}

function setupControls() {
  const panel = select("#sidePanel");

  createControl(panel, "Space Object");
  objectSelect = createSelect();
  objectSelect.parent(panel);
  objectSelect.option("Earth");
  objectSelect.option("Mars");
  objectSelect.option("Comet");
  objectSelect.option("Asteroid");
  objectSelect.changed(() => applyPreset(objectSelect.value()));

  createControl(panel, "Orbit Shape");
  eccentricitySlider = createSlider(0.0, 0.8, 0.08, 0.01);
  eccentricitySlider.parent(panel);

  createControl(panel, "Pitch from Speed");
  pitchSlider = createSlider(0, 220, 95, 1);
  pitchSlider.parent(panel);

  createControl(panel, "Volume from Distance");
  volumeSlider = createSlider(0, 1, 0.58, 0.01);
  volumeSlider.parent(panel);

  createControl(panel, "Pan from Position");
  panSlider = createSlider(0, 1, 0.9, 0.01);
  panSlider.parent(panel);

  createControl(panel, "Orbit Speed");
  speedSlider = createSlider(0.2, 3, 1, 0.01);
  speedSlider.parent(panel);

  modeButton = createButton("Switch Comparison Mode");
  modeButton.parent(panel);
  modeButton.addClass("panel-btn");
  modeButton.mousePressed(cycleMode);

  startAudioButton = createButton("Start Audio");
  startAudioButton.parent(panel);
  startAudioButton.addClass("panel-btn");
  startAudioButton.mousePressed(startAudio);

  stopButton = createButton("Stop Audio");
  stopButton.parent(panel);
  stopButton.addClass("panel-btn");
  stopButton.mousePressed(stopAudio);

  homeButton = createButton("Back to Home");
  homeButton.parent(panel);
  homeButton.addClass("panel-btn");
  homeButton.mousePressed(returnHome);
}

function createControl(parent, labelText) {
  const block = createDiv();
  block.parent(parent);
  block.addClass("control-block");

  const label = createElement("label", labelText);
  label.parent(block);
}

async function beginIntroFlow() {
  if (!started) {
    await Tone.start();
    buildAudio();
    buildLessonAudio();
    started = true;
  }

  appStage = "lesson";
  document.getElementById("introOverlay").style.display = "none";
  document.getElementById("lessonOverlay").style.display = "flex";
}

function continueToExhibit() {
  stopLessonAudio();

  appStage = "exhibit";
  motionRunning = true;
  audioEnabled = exhibitMode !== 0;

  document.getElementById("lessonOverlay").style.display = "none";
  document.getElementById("listenPrompt").style.display = "block";
  document.getElementById("sidePanel").style.display = "block";
  document.getElementById("bottomBar").style.display = "grid";

  updateExhibitText();
  updateModeAudioState();
}

function returnHome() {
  stopAudio();
  stopLessonAudio();

  appStage = "intro";
  motionRunning = false;
  audioEnabled = false;
  exhibitMode = 0;

  orbit.theta = 0;
  lessonOrbit.theta = 0;
  lessonOrbit.isDisturbed = false;
  trail = [];

  if (gainNode) gainNode.gain.rampTo(0, 0.2);
  if (ambientGain) ambientGain.gain.rampTo(0, 0.5);
  if (noiseGain) noiseGain.gain.rampTo(0, 0.5);

  document.getElementById("introOverlay").style.display = "flex";
  document.getElementById("lessonOverlay").style.display = "none";
  document.getElementById("listenPrompt").style.display = "none";
  document.getElementById("sidePanel").style.display = "none";
  document.getElementById("bottomBar").style.display = "none";

  updateExhibitText();
}

function buildAudio() {
  synth = new Tone.Oscillator({
    type: "sine",
    frequency: orbit.baseFreq,
    volume: -12,
  });

  filterNode = new Tone.Filter({
    frequency: 900,
    type: "lowpass",
    rolloff: -24,
  });

  gainNode = new Tone.Gain(0);
  panner = new Tone.Panner(0);

  reverb = new Tone.Reverb({
    decay: 6,
    wet: 0.4,
  });

  analyser = new Tone.Analyser("waveform", 512);

  synth.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(reverb);
  reverb.toDestination();
  gainNode.connect(analyser);

  synth.start();

  ambientOsc = new Tone.Oscillator({
    type: "sine",
    frequency: 55,
    volume: -22,
  });

  ambientGain = new Tone.Gain(0);
  ambientOsc.connect(ambientGain);
  ambientGain.connect(reverb);
  ambientOsc.start();

  noise = new Tone.Noise("pink");
  noiseFilter = new Tone.Filter({
    frequency: 500,
    type: "lowpass",
    rolloff: -24,
  });

  noiseGain = new Tone.Gain(0);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(reverb);
  noise.start();
}

function buildLessonAudio() {
  lessonSynth = new Tone.Oscillator({
    type: "sine",
    frequency: 190,
    volume: -10,
  });

  lessonFilter = new Tone.Filter({
    frequency: 1000,
    type: "lowpass",
    rolloff: -24,
  });

  lessonGain = new Tone.Gain(0);
  lessonPanner = new Tone.Panner(0);

  lessonSynth.connect(lessonFilter);
  lessonFilter.connect(lessonGain);
  lessonGain.connect(lessonPanner);
  lessonPanner.connect(reverb);

  lessonSynth.start();
}

function stopLessonAudio() {
  if (lessonGain) {
    lessonGain.gain.rampTo(0, 0.2);
  }
}

function playLessonExample(isDisturbed) {
  if (!started || !lessonGain) return;

  lessonOrbit.theta = 0;
  lessonOrbit.isDisturbed = isDisturbed;

  lessonGain.gain.rampTo(0.18, 0.2);

  const feedback = document.getElementById("lessonFeedback");
  if (isDisturbed) {
    feedback.textContent =
      "Disturbed satellite: it has a brief course-correction wobble. The path changes only slightly, but the sound shifts more clearly.";
  } else {
    feedback.textContent =
      "Normal satellite: smooth and stable. Compare this sound to the disturbed version.";
  }

  setTimeout(() => {
    if (lessonGain) lessonGain.gain.rampTo(0, 0.5);
  }, 6500);
}

function applyPreset(name) {
  const obj = objects[name];
  orbit.name = name;
  orbit.theta = 0;
  orbit.a = obj.a;
  orbit.e = obj.e;
  orbit.baseFreq = obj.baseFreq;
  orbit.color = obj.color;
  orbit.size = obj.size;

  if (eccentricitySlider) {
    eccentricitySlider.value(obj.e);
  }

  trail = [];
}

function startAudio() {
  if (!started || !gainNode) return;
  audioEnabled = true;
  updateModeAudioState();
}

function stopAudio() {
  audioEnabled = false;

  if (gainNode) gainNode.gain.rampTo(0, 0.3);
  if (ambientGain) ambientGain.gain.rampTo(0, 1);
  if (noiseGain) noiseGain.gain.rampTo(0, 1);
}

function cycleMode() {
  exhibitMode = (exhibitMode + 1) % 3;
  updateExhibitText();
  updateModeAudioState();
}

function updateExhibitText() {
  const modeStatus = document.getElementById("modeStatus");
  const challengeText = document.getElementById("challengeText");
  const whyItMatters = document.getElementById("whyItMatters");

  modeStatus.textContent = `Current mode: ${modeNames[exhibitMode]}`;

  if (exhibitMode === 0) {
    challengeText.textContent =
      "Start by watching the orbit. Can you tell exactly when the object speeds up most near the sun using visuals alone?";
    whyItMatters.textContent =
      "Visuals show motion, but subtle changes over time can be hard to judge precisely with sight alone.";
  } else if (exhibitMode === 1) {
    challengeText.textContent =
      "Now listen without the orbit visible. Can you hear when the object speeds up, gets closer, or shifts position?";
    whyItMatters.textContent =
      "Audio can make motion, intensity, and timing easier to notice, even when visual detail is removed.";
  } else {
    challengeText.textContent =
      "Now combine sight and sound. Which moments become easiest to understand when both work together?";
    whyItMatters.textContent =
      "Sonification matters because it adds another channel for understanding change, helping patterns stand out more clearly.";
  }
}

function updateModeAudioState() {
  if (!gainNode || !started) return;

  if (!motionRunning) {
    gainNode.gain.rampTo(0, 0.2);
    if (ambientGain) ambientGain.gain.rampTo(0, 0.8);
    if (noiseGain) noiseGain.gain.rampTo(0, 0.8);
    return;
  }

  if (!audioEnabled) {
    gainNode.gain.rampTo(0, 0.2);
    if (ambientGain) ambientGain.gain.rampTo(0, 0.8);
    if (noiseGain) noiseGain.gain.rampTo(0, 0.8);
    return;
  }

  if (exhibitMode === 0) {
    gainNode.gain.rampTo(0, 0.2);
    if (ambientGain) ambientGain.gain.rampTo(0, 0.8);
    if (noiseGain) noiseGain.gain.rampTo(0, 0.8);
  } else {
    gainNode.gain.rampTo(0.28, 0.3);
    if (ambientGain) ambientGain.gain.rampTo(0.12, 1.2);
    if (noiseGain) noiseGain.gain.rampTo(0.05, 1.2);
  }
}

function draw() {
  drawBackground();

  if (appStage === "lesson") {
    drawLessonScene();
    updateLessonAudio();
    return;
  }

  if (appStage !== "exhibit") {
    return;
  }

  const cx = width * 0.42;
  const cy = height * 0.5;

  orbit.e = eccentricitySlider.value();
  const pos = getOrbitPosition(cx, cy);

  if (motionRunning) {
    updateOrbit(pos.rNorm);

    if (audioEnabled && exhibitMode !== 0) {
      updateSound(pos);
    }
  }

  if (ambientOsc && audioEnabled) {
    let slowDrift = 55 + sin(frameCount * 0.002) * 4;
    ambientOsc.frequency.rampTo(slowDrift, 0.5);
  }

  if (noiseFilter && audioEnabled) {
    let filterDrift = 400 + sin(frameCount * 0.003) * 120;
    noiseFilter.frequency.rampTo(filterDrift, 0.5);
  }

  if (exhibitMode !== 1) {
    drawOrbitSystem(cx, cy, pos);
    drawDataReadout(pos);
  } else {
    drawAudioOnlyView();
  }

  if (exhibitMode !== 0 && audioEnabled) {
    drawWaveform();
  }
}

function drawBackground() {
  background(3, 7, 18);

  noStroke();
  for (const star of stars) {
    let a = star.alpha + sin(frameCount * star.twinkle) * 30;
    fill(255, 255, 255, a);
    circle(star.x, star.y, star.size);
  }

  fill(60, 100, 255, 12);
  circle(width * 0.25, height * 0.28, 260);
  circle(width * 0.55, height * 0.2, 180);
  circle(width * 0.33, height * 0.7, 220);
}

function drawLessonScene() {
  const cx = width / 2;
  const cy = height * 0.68;
  const a = 210;
  const e = 0.12;

  lessonOrbit.theta += 0.018;

  let r = (a * (1 - e * e)) / (1 + e * cos(lessonOrbit.theta));
  let x = cx + r * cos(lessonOrbit.theta);
  let y = cy + r * sin(lessonOrbit.theta) * 0.75;

  let disturbedX = x;
  let disturbedY = y;

  let disturbanceZone = lessonOrbit.theta > 1.0 && lessonOrbit.theta < 1.45;
  if (disturbanceZone) {
    disturbedY += sin(frameCount * 0.45) * 4;
    disturbedX += sin(frameCount * 0.3) * 2;
  }

  noFill();
  strokeWeight(1.5);

  stroke(140, 210, 255, 180);
  ellipse(cx, cy, a * 2.25, a * 2.25 * 0.75);

  stroke(255, 170, 170, 185);
  beginShape();
  for (let t = 0; t < TWO_PI; t += 0.03) {
    let rr = (a * (1 - e * e)) / (1 + e * cos(t));
    let px = cx + rr * cos(t);
    let py = cy + rr * sin(t) * 0.75;

    if (t > 1.0 && t < 1.45) {
      py += sin(t * 18) * 4;
      px += sin(t * 12) * 2;
    }

    vertex(px, py);
  }
  endShape(CLOSE);

  noStroke();
  fill(255, 210, 90, 230);
  circle(cx, cy, 34);
  fill(255, 210, 90, 45);
  circle(cx, cy, 78);

  strokeWeight(1.6);
  stroke(170, 225, 255, 90);
  line(cx, cy, x, y);

  stroke(255, 190, 190, 90);
  line(cx, cy, disturbedX, disturbedY);

  noStroke();

  fill(120, 210, 255, 45);
  circle(x, y, 54);
  fill(120, 210, 255, 90);
  circle(x, y, 34);
  fill(170, 235, 255, 255);
  circle(x, y, 20);

  fill(255, 150, 150, 45);
  circle(disturbedX, disturbedY, 54);
  fill(255, 150, 150, 90);
  circle(disturbedX, disturbedY, 34);
  fill(255, 210, 210, 255);
  circle(disturbedX, disturbedY, 20);

  fill(255, 255, 255, 255);
  circle(x, y, 6);
  circle(disturbedX, disturbedY, 6);

  fill(220, 235, 255, 180);
  textAlign(CENTER, CENTER);
  textSize(22);
  text("Satellite Orbit Visualization", width / 2, height * 0.30);

  textSize(13);
  fill(190, 210, 255, 170);
  text(
    "These two paths are nearly identical. The disturbed satellite shifts only slightly in one region.",
    width / 2,
    height * 0.35
  );

  textAlign(LEFT, CENTER);
  textSize(15);

  fill(170, 235, 255, 255);
  text("Normal Satellite", cx + a * 1.15, cy - 42);

  fill(255, 205, 205, 255);
  text("Disturbed Satellite", cx + a * 1.15, cy - 18);

  noFill();
  stroke(255, 255, 255, 70);
  strokeWeight(1);
  ellipse(cx + 60, cy + 135, 92, 56);

  noStroke();
  fill(255, 255, 255, 150);
  textSize(12);
  textAlign(CENTER, CENTER);
  text("tiny difference zone", cx + 60, cy + 172);

  textSize(14);
  fill(220, 235, 255, 190);
  textAlign(CENTER, CENTER);
  text(
    lessonOrbit.isDisturbed
      ? "Currently playing: Disturbed Satellite"
      : "Currently playing: Normal Satellite",
    width / 2,
    height * 0.41
  );
}

function updateLessonAudio() {
  if (!lessonSynth || !lessonGain) return;

  let base = lessonOrbit.baseFreq;
  let freq = base + sin(frameCount * 0.03) * 6;
  let pan = sin(frameCount * 0.01) * 0.45;
  let filterFreq = 900 + sin(frameCount * 0.02) * 120;

  let disturbanceZone = lessonOrbit.theta > 1.0 && lessonOrbit.theta < 1.45;
  if (lessonOrbit.isDisturbed && disturbanceZone) {
    freq += sin(frameCount * 0.45) * 18 + 20;
    pan += sin(frameCount * 0.18) * 0.12;
    filterFreq += 250;
  }

  lessonSynth.frequency.rampTo(freq, 0.05);
  lessonPanner.pan.rampTo(pan, 0.08);
  lessonFilter.frequency.rampTo(filterFreq, 0.08);
}

function getOrbitPosition(cx, cy) {
  const a = orbit.a;
  const e = orbit.e;

  const r = (a * (1 - e * e)) / (1 + e * cos(orbit.theta));
  const x = cx + r * cos(orbit.theta);
  const y = cy + r * sin(orbit.theta) * 0.75;

  const perihelion = a * (1 - e);
  const aphelion = a * (1 + e);

  const rNorm = constrain(map(r, perihelion, aphelion, 0, 1), 0, 1);
  const speedApprox = 1.15 - rNorm;
  const xNorm = constrain(map(x, cx - aphelion, cx + aphelion, -1, 1), -1, 1);

  return { x, y, r, rNorm, speedApprox, xNorm, perihelion, aphelion };
}

function updateOrbit(rNorm) {
  const speed = speedSlider.value();
  const localStep = map(rNorm, 0, 1, 0.045, 0.012);
  orbit.theta += localStep * speed;

  if (orbit.theta > TWO_PI) orbit.theta -= TWO_PI;
}

function updateSound(pos) {
  if (!synth || !gainNode || !filterNode || !panner) return;

  const pitchAmount = pitchSlider.value();
  const volumeAmount = volumeSlider.value();
  const panAmount = panSlider.value();

  const freq =
    orbit.baseFreq + pos.speedApprox * pitchAmount + sin(frameCount * 0.01) * 3;
  const targetVol = 0.08 + (1 - pos.rNorm) * volumeAmount * 0.45;
  const targetPan = pos.xNorm * panAmount;
  const filterFreq = map(pos.speedApprox, 0, 1.2, 500, 1800);

  synth.frequency.rampTo(freq, 0.08);
  panner.pan.rampTo(targetPan, 0.12);
  filterNode.frequency.rampTo(filterFreq, 0.12);

  if (audioEnabled && exhibitMode !== 0) {
    gainNode.gain.rampTo(targetVol, 0.12);
  }
}

function drawOrbitSystem(cx, cy, pos) {
  const aphelion = pos.aphelion;
  const orbitW = aphelion * 2;
  const orbitH = aphelion * 2 * 0.75;

  noFill();
  stroke(120, 150, 255, 55);
  strokeWeight(1.5);
  ellipse(cx, cy, orbitW, orbitH);

  noStroke();
  fill(255, 210, 90, 230);
  circle(cx, cy, 34);
  fill(255, 210, 90, 45);
  circle(cx, cy, 78);
  fill(255, 210, 90, 18);
  circle(cx, cy, 120);

  trail.push({ x: pos.x, y: pos.y });
  if (trail.length > maxTrail) trail.shift();

  noFill();
  beginShape();
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const a = map(i, 0, trail.length - 1, 8, 180);
    stroke(orbit.color[0], orbit.color[1], orbit.color[2], a);
    strokeWeight(2);
    vertex(p.x, p.y);
  }
  endShape();

  stroke(190, 220, 255, 35);
  strokeWeight(1);
  line(cx, cy, pos.x, pos.y);

  noStroke();
  fill(orbit.color[0], orbit.color[1], orbit.color[2], 235);
  circle(pos.x, pos.y, orbit.size * 2);

  fill(orbit.color[0], orbit.color[1], orbit.color[2], 45);
  circle(pos.x, pos.y, orbit.size * 4.3);

  noFill();
  stroke(180, 220, 255, 70);
  strokeWeight(1.5);
  circle(pos.x, pos.y, orbit.size * 3 + sin(frameCount * 0.08) * 5);
}

function drawDataReadout(pos) {
  const x = 24;
  const y = height - 158;
  const w = 360;
  const h = 118;

  noStroke();
  fill(8, 15, 30, 175);
  rect(x, y, w, h, 18);

  fill(235, 245, 255);
  textSize(18);
  textAlign(LEFT, TOP);
  text(orbit.name + " Live Data", x + 16, y + 12);

  textSize(13);
  fill(190, 210, 255);
  text(`Speed → Pitch: ${nf(pos.speedApprox, 1, 2)}`, x + 16, y + 44);
  text(`Distance → Volume: ${nf(pos.r, 1, 2)}`, x + 16, y + 66);
  text(`Position → Pan: ${nf(pos.xNorm, 1, 2)}`, x + 16, y + 88);
}

function drawAudioOnlyView() {
  fill(255, 255, 255, 160);
  textAlign(CENTER, CENTER);
  textSize(26);
  text("Audio-Only Listening Mode", width / 2, height / 2 - 20);

  textSize(15);
  fill(190, 210, 255, 180);
  text(
    "Listen for shifts in pitch, loudness, and stereo movement.",
    width / 2,
    height / 2 + 20
  );
}

function drawWaveform() {
  const panelX = width * 0.56;
  const panelY = height - 150;
  const panelW = width * 0.4;
  const panelH = 110;

  noStroke();
  fill(8, 15, 30, 150);
  rect(panelX, panelY, panelW, panelH, 18);

  if (!started || !analyser || !audioEnabled) return;

  const values = analyser.getValue();

  noFill();
  stroke(120, 220, 255);
  strokeWeight(2);
  beginShape();

  for (let i = 0; i < values.length; i++) {
    const x = map(i, 0, values.length - 1, panelX + 12, panelX + panelW - 12);
    const y = map(values[i], -1, 1, panelY + panelH - 16, panelY + 16);
    vertex(x, y);
  }

  endShape();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}