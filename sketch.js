let stars = [];
let trail = [];
let maxTrail = 260;

let started = false;
let motionRunning = false;
let audioEnabled = false;

let appStage = "welcome";
// welcome | visual1 | visual2 | audio | reveal | sandbox

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

let compareSynth;
let compareGain;
let comparePanner;
let compareFilter;

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

let visual1Guess = null;
let visual2Guess = null;
let audioGuess = null;
let lastPlayedSignal = null;

const DISTURBED_SIGNAL = "B";

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
  setupStageUI();
  renderStageCard();
  updateExhibitText();
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

function choiceButton(key, title, subtitle, action, secondary = false) {
  return `
    <button class="stage-btn ${secondary ? "secondary" : ""}" data-action="${action}">
      <span class="choice-key">${key}</span>
      <span class="choice-title">${title}</span>
      ${subtitle ? `<span class="choice-subtitle">${subtitle}</span>` : ""}
    </button>
  `;
}

function setupStageUI() {
  document.getElementById("stageButtons").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;

    if (!started && action !== "next_welcome") {
      await ensureAudio();
    }

    switch (action) {
      case "next_welcome":
        await ensureAudio();
        appStage = "visual1";
        break;

      case "guess_visual1_A":
        visual1Guess = "A";
        setFeedback("You chose A. Now try a different visual form.");
        appStage = "visual2";
        break;

      case "guess_visual1_B":
        visual1Guess = "B";
        setFeedback("You chose B. Now see whether another visual makes the anomaly clearer.");
        appStage = "visual2";
        break;

      case "guess_visual1_unsure":
        visual1Guess = "Unsure";
        setFeedback("That's fair. Try one more visual representation.");
        appStage = "visual2";
        break;

      case "guess_visual2_A":
        visual2Guess = "A";
        setFeedback("You made a choice. Now try listening.");
        appStage = "audio";
        break;

      case "guess_visual2_B":
        visual2Guess = "B";
        setFeedback("You made a choice. Now try listening.");
        appStage = "audio";
        break;

      case "guess_visual2_unsure":
        visual2Guess = "Unsure";
        setFeedback("Still unclear visually. Now compare the audio.");
        appStage = "audio";
        break;

      case "play_A":
        playComparisonSignal("A");
        break;

      case "play_B":
        playComparisonSignal("B");
        break;

      case "guess_audio_A":
        audioGuess = "A";
        appStage = "reveal";
        break;

      case "guess_audio_B":
        audioGuess = "B";
        appStage = "reveal";
        break;

      case "reveal_continue":
        enterSandbox();
        return;

      case "restart_home":
        returnHome();
        return;
    }

    renderStageCard();
  });
}

async function ensureAudio() {
  if (started) return;
  await Tone.start();
  buildSandboxAudio();
  buildComparisonAudio();
  started = true;
}

function setFeedback(text) {
  document.getElementById("stageFeedback").textContent = text;
}

function updateProgressTracker() {
  const tracker = document.getElementById("progressTracker");
  const step = document.getElementById("progressStep");
  const label = document.getElementById("progressLabel");
  const fill = document.getElementById("progressBarFill");

  if (appStage === "welcome" || appStage === "sandbox") {
    tracker.style.display = "none";
    return;
  }

  tracker.style.display = "flex";

  if (appStage === "visual1") {
    step.textContent = "Step 1 of 4";
    label.textContent = "Visual";
    fill.style.width = "25%";
  } else if (appStage === "visual2") {
    step.textContent = "Step 2 of 4";
    label.textContent = "Telemetry";
    fill.style.width = "50%";
  } else if (appStage === "audio") {
    step.textContent = "Step 3 of 4";
    label.textContent = "Audio";
    fill.style.width = "75%";
  } else if (appStage === "reveal") {
    step.textContent = "Step 4 of 4";
    label.textContent = "Reveal";
    fill.style.width = "100%";
  }
}

function renderStageCard() {
  const eyebrow = document.getElementById("stageEyebrow");
  const title = document.getElementById("stageTitle");
  const body = document.getElementById("stageBody");
  const hint = document.getElementById("stageHint");
  const buttons = document.getElementById("stageButtons");
  const feedback = document.getElementById("stageFeedback");

  feedback.textContent = "";

  if (appStage === "sandbox") {
    document.getElementById("stageOverlay").style.display = "none";
    updateProgressTracker();
    return;
  }

  document.getElementById("stageOverlay").style.display = "flex";

  if (appStage === "welcome") {
    eyebrow.textContent = "Guided Investigation";
    title.textContent = "Can You Detect the Anomaly?";
    body.textContent =
      "A satellite experienced a subtle course correction. Your job is to figure out which signal contains the disturbance.";
    hint.textContent =
      "You will first inspect visual data, then compare that to what sonification reveals.";
    buttons.innerHTML = `
      ${choiceButton("Start", "Begin Investigation", "Enter the guided anomaly test.", "next_welcome")}
    `;
  }

  if (appStage === "visual1") {
    eyebrow.textContent = "Signal Comparison";
    title.textContent = "Attempt 1: Orbit View";
    body.textContent =
      "Below are two satellite traces, A and B. One contains a subtle anomaly. Which one looks different?";
    hint.textContent =
      "This is meant to feel ambiguous. Pick the one you think contains the disturbance.";
    buttons.innerHTML = `
      ${choiceButton("Option A", "Choose Signal A", "This orbit looks more suspicious.", "guess_visual1_A", true)}
      ${choiceButton("Option B", "Choose Signal B", "This orbit looks more suspicious.", "guess_visual1_B", true)}
      ${choiceButton("Fallback", "Not Sure", "The difference is not visually obvious yet.", "guess_visual1_unsure")}
    `;
  }

  if (appStage === "visual2") {
    eyebrow.textContent = "Signal Comparison";
    title.textContent = "Attempt 2: Telemetry View";
    body.textContent =
      "Now look at the same event as time-based data. Can you tell more clearly which signal contains the anomaly?";
    hint.textContent =
      "Try again, even if you are unsure. This step is about discovering the limits of visual inspection.";
    buttons.innerHTML = `
      ${choiceButton("Option A", "Choose Signal A", "Telemetry makes A look more unusual.", "guess_visual2_A", true)}
      ${choiceButton("Option B", "Choose Signal B", "Telemetry makes B look more unusual.", "guess_visual2_B", true)}
      ${choiceButton("Fallback", "Not Sure", "The visual evidence is still subtle.", "guess_visual2_unsure")}
    `;
  }

  if (appStage === "audio") {
    eyebrow.textContent = "Sonification Test";
    title.textContent = "Attempt 3: Listen";
    body.textContent =
      "Now listen to each signal. Which one contains the anomaly?";
    hint.textContent =
      "Play A and B as many times as you need. Listen for a brief wobble or irregular pulse.";
    buttons.innerHTML = `
      ${choiceButton("Playback", "Play Signal A", "Listen to the first sonified pattern.", "play_A", true)}
      ${choiceButton("Playback", "Play Signal B", "Listen to the second sonified pattern.", "play_B", true)}
      ${choiceButton("Decision", "Choose Signal A", "I think A contains the anomaly.", "guess_audio_A", true)}
      ${choiceButton("Decision", "Choose Signal B", "I think B contains the anomaly.", "guess_audio_B")}
    `;
    if (lastPlayedSignal) {
      feedback.textContent = `Last played: Signal ${lastPlayedSignal}`;
    }
  }

  if (appStage === "reveal") {
    const correct = audioGuess === DISTURBED_SIGNAL;
    eyebrow.textContent = "Reveal";
    title.textContent = correct ? "There’s the Difference." : "Reveal";
    body.textContent = correct
      ? "Signal B contained the anomaly. The disturbed signal includes a brief irregular motion change that is hard to identify visually, but easier to detect through sound."
      : "Signal B contained the anomaly. Even when the visual difference is minimal, sonification can make subtle changes in time-based data easier to detect.";
    hint.textContent =
      "This is the core idea of the exhibit: sound can reveal patterns and anomalies that are difficult to decipher with visuals alone.";
    buttons.innerHTML = `
      ${choiceButton("Next", "Enter Interactive Exhibit", "Move from the guided sequence into exploration.", "reveal_continue")}
      ${choiceButton("Reset", "Back to Home", "Restart the full guided experience.", "restart_home", true)}
    `;
  }

  updateProgressTracker();
}

function enterSandbox() {
  appStage = "sandbox";
  motionRunning = true;
  audioEnabled = exhibitMode !== 0;

  document.getElementById("stageOverlay").style.display = "none";
  document.getElementById("challengePanel").style.display = "block";
  document.getElementById("sidePanel").style.display = "block";
  document.getElementById("bottomBar").style.display = "grid";

  updateExhibitText();
  updateModeAudioState();
  updateProgressTracker();
}

function returnHome() {
  stopAudio();
  stopComparisonAudio();

  appStage = "welcome";
  motionRunning = false;
  audioEnabled = false;
  exhibitMode = 0;

  visual1Guess = null;
  visual2Guess = null;
  audioGuess = null;
  lastPlayedSignal = null;

  orbit.theta = 0;
  trail = [];

  document.getElementById("challengePanel").style.display = "none";
  document.getElementById("sidePanel").style.display = "none";
  document.getElementById("bottomBar").style.display = "none";
  document.getElementById("stageOverlay").style.display = "flex";
  document.getElementById("progressTracker").style.display = "none";

  renderStageCard();
  updateExhibitText();
}

function buildSandboxAudio() {
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

function buildComparisonAudio() {
  compareSynth = new Tone.Oscillator({
    type: "sine",
    frequency: 190,
    volume: -8,
  });

  compareFilter = new Tone.Filter({
    frequency: 1000,
    type: "lowpass",
    rolloff: -24,
  });

  compareGain = new Tone.Gain(0);
  comparePanner = new Tone.Panner(0);

  compareSynth.connect(compareFilter);
  compareFilter.connect(compareGain);
  compareGain.connect(comparePanner);
  comparePanner.connect(reverb);

  compareSynth.start();
}

function playComparisonSignal(signal) {
  if (!compareGain) return;
  lastPlayedSignal = signal;
  renderStageCard();

  compareGain.gain.cancelScheduledValues();
  compareGain.gain.rampTo(0.2, 0.1);

  const start = performance.now();
  const disturbed = signal === DISTURBED_SIGNAL;

  const interval = setInterval(() => {
    const t = (performance.now() - start) / 1000;

    let freq = 188 + Math.sin(t * 3) * 6;
    let pan = Math.sin(t * 0.9) * 0.45;
    let filt = 900 + Math.sin(t * 2) * 120;

    const anomalyZone = t > 2.1 && t < 3.0;
    if (disturbed && anomalyZone) {
      freq += Math.sin(t * 22) * 18 + 18;
      pan += Math.sin(t * 8) * 0.12;
      filt += 240;
    }

    compareSynth.frequency.rampTo(freq, 0.05);
    comparePanner.pan.rampTo(pan, 0.05);
    compareFilter.frequency.rampTo(filt, 0.05);
  }, 50);

  setTimeout(() => {
    clearInterval(interval);
    compareGain.gain.rampTo(0, 0.3);
  }, 4200);
}

function stopComparisonAudio() {
  if (compareGain) compareGain.gain.rampTo(0, 0.2);
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

  if (eccentricitySlider) eccentricitySlider.value(obj.e);
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

  modeStatus.textContent = `Mode: ${modeNames[exhibitMode]}`;

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

  if (appStage === "visual1") {
    drawVisualComparisonOrbit();
    return;
  }

  if (appStage === "visual2") {
    drawVisualComparisonTelemetry();
    return;
  }

  if (appStage === "audio") {
    drawAudioChallengeView();
    return;
  }

  if (appStage === "reveal") {
    drawRevealView();
    return;
  }

  if (appStage !== "sandbox") {
    drawWelcomeBackdrop();
    return;
  }

  drawSandbox();
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

function drawWelcomeBackdrop() {
  fill(220, 235, 255, 120);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Use the investigation to discover the anomaly.", width / 2, height * 0.28);
}

function drawVisualComparisonOrbit() {
  const leftX = width * 0.32;
  const rightX = width * 0.68;
  const cy = height * 0.40;
  const a = 170;
  const e = 0.12;

  drawOrbitPanel(leftX, cy, a, e, false, "Signal A");
  drawOrbitPanel(rightX, cy, a, e, true, "Signal B");

  fill(220, 235, 255, 170);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("Orbit traces look nearly identical.", width / 2, height * 0.75);
}

function drawOrbitPanel(cx, cy, a, e, disturbed, label) {
  let aphelionW = a * 2.1;
  let aphelionH = aphelionW * 0.75;

  noFill();
  stroke(disturbed ? 255 : 140, disturbed ? 170 : 210, disturbed ? 170 : 255, 185);
  strokeWeight(1.6);

  if (!disturbed) {
    ellipse(cx, cy, aphelionW, aphelionH);
  } else {
    beginShape();
    for (let t = 0; t < TWO_PI; t += 0.03) {
      let rr = (a * (1 - e * e)) / (1 + e * cos(t));
      let px = cx + rr * cos(t);
      let py = cy + rr * sin(t) * 0.75;
      if (t > 1.0 && t < 1.45) {
        py += sin(t * 18) * 3;
        px += sin(t * 12) * 1.5;
      }
      vertex(px, py);
    }
    endShape(CLOSE);
  }

  noStroke();
  fill(255, 210, 90, 230);
  circle(cx, cy, 28);

  fill(disturbed ? color(255, 205, 205) : color(170, 235, 255));
  textAlign(CENTER, CENTER);
  textSize(18);
  text(label, cx, cy - 150);
}

function drawVisualComparisonTelemetry() {
  const graphX = width * 0.12;
  const graphY = height * 0.20;
  const graphW = width * 0.76;
  const graphH = height * 0.45;

  noStroke();
  fill(8, 15, 30, 160);
  rect(graphX, graphY, graphW, graphH, 20);

  stroke(255, 255, 255, 25);
  for (let i = 0; i < 6; i++) {
    let y = graphY + (graphH / 5) * i;
    line(graphX + 20, y, graphX + graphW - 20, y);
  }

  noFill();
  stroke(140, 210, 255, 220);
  strokeWeight(2);
  beginShape();
  for (let i = 0; i <= 160; i++) {
    let x = map(i, 0, 160, graphX + 30, graphX + graphW - 30);
    let y = graphY + graphH * 0.55 + sin(i * 0.08) * 18;
    vertex(x, y);
  }
  endShape();

  stroke(255, 170, 170, 220);
  beginShape();
  for (let i = 0; i <= 160; i++) {
    let x = map(i, 0, 160, graphX + 30, graphX + graphW - 30);
    let y = graphY + graphH * 0.55 + sin(i * 0.08) * 18;
    if (i > 95 && i < 112) {
      y -= sin((i - 95) * 0.45) * 6;
    }
    vertex(x, y);
  }
  endShape();

  noStroke();
  fill(170, 235, 255, 255);
  textAlign(LEFT, CENTER);
  textSize(15);
  text("Signal A", graphX + 36, graphY + 26);

  fill(255, 205, 205, 255);
  text("Signal B", graphX + 140, graphY + 26);

  fill(220, 235, 255, 170);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("Even as telemetry, the anomaly is still subtle.", width / 2, height * 0.74);
}

function drawAudioChallengeView() {
  const cx = width / 2;
  const cy = height * 0.42;

  noFill();
  stroke(120, 150, 255, 55);
  strokeWeight(1.5);
  ellipse(cx, cy, 360, 270);

  noStroke();
  fill(255, 210, 90, 230);
  circle(cx, cy, 34);
  fill(255, 210, 90, 45);
  circle(cx, cy, 78);

  fill(220, 235, 255, 180);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Listen for a brief wobble or irregular pulse.", width / 2, height * 0.72);
}

function drawRevealView() {
  fill(220, 235, 255, 180);
  textAlign(CENTER, CENTER);
  textSize(20);
  text("The anomaly becomes clearer when heard over time.", width / 2, height * 0.25);

  drawVisualComparisonTelemetry();
}

function drawSandbox() {
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