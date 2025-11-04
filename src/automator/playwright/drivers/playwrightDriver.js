const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../common/utils/logger');

/**
 * Unified Playwright Driver - Modern browser automation with unified API
 * 
 * This class provides a clean, standardized interface for all browsers
 * (Chromium, Firefox, WebKit) using Playwright's unified API.
 * Unlike Selenium, Playwright handles all browsers through a single driver.
 */
class PlaywrightDriver {
  // Constants
  static DEFAULT_OUTPUT_DIRECTORY = './output';
  static DEFAULT_DOWNLOADS_DIRECTORY = './downloads';
  static DEFAULT_SCREENSHOTS_DIRECTORY = 'screenshots';
  static DEFAULT_VIDEOS_DIRECTORY = 'videos';

  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.options = {
      browser: 'chromium',          // 'chromium', 'firefox', 'webkit'
      headless: true,               // Run without visible window
      windowSize: {                 // Browser window size
        width: 1920,
        height: 1080
      },
      timeout: 30000,               // Default timeout in milliseconds
      navigationTimeout: 30000,     // Navigation timeout
      userAgent: null,              // Custom user agent
      downloadsPath: PlaywrightDriver.DEFAULT_DOWNLOADS_DIRECTORY,  // Download directory for browser downloads
      outputPath: PlaywrightDriver.DEFAULT_OUTPUT_DIRECTORY, // Base output directory
      disableImages: false,         // Disable image loading for performance
      disableJavaScript: false,     // Disable JavaScript
      acceptInsecureCerts: true,    // Accept self-signed certificates
      recordVideo: false,           // Enable video recording
      slowMo: 0,                   // Slow down operations (for debugging)
      ...options
    };
    
    this.isStarted = false;
    this.currentUrl = null;
    
    // Initialize directory state from options (resolve to absolute paths from project base directory)
    const projectRoot = path.resolve(__dirname, '../../../../'); // Go up to project root from src/automator/playwright/drivers/
    this.outputDirectoryBasePath = path.isAbsolute(this.options.outputPath) 
      ? this.options.outputPath 
      : path.resolve(projectRoot, this.options.outputPath);
    this.downloadDirectoryBasePath = path.isAbsolute(this.options.downloadsPath) 
      ? this.options.downloadsPath 
      : path.resolve(projectRoot, this.options.downloadsPath);
    this.screenshotsDirectory = PlaywrightDriver.DEFAULT_SCREENSHOTS_DIRECTORY;
    this.videosDirectory = PlaywrightDriver.DEFAULT_VIDEOS_DIRECTORY;
  }

  /**
   * Start the browser and create context/page
   */
  async start() {
    if (this.isStarted) {
      logger.warn('Driver already started');
      return;
    }

    logger.info(`Starting ${this.options.browser} browser (headless: ${this.options.headless})`);

    try {
      // Select browser engine
      let browserEngine;
      switch (this.options.browser.toLowerCase()) {
        case 'chromium':
        case 'chrome':
          browserEngine = chromium;
          break;
        case 'firefox':
          browserEngine = firefox;
          break;
        case 'webkit':
        case 'safari':
          browserEngine = webkit;
          break;
        default:
          throw new Error(`Unsupported browser: ${this.options.browser}`);
      }

      // Launch browser
      const launchOptions = {
        headless: this.options.headless,
        slowMo: this.options.slowMo,
        args: []
      };

      // Detect AWS Lambda environment (works for dev, staging, prod)
      const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV;
      
      if (isLambda) {
        try {
          // Try serverless Chromium first (for real AWS Lambda)
          const chromium = require('@sparticuz/chromium');
          launchOptions.executablePath = await chromium.executablePath();
          launchOptions.args = [
            ...launchOptions.args,
            ...chromium.args
          ];
          logger.info('Using serverless Chromium for AWS Lambda environment');
        } catch (error) {
          logger.warn(`Serverless Chromium not available in Lambda: ${error.message}`);
          // In Lambda without @sparticuz/chromium, we'll fail fast with a clear error
          throw new Error('Lambda environment detected but serverless Chromium not available. Install @sparticuz/chromium package.');
        }
      } else {
        // Local/Docker environment
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
        if (executablePath && (this.options.browser === 'chromium' || this.options.browser === 'chrome')) {
          launchOptions.executablePath = executablePath;
          logger.info(`Using custom Chromium executable: ${executablePath}`);
        } else {
          // Use default Playwright browser installation
          logger.info('Using default Playwright browser installation');
        }
      }

      // Add browser-specific launch arguments
      if (this.options.browser === 'chromium' || this.options.browser === 'chrome') {
        launchOptions.args.push(
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--allow-running-insecure-content'
        );
      }

      this.browser = await browserEngine.launch(launchOptions);

      // Create browser context with options
      const contextOptions = {
        viewport: {
          width: this.options.windowSize.width,
          height: this.options.windowSize.height
        },
        ignoreHTTPSErrors: this.options.acceptInsecureCerts
      };

      // Only set userAgent if it's a valid string
      if (typeof this.options.userAgent === 'string' && this.options.userAgent.trim()) {
        contextOptions.userAgent = this.options.userAgent;
      }

      // Configure video recording if enabled
      if (this.options.recordVideo) {
        const videoDirInfo = await this.createVideosDirectory();
        contextOptions.recordVideo = {
          dir: videoDirInfo.videosPath,
          size: {
            width: this.options.windowSize.width,
            height: this.options.windowSize.height
          }
        };
      }

      // Configure download directory
      if (this.options.downloadsPath) {
        contextOptions.acceptDownloads = true;
        contextOptions.downloadsPath = this.downloadDirectoryBasePath;
        
        // Ensure download directory exists
        await fs.mkdir(this.downloadDirectoryBasePath, { recursive: true });
        logger.info(`Download directory set to: ${this.downloadDirectoryBasePath}`);
      }

      this.context = await this.browser.newContext(contextOptions);
      
      // Set timeouts
      this.context.setDefaultTimeout(this.options.timeout);
      this.context.setDefaultNavigationTimeout(this.options.navigationTimeout);

      // Create page
      this.page = await this.context.newPage();

      // Configure page-level settings
      if (this.options.disableImages) {
        await this.page.route('**/*', (route) => {
          const resourceType = route.request().resourceType();
          if (resourceType === 'image') {
            route.abort();
          } else {
            route.continue();
          }
        });
      }

      if (this.options.disableJavaScript) {
        await this.context.addInitScript('window.addEventListener = () => {};');
      }

      this.isStarted = true;
      logger.info('Browser driver started successfully');

    } catch (error) {
      logger.error('Failed to start browser driver:', error.message);
      throw new Error(`Driver startup failed: ${error.message}`);
    }
  }

  /**
   * Stop and close the browser
   */
  async quit() {
    if (!this.isStarted) {
      logger.warn('Driver not started or already quit');
      return;
    }

    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isStarted = false;
      this.currentUrl = null;
      logger.info('Browser driver quit successfully');
    } catch (error) {
      logger.error('Error quitting driver:', error.message);
      throw error;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url) {
    this._ensureStarted();
    
    logger.info(`Navigating to: ${url}`);
    
    try {
      const response = await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.options.navigationTimeout 
      });
      
      this.currentUrl = url;
      logger.info('Navigation completed successfully');
      
      return {
        url: this.page.url(),
        title: await this.page.title(),
        success: response.ok(),
        status: response.status()
      };
    } catch (error) {
      logger.error(`Navigation failed: ${error.message}`);
      throw new Error(`Failed to navigate to ${url}: ${error.message}`);
    }
  }

  /**
   * Find a single element by selector (Playwright has more powerful selectors)
   */
  async findElement(selector, timeout = null) {
    this._ensureStarted();
    
    try {
      const timeoutMs = timeout || this.options.timeout;
      
      // Playwright has powerful built-in selectors
      const element = await this.page.waitForSelector(selector, {
        timeout: timeoutMs,
        state: 'attached'
      });
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      return element;
    } catch (error) {
      logger.error(`Element not found: ${selector}`, error.message);
      throw new Error(`Element not found: ${selector}`);
    }
  }

  /**
   * Find multiple elements by selector
   */
  async findElements(selector) {
    this._ensureStarted();
    
    try {
      return await this.page.locator(selector).all();
    } catch (error) {
      logger.error(`Elements not found: ${selector}`, error.message);
      return [];
    }
  }

  /**
   * Click an element
   */
  async click(selector, timeout = null) {
    this._ensureStarted();
    
    try {
      const timeoutMs = timeout || this.options.timeout;
      
      // Playwright has smart waiting built-in
      await this.page.click(selector, { timeout: timeoutMs });
      logger.info(`Clicked element: ${selector}`);
      
      return { success: true, selector };
    } catch (error) {
      logger.error(`Click failed: ${selector}`, error.message);
      throw new Error(`Failed to click ${selector}: ${error.message}`);
    }
  }

  /**
   * Send keys to an element
   */
  async sendKeys(selector, text, timeout = null) {
    this._ensureStarted();
    
    try {
      const timeoutMs = timeout || this.options.timeout;
      
      await this.page.fill(selector, text, { timeout: timeoutMs });
      logger.info(`Sent keys to element: ${selector}`);
      
      return { success: true, selector, text };
    } catch (error) {
      logger.error(`Send keys failed: ${selector}`, error.message);
      throw new Error(`Failed to send keys to ${selector}: ${error.message}`);
    }
  }

  /**
   * Clear text from an element
   */
  async clearText(selector, timeout = null) {
    this._ensureStarted();
    
    try {
      const timeoutMs = timeout || this.options.timeout;
      
      await this.page.fill(selector, '', { timeout: timeoutMs });
      logger.info(`Cleared text from element: ${selector}`);
      
      return { success: true, selector };
    } catch (error) {
      logger.error(`Clear text failed: ${selector}`, error.message);
      throw new Error(`Failed to clear text from ${selector}: ${error.message}`);
    }
  }

  /**
   * Get text content from an element
   */
  async getText(selector, timeout = null) {
    this._ensureStarted();
    
    try {
      const timeoutMs = timeout || this.options.timeout;
      
      const text = await this.page.textContent(selector, { timeout: timeoutMs });
      return text || '';
    } catch (error) {
      logger.error(`Get text failed: ${selector}`, error.message);
      throw new Error(`Failed to get text from ${selector}: ${error.message}`);
    }
  }

  /**
   * Wait for an element to be present
   */
  async waitForElement(selector, timeout = null) {
    this._ensureStarted();
    
    const timeoutMs = timeout || this.options.timeout;
    
    try {
      await this.page.waitForSelector(selector, { 
        timeout: timeoutMs,
        state: 'attached'
      });
      return { success: true, selector };
    } catch (error) {
      throw new Error(`Element not found within ${timeoutMs}ms: ${selector}`);
    }
  }

  /**
   * Wait for an element to be visible
   */
  async waitForVisible(selector, timeout = null) {
    this._ensureStarted();
    
    const timeoutMs = timeout || this.options.timeout;
    
    try {
      await this.page.waitForSelector(selector, { 
        timeout: timeoutMs,
        state: 'visible'
      });
      return { success: true, selector };
    } catch (error) {
      throw new Error(`Element not visible within ${timeoutMs}ms: ${selector}`);
    }
  }

  /**
   * Wait for an element to be clickable
   */
  async waitForClickable(selector, timeout = null) {
    this._ensureStarted();
    
    const timeoutMs = timeout || this.options.timeout;
    
    try {
      await this.page.waitForSelector(selector, { 
        timeout: timeoutMs,
        state: 'visible'
      });
      
      // Check if element is enabled
      const isEnabled = await this.page.isEnabled(selector);
      if (!isEnabled) {
        throw new Error('Element is disabled');
      }
      
      return { success: true, selector };
    } catch (error) {
      throw new Error(`Element not clickable within ${timeoutMs}ms: ${selector}`);
    }
  }

  /**
   * Generate filename with timestamp if configured
   */
  _generateFilename(baseName, includeTimestamp = true) {
    let filename = baseName;
    
    if (includeTimestamp) {
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace(/T/, '_')
        .slice(0, -5); // Remove milliseconds
      
      const extension = path.extname(filename);
      const nameWithoutExt = path.basename(filename, extension);
      filename = `${nameWithoutExt}_${timestamp}${extension}`;
    }
    
    return filename;
  }

  /**
   * Take a screenshot with configured output directory
   */
  async takeScreenshot(filename = null, includeTimestamp = true, baseDirectory = null, screenshotsDirectory = null) {
    this._ensureStarted();
    
    try {
      if (filename) {
        // Use provided values or fall back to class variables
        const actualBaseDirectory = baseDirectory || this.outputDirectoryBasePath;
        const actualScreenshotsDirectory = screenshotsDirectory || this.screenshotsDirectory;
        
        // Create output directories
        const paths = await this.createScreenshotsDirectory(actualBaseDirectory, actualScreenshotsDirectory);
        
        // Generate filename with timestamp if configured
        const finalFilename = this._generateFilename(filename, includeTimestamp);
        
        // Create full filepath
        const filepath = path.join(paths.screenshotsPath, finalFilename);
        
        // Ensure the filename has proper extension
        const ext = path.extname(filepath);
        const finalPath = ext ? filepath : `${filepath}.png`;
        
        // Playwright screenshot - much simpler than Selenium!
        await this.page.screenshot({ 
          path: finalPath,
          fullPage: true // Capture full page by default
        });
        
        logger.info(`Screenshot saved: ${finalPath}`);
        return finalPath;
      }
      
      // Return screenshot buffer
      return await this.page.screenshot({ fullPage: true });
      
    } catch (error) {
      logger.error('Screenshot failed:', error.message);
      throw new Error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Create the screenshots output directory
   */
  async createScreenshotsDirectory(baseDirectory = this.outputDirectoryBasePath, screenshotsDirectory = this.screenshotsDirectory, createDirectories = true) {
    try {
      // Use provided values to resolve final paths (don't modify class state here)
      const projectRoot = path.resolve(__dirname, '../../../../'); // Go up to project root
      const resolvedBaseDirectory = path.isAbsolute(baseDirectory) 
        ? baseDirectory 
        : path.resolve(projectRoot, baseDirectory);
      const screenshotsPath = path.resolve(resolvedBaseDirectory, screenshotsDirectory);

      if (createDirectories) {
        await fs.mkdir(screenshotsPath, { recursive: true });
        logger.info(`Screenshots output directory created: ${screenshotsPath}`);
      }

      return {
        screenshotsPath,
        baseDirectory: resolvedBaseDirectory
      };
    } catch (error) {
      logger.error('Screenshots directory creation failed:', error.message);
      throw new Error(`Failed to create screenshots directory: ${error.message}`);
    }
  }

  /**
   * Create videos output directory
   */
  async createVideosDirectory(baseDirectory = this.outputDirectoryBasePath, videosDirectory = this.videosDirectory, createDirectories = true) {
    try {
      // Use provided values to resolve final paths (don't modify class state here)
      const projectRoot = path.resolve(__dirname, '../../../../'); // Go up to project root
      const resolvedBaseDirectory = path.isAbsolute(baseDirectory) 
        ? baseDirectory 
        : path.resolve(projectRoot, baseDirectory);
      const videosPath = path.resolve(resolvedBaseDirectory, videosDirectory);

      if (createDirectories) {
        await fs.mkdir(videosPath, { recursive: true });
        logger.info(`Videos output directory created: ${videosPath}`);
      }

      return {
        videosPath,
        baseDirectory: resolvedBaseDirectory
      };
    } catch (error) {
      logger.error('Video directory creation failed:', error.message);
      throw new Error(`Failed to create video directory: ${error.message}`);
    }
  }

  /**
   * Start video recording (Playwright has built-in support!)
   */
  async startVideoRecording(filename = 'recording.webm', baseDirectory = null, videosDirectory = null, includeTimestamp = true) {
    this._ensureStarted();
    
    logger.warn('Video recording should be enabled at browser start. Use recordVideo: true in options and restart browser.');
    
    if (!this.options.recordVideo) {
      throw new Error('Video recording not enabled. Set recordVideo: true in options and restart browser.');
    }
    
    // Video recording is automatically handled by Playwright context
    logger.info('Video recording is active (managed by Playwright context)');
    return { success: true, message: 'Video recording active' };
  }

  /**
   * Stop video recording and get video path
   */
  async stopVideoRecording() {
    this._ensureStarted();
    
    if (!this.options.recordVideo) {
      throw new Error('Video recording not enabled');
    }
    
    try {
      // Get video path from page
      const videoPath = await this.page.video().path();
      logger.info(`Video recording saved: ${videoPath}`);
      return videoPath;
    } catch (error) {
      logger.error('Failed to get video path:', error.message);
      throw new Error(`Failed to stop video recording: ${error.message}`);
    }
  }

  /**
   * Get page source HTML
   */
  async getPageSource() {
    this._ensureStarted();
    
    try {
      return await this.page.content();
    } catch (error) {
      logger.error('Get page source failed:', error.message);
      throw new Error(`Failed to get page source: ${error.message}`);
    }
  }

  /**
   * Get current page title
   */
  async getTitle() {
    this._ensureStarted();
    
    try {
      return await this.page.title();
    } catch (error) {
      logger.error('Get title failed:', error.message);
      throw new Error(`Failed to get page title: ${error.message}`);
    }
  }

  /**
   * Get current URL
   */
  async getCurrentUrl() {
    this._ensureStarted();
    
    try {
      this.currentUrl = this.page.url();
      return this.currentUrl;
    } catch (error) {
      logger.error('Get current URL failed:', error.message);
      throw new Error(`Failed to get current URL: ${error.message}`);
    }
  }

  /**
   * Navigate back in browser history
   */
  async goBack() {
    this._ensureStarted();
    
    try {
      await this.page.goBack();
      this.currentUrl = this.page.url();
      logger.info('Navigated back');
    } catch (error) {
      logger.error('Go back failed:', error.message);
      throw new Error(`Failed to go back: ${error.message}`);
    }
  }

  /**
   * Navigate forward in browser history
   */
  async goForward() {
    this._ensureStarted();
    
    try {
      await this.page.goForward();
      this.currentUrl = this.page.url();
      logger.info('Navigated forward');
    } catch (error) {
      logger.error('Go forward failed:', error.message);
      throw new Error(`Failed to go forward: ${error.message}`);
    }
  }

  /**
   * Refresh the current page
   */
  async refresh() {
    this._ensureStarted();
    
    try {
      await this.page.reload();
      logger.info('Page refreshed');
    } catch (error) {
      logger.error('Refresh failed:', error.message);
      throw new Error(`Failed to refresh page: ${error.message}`);
    }
  }

  /**
   * Execute JavaScript in the browser
   */
  async executeScript(script, ...args) {
    this._ensureStarted();
    
    try {
      return await this.page.evaluate(script, ...args);
    } catch (error) {
      logger.error('Execute script failed:', error.message);
      throw new Error(`Failed to execute script: ${error.message}`);
    }
  }

  /**
   * Wait for a specified amount of time
   */
  async wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Check if driver is started
   */
  getIsStarted() {
    return this.isStarted;
  }

  /**
   * Get driver options
   */
  getOptions() {
    return { ...this.options };
  }

  /**
   * Get current output directory configuration
   */
  getOutputDirectoryConfig() {
    return {
      baseDirectory: this.outputDirectoryBasePath,
      screenshotsDirectory: this.screenshotsDirectory,
      videosDirectory: this.videosDirectory,
      downloadDirectory: this.downloadDirectoryBasePath
    };
  }

  /**
   * Get or create the download directory
   * @param {string} [downloadsPath=null] - Override download directory path
   * @param {boolean} [createDirectory=true] - Whether to create directory if it doesn't exist
   * @returns {Promise<{downloadPath: string}>} Download directory information
   */
  async getDownloadDirectory(downloadsPath = null, createDirectory = true) {
    try {
      // Use provided directory or fall back to internal state
      const projectRoot = path.resolve(__dirname, '../../../../'); // Go up to project root
      const downloadPath = downloadsPath 
        ? (path.isAbsolute(downloadsPath) ? downloadsPath : path.resolve(projectRoot, downloadsPath))
        : this.downloadDirectoryBasePath;

      if (createDirectory) {
        await fs.mkdir(downloadPath, { recursive: true });
        logger.info(`Download directory ready: ${downloadPath}`);
      }

      return {
        downloadPath
      };
    } catch (error) {
      logger.error('Download directory creation failed:', error.message);
      throw new Error(`Failed to setup download directory: ${error.message}`);
    }
  }

  /**
   * Get the underlying Playwright Page instance for advanced operations
   * @returns {import('playwright').Page} The Playwright page instance
   */
  getPage() {
    this._ensureStarted();
    return this.page;
  }

  /**
   * Get the underlying Playwright Browser Context for advanced operations
   * @returns {import('playwright').BrowserContext} The Playwright context instance
   */
  getContext() {
    this._ensureStarted();
    return this.context;
  }

  /**
   * Get the underlying Playwright Browser instance for advanced operations
   * @returns {import('playwright').Browser} The Playwright browser instance
   */
  getBrowser() {
    this._ensureStarted();
    return this.browser;
  }

  /**
   * Private method to ensure driver is started
   */
  _ensureStarted() {
    if (!this.isStarted || !this.page) {
      throw new Error('Driver not started. Call start() first.');
    }
  }
}

module.exports = PlaywrightDriver;