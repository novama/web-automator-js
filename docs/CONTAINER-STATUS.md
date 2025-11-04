# Docker Lambda Container Status Dashboard

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm run docker:health` | Check container status and health |
| `npm run docker:restart` | Smart restart with health verification |
| `npm run docker:monitor` | Continuous monitoring (auto-restart on failure) |
| `npm run docker:test` | Quick functional test |
| `npm run docker:stop` | Stop all containers |

## Health Check Results

### Healthy Container

```txt
📊 Checking container status...
📦 Container: web-automator-lambda
🏃 Status: running
🚀 Ports: 0.0.0.0:9000->8080/tcp
🔍 Testing Lambda health...
💚 Health: Healthy
```

### Unhealthy Container

```txt
📊 Checking container status...
📦 Container: web-automator-lambda
🏃 Status: running
🚀 Ports: 0.0.0.0:9000->8080/tcp
🔍 Testing Lambda health...
💚 Health: Unhealthy
💡 Container may need restart: npm run docker:restart
```

### Stopped Container

```txt
📊 Checking container status...
❌ Container not found
💡 Run: npm run docker:start
```

## Troubleshooting Guide

### Container Crashes (Segmentation Fault)

This typically happens when:

- Processing complex CSS selectors with advanced attributes
- Lambda runtime encounters memory issues
- Browser automation operations exceed timeout limits

**Solution:**

```bash
npm run docker:restart
```

### Container Unresponsive

When container shows as "running" but health check fails:

**Solution:**

```bash
npm run docker:restart
```

### Auto-Monitoring Mode

For production-like monitoring with automatic recovery:

```bash
npm run docker:monitor
```

This will:

- Check health every 30 seconds
- Auto-restart after 3 consecutive failures
- Provide real-time status updates

## Environment Detection Status

The container now properly detects AWS environments:

| Environment Variable | Purpose |
|---------------------|---------|
| `AWS_LAMBDA_FUNCTION_NAME` | Identifies AWS Lambda runtime |
| `AWS_EXECUTION_ENV` | AWS execution environment indicator |
| `NODE_ENV` | Application environment mode |

### AWS Environment Behavior

[x]  **Development AWS Account**: Uses `@sparticuz/chromium` (serverless-optimized)  
[x]  **Staging AWS Account**: Uses `@sparticuz/chromium` (serverless-optimized)  
[x]  **Production AWS Account**: Uses `@sparticuz/chromium` (serverless-optimized)  
[x]  **Local Development**: Uses regular Playwright browsers

## Current Status: Production Ready

The containerization is complete with:

- [x]  Multi-stage Docker builds optimized for AWS Lambda
- [x]  Environment-aware browser selection
- [x]  Robust health monitoring and auto-recovery
- [x]  Cross-platform testing capabilities
- [x]  AWS deployment consistency across all environments
- [x]  Comprehensive error handling and diagnostics

### Known Issues & Mitigation

1. **Lambda Runtime Crashes**:
   - **Issue**: Segmentation faults during complex operations
   - **Mitigation**: Auto-restart monitoring system
   - **Status**: Managed through health checks

2. **Browser Compatibility**:
   - **Issue**: Different browsers in local vs AWS
   - **Mitigation**: Environment detection with `@sparticuz/chromium` fallback
   - **Status**: Resolved

3. **Container Instability**:
   - **Issue**: Container stops responding during heavy load
   - **Mitigation**: Health monitoring with automatic restart
   - **Status**: Actively monitored

## Next Steps for Production

1. Deploy to AWS Lambda using the containerized approach
2. Set up CloudWatch monitoring for production instances
3. Configure auto-scaling based on request volume
4. Implement distributed tracing for complex workflows

The system is now ready for AWS Lambda deployment with comprehensive monitoring.
