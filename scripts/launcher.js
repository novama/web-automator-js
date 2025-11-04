#!/usr/bin/env node

/**
 * Script Launcher - Ensures proper working directory
 * 
 * This launcher ensures scripts run from the correct directory
 * and have the right context for configuration files.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runScript(scriptPath, workingDir = null) {
  const resolvedScriptPath = path.resolve(scriptPath);
  const scriptDir = workingDir || path.dirname(resolvedScriptPath);
  
  console.log(`🚀 Running: ${path.basename(scriptPath)}`);
  console.log(`📁 Working directory: ${scriptDir}`);
  
  const child = spawn('node', [resolvedScriptPath], {
    cwd: scriptDir,
    stdio: 'inherit'
  });
  
  child.on('error', (error) => {
    console.error(`❌ Error running script: ${error.message}`);
    process.exit(1);
  });
  
  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Script exited with code: ${code}`);
      process.exit(code);
    }
    console.log(`✅ Script completed successfully`);
  });
}

if (require.main === module) {
  const scriptPath = process.argv[2];
  const workingDir = process.argv[3];
  
  if (!scriptPath) {
    console.error('❌ Please provide a script path');
    console.log('Usage: node launcher.js <script-path> [working-directory]');
    process.exit(1);
  }
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Script not found: ${scriptPath}`);
    process.exit(1);
  }
  
  runScript(scriptPath, workingDir);
}

module.exports = { runScript };