const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const edge = require('selenium-webdriver/edge');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../common/utils/logger');

/**
 * Base Selenium Driver - Core WebDriver wrapper with clean API
 * 
 * This class provides a clean, standardized interface that can be easily
 * replicated in other languages using Selenium WebDriver.
 */
class BaseSeleniumDriver {
  // Constants
  static DEFAULT_OUTPUT_DIRECTORY = './output';
  static DEFAULT_DOWNLOADS_DIRECTORY = './downloads';
  static DEFAULT_SCREENSHOTS_DIRECTORY = 'screenshots';
  static DEFAULT_VIDEOS_DIRECTORY = 'videos';

  constructor(options = {}) {
    this.driver = null;
    this.options = {
      browser: 'chrome',           // 'chrome', 'firefox', 'edge'
      headless: true,              // Run without visible window
      windowSize: {                // Browser window size
        width: 1920,
        height: 1080
      },
      timeout: 30000,              // Default timeout in milliseconds
      implicitWait: 10000,         // Implicit wait for elements
      userAgent: null,             // Custom user agent
      downloadsPath: BaseSeleniumDriver.DEFAULT_DOWNLOADS_DIRECTORY,  // Download directory for browser downloads
      outputPath: BaseSeleniumDriver.DEFAULT_OUTPUT_DIRECTORY, // Base output directory
      disableImages: false,        // Disable image loading for performance
      disableJavaScript: false,    // Disable JavaScript
      acceptInsecureCerts: true,   // Accept self-signed certificates
      ...options
    };
    
    this.isStarted = false;
    this.currentUrl = null;
    
    // Initialize directory state from options (resolve to absolute paths from project base directory)
    const projectRoot = path.resolve(__dirname, '../../../../'); // Go up to project root from src/automator/selenium/drivers/
    this.outputDirectoryBasePath = path.isAbsolute(this.options.outputPath) 
      ? this.options.outputPath 
      : path.resolve(projectRoot, this.options.outputPath);
    this.downloadDirectoryBasePath = path.isAbsolute(this.options.downloadsPath) 
      ? this.options.downloadsPath 
      : path.resolve(projectRoot, this.options.downloadsPath);
    this.screenshotsDirectory = BaseSeleniumDriver.DEFAULT_SCREENSHOTS_DIRECTORY;
    this.videosDirectory = BaseSeleniumDriver.DEFAULT_VIDEOS_DIRECTORY;
  }

  /**
   * Start the browser driver
   */
  async start() {
    if (this.isStarted) {
      logger.warn('Driver already started');
      return;
    }

    logger.info(`Starting ${this.options.browser} browser (headless: ${this.options.headless})`);

    try {
      const builder = new Builder();

      // Configure browser-specific options
      switch (this.options.browser.toLowerCase()) {
        case 'chrome':
          builder.forBrowser('chrome');
          const chromeOptions = new chrome.Options();
          
          if (this.options.headless) {
            chromeOptions.addArguments('--headless=new');
          }
          
          chromeOptions.addArguments(
            `--window-size=${this.options.windowSize.width},${this.options.windowSize.height}`,
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--allow-running-insecure-content'
          );
          
          if (this.options.userAgent) {
            chromeOptions.addArguments(`--user-agent=${this.options.userAgent}`);
          }
          
          if (this.options.disableImages) {
            chromeOptions.addArguments('--blink-settings=imagesEnabled=false');
          }
          
          if (this.options.disableJavaScript) {
            chromeOptions.addArguments('--disable-javascript');
          }
          
          // Configure download directory
          if (this.options.downloadsPath) {
            chromeOptions.setUserPreferences({
              'download.default_directory': this.downloadDirectoryBasePath,
              'download.prompt_for_download': false,
              'download.directory_upgrade': true,
              'safebrowsing.enabled': true
            });
            
            // Ensure download directory exists
            await fs.mkdir(this.downloadDirectoryBasePath, { recursive: true });
            logger.info(`Chrome download directory set to: ${this.downloadDirectoryBasePath}`);
          }
          
          builder.setChromeOptions(chromeOptions);
          break;

        case 'firefox':
          builder.forBrowser('firefox');
          const firefoxOptions = new firefox.Options();
          
          if (this.options.headless) {
            firefoxOptions.addArguments('--headless');
          }
          
          firefoxOptions.addArguments(
            `--width=${this.options.windowSize.width}`,
            `--height=${this.options.windowSize.height}`
          );
          
          // Configure download directory
          if (this.options.downloadsPath) {
            firefoxOptions.setPreference('browser.download.dir', this.downloadDirectoryBasePath);
            firefoxOptions.setPreference('browser.download.folderList', 2); // Use custom directory
            firefoxOptions.setPreference('browser.download.useDownloadDir', true);
            firefoxOptions.setPreference('browser.helperApps.neverAsk.saveToDisk', 
              'application/pdf,application/zip,text/csv,application/xml,application/octet-stream');
            
            // Ensure download directory exists
            await fs.mkdir(this.downloadDirectoryBasePath, { recursive: true });
            logger.info(`Firefox download directory set to: ${this.downloadDirectoryBasePath}`);
          }
          
          builder.setFirefoxOptions(firefoxOptions);
          break;

        case 'edge':
          builder.forBrowser('MicrosoftEdge');
          const edgeOptions = new edge.Options();
          
          if (this.options.headless) {
            edgeOptions.addArguments('--headless');
          }
          
          edgeOptions.addArguments(
            `--window-size=${this.options.windowSize.width},${this.options.windowSize.height}`
          );
          
          // Configure download directory  
          if (this.options.downloadsPath) {
            edgeOptions.setUserPreferences({
              'download.default_directory': this.downloadDirectoryBasePath,
              'download.prompt_for_download': false,
              'download.directory_upgrade': true,
              'safebrowsing.enabled': true
            });
            
            // Ensure download directory exists
            await fs.mkdir(this.downloadDirectoryBasePath, { recursive: true });
            logger.info(`Edge download directory set to: ${this.downloadDirectoryBasePath}`);
          }
          
          builder.setEdgeOptions(edgeOptions);
          break;

        default:
          throw new Error(`Unsupported browser: ${this.options.browser}`);
      }

      this.driver = await builder.build();
      
      // Set timeouts
      await this.driver.manage().setTimeouts({
        implicit: this.options.implicitWait,
        pageLoad: this.options.timeout,
        script: this.options.timeout
      });

      this.isStarted = true;
      logger.info('Browser driver started successfully');

    } catch (error) {
      logger.error('Failed to start browser driver:', error.message);
      throw new Error(`Driver startup failed: ${error.message}`);
    }
  }

  /**
   * Stop and quit the browser driver
   */
  async quit() {
    if (!this.isStarted || !this.driver) {
      logger.warn('Driver not started or already quit');
      return;
    }

    try {
      await this.driver.quit();
      this.driver = null;
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
      await this.driver.get(url);
      this.currentUrl = url;
      logger.info('Navigation completed successfully');
      
      return {
        url: await this.driver.getCurrentUrl(),
        title: await this.driver.getTitle(),
        success: true
      };
    } catch (error) {
      logger.error(`Navigation failed: ${error.message}`);
      throw new Error(`Failed to navigate to ${url}: ${error.message}`);
    }
  }

  /**
   * Find a single element by selector
   */
  async findElement(selector, timeout = null) {
    this._ensureStarted();
    
    try {
      const timeoutMs = timeout || this.options.timeout;
      
      // Support different selector types
      let by;
      if (selector.startsWith('//') || selector.startsWith('(//')) {
        by = By.xpath(selector);
      } else if (selector.startsWith('#')) {
        by = By.id(selector.substring(1));
      } else if (selector.startsWith('.')) {
        by = By.className(selector.substring(1));
      } else if (selector.includes('=')) {
        // Support name=value pattern
        const [attr, value] = selector.split('=');
        by = By.css(`[${attr}="${value}"]`);
      } else {
        by = By.css(selector);
      }

      const element = await this.driver.wait(until.elementLocated(by), timeoutMs);
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
      let by;
      if (selector.startsWith('//') || selector.startsWith('(//')) {
        by = By.xpath(selector);
      } else if (selector.startsWith('#')) {
        by = By.id(selector.substring(1));
      } else if (selector.startsWith('.')) {
        by = By.className(selector.substring(1));
      } else {
        by = By.css(selector);
      }

      return await this.driver.findElements(by);
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
      const element = await this.findElement(selector, timeout);
      await this.driver.wait(until.elementIsEnabled(element), timeout || this.options.timeout);
      await element.click();
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
      const element = await this.findElement(selector, timeout);
      await this.driver.wait(until.elementIsEnabled(element), timeout || this.options.timeout);
      await element.sendKeys(text);
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
      const element = await this.findElement(selector, timeout);
      await element.clear();
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
      const element = await this.findElement(selector, timeout);
      const text = await element.getText();
      return text;
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
      await this.findElement(selector, timeoutMs);
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
      const element = await this.findElement(selector, timeoutMs);
      await this.driver.wait(until.elementIsVisible(element), timeoutMs);
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
      const element = await this.findElement(selector, timeoutMs);
      await this.driver.wait(until.elementIsEnabled(element), timeoutMs);
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
      const screenshot = await this.driver.takeScreenshot();
      
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
        
        await fs.writeFile(finalPath, screenshot, 'base64');
        logger.info(`Screenshot saved: ${finalPath}`);
        return finalPath;
      }
      
      return screenshot; // Return base64 string
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
   * Start video recording (NOT YET IMPLEMENTED BUILT-IN IN SELENIUM)
   * TODO: Implement actual video recording functionality
   */
  async startVideoRecording(filename = 'recording.mp4', baseDirectory = null, videosDirectory = null, includeTimestamp = true) {
    // Use provided values or fall back to class variables
    const actualBaseDirectory = baseDirectory || this.outputDirectoryBasePath;
    const actualVideosDirectory = videosDirectory || this.videosDirectory;
    
    // Create video directory (this will update class variables if new values provided)
    await this.createVideosDirectory(actualBaseDirectory, actualVideosDirectory);
    
    throw new Error('Video recording not yet implemented. Use startVideoRecording() when this feature is added.');
  }

  /**
   * Stop video recording (NOT YET IMPLEMENTED BUILT-IN IN SELENIUM)
   * TODO: Implement actual video recording functionality
   */
  async stopVideoRecording() {
    throw new Error('Video recording not yet implemented. Use stopVideoRecording() when this feature is added.');
  }

  /**
   * Get page source HTML
   */
  async getPageSource() {
    this._ensureStarted();
    
    try {
      return await this.driver.getPageSource();
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
      return await this.driver.getTitle();
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
      this.currentUrl = await this.driver.getCurrentUrl();
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
      await this.driver.navigate().back();
      this.currentUrl = await this.getCurrentUrl();
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
      await this.driver.navigate().forward();
      this.currentUrl = await this.getCurrentUrl();
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
      await this.driver.navigate().refresh();
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
      return await this.driver.executeScript(script, ...args);
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
   * Get the underlying WebDriver instance for advanced operations
   * @returns {import('selenium-webdriver').WebDriver} The raw WebDriver instance
   */
  getWebDriver() {
    this._ensureStarted();
    return this.driver;
  }

  /**
   * Private method to ensure driver is started
   */
  _ensureStarted() {
    if (!this.isStarted || !this.driver) {
      throw new Error('Driver not started. Call start() first.');
    }
  }
}

module.exports = BaseSeleniumDriver;