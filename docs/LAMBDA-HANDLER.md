# Lambda Web Automation Handler

A serverless web automation handler built with Playwright for AWS Lambda and other serverless platforms.

## Features

- **Headless Browser Automation**: Uses Playwright in headless mode for optimal performance
- **Structured Data Extraction**: Configurable selectors for extracting specific page data
- **Error Handling**: Comprehensive error handling with structured JSON responses
- **Logging Integration**: Uses the same logging system as other project components
- **Configuration Management**: Supports both file-based and environment variable configuration
- **Lambda Optimized**: Optimized for serverless environments with proper resource cleanup

## Usage

### Local Testing

```bash
npm run lambda
```

### Response Format

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "X-Request-ID": "req-12345"
  },
  "body": {
    "status": "success",
    "requestId": "req-12345", 
    "timestamp": "2025-11-04T05:21:15.938Z",
    "data": {
      "url": "https://example.com",
      "pageTitle": "Example Domain",
      "extractedData": { }
    },
    "executionTime": 1016
  }
}
```

### Event Structure

```json
{
  "url": "https://example.com",
  "extract": {
    "heading": true,
    "headingSelector": "h1",
    "metadata": true,
    "selectors": [
      {
        "name": "description",
        "selector": "p",
        "attribute": "textContent"
      }
    ]
  },
  "optimizations": {
    "disableImages": true,
    "disableJavaScript": false
  }
}
```

## Environment Variables

For serverless deployment, you can use environment variables instead of config files:

- `AUTOMATION_DEFAULT_URL`: Default URL to scrape
- `PLAYWRIGHT_BROWSER`: Browser engine (chromium, firefox, webkit)  
- `PLAYWRIGHT_TIMEOUT`: Navigation timeout in milliseconds
- `CONFIG_PATH`: Path to configuration file

## AWS Lambda Deployment

Package Dependencies:

```bash
npm install --production
```

Create Deployment Package:

```bash
zip -r lambda-deployment.zip . -x "*.git*" "output/*" "downloads/*" "node_modules/playwright/.local-browsers/*"
```

Lambda Configuration:

- Runtime: Node.js 22.x
- Handler: index.lambda_handler
- Memory: 1024 MB (minimum for Playwright)
- Timeout: 30 seconds
- Environment: Set NODE_ENV=production

## Performance Notes

- **Cold Start**: First invocation may take 2-3 seconds due to browser initialization
- **Warm Execution**: Subsequent calls typically complete in 1-2 seconds
- **Memory Usage**: Requires at least 1024 MB RAM for reliable operation
- **Timeout**: Recommended 30-second timeout for complex pages

## Error Handling

The handler returns structured error responses:

```json
{
  "statusCode": 500,
  "body": {
    "status": "error",
    "error": {
      "message": "Navigation failed: timeout",
      "type": "TimeoutError",
      "code": "AUTOMATION_ERROR"
    }
  }
}
```

## Testing

Test locally with different configurations:

```bash
# Basic test
npm run lambda

# Test with custom URL (modify index.js testEvent)
node index.js
```
