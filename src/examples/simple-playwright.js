/**
 * Super Simple Example - Logger, Configuration & Web Automation
 * 
 * Basic demonstration of importing and using:
 * - Logger (with automatic fallback)
 * - ConfigManager (loading from JSON file)
 * - Playwright Web Automation (with configuration-based setup)
 */

const path = require('path');

// Import the logger and config manager
const logger = require('../common/utils/logger');
const ConfigManager = require('../common/utils/configManager');

// Import playwright driver
const PlaywrightDriver = require('../automator/playwright/drivers/playwrightDriver');

// Define configuration file path
const CONFIG_FILE_PATH = '../../config/simple-example-config.json';
const TARGET_URL = 'https://example.com';

async function simpleWebAutomationExample() {
    console.log('🚀 Starting simple Playwright web automation example...\n');

    // Load configuration
    logger.info('Loading configuration from JSON file...');
    const config = new ConfigManager(CONFIG_FILE_PATH);

    // Get app configuration
    const app = config.get('app', {});
    logger.info(`App: ${app.name} v${app.version}`);
    logger.info(`Debug: ${app.debug ? 'Enabled' : 'Disabled'}`);

    // Get playwright configuration
    const playwright = config.get('playwright', {});
    logger.info(`Browser: ${playwright.browser}`);
    logger.info(`Headless: ${playwright.headless ? 'Yes' : 'No'}`);
    logger.info(`Window Size: ${playwright.windowSize?.width}x${playwright.windowSize?.height}`);
    logger.info(`Video Recording: ${playwright.recordVideo ? 'Enabled' : 'Disabled'}`);
    logger.info(`Target URL: ${playwright.targetUrl || 'Not specified'}`);

    // Create playwright driver based on configuration
    logger.info('\n🌐 Creating web automation driver...');
    
    // Get output configuration for directory setup
    const outputConfig = config.get('output', {});
    
    const driverOptions = {
        browser: playwright.browser || 'chromium',
        headless: playwright.headless !== false,
        windowSize: playwright.windowSize || {
            width: 1920,
            height: 1080
        },
        timeout: playwright.timeout || 30000,
        navigationTimeout: playwright.navigationTimeout || 30000,
        outputPath: outputConfig.baseFolder || './output',
        downloadsPath: outputConfig.downloads?.folder || './downloads',
        acceptInsecureCerts: playwright.acceptInsecureCerts !== false,
        slowMo: playwright.slowMo || 0,
        recordVideo: playwright.recordVideo || false,
        disableImages: playwright.disableImages || false,
        disableJavaScript: playwright.disableJavaScript || false
    };

    // Create unified playwright driver (supports chromium, firefox, webkit)
    const driver = new PlaywrightDriver(driverOptions);
    
    logger.info(`Using Playwright with ${driverOptions.browser} engine`);

    try {
        // Start the browser
        logger.info('Starting browser...');
        await driver.start();

        // Check if video recording is enabled
        if (driverOptions.recordVideo) {
            logger.info('📹 Video recording is enabled - session will be recorded');
        }

        // Navigate to a simple webpage
        logger.info(`Navigating to ${TARGET_URL}...`);
        await driver.navigateTo(TARGET_URL);

        // Get page information
        const pageTitle = await driver.getTitle();
        const currentUrl = await driver.getCurrentUrl();
        
        logger.info(`Page Title: ${pageTitle}`);
        logger.info(`Current URL: ${currentUrl}`);

        // Find and get text from the main heading
        logger.info('Finding page elements...');
        try {
            // Use Playwright's built-in text content method
            const headingText = await driver.getText('h1');
            logger.info(`Main Heading: "${headingText}"`);
        } catch (elementError) {
            logger.warn(`Could not find or read h1 element: ${elementError.message}`);
            logger.info('Continuing without heading text...');
        }

        // Take a screenshot using configured output directories
        logger.info('Taking screenshot...');
        try {
            const outputConfig = config.get('output', {});
            const includeTimestamp = outputConfig.screenshots?.includeTimestamp !== false;
            
            const screenshotPath = await driver.takeScreenshot('example-page.png', includeTimestamp);
            logger.info(`Screenshot saved to organized folder: ${path.basename(screenshotPath)}`);
        } catch (screenshotError) {
            logger.warn(`Screenshot failed: ${screenshotError.message}`);
        }

        // Get output directory paths for reference
        try {
            const paths = driver.getOutputDirectoryConfig();
            logger.info(`Output directories available at: ${paths.baseDirectory}`);
            logger.info(`Download directory: ${paths.downloadDirectory}`);
            logger.info(`Screenshots directory: ${paths.screenshotsDirectory}`);
            logger.info(`Videos directory: ${paths.videosDirectory} (ready for future video recording)`);
        } catch (pathError) {
            logger.warn(`Could not get output paths: ${pathError.message}`);
        }

        // Demonstrate some additional interactions for video recording
        if (driverOptions.recordVideo) {
            logger.info('📹 Recording additional interactions for video...');
            
            // Scroll down and up for visual effect
            await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
            await driver.wait(1000);
            await driver.executeScript('window.scrollTo(0, 0);');
            await driver.wait(1000);
            
            // Get and display some page information
            const pageSource = await driver.getPageSource();
            logger.info(`📄 Page has ${pageSource.length} characters of HTML content`);
        }

        // Wait a moment to see the browser (if not headless)
        if (!playwright.headless) {
            logger.info('Waiting 3 seconds (browser visible)...');
            await driver.wait(3000);
        }

        logger.info('✅ Web automation example completed successfully!');

    } catch (error) {
        logger.error(`❌ Web automation failed: ${error.message || error.toString()}`);
        if (error.stack) {
            logger.error(`Stack trace: ${error.stack}`);
        }
    } finally {
        // Always close the browser
        if (driver && driver.getIsStarted()) {
            logger.info('Closing browser...');
            await driver.quit();
            
            // Video recording info
            if (driverOptions.recordVideo) {
                logger.info('📹 Video recording completed');
                try {
                    const videosPath = await driver.createVideosDirectory();
                    logger.info(`📁 Video files should be available in: ${videosPath.videosPath}`);
                    logger.info('🎬 Video files are automatically saved when the browser context closes');
                    logger.info('📹 Video format: WebM (can be played with most modern video players)');
                } catch (videoError) {
                    logger.warn(`Could not get video directory info: ${videoError.message}`);
                }
            }
        }
    }
}

// Run the example
if (require.main === module) {
    simpleWebAutomationExample().catch(error => {
        console.error('Example failed:', error.message);
        process.exit(1);
    });
}