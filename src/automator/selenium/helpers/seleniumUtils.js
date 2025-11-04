/**
 * Selenium WebDriver Utilities
 * 
 * Advanced utility functions for Selenium WebDriver automation with smart selectors,
 * robust interactions, retry logic, and enhanced element handling capabilities.
 */

const { By, until } = require('selenium-webdriver');
const logger = require('../../../common/utils/logger');

class SeleniumUtils {
  /**
   * Smart element selector that tries multiple strategies
   * @param {string} selector - The selector string to convert
   * @returns {import('selenium-webdriver').By} Selenium By locator
   */
  static getSmartSelector(selector) {
    // XPath
    if (selector.startsWith('//') || selector.startsWith('(//')) {
      return By.xpath(selector);
    }
    
    // ID
    if (selector.startsWith('#')) {
      return By.id(selector.substring(1));
    }
    
    // Class
    if (selector.startsWith('.')) {
      return By.className(selector.substring(1));
    }
    
    // Attribute=value pattern
    if (selector.includes('=') && !selector.includes('[') && !selector.includes(' ')) {
      const [attr, value] = selector.split('=');
      return By.css(`[${attr}="${value}"]`);
    }
    
    // Text content (convert to XPath)
    if (selector.startsWith('text:')) {
      const text = selector.substring(5);
      return By.xpath(`//*[contains(text(), "${text}")]`);
    }
    
    // Partial text content
    if (selector.startsWith('partial-text:')) {
      const text = selector.substring(13);
      return By.xpath(`//*[contains(text(), "${text}")]`);
    }
    
    // Default to CSS selector
    return By.css(selector);
  }

  /**
   * Smart wait for element with multiple conditions
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector
   * @param {number} [timeout=30000] - Timeout in milliseconds
   * @param {'present'|'visible'|'clickable'|'invisible'} [condition='present'] - Wait condition
   * @returns {Promise<import('selenium-webdriver').WebElement>} The found element
   */
  static async smartWaitForElement(driver, selector, timeout = 30000, condition = 'present') {
    const by = this.getSmartSelector(selector);
    
    switch (condition) {
      case 'present':
        return await driver.wait(until.elementLocated(by), timeout);
      
      case 'visible':
        const element = await driver.wait(until.elementLocated(by), timeout);
        await driver.wait(until.elementIsVisible(element), timeout);
        return element;
      
      case 'clickable':
        const clickableElement = await driver.wait(until.elementLocated(by), timeout);
        await driver.wait(until.elementIsEnabled(clickableElement), timeout);
        return clickableElement;
      
      case 'invisible':
        const invisibleElement = await driver.wait(until.elementLocated(by), timeout);
        await driver.wait(until.elementIsNotVisible(invisibleElement), timeout);
        return invisibleElement;
      
      default:
        throw new Error(`Unknown wait condition: ${condition}`);
    }
  }

  /**
   * Safe click with retry logic
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector to click
   * @param {number} [maxRetries=3] - Maximum number of retry attempts
   * @param {number} [retryDelay=1000] - Delay between retries in milliseconds
   * @returns {Promise<boolean>} True if click succeeded, false otherwise
   */
  static async safeClick(driver, selector, maxRetries = 3, retryDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const element = await this.smartWaitForElement(driver, selector, 5000, 'clickable');
        
        // Scroll element into view
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', element);
        
        // Small delay for scroll to complete
        await this.wait(500);
        
        // Try to click
        await element.click();
        
        logger.info(`Successfully clicked element: ${selector}`);
        return true;
        
      } catch (error) {
        logger.warn(`Click attempt ${attempt}/${maxRetries} failed for ${selector}: ${error.message}`);
        
        if (attempt < maxRetries) {
          await this.wait(retryDelay);
        } else {
          throw new Error(`Failed to click ${selector} after ${maxRetries} attempts`);
        }
      }
    }
    
    return false;
  }

  /**
   * Safe text input with clear and retry logic
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector to type into
   * @param {string} text - The text to input
   * @param {boolean} [clearFirst=true] - Whether to clear existing text first
   * @param {number} [maxRetries=3] - Maximum number of retry attempts
   * @returns {Promise<boolean>} True if text input succeeded, false otherwise
   */
  static async safeSendKeys(driver, selector, text, clearFirst = true, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const element = await this.smartWaitForElement(driver, selector, 5000, 'clickable');
        
        // Scroll element into view
        await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', element);
        
        // Clear existing text if requested
        if (clearFirst) {
          await element.clear();
          await this.wait(100); // Small delay after clear
        }
        
        // Send the text
        await element.sendKeys(text);
        
        // Verify text was entered (optional verification)
        const actualValue = await element.getAttribute('value');
        if (actualValue && !actualValue.includes(text)) {
          throw new Error(`Text verification failed. Expected: ${text}, Actual: ${actualValue}`);
        }
        
        logger.info(`Successfully sent keys to element: ${selector}`);
        return true;
        
      } catch (error) {
        logger.warn(`Send keys attempt ${attempt}/${maxRetries} failed for ${selector}: ${error.message}`);
        
        if (attempt < maxRetries) {
          await this.wait(1000);
        } else {
          throw new Error(`Failed to send keys to ${selector} after ${maxRetries} attempts`);
        }
      }
    }
    
    return false;
  }

  /**
   * Get element text with fallback strategies
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector
   * @returns {Promise<string>} The element's text content
   */
  static async getElementText(driver, selector) {
    try {
      const element = await this.smartWaitForElement(driver, selector, 5000);
      
      // Try different text extraction methods
      let text = await element.getText();
      
      if (!text || text.trim() === '') {
        // Fallback to innerHTML
        text = await element.getAttribute('innerHTML');
        
        if (!text) {
          // Fallback to textContent
          text = await driver.executeScript('return arguments[0].textContent;', element);
        }
      }
      
      return (text || '').trim();
      
    } catch (error) {
      logger.error(`Failed to get text from ${selector}: ${error.message}`);
      return '';
    }
  }

  /**
   * Check if element exists without throwing error
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector to check
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<boolean>} True if element exists, false otherwise
   */
  static async elementExists(driver, selector, timeout = 5000) {
    try {
      await this.smartWaitForElement(driver, selector, timeout);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if element is visible
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector to check
   * @returns {Promise<boolean>} True if element is visible, false otherwise
   */
  static async isElementVisible(driver, selector) {
    try {
      const element = await this.smartWaitForElement(driver, selector, 5000);
      return await element.isDisplayed();
    } catch (error) {
      return false;
    }
  }

  /**
   * Scroll element into view
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string} selector - The element selector to scroll to
   * @returns {Promise<boolean>} True if scroll succeeded, false otherwise
   */
  static async scrollToElement(driver, selector) {
    try {
      const element = await this.smartWaitForElement(driver, selector, 5000);
      await driver.executeScript('arguments[0].scrollIntoView({block: "center", behavior: "smooth"});', element);
      await this.wait(500); // Wait for scroll to complete
      return true;
    } catch (error) {
      logger.error(`Failed to scroll to element ${selector}: ${error.message}`);
      return false;
    }
  }

  /**
   * Wait for page to load completely
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {number} [timeout=30000] - Timeout in milliseconds
   * @returns {Promise<boolean>} True if page loaded successfully, false if timeout
   */
  static async waitForPageLoad(driver, timeout = 30000) {
    try {
      await driver.wait(async () => {
        const readyState = await driver.executeScript('return document.readyState');
        return readyState === 'complete';
      }, timeout);
      
      // Additional wait for any dynamic content
      await this.wait(1000);
      
      return true;
    } catch (error) {
      logger.warn(`Page load wait timed out: ${error.message}`);
      return false;
    }
  }

  /**
   * Take screenshot with simple file path handling
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {string|null} [filePath=null] - Optional complete file path to save screenshot (with extension)
   * @returns {Promise<string>} Base64 screenshot data or file path if saved
   */
  static async takeScreenshot(driver, filePath = null) {
    try {
      const screenshot = await driver.takeScreenshot();
      
      if (filePath) {
        const fs = require('fs').promises;
        const path = require('path');
        
        // Ensure directory exists for the provided file path
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Save screenshot to the exact path provided
        const resolvedPath = path.resolve(filePath);
        await fs.writeFile(resolvedPath, screenshot, 'base64');
        
        logger.info(`Screenshot saved: ${resolvedPath}`);
        return resolvedPath;
      }
      
      return screenshot; // Return base64 string
    } catch (error) {
      logger.error(`Screenshot failed: ${error.message}`);
      throw new Error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Get current timestamp for filenames
   * @returns {string} Formatted timestamp string for use in filenames
   */
  static getTimestamp() {
    const now = new Date();
    return now.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .substring(0, 19);
  }

  /**
   * Wait for specified milliseconds
   * @param {number} milliseconds - Number of milliseconds to wait
   * @returns {Promise<void>} Promise that resolves after the delay
   */
  static async wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Get browser information
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @returns {Promise<{userAgent: string, viewport: {width: number, height: number}, url: string, title: string, timestamp: string}|null>} Browser info object or null if failed
   */
  static async getBrowserInfo(driver) {
    try {
      const userAgent = await driver.executeScript('return navigator.userAgent;');
      const viewport = await driver.executeScript('return {width: window.innerWidth, height: window.innerHeight};');
      const url = await driver.getCurrentUrl();
      const title = await driver.getTitle();
      
      return {
        userAgent,
        viewport,
        url,
        title,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to get browser info: ${error.message}`);
      return null;
    }
  }

  /**
   * Handle JavaScript alerts/confirms/prompts
   * @param {import('selenium-webdriver').WebDriver} driver - The WebDriver instance
   * @param {'accept'|'dismiss'|'sendkeys'} action - The action to perform on the alert
   * @param {string|null} text - Text to send to alert if using 'sendkeys' action
   * @returns {Promise<string|null>} Alert text if successfully handled, null if no alert or failed
   */
  static async handleAlert(driver, action = 'accept', text = null) {
    try {
      const alert = await driver.switchTo().alert();
      const alertText = await alert.getText();
      
      switch (action.toLowerCase()) {
        case 'accept':
          await alert.accept();
          break;
        case 'dismiss':
          await alert.dismiss();
          break;
        case 'sendkeys':
          if (text) {
            await alert.sendKeys(text);
          }
          await alert.accept();
          break;
        default:
          throw new Error(`Unknown alert action: ${action}`);
      }
      
      logger.info(`Handled alert: ${action} - "${alertText}"`);
      return alertText;
      
    } catch (error) {
      // No alert present or handling failed
      return null;
    }
  }
}

module.exports = SeleniumUtils;