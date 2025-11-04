# Docker Lambda Setup

Containerized web automation Lambda handler with Docker and docker-compose support.

## Quick Start

### Build and Start Lambda Container

```bash
# Build the Lambda image
npm run docker:build

# Start Lambda service
npm run docker:start

# Test the Lambda function
npm run docker:test
```

### Using NPM Scripts (Recommended)

**All Platforms:**

```bash
npm run docker:build && npm run docker:start
npm run docker:test
```

**With Health Monitoring:**

```bash
npm run docker:health    # Check container status
npm run docker:monitor   # Continuous monitoring with auto-restart
npm run docker:restart   # Smart restart with health verification
```

## Container Architecture

### Lambda Container (`web-automator-lambda`)

- **Base Image**: `public.ecr.aws/lambda/nodejs:22`
- **Port**: 9000 (maps to Lambda Runtime Interface Emulator)
- **Environment**: Production-optimized with Playwright headless mode
- **Browsers**: Pre-installed Chromium for consistent execution

### Development Container (`web-automator-dev`)

- **Base Image**: `node:22-bullseye`
- **Port**: 3000
- **Environment**: Full development setup with source mounting
- **Use Case**: Local development and testing

## Container Services

### Production Lambda Service

```bash
docker-compose up -d web-automator-lambda
```

Access at: `http://localhost:9000/2015-03-31/functions/function/invocations`

### Development Service  

```bash
docker-compose --profile dev up web-automator-dev
```

### Testing Service

```bash
docker-compose --profile test up lambda-tester
```

## Environment Variables

### Lambda Container Environment

```yaml
NODE_ENV: production
PLAYWRIGHT_BROWSERS_PATH: /ms-playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 1
AUTOMATION_DEFAULT_URL: https://example.com
PLAYWRIGHT_BROWSER: chromium
PLAYWRIGHT_TIMEOUT: 25000
```

### Custom Configuration

Override settings by modifying `docker-compose.yml`:

```yaml
environment:
  - AUTOMATION_DEFAULT_URL=https://your-site.com
  - PLAYWRIGHT_BROWSER=firefox
  - PLAYWRIGHT_TIMEOUT=30000
```

## Testing Events

Test events are stored in `tests/test-events/` directory:

### Basic Test

```bash
curl -X POST 'http://localhost:9000/2015-03-31/functions/function/invocations' \
  -H 'Content-Type: application/json' \
  -d @tests/test-events/basic-test.json
```

### Custom Test Event

Create your own test event in `tests/test-events/`:

```json
{
  "url": "https://your-site.com",
  "extract": {
    "heading": true,
    "selectors": [
      {
        "name": "title",
        "selector": "h1",
        "attribute": "textContent"
      }
    ]
  }
}
```

## Volume Mounts

### Lambda Container

- `./lambda-config.json:/var/task/lambda-config.json:ro` - Configuration file
- `./docker-logs:/tmp/logs` - Log output directory

### Development Container  

- `.:/app` - Source code (live reload)
- `./output:/app/output` - Output files
- `./downloads:/app/downloads` - Downloaded files

## Docker Commands Reference

### NPM Scripts

```bash
npm run docker:build      # Build Lambda image
npm run docker:start      # Start Lambda service
npm run docker:test       # Test Lambda function
npm run docker:dev        # Start development environment
npm run docker:stop       # Stop all services
npm run docker:logs       # View Lambda logs
npm run docker:cleanup    # Clean up all resources
```

### Direct Docker Compose Commands

```bash
# Build specific service
docker-compose build web-automator-lambda

# Start with logs
docker-compose up web-automator-lambda

# Start in background
docker-compose up -d web-automator-lambda

# View logs
docker-compose logs -f web-automator-lambda

# Stop services
docker-compose down

# Complete cleanup
docker-compose down --volumes --remove-orphans
```

### NPM Script Commands

```bash
# Core Operations
npm run docker:build        # Build Lambda container
npm run docker:start        # Start Lambda service
npm run docker:test         # Test with basic-test.json
npm run docker:test:basic   # Test with basic-test.json (explicit)
npm run docker:stop         # Stop all services

# Health & Monitoring  
npm run docker:health       # Check container status and health
npm run docker:monitor      # Continuous monitoring with auto-restart
npm run docker:restart      # Smart restart with health verification

# Development & Debugging
npm run docker:dev          # Start development environment
npm run docker:logs         # View Lambda container logs
npm run docker:status       # Show container status with recent logs
npm run docker:cleanup      # Clean up all Docker resources
```

### Alternative Docker Compose Commands

```bash
# Direct Docker Compose (if you prefer)
docker-compose build web-automator-lambda
docker-compose up -d web-automator-lambda
docker-compose logs -f web-automator-lambda
docker-compose down --volumes --remove-orphans
```

## Deployment

### AWS Lambda Deployment

1. Build production image:

   ```bash
   docker build -t web-automator-lambda .
   ```

2. Tag for ECR:

   ```bash
   docker tag web-automator-lambda:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/web-automator:latest
   ```

3. Push to ECR:

   ```bash
   docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/web-automator:latest
   ```

4. Deploy Lambda function using container image URI

### Local Production Testing

```bash
# Test exactly like AWS Lambda
docker run -p 9000:8080 web-automator-lambda:latest

# Test with curl
curl -X POST 'http://localhost:9000/2015-03-31/functions/function/invocations' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'
```

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker-compose logs web-automator-lambda

# Check container status
docker-compose ps
```

### Playwright Browser Issues

```bash
# Shell into container
docker-compose exec web-automator-lambda /bin/bash

# Check browser installation
ls -la /ms-playwright/

# Test browser manually
node -e "console.log(require('playwright').chromium)"
```

### Network Issues

```bash
# Test container networking
docker network ls
docker network inspect web-automator-js_lambda-network
```

### Performance Issues

- Increase container memory in docker-compose.yml
- Check Docker Desktop resource allocation
- Monitor container resource usage:

  ```bash
  docker stats web-automator-lambda
  ```

## Image Optimization

### Multi-stage Build Benefits

- **Smaller final image**: Only production dependencies included
- **Faster cold starts**: Optimized layer caching
- **Security**: No build tools in production image

### Build Performance

- Uses Docker layer caching for faster rebuilds
- Playwright browsers installed in separate layer
- Dependencies cached between builds

### Resource Usage

- **Memory**: ~1GB minimum for Playwright
- **CPU**: 1-2 cores recommended
- **Storage**: ~500MB for base image + browsers
