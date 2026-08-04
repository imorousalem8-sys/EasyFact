#!/usr/bin/env node
/**
 * EasyFact Africa — Vercel Build Script
 * Copies static files to public/ then builds NestJS
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure public directory exists
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

// Copy static frontend files
const staticFiles = ['index.html', 'styles.css', 'app.js', 'i18n.js', 'easyfact_logo.png', 'easyfact_icon.png', 'easyfact_hero.png'];
staticFiles.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join('public', f));
    console.log(`✅ Copied: ${f}`);
  }
});

// Build NestJS server
console.log('\n🔨 Building NestJS server...');
execSync('cd server && npm install --include=dev && npm run build', { stdio: 'inherit' });
console.log('✅ NestJS build complete!');
