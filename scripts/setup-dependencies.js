#!/usr/bin/env node

/**
 * Smart Dependency Setup Utility
 * 
 * This script detects which automation framework is needed based on the 
 * script being run and installs only the required dependencies.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkPackageInstalled(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch (error) {
    return false;
  }
}

function installPackage(packageName, options = {}) {
  const { global = false, dev = false } = options;
  
  log(`📦 Installing ${packageName}...`, 'blue');
  
  let command = `npm install --strict-ssl=false ${packageName}`;
  if (global) command += ' -g';
  if (dev) command += ' --save-dev';
  
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ Successfully installed ${packageName}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to install ${packageName}`, 'red');
    return false;
  }
}

function setupPlaywright() {
  log('🎭 Setting up Playwright...', 'yellow');
  
  if (!checkPackageInstalled('playwright')) {
    if (!installPackage('playwright')) {
      return false;
    }
  } else {
    log('✅ Playwright already installed', 'green');
  }
  
  // Install browsers
  log('🌐 Installing Playwright browsers...', 'blue');
  try {
    execSync('npx playwright install chromium firefox webkit', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }
    });
    log('✅ Playwright browsers installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install Playwright browsers', 'red');
    return false;
  }
}

function setupSelenium() {
  log('🚗 Setting up Selenium WebDriver...', 'yellow');
  
  if (!checkPackageInstalled('selenium-webdriver')) {
    return installPackage('selenium-webdriver');
  } else {
    log('✅ Selenium WebDriver already installed', 'green');
    return true;
  }
}

function detectFrameworkFromScript(scriptPath) {
  if (!fs.existsSync(scriptPath)) {
    return null;
  }
  
  const content = fs.readFileSync(scriptPath, 'utf8');
  
  if (content.includes('playwright') || content.includes('PlaywrightDriver')) {
    return 'playwright';
  } else if (content.includes('selenium-webdriver') || content.includes('SeleniumDriver')) {
    return 'selenium';
  }
  
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  log(`${colors.bold}🚀 Web Automation Dependencies Setup${colors.reset}`, 'blue');
  log('==========================================');
  
  switch (command) {
    case 'selenium':
      setupSelenium();
      break;
      
    case 'playwright':
      setupPlaywright();
      break;
      
    case 'all':
      log('📦 Installing all automation frameworks...', 'yellow');
      setupSelenium();
      setupPlaywright();
      break;
      
    case 'check':
      log('🔍 Checking installed packages...', 'blue');
      const seleniumInstalled = checkPackageInstalled('selenium-webdriver');
      const playwrightInstalled = checkPackageInstalled('playwright');
      
      log(`Selenium WebDriver: ${seleniumInstalled ? '✅ Installed' : '❌ Not installed'}`, seleniumInstalled ? 'green' : 'red');
      log(`Playwright: ${playwrightInstalled ? '✅ Installed' : '❌ Not installed'}`, playwrightInstalled ? 'green' : 'red');
      break;
      
    case 'auto':
      const scriptFile = args[1];
      if (!scriptFile) {
        log('❌ Please provide a script file to analyze', 'red');
        log('Usage: node setup-dependencies.js auto <script-file>', 'yellow');
        process.exit(1);
      }
      
      const framework = detectFrameworkFromScript(scriptFile);
      if (!framework) {
        log('❓ Could not detect automation framework from script', 'yellow');
        log('Manual setup required', 'blue');
        break;
      }
      
      log(`🔍 Detected framework: ${framework}`, 'blue');
      if (framework === 'selenium') {
        setupSelenium();
      } else if (framework === 'playwright') {
        setupPlaywright();
      }
      break;
      
    default:
      log('📖 Usage:', 'blue');
      log('  node setup-dependencies.js selenium    - Install Selenium WebDriver');
      log('  node setup-dependencies.js playwright  - Install Playwright');
      log('  node setup-dependencies.js all         - Install both frameworks');
      log('  node setup-dependencies.js check       - Check what\'s installed');
      log('  node setup-dependencies.js auto <file> - Auto-detect from script');
      log('');
      log('Examples:', 'yellow');
      log('  node setup-dependencies.js auto src/examples/simple-selenium.js');
      log('  node setup-dependencies.js auto src/examples/simple-playwright.js');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupSelenium, setupPlaywright, detectFrameworkFromScript, checkPackageInstalled };