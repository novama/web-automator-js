# Smart Dependency Management

This project features intelligent dependency management that automatically installs only the required automation frameworks based on what you're trying to run.

## Quick Start

### Run Playwright Example

```bash
npm run playwright
```

### Run Selenium Example  

```bash
npm run selenium
```

### Check Installation Status

```bash
npm run setup
```

## How It Works

The smart dependency system:

1. **Auto-Detection**: Analyzes your script to determine which framework is needed
2. **On-Demand Installation**: Installs only required packages (Selenium OR Playwright)
3. **Browser Setup**: Automatically installs browser drivers when needed
4. **Zero Configuration**: Works out of the box

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run selenium` | Run Selenium example with auto-setup |
| `npm run playwright` | Run Playwright example with auto-setup |
| `npm run setup` | Check what's currently installed |
| `npm run setup:selenium` | Install only Selenium WebDriver |
| `npm run setup:playwright` | Install only Playwright + browsers |
| `npm run setup:all` | Install both frameworks |
| `npm run clean` | Remove output and download folders |

## Manual Setup

If you prefer manual control:

```bash
# Setup individual frameworks
node scripts/setup-dependencies.js selenium
node scripts/setup-dependencies.js playwright

# Check status
node scripts/setup-dependencies.js check

# Auto-detect from script
node scripts/setup-dependencies.js auto src/examples/simple-selenium.js
```

## Dependencies

**Core Dependencies:**

- `winston` - Logging (always installed)

**Optional Dependencies:**

- `selenium-webdriver` - Installed when running Selenium scripts
- `playwright` - Installed when running Playwright scripts

## Benefits

- **Smaller Install Size**: Only install what you use
- **Faster Setup**: No need to install both frameworks upfront  
- **Automatic Detection**: Smart framework detection from scripts
- **Browser Management**: Automatic browser driver installation
- **Zero Configuration**: Works without manual setup

## Project Structure

```txt
web-automator-js/
├── scripts/
│   ├── setup-dependencies.js     # Smart dependency installer
│   └── launcher.js               # Script launcher with proper context
├── src/
│   ├── examples/
│   │   ├── simple-selenium.js    # Selenium example
│   │   └── simple-playwright.js  # Playwright example
│   └── automator/
│       ├── selenium/             # Selenium drivers
│       └── playwright/           # Playwright drivers
├── output/                       # Generated screenshots/videos
├── downloads/                    # Browser downloads
└── package.json                  # Smart npm scripts
```
