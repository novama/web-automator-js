const BaseSeleniumDriver = require('./baseSeleniumDriver');

/**
 * Edge-specific Selenium Driver
 * 
 * Extends BaseSeleniumDriver with Edge-specific optimizations and features.
 */
class EdgeSeleniumDriver extends BaseSeleniumDriver {
  constructor(options = {}) {
    super({
      browser: 'edge',
      ...options
    });
  }

  /**
   * Configure Edge-specific optimizations
   */
  async start() {
    // Add Edge-specific options before starting
    this.options.edgeSpecific = {
      disableExtensions: true,
      enableLogging: false,
      ...this.options.edgeSpecific
    };

    await super.start();
    
    // Edge-specific post-startup configuration
    if (this.isStarted) {
      await this._configureEdgePerformance();
    }
  }

  /**
   * Edge-specific performance configuration
   */
  async _configureEdgePerformance() {
    try {
      // Edge shares Chrome's engine, so similar optimizations apply
      await this.executeScript(`
        var style = document.createElement('style');
        style.innerHTML = '*{animation-duration:0s !important;transition-duration:0s !important;}';
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
      this.logger?.warn('Edge performance configuration failed:', error.message);
    }
  }
}

module.exports = EdgeSeleniumDriver;