# AWS Lambda Deployment Guide

## Environment Detection & Browser Strategy

The Lambda handler automatically detects the environment and uses the appropriate browser strategy:

### **Environment Detection Logic**

```javascript
// Detects ANY AWS Lambda environment (dev, staging, prod)
const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV;
```

### **Environment Behaviors**

| Environment | Detection | Browser Strategy | Notes |
|-------------|-----------|------------------|-------|
| **AWS Lambda (Dev)** | `AWS_LAMBDA_FUNCTION_NAME` present | `@sparticuz/chromium` | Works regardless of NODE_ENV |
| **AWS Lambda (Staging)** | `AWS_LAMBDA_FUNCTION_NAME` present | `@sparticuz/chromium` | Works regardless of NODE_ENV |
| **AWS Lambda (Prod)** | `AWS_LAMBDA_FUNCTION_NAME` present | `@sparticuz/chromium` | Works regardless of NODE_ENV |
| **Local Docker** | No AWS env vars | System Chromium or Playwright | For development/testing |
| **Local Node.js** | No AWS env vars | Playwright browsers | Standard local development |

### **Required Dependencies for AWS Lambda**

Ensure these are in your `package.json` dependencies (not devDependencies):

```json
{
  "dependencies": {
    "@sparticuz/chromium": "^141.0.0",
    "playwright": "^1.48.0"
  }
}
```

### **Deployment to AWS Lambda**

#### Option 1: Container Image (Recommended)

```bash
# Build production container
docker build -t web-automator-lambda .

# Tag for ECR
docker tag web-automator-lambda:latest 123456789012.dkr.ecr.region.amazonaws.com/web-automator:latest

# Push to ECR
docker push 123456789012.dkr.ecr.region.amazonaws.com/web-automator:latest

# Deploy Lambda with container image URI
```

#### Option 2: ZIP Package

```bash
# Install production dependencies
npm ci --only=production

# Create deployment package
zip -r lambda-deployment.zip . -x "*.git*" "tests/*" "docker*" "*.md"

# Upload to Lambda (via AWS CLI or console)
aws lambda update-function-code --function-name web-automator --zip-file fileb://lambda-deployment.zip
```

### **Lambda Configuration**

**Memory:** 1024 MB minimum (recommended 1536 MB)
**Timeout:** 30 seconds minimum (recommended 60 seconds)
**Runtime:** Node.js 22.x

**Environment Variables:**

```bash
NODE_ENV=production    # Optional (any value works)
AUTOMATION_DEFAULT_URL=https://your-default-site.com
PLAYWRIGHT_BROWSER=chromium
CONFIG_PATH=./config/lambda-config.json
```

### 🔧 **Testing Across Environments**

#### Development Environment Test

```bash
# Set test environment variables
export AWS_LAMBDA_FUNCTION_NAME=web-automator-dev
export NODE_ENV=development

# Run locally (will use @sparticuz/chromium)
node index.js
```

#### Staging Environment Test

```bash
# Deploy to staging Lambda
aws lambda invoke --function-name web-automator-staging \
  --payload '{"url": "https://example.com"}' \
  response.json

# Check response
cat response.json
```

#### Production Environment Test

```bash
# Deploy to production Lambda
aws lambda invoke --function-name web-automator-prod \
  --payload '{"url": "https://example.com"}' \
  response.json
```

### **Error Handling**

If deployment fails with browser issues:

1. **Check dependencies:**

   ```bash
   npm ls @sparticuz/chromium
   ```

2. **Verify Lambda configuration:**
   - Memory ≥ 1024 MB
   - Timeout ≥ 30 seconds
   - Runtime = Node.js 22.x

3. **Check logs:**

   ```bash
   aws logs tail /aws/lambda/web-automator-dev --follow
   ```

### **Best Practices**

1. **Always test in dev environment first**
2. **Use same container image across dev/staging/prod**
3. **Monitor memory usage and adjust accordingly**
4. **Set appropriate timeouts for your use cases**
5. **Use CloudWatch for monitoring and alerting**

### **Environment-Specific Configuration**

Create environment-specific config files:

```txt
config/
├── lambda-config.json          # Default config
├── lambda-config.dev.json      # Development overrides  
├── lambda-config.staging.json  # Staging overrides
└── lambda-config.prod.json     # Production overrides
```

Update Lambda environment variables:

```bash
# Development
CONFIG_PATH=./config/lambda-config.dev.json

# Staging  
CONFIG_PATH=./config/lambda-config.staging.json

# Production
CONFIG_PATH=./config/lambda-config.prod.json
```

This approach ensures consistent behavior across **all AWS environments** regardless of how NODE_ENV is configured!
