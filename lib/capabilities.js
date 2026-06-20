'use client';

// lib/capabilities.js
// Detects whether browser media APIs are actually usable in the current
// environment. Inside the iOS Capacitor WKWebView, navigator.mediaDevices and
// SpeechRecognition are undefined, so features that rely on them must hide
// themselves rather than throw. In a normal mobile/desktop browser they work.

export function hasCamera() {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
}

export function hasSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
