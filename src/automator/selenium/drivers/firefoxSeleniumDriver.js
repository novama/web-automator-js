const BaseSeleniumDriver = require('./baseSeleniumDriver');

/**
 * Firefox-specific Selenium Driver
 * 
 * Extends BaseSeleniumDriver with Firefox-specific optimizations and features.
 */
class FirefoxSeleniumDriver extends BaseSeleniumDriver {
  constructor(options = {}) {
    super({
      browser: 'firefox',
      ...options
    });
  }

  /**
   * Configure Firefox-specific optimizations
   */
  async start() {
    // Add Firefox-specific options before starting
    this.options.firefoxSpecific = {
      disableExtensions: true,
      enableLogging: false,
      ...this.options.firefoxSpecific
    };

    await super.start();
    
    // Firefox-specific post-startup configuration
    if (this.isStarted) {
      await this._configureFirefoxPerformance();
    }
  }

  /**
   * Firefox-specific performance configuration
   */
  async _configureFirefoxPerformance() {
    try {
      // Set Firefox-specific preferences for automation
      await this.executeScript(`
        // Disable animations
        var style = document.createElement('style');
        style.innerHTML = '*{animation-duration:0s !important;transition-duration:0s !important;}';
        document.head.appendChild(style);
      `);
    } catch (error) {
      // Non-critical - log but don't fail
      this.logger?.warn('Firefox performance configuration failed:', error.message);
    }
  }
}

module.exports = FirefoxSeleniumDriver;