/**
 * Base Playwright Parser - Data extraction and parsing utilities
 * 
 * Provides foundational parsing capabilities for Playwright-based automation.
 * Playwright offers more powerful data extraction than Selenium.
 */

const logger = require('../../../common/utils/logger');

class BasePlaywrightParser {
  constructor(page) {
    this.page = page;
  }

  /**
   * Extract text content from multiple elements
   */
  async extractTexts(selector, options = {}) {
    try {
      const elements = await this.page.locator(selector);
      const count = await elements.count();
      
      if (count === 0) {
        return options.defaultValue || [];
      }
      
      const texts = [];
      for (let i = 0; i < count; i++) {
        const text = await elements.nth(i).textContent();
        
        if (options.trim !== false) {
          texts.push(text?.trim() || '');
        } else {
          texts.push(text || '');
        }
      }
      
      logger.info(`Extracted ${texts.length} text values from: ${selector}`);
      return texts;
      
    } catch (error) {
      logger.error(`Text extraction failed for ${selector}: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return options.defaultValue || [];
    }
  }

  /**
   * Extract attributes from multiple elements
   */
  async extractAttributes(selector, attributeName, options = {}) {
    try {
      const elements = await this.page.locator(selector);
      const count = await elements.count();
      
      if (count === 0) {
        return options.defaultValue || [];
      }
      
      const attributes = [];
      for (let i = 0; i < count; i++) {
        const attribute = await elements.nth(i).getAttribute(attributeName);
        attributes.push(attribute);
      }
      
      logger.info(`Extracted ${attributes.length} ${attributeName} attributes from: ${selector}`);
      return attributes.filter(attr => attr !== null);
      
    } catch (error) {
      logger.error(`Attribute extraction failed for ${selector}.${attributeName}: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return options.defaultValue || [];
    }
  }

  /**
   * Extract structured data from table
   */
  async extractTable(tableSelector, options = {}) {
    try {
      const headerSelector = options.headerSelector || `${tableSelector} thead th`;
      const rowSelector = options.rowSelector || `${tableSelector} tbody tr`;
      const cellSelector = options.cellSelector || 'td';
      
      // Extract headers
      const headers = await this.extractTexts(headerSelector, { trim: true });
      
      if (headers.length === 0) {
        throw new Error('No table headers found');
      }
      
      // Extract rows
      const rows = [];
      const rowElements = await this.page.locator(rowSelector);
      const rowCount = await rowElements.count();
      
      for (let i = 0; i < rowCount; i++) {
        const row = {};
        const cellElements = await rowElements.nth(i).locator(cellSelector);
        const cellCount = await cellElements.count();
        
        for (let j = 0; j < Math.min(cellCount, headers.length); j++) {
          const cellText = await cellElements.nth(j).textContent();
          const headerName = headers[j] || `column_${j}`;
          
          row[headerName] = options.trim !== false ? cellText?.trim() || '' : cellText || '';
        }
        
        rows.push(row);
      }
      
      logger.info(`Extracted table data: ${headers.length} columns, ${rows.length} rows`);
      
      return {
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length
      };
      
    } catch (error) {
      logger.error(`Table extraction failed for ${tableSelector}: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return {
        headers: [],
        rows: [],
        rowCount: 0,
        columnCount: 0
      };
    }
  }

  /**
   * Extract form data
   */
  async extractFormData(formSelector, options = {}) {
    try {
      const formData = {};
      
      // Extract input fields
      const inputs = await this.page.locator(`${formSelector} input`);
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type') || 'text';
        const id = await input.getAttribute('id');
        
        if (!name && !id) continue;
        
        const fieldName = name || id;
        
        switch (type.toLowerCase()) {
          case 'checkbox':
          case 'radio':
            formData[fieldName] = await input.isChecked();
            break;
          case 'file':
            // Can't extract file values for security reasons
            formData[fieldName] = '[file input]';
            break;
          default:
            formData[fieldName] = await input.inputValue();
        }
      }
      
      // Extract select fields
      const selects = await this.page.locator(`${formSelector} select`);
      const selectCount = await selects.count();
      
      for (let i = 0; i < selectCount; i++) {
        const select = selects.nth(i);
        const name = await select.getAttribute('name');
        const id = await select.getAttribute('id');
        
        if (!name && !id) continue;
        
        const fieldName = name || id;
        
        // Get selected option value
        const selectedOption = await select.locator('option:checked').first();
        formData[fieldName] = await selectedOption.getAttribute('value') || await selectedOption.textContent();
      }
      
      // Extract textarea fields
      const textareas = await this.page.locator(`${formSelector} textarea`);
      const textareaCount = await textareas.count();
      
      for (let i = 0; i < textareaCount; i++) {
        const textarea = textareas.nth(i);
        const name = await textarea.getAttribute('name');
        const id = await textarea.getAttribute('id');
        
        if (!name && !id) continue;
        
        const fieldName = name || id;
        formData[fieldName] = await textarea.inputValue();
      }
      
      logger.info(`Extracted form data with ${Object.keys(formData).length} fields from: ${formSelector}`);
      return formData;
      
    } catch (error) {
      logger.error(`Form data extraction failed for ${formSelector}: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return {};
    }
  }

  /**
   * Extract links with metadata
   */
  async extractLinks(containerSelector = 'body', options = {}) {
    try {
      const linkSelector = options.linkSelector || `${containerSelector} a[href]`;
      const links = [];
      
      const linkElements = await this.page.locator(linkSelector);
      const linkCount = await linkElements.count();
      
      for (let i = 0; i < linkCount; i++) {
        const link = linkElements.nth(i);
        
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        const title = await link.getAttribute('title');
        const target = await link.getAttribute('target');
        
        // Resolve relative URLs
        const absoluteUrl = new URL(href, this.page.url()).href;
        
        links.push({
          href: absoluteUrl,
          text: text?.trim() || '',
          title: title || '',
          target: target || '',
          isExternal: !absoluteUrl.startsWith(new URL(this.page.url()).origin),
          selector: `${linkSelector}:nth-child(${i + 1})`
        });
      }
      
      logger.info(`Extracted ${links.length} links from: ${containerSelector}`);
      return links;
      
    } catch (error) {
      logger.error(`Link extraction failed for ${containerSelector}: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return [];
    }
  }

  /**
   * Extract images with metadata
   */
  async extractImages(containerSelector = 'body', options = {}) {
    try {
      const imageSelector = options.imageSelector || `${containerSelector} img`;
      const images = [];
      
      const imageElements = await this.page.locator(imageSelector);
      const imageCount = await imageElements.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = imageElements.nth(i);
        
        const src = await img.getAttribute('src');
        const alt = await img.getAttribute('alt');
        const title = await img.getAttribute('title');
        const width = await img.getAttribute('width');
        const height = await img.getAttribute('height');
        
        if (!src) continue;
        
        // Resolve relative URLs
        const absoluteUrl = new URL(src, this.page.url()).href;
        
        images.push({
          src: absoluteUrl,
          alt: alt || '',
          title: title || '',
          width: width ? parseInt(width) : null,
          height: height ? parseInt(height) : null,
          selector: `${imageSelector}:nth-child(${i + 1})`
        });
      }
      
      logger.info(`Extracted ${images.length} images from: ${containerSelector}`);
      return images;
      
    } catch (error) {
      logger.error(`Image extraction failed for ${containerSelector}: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return [];
    }
  }

  /**
   * Extract page metadata
   */
  async extractPageMetadata(options = {}) {
    try {
      const metadata = {
        title: await this.page.title(),
        url: this.page.url(),
        timestamp: new Date().toISOString()
      };
      
      // Extract meta tags
      const metaTags = {};
      const metaElements = await this.page.locator('meta');
      const metaCount = await metaElements.count();
      
      for (let i = 0; i < metaCount; i++) {
        const meta = metaElements.nth(i);
        const name = await meta.getAttribute('name') || await meta.getAttribute('property');
        const content = await meta.getAttribute('content');
        
        if (name && content) {
          metaTags[name] = content;
        }
      }
      
      metadata.meta = metaTags;
      
      // Extract structured data (JSON-LD)
      if (options.includeStructuredData) {
        try {
          const structuredData = await this.page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(script => {
              try {
                return JSON.parse(script.textContent);
              } catch {
                return null;
              }
            }).filter(data => data !== null);
          });
          
          metadata.structuredData = structuredData;
        } catch (error) {
          logger.warn('Failed to extract structured data:', error.message);
          metadata.structuredData = [];
        }
      }
      
      logger.info(`Extracted page metadata with ${Object.keys(metaTags).length} meta tags`);
      return metadata;
      
    } catch (error) {
      logger.error(`Page metadata extraction failed: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return {
        title: '',
        url: '',
        timestamp: new Date().toISOString(),
        meta: {},
        structuredData: []
      };
    }
  }

  /**
   * Extract custom data using JavaScript evaluation
   */
  async extractCustomData(evaluationFunction, options = {}) {
    try {
      const result = await this.page.evaluate(evaluationFunction, options.args || []);
      
      logger.info('Custom data extraction completed successfully');
      return result;
      
    } catch (error) {
      logger.error(`Custom data extraction failed: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return options.defaultValue || null;
    }
  }
}

module.exports = BasePlaywrightParser;