const BaseSeleniumDriver = require('./baseSeleniumDriver');

/**
 * Chrome-specific Selenium Driver
 * 
 * Extends BaseSeleniumDriver with Chrome-specific optimizations and features.
 */
class ChromeSeleniumDriver extends BaseSeleniumDriver {
  constructor(options = {}) {
    super({
      browser: 'chrome',
      ...options
    });
  }

  /**
   * Configure Chrome-specific performance optimizations
   */
  async start() {
    // Add Chrome-specific options before starting
    this.options.chromeSpecific = {
      disableExtensions: true,
      disablePlugins: true,
      disableBackgroundTimer: true,
      disableRendererBackgrounding: true,
      disableBackgroundNetworking: true,
      ...this.options.chromeSpecific
    };

    await super.start();
    
    // Chrome-specific post-startup configuration
    if (this.isStarted) {
      await this._configureChromePerformance();
    }
  }

  /**
   * Chrome-specific performance configuration
   */
  async _configureChromePerformance() {
    try {
      // Disable animations for faster automation
      await this.executeScript(`
        var style = document.createElement('style');
        style.innerHTML = '*{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;transition-delay:0s !important;}';
        document.head.appendChild(style);
      `);

      // Set viewport if not in headless mode
      if (!this.options.headless) {
        await this.driver.manage().window().setRect({
          width: this.options.windowSize.width,
          height: this.options.windowSize.height,
          x: 0,
          y: 0
        });
      }
    } catch (error) {
      // Non-critical - log but don't fail
      this.logger?.warn('Chrome performance configuration failed:', error.message);
    }
  }

  /**
   * Chrome-specific method to clear browser data
   */
  async clearBrowserData() {
    this._ensureStarted();
    
    try {
      // Navigate to Chrome's clear browsing data page
      await this.driver.get('chrome://settings/clearBrowserData');
      await this.wait(1000);
      
      // This is a simplified approach - in practice, you might use CDP
      await this.executeScript(`
        chrome.settingsPrivate.clearBrowsingData({
          dataTypes: ['cookies', 'cache', 'localStorage'],
          timePeriod: 'all'
        });
      `);
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to clear browser data: ${error.message}`);
    }
  }

  /**
   * Chrome DevTools Protocol access (if supported)
   */
  async executeDevToolsCommand(command, params = {}) {
    this._ensureStarted();
    
    try {
      // This would require chrome-remote-interface or similar
      // For now, return a placeholder
      return { 
        success: false, 
        message: 'CDP not implemented in this version',
        command,
        params
      };
    } catch (error) {
      throw new Error(`DevTools command failed: ${error.message}`);
    }
  }
}

module.exports = ChromeSeleniumDriver;