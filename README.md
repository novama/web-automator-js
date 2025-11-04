# Web Automator JS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda%20Ready-orange.svg)](https://aws.amazon.com/lambda/)

A web automation framework supporting both **Selenium** and **Playwright**, with containerized **AWS Lambda** deployment capabilities. Perfect for web scraping, E2E testing, and browser automation at scale.

## Key Features

- **Dual Framework Support** - Choose between Selenium and Playwright
- **Docker Containerization** - Production-ready Lambda containers
- **Smart Environment Detection** - Automatic browser configuration
- **Health Monitoring** - Container health checks and auto-restart
- **Cross-Platform** - Works on Windows, macOS, and Linux
- **Serverless Ready** - Optimized for AWS Lambda deployment
- **Production Stable** - Comprehensive error handling and logging

## Architecture

```txt
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Lambda Event  │───▶│  Handler (index) │───▶│ Browser Engine  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Environment      │    │ Selenium /      │
                       │ Detection        │    │ Playwright      │
                       └──────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** 18+ (22.x recommended)
- **Docker** (for containerized deployment)
- **Git** (for cloning the repository)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/web-automator-js.git
cd web-automator-js

# Install dependencies
npm install

# Setup automation drivers (choose one or both)
npm run setup:playwright  # Install Playwright browsers
npm run setup:selenium    # Install Selenium drivers
npm run setup:all         # Install everything
```

### Basic Usage

#### Local Testing

```bash
# Test Playwright automation
npm run playwright

# Test Selenium automation  
npm run selenium

# Test Lambda handler locally
npm run lambda
```

#### Docker Development

```bash
# Build and start containerized Lambda
npm run docker:build && npm run docker:start

# Test containerized Lambda
npm run docker:test

# Monitor container health
npm run docker:health
```

## Documentation

| Document | Description |
|----------|-------------|
| [Docker Lambda Setup](docs/DOCKER-LAMBDA-SETUP.md) | Complete containerization and deployment guide |
| [AWS Deployment](docs/AWS-DEPLOYMENT.md) | AWS Lambda deployment instructions |
| [Framework Comparison](docs/SELENIUM-VS-PLAYWRIGHT.md) | Selenium vs Playwright detailed comparison |
| [Container Status](docs/CONTAINER-STATUS.md) | Health monitoring and troubleshooting |
| [Lambda Handler](docs/LAMBDA-HANDLER.md) | Lambda function implementation guide |

## Project Structure

```text
web-automator-js/
├── src/
│   ├── automator/
│   │   ├── playwright/          # Playwright automation drivers
│   │   └── selenium/            # Selenium automation drivers
│   ├── common/utils/            # Shared utilities
│   └── examples/                # Example implementations
├── tests/
│   └── test-events/             # Lambda test event files
├── config/                      # Configuration files
├── scripts/                     # Setup and utility scripts
├── Dockerfile                   # Production container image
├── docker-compose.yml           # Local development environment
├── package.json                 # Dependencies and npm scripts
└── index.js                     # Main Lambda handler
```

## Available Commands

### Development Commands

```bash
npm run setup              # Check and install dependencies
npm run playwright         # Run Playwright example
npm run selenium           # Run Selenium example
npm run lambda             # Test Lambda handler locally
npm run clean              # Clean output directories
```

### Docker Commands

```bash
npm run docker:build       # Build Lambda container
npm run docker:start       # Start Lambda service
npm run docker:test        # Test containerized Lambda
npm run docker:health      # Check container health
npm run docker:monitor     # Continuous health monitoring
npm run docker:restart     # Smart container restart
npm run docker:logs        # View container logs
npm run docker:stop        # Stop all containers
npm run docker:cleanup     # Clean up Docker resources
```

## Framework Comparison

Both frameworks are supported with smart environment detection:

| Aspect | Selenium | Playwright |
|--------|----------|------------|
| **Speed** | Good | Excellent |
| **Reliability** | Good | Excellent |
| **AWS Lambda** | Supported | Optimized |
| **Setup** | Manual | Automatic |

**[View Detailed Comparison →](docs/SELENIUM-VS-PLAYWRIGHT.md)**

## Configuration

### Environment Variables

```bash
# Browser Configuration
HEADLESS=true                   # Run browsers in headless mode
BROWSER_TYPE=chromium           # Browser type (chromium/firefox/webkit)

# AWS Lambda Detection (auto-detected)
AWS_LAMBDA_FUNCTION_NAME        # Lambda function name
AWS_EXECUTION_ENV               # AWS execution environment
NODE_ENV                        # Application environment

# Development Options
DEBUG=true                      # Enable debug logging
TIMEOUT=30000                   # Default timeout in milliseconds
```

### Custom Configuration

Create `config/config.json` for custom settings:

```json
{
  "browser": {
    "headless": true,
    "timeout": 30000,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  },
  "lambda": {
    "timeout": 30,
    "memorySize": 1024
  }
}
```

## Docker Deployment

### Local Development

```bash
# Start development environment
npm run docker:start

# Test with sample event
npm run docker:test

# Monitor health
npm run docker:monitor
```

### AWS Lambda Deployment

```bash
# Build production image
docker build -t web-automator-lambda .

# Tag for ECR
docker tag web-automator-lambda:latest {account}.dkr.ecr.{region}.amazonaws.com/web-automator:latest

# Deploy to Lambda (requires AWS CLI configured)
aws lambda update-function-code --function-name web-automator --image-uri {account}.dkr.ecr.{region}.amazonaws.com/web-automator:latest
```

**[Complete Deployment Guide →](docs/AWS-DEPLOYMENT.md)**

## Testing

### Unit Tests

```bash
npm test                       # Run test suite (when implemented)
```

### Integration Tests

```bash
npm run docker:test            # Test containerized Lambda
npm run docker:test:basic      # Basic functionality test
```

### Health Monitoring

```bash
npm run docker:health          # One-time health check
npm run docker:monitor         # Continuous monitoring
```

## Examples

### Basic Web Scraping

```javascript
const { playwrightDriver } = require('./src/automator/playwright/drivers/playwrightDriver');

async function scrapeTitle(url) {
    const driver = new playwrightDriver();
    await driver.initialize();
    
    const page = await driver.browser.newPage();
    await page.goto(url);
    const title = await page.title();
    
    await driver.cleanup();
    return title;
}
```

### Lambda Handler Usage

```javascript
// Event format
const event = {
    "url": "https://example.com",
    "selector": "h1",
    "action": "getText",
    "timeout": 30000
};

// Response format
{
    "statusCode": 200,
    "body": {
        "success": true,
        "url": "https://example.com",
        "title": "Example Domain",
        "result": "Example Domain"
    }
}
```

## Troubleshooting

### Common Issues

**Container crashes with segmentation fault:**

```bash
npm run docker:restart          # Smart restart with health checks
npm run docker:logs             # Check error details
```

**Browser not found in Lambda:**

- Ensure using `@sparticuz/chromium` package
- Check AWS environment detection
- Verify container image includes browsers

**Network timeouts:**

- Increase timeout values in configuration
- Check Lambda function timeout settings
- Verify network connectivity

**[Complete Troubleshooting Guide →](docs/CONTAINER-STATUS.md)**

## Performance

### AWS Lambda Metrics

- **Cold Start**: ~3-5 seconds (Playwright) / ~8-12 seconds (Selenium)
- **Execution**: ~2-4 seconds per page (Playwright) / ~5-8 seconds (Selenium)
- **Memory Usage**: 256MB+ (Playwright) / 512MB+ (Selenium)
- **Container Size**: ~250MB (Playwright) / ~1.5GB (Selenium)

### Optimization Tips

- Use Playwright for better Lambda performance
- Enable connection pooling for multiple requests
- Implement intelligent caching strategies
- Use appropriate Lambda memory allocation

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **[Playwright Team](https://playwright.dev/)** - Modern web automation framework
- **[Selenium Project](https://selenium.dev/)** - Web automation standard
- **[@sparticuz/chromium](https://github.com/Sparticuz/chromium)** - Serverless Chromium builds
- **AWS Lambda Team** - Serverless compute platform
