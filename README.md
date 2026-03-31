# 🟢 Hulky Curl Game

A motion-controlled browser game powered by MediaPipe pose detection.

Perform a real bicep curl to control the Hulk — when your elbow angle 
drops below 90°, Hulk catches the incoming car. Extend your arm back 
to throw it. Don't let a second car arrive while you're still holding one.

## How it works
- MediaPipe tracks your shoulder, elbow, and wrist in real time
- Elbow angle is calculated geometrically from joint coordinates
- Curl trigger: < 90° | Throw trigger: > 155°
- No backend, no install — runs entirely in the browser

## Modes
- Single arm / Both arms
- Slow (4s) / Medium (3s) / Fast (2s) car intervals

## Run locally
cd hulky-curl-game
serve .
Then open localhost in Chrome and allow camera access.

## Built with
- MediaPipe Pose (browser)
- Vanilla JavaScript + Canvas API
- HTML/CSS
