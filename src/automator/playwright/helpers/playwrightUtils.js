/**
 * Playwright Utilities
 * 
 * Advanced utility functions for Playwright automation with enhanced selectors,
 * robust interactions, performance monitoring, and Playwright-specific capabilities.
 * Leverages Playwright's powerful built-in features and intelligent waiting.
 */

const logger = require('../../../common/utils/logger');

class PlaywrightUtils {
  /**
   * Analyze Playwright selector strategies and provide metadata
   * @param {string} selector - The selector to analyze
   * @returns {{type: string, selector: string, strategy: string}} Selector information object
   */
  static getSelectorInfo(selector) {
    const info = {
      type: 'css',
      selector: selector,
      strategy: 'default'
    };

    // XPath
    if (selector.startsWith('//') || selector.startsWith('(//')) {
      info.type = 'xpath';
      info.strategy = 'xpath';
    }
    
    // Text content (Playwright has native text selectors)
    else if (selector.startsWith('text=')) {
      info.type = 'text';
      info.strategy = 'text';
      info.selector = selector; // Keep as-is, Playwright handles it
    }
    
    // Partial text content
    else if (selector.includes('text=')) {
      info.type = 'text';
      info.strategy = 'partial-text';
    }
    
    // Role-based selectors (Playwright specific)
    else if (selector.startsWith('role=')) {
      info.type = 'role';
      info.strategy = 'role';
    }
    
    // Label selectors (Playwright specific)
    else if (selector.startsWith('label=')) {
      info.type = 'label';
      info.strategy = 'label';
    }
    
    // Placeholder selectors (Playwright specific)
    else if (selector.startsWith('placeholder=')) {
      info.type = 'placeholder';
      info.strategy = 'placeholder';
    }
    
    // Data-testid selectors (Playwright specific)
    else if (selector.startsWith('data-testid=')) {
      info.type = 'testid';
      info.strategy = 'testid';
      info.selector = `[data-testid="${selector.substring(13)}"]`;
    }
    
    // CSS selector (default)
    else {
      info.type = 'css';
      info.strategy = 'css';
    }

    return info;
  }

  /**
   * Smart element click with retry logic and advanced options
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {string} selector - The element selector to click
   * @param {Object} [options={}] - Click options
   * @param {number} [options.retries=3] - Maximum retry attempts
   * @param {number} [options.retryDelay=1000] - Delay between retries in milliseconds
   * @param {number} [options.timeout=30000] - Timeout for each attempt
   * @param {boolean} [options.force=false] - Whether to force the click
   * @returns {Promise<{success: boolean, attempts: number}>} Click result with attempt count
   */
  static async smartClick(page, selector, options = {}) {
    const maxRetries = options.retries || 3;
    const retryDelay = options.retryDelay || 1000;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Playwright has smart waiting built-in
        await page.click(selector, {
          timeout: options.timeout || 30000,
          force: options.force || false
        });
        
        logger.info(`Smart click successful: ${selector}`);
        return { success: true, attempts: i + 1 };
        
      } catch (error) {
        logger.warn(`Click attempt ${i + 1} failed for ${selector}: ${error.message}`);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Smart text input with clearing and validation
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {string} selector - The element selector to fill
   * @param {string} text - The text to input
   * @param {Object} [options={}] - Fill options
   * @param {boolean} [options.clear=true] - Whether to clear existing text first
   * @param {number} [options.timeout=30000] - Timeout in milliseconds
   * @param {boolean} [options.validate=false] - Whether to validate the input after filling
   * @returns {Promise<{success: boolean, text: string, validated: boolean}>} Fill result with validation status
   */
  static async smartFill(page, selector, text, options = {}) {
    try {
      // Clear first if requested
      if (options.clear !== false) {
        await page.fill(selector, '');
      }
      
      // Fill the text
      await page.fill(selector, text, {
        timeout: options.timeout || 30000
      });
      
      // Validate if requested
      if (options.validate) {
        const actualValue = await page.inputValue(selector);
        if (actualValue !== text) {
          throw new Error(`Text validation failed. Expected: "${text}", Got: "${actualValue}"`);
        }
      }
      
      logger.info(`Smart fill successful: ${selector}`);
      return { success: true, text, validated: options.validate || false };
      
    } catch (error) {
      logger.error(`Smart fill failed for ${selector}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for multiple conditions simultaneously or sequentially
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {Array<{type: string, selector?: string, url?: string, state?: string}>} conditions - Array of conditions to wait for
   * @param {Object} [options={}] - Wait options
   * @param {number} [options.timeout=30000] - Timeout in milliseconds
   * @param {'all'|'any'} [options.mode='all'] - Whether to wait for all conditions or any condition
   * @returns {Promise<{success: boolean, results: Array}>} Results of condition waiting
   */
  static async waitForMultiple(page, conditions, options = {}) {
    const timeout = options.timeout || 30000;
    const mode = options.mode || 'all'; // 'all' or 'any'
    
    try {
      const promises = conditions.map(condition => {
        switch (condition.type) {
          case 'selector':
            return page.waitForSelector(condition.selector, {
              timeout: timeout,
              state: condition.state || 'visible'
            });
          case 'url':
            return page.waitForURL(condition.pattern, { timeout });
          case 'function':
            return page.waitForFunction(condition.fn, condition.args || [], { timeout });
          case 'response':
            return page.waitForResponse(condition.urlPattern, { timeout });
          case 'request':
            return page.waitForRequest(condition.urlPattern, { timeout });
          default:
            throw new Error(`Unknown condition type: ${condition.type}`);
        }
      });

      if (mode === 'all') {
        await Promise.all(promises);
      } else {
        await Promise.race(promises);
      }
      
      logger.info(`Wait for multiple conditions completed (${mode} mode)`);
      return { success: true, mode, conditionsCount: conditions.length };
      
    } catch (error) {
      logger.error(`Wait for multiple conditions failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find element using multiple selectors with fallback strategies
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {string[]} selectors - Array of selectors to try in order
   * @param {Object} [options={}] - Search options
   * @param {number} [options.timeout=30000] - Total timeout distributed across selectors
   * @param {string} [options.state='visible'] - Element state to wait for
   * @returns {Promise<{success: boolean, element?: import('playwright').ElementHandle, selector?: string, attemptNumber?: number}>} Element search result
   */
  static async findElementWithFallback(page, selectors, options = {}) {
    const timeout = options.timeout || 30000;
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      
      try {
        const element = await page.waitForSelector(selector, {
          timeout: timeout / selectors.length, // Distribute timeout across attempts
          state: options.state || 'visible'
        });
        
        if (element) {
          logger.info(`Element found with selector ${i + 1}/${selectors.length}: ${selector}`);
          return { element, selector, attemptIndex: i };
        }
        
      } catch (error) {
        logger.warn(`Selector ${i + 1}/${selectors.length} failed: ${selector} - ${error.message}`);
        
        if (i === selectors.length - 1) {
          throw new Error(`All ${selectors.length} selectors failed to find element`);
        }
      }
    }
  }

  /**
   * Smart form filling with multiple field types support
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {Object<string, {selector?: string, value: any, type?: string}>} formData - Form field data object
   * @param {Object} [options={}] - Form filling options
   * @param {number} [options.timeout=30000] - Timeout for each field operation
   * @returns {Promise<{success: boolean, results: Object<string, any>, errors: Object<string, string>}>} Form filling results
   */
  static async fillForm(page, formData, options = {}) {
    const results = {};
    const timeout = options.timeout || 30000;
    
    try {
      for (const [fieldName, fieldData] of Object.entries(formData)) {
        const selector = fieldData.selector || `[name="${fieldName}"]`;
        const value = fieldData.value;
        const type = fieldData.type || 'text';
        
        logger.info(`Filling form field: ${fieldName}`);
        
        switch (type) {
          case 'text':
          case 'email':
          case 'password':
            await page.fill(selector, value, { timeout });
            break;
            
          case 'select':
            await page.selectOption(selector, value, { timeout });
            break;
            
          case 'checkbox':
            if (value) {
              await page.check(selector, { timeout });
            } else {
              await page.uncheck(selector, { timeout });
            }
            break;
            
          case 'radio':
            await page.check(selector, { timeout });
            break;
            
          case 'file':
            await page.setInputFiles(selector, value, { timeout });
            break;
            
          default:
            throw new Error(`Unknown field type: ${type}`);
        }
        
        results[fieldName] = { success: true, type, value };
      }
      
      logger.info(`Form filling completed. Fields: ${Object.keys(formData).length}`);
      return { success: true, results, fieldsCount: Object.keys(formData).length };
      
    } catch (error) {
      logger.error(`Form filling failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Network interception and route management
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {Object} [options={}] - Interception options
   * @param {boolean} [options.blockImages=false] - Whether to block image resources
   * @param {boolean} [options.blockCSS=false] - Whether to block CSS resources
   * @param {boolean} [options.blockFonts=false] - Whether to block font resources
   * @param {string[]} [options.blockDomains=[]] - Array of domains to block
   * @returns {Promise<{success: boolean, interceptors: string[], blockedRequests: number}>} Interception setup result
   */
  static async interceptNetwork(page, options = {}) {
    const interceptors = [];
    
    try {
      // Block images if requested
      if (options.blockImages) {
        await page.route('**/*.{jpg,jpeg,png,gif,webp,svg}', route => route.abort());
        interceptors.push('images');
      }
      
      // Block CSS if requested
      if (options.blockCSS) {
        await page.route('**/*.css', route => route.abort());
        interceptors.push('css');
      }
      
      // Block fonts if requested
      if (options.blockFonts) {
        await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());
        interceptors.push('fonts');
      }
      
      // Custom route patterns
      if (options.customRoutes) {
        for (const [pattern, handler] of Object.entries(options.customRoutes)) {
          await page.route(pattern, handler);
          interceptors.push(`custom:${pattern}`);
        }
      }
      
      logger.info(`Network interception enabled: ${interceptors.join(', ')}`);
      return { success: true, interceptors };
      
    } catch (error) {
      logger.error(`Network interception setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Performance monitoring and measurement
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {Function} action - The action to measure (async function)
   * @param {Object} [options={}] - Performance options
   * @param {boolean} [options.includeEntries=false] - Whether to include detailed performance entries
   * @param {string[]} [options.entryTypes=['navigation', 'paint', 'measure']] - Performance entry types to collect
   * @returns {Promise<{success: boolean, duration: number, result: any, performanceEntries?: any[], entriesCount: number}>} Performance measurement result
   */
  static async measurePerformance(page, action, options = {}) {
    try {
      const startTime = Date.now();
      
      // Start performance monitoring
      const performanceEntries = [];
      
      if (options.monitorRequests) {
        page.on('request', request => {
          performanceEntries.push({
            type: 'request',
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          });
        });
      }
      
      if (options.monitorResponses) {
        page.on('response', response => {
          performanceEntries.push({
            type: 'response',
            url: response.url(),
            status: response.status(),
            timestamp: Date.now()
          });
        });
      }
      
      // Execute the action
      const result = await action();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logger.info(`Performance measurement completed. Duration: ${duration}ms, Events: ${performanceEntries.length}`);
      
      return {
        success: true,
        duration,
        result,
        performanceEntries: options.includeEntries ? performanceEntries : [],
        entriesCount: performanceEntries.length
      };
      
    } catch (error) {
      logger.error(`Performance measurement failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for DOM to stabilize (no mutations for specified time)
   * @param {import('playwright').Page} page - The Playwright page instance
   * @param {Object} [options={}] - Stability options
   * @param {number} [options.stabilityTimeout=2000] - Time to wait for stability in milliseconds
   * @param {number} [options.maxWait=30000] - Maximum time to wait in milliseconds
   * @returns {Promise<{success: boolean, stabilityTimeout: number}>} Stability result
   */
  static async waitForStableDOM(page, options = {}) {
    const stabilityTimeout = options.stabilityTimeout || 2000;
    const maxWait = options.maxWait || 30000;
    
    try {
      let lastDOMChange = Date.now();
      let domStable = false;
      
      // Set up mutation observer
      await page.evaluate((stabilityTimeout) => {
        return new Promise((resolve) => {
          let timer;
          
          const observer = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
              observer.disconnect();
              resolve();
            }, stabilityTimeout);
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
          
          // Start initial timer
          timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, stabilityTimeout);
        });
      }, stabilityTimeout);
      
      logger.info(`DOM stabilized after waiting ${stabilityTimeout}ms`);
      return { success: true, stabilityTimeout };
      
    } catch (error) {
      logger.error(`Wait for stable DOM failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PlaywrightUtils;