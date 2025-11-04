/**
 * AWS Lambda Handler - Web Automation
 * 
 * A serverless web automation handler that demonstrates:
 * - Playwright automation without UI components (headless)
 * - Configuration management via environment variables or config files
 * - Structured logging and error handling
 * - JSON response formatting for API Gateway integration
 * 
 * This handler extracts data from web pages and returns structured results
 * suitable for serverless environments.
 */

const path = require('path');

// Import our existing utilities
const logger = require('./src/common/utils/logger');
const ConfigManager = require('./src/common/utils/configManager');
const PlaywrightDriver = require('./src/automator/playwright/drivers/playwrightDriver');

/**
 * Lambda handler function
 * @param {Object} event - Lambda event object
 * @param {Object} context - Lambda context object
 * @returns {Promise<Object>} JSON response with status and data
 */
async function lambda_handler(event, context) {
    const startTime = Date.now();
    const requestId = context?.requestId || `req-${Date.now()}`;
    
    // Initialize response structure
    let response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
        },
        body: {
            status: 'success',
            requestId: requestId,
            timestamp: new Date().toISOString(),
            data: null,
            error: null,
            executionTime: 0
        }
    };

    let driver = null;

    try {
        logger.info(`Starting web automation handler (Request: ${requestId})`);

        // Load configuration (supports both file-based and environment variables)
        const config = await loadConfiguration(event);
        
        // Get target URL from event or use default
        const targetUrl = event?.url || event?.body?.url || config.get('automation.defaultUrl', 'https://example.com');
        const extractConfig = event?.extract || event?.body?.extract || config.get('automation.extract', {});

        logger.info(`Target URL: ${targetUrl}`);
        logger.info(`Extract configuration: ${JSON.stringify(extractConfig)}`);

        // Create Playwright driver with serverless-optimized settings
        const driverOptions = createDriverOptions(config, event);
        driver = new PlaywrightDriver(driverOptions);

        // Start browser and navigate
        logger.info('Starting headless browser...');
        await driver.start();

        logger.info(`Navigating to: ${targetUrl}`);
        const navigationResult = await driver.navigateTo(targetUrl);

        if (!navigationResult.success) {
            throw new Error(`Navigation failed: ${navigationResult.error || 'Unknown error'}`);
        }

        // Extract data from the page
        logger.info('Extracting data from page...');
        const extractedData = await extractPageData(driver, extractConfig, targetUrl);

        // Prepare successful response
        response.body.data = {
            url: targetUrl,
            pageTitle: navigationResult.title,
            currentUrl: navigationResult.url,
            extractedData: extractedData,
            pageMetadata: {
                loadTime: `${Date.now() - startTime}ms`,
                userAgent: driverOptions.userAgent || 'Playwright-Headless'
            }
        };

        logger.info('Web automation completed successfully');

    } catch (error) {
        logger.error(`Web automation failed: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);

        // Prepare error response
        response.statusCode = 500;
        response.body.status = 'error';
        response.body.error = {
            message: error.message,
            type: error.constructor.name,
            code: error.code || 'AUTOMATION_ERROR'
        };

        // Don't expose internal details in production
        if (process.env.NODE_ENV !== 'production') {
            response.body.error.stack = error.stack;
        }

    } finally {
        // Always cleanup browser resources
        if (driver && driver.getIsStarted()) {
            try {
                logger.info('Cleaning up browser resources...');
                await driver.quit();
            } catch (cleanupError) {
                logger.warn(`Cleanup warning: ${cleanupError.message}`);
            }
        }

        // Calculate final execution time
        response.body.executionTime = Date.now() - startTime;
        logger.info(`Request completed in ${response.body.executionTime}ms`);

        // Return response (Lambda expects body as string for API Gateway)
        return {
            ...response,
            body: JSON.stringify(response.body)
        };
    }
}

/**
 * Load configuration from file or environment variables
 * @param {Object} event - Lambda event (may contain config overrides)
 * @returns {ConfigManager} Configuration manager instance
 */
async function loadConfiguration(event) {
    try {
        // Try to load from config file first
        const configPath = process.env.CONFIG_PATH || './config/lambda-config.json';
        const config = new ConfigManager(configPath);

        // Allow event-based config overrides
        if (event?.config) {
            logger.info('Applying event-based configuration overrides');
            // Note: In a real implementation, you might want to merge configurations
        }

        return config;

    } catch (error) {
        logger.warn(`Config file not found: ${error.message}. Using environment variables.`);
        
        // Fallback to environment-based config
        const envConfig = createEnvironmentConfig();
        return envConfig;
    }
}

/**
 * Create configuration from environment variables
 * @returns {Object} Environment-based configuration
 */
function createEnvironmentConfig() {
    return {
        get: (key, defaultValue) => {
            const envKey = key.replace(/\./g, '_').toUpperCase();
            const value = process.env[envKey];
            
            if (value === undefined) {
                return defaultValue;
            }

            // Try to parse JSON values
            if (value.startsWith('{') || value.startsWith('[')) {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }

            // Convert boolean strings
            if (value === 'true') return true;
            if (value === 'false') return false;
            
            return value;
        }
    };
}

/**
 * Create optimized driver options for serverless environment
 * @param {ConfigManager} config - Configuration manager
 * @param {Object} event - Lambda event
 * @returns {Object} Driver options
 */
function createDriverOptions(config, event) {
    const playwright = config.get('playwright', {});
    
    return {
        browser: playwright.browser || 'chromium',
        headless: true,  // Always headless in serverless
        windowSize: playwright.windowSize || {
            width: 1920,
            height: 1080
        },
        timeout: Math.min(playwright.timeout || 30000, 25000), // Respect Lambda timeout
        navigationTimeout: Math.min(playwright.navigationTimeout || 30000, 25000),
        outputPath: '/tmp/automation-output', // Use Lambda's tmp directory
        downloadsPath: '/tmp/automation-downloads',
        acceptInsecureCerts: playwright.acceptInsecureCerts !== false,
        slowMo: 0, // No delays in serverless
        recordVideo: false, // No video in serverless
        disableImages: event?.optimizations?.disableImages || false,
        disableJavaScript: event?.optimizations?.disableJavaScript || false,
        userAgent: event?.userAgent || playwright.userAgent
    };
}

/**
 * Extract data from the page based on configuration
 * @param {PlaywrightDriver} driver - Playwright driver instance
 * @param {Object} extractConfig - Configuration for data extraction
 * @param {string} url - Current page URL
 * @returns {Promise<Object>} Extracted data
 */
async function extractPageData(driver, extractConfig, url) {
    const data = {};

    try {
        // Default extractions
        data.pageTitle = await driver.getTitle();
        data.currentUrl = await driver.getCurrentUrl();
        
        // Extract main heading if configured or as default
        if (extractConfig.heading !== false) {
            try {
                const selector = extractConfig.headingSelector || 'h1';
                data.mainHeading = await driver.getText(selector);
                logger.info(`Extracted heading: "${data.mainHeading}"`);
            } catch (error) {
                logger.warn(`Could not extract heading: ${error.message}`);
                data.mainHeading = null;
            }
        }

        // Extract custom selectors if provided
        if (extractConfig.selectors && Array.isArray(extractConfig.selectors)) {
            data.customData = {};
            
            for (const selectorConfig of extractConfig.selectors) {
                const { name, selector, attribute = 'textContent' } = selectorConfig;
                
                try {
                    let value;
                    if (attribute === 'textContent') {
                        value = await driver.getText(selector);
                    } else {
                        // For other attributes, we'd need to extend the driver
                        // This is a placeholder for more complex extraction
                        value = await driver.getText(selector);
                    }
                    
                    data.customData[name] = value;
                    logger.info(`Extracted ${name}: "${value}"`);
                    
                } catch (error) {
                    logger.warn(`Could not extract ${name} with selector ${selector}: ${error.message}`);
                    data.customData[name] = null;
                }
            }
        }

        // Extract page metadata
        if (extractConfig.metadata !== false) {
            try {
                const pageSource = await driver.getPageSource();
                data.metadata = {
                    contentLength: pageSource.length,
                    hasJavaScript: pageSource.includes('<script'),
                    hasCSS: pageSource.includes('<style') || pageSource.includes('.css'),
                    extractedAt: new Date().toISOString()
                };
            } catch (error) {
                logger.warn(`Could not extract metadata: ${error.message}`);
                data.metadata = null;
            }
        }

        // Custom JavaScript execution if configured
        if (extractConfig.customScript) {
            try {
                logger.info('Executing custom JavaScript...');
                const customResult = await driver.executeScript(extractConfig.customScript);
                data.customScriptResult = customResult;
            } catch (error) {
                logger.warn(`Custom script execution failed: ${error.message}`);
                data.customScriptResult = null;
            }
        }

    } catch (error) {
        logger.error(`Data extraction failed: ${error.message}`);
        throw new Error(`Data extraction failed: ${error.message}`);
    }

    return data;
}

// Export for Lambda
module.exports = {
    lambda_handler,
    // Export utilities for testing
    loadConfiguration,
    createDriverOptions,
    extractPageData
};

// For local testing
if (require.main === module) {
    // Simulate Lambda event for local testing
    const testEvent = {
        url: 'https://example.com',
        extract: {
            heading: true,
            headingSelector: 'h1',
            metadata: true,
            selectors: [
                {
                    name: 'description',
                    selector: 'p',
                    attribute: 'textContent'
                }
            ]
        }
    };

    const testContext = {
        requestId: 'test-' + Date.now(),
        functionName: 'web-automation-test',
        remainingTimeInMillis: () => 30000
    };

    lambda_handler(testEvent, testContext)
        .then(response => {
            console.log('Lambda Response:');
            console.log(JSON.stringify(JSON.parse(response.body), null, 2));
        })
        .catch(error => {
            console.error('Lambda Error:', error);
            process.exit(1);
        });
}