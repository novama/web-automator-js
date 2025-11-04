const { By } = require('selenium-webdriver');
const SeleniumUtils = require('../helpers/seleniumUtils');
const logger = require('../../../common/utils/logger');

/**
 * Base Browser Parser - Works with Selenium WebElements instead of HTML strings
 * 
 * This parser provides DOM analysis capabilities using live browser elements
 * rather than static HTML parsing. Can be easily replicated in C#.
 */
class BaseBrowserParser {
  constructor(driver) {
    this.driver = driver;
  }

  /**
   * Find all forms on the current page
   * 
   * C# equivalent: public async Task<List<FormInfo>> GetAllFormsAsync()
   */
  async getAllForms() {
    try {
      const forms = await this.driver.findElements(By.css('form'));
      const formData = [];
      
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        
        try {
          const action = await form.getAttribute('action') || '';
          const method = (await form.getAttribute('method') || 'GET').toUpperCase();
          const name = await form.getAttribute('name') || `form-${i}`;
          const id = await form.getAttribute('id') || `form-${i}`;
          
          // Get form fields
          const fields = await this._getFormFields(form);
          
          formData.push({
            index: i,
            id,
            name,
            action,
            method,
            fields,
            fieldCount: Object.keys(fields).length
          });
          
        } catch (error) {
          logger.warn(`Error parsing form ${i}: ${error.message}`);
        }
      }
      
      logger.info(`Found ${formData.length} forms on page`);
      return formData;
      
    } catch (error) {
      logger.error('Form parsing failed:', error.message);
      return [];
    }
  }

  /**
   * Get fields from a specific form element
   */
  async _getFormFields(form) {
    const fields = {};
    
    try {
      // Get input fields
      const inputs = await form.findElements(By.css('input'));
      for (const input of inputs) {
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type') || 'text';
        const value = await input.getAttribute('value') || '';
        const placeholder = await input.getAttribute('placeholder') || '';
        const required = await input.getAttribute('required') !== null;
        
        if (name && type !== 'submit' && type !== 'button') {
          fields[name] = {
            type,
            value,
            placeholder,
            required,
            element: 'input'
          };
        }
      }
      
      // Get select fields
      const selects = await form.findElements(By.css('select'));
      for (const select of selects) {
        const name = await select.getAttribute('name');
        if (name) {
          const options = await select.findElements(By.css('option'));
          const optionValues = [];
          let selectedValue = '';
          
          for (const option of options) {
            const value = await option.getAttribute('value') || '';
            const text = await option.getText();
            const selected = await option.isSelected();
            
            optionValues.push({ value, text, selected });
            
            if (selected) {
              selectedValue = value;
            }
          }
          
          fields[name] = {
            type: 'select',
            value: selectedValue,
            options: optionValues,
            element: 'select'
          };
        }
      }
      
      // Get textarea fields
      const textareas = await form.findElements(By.css('textarea'));
      for (const textarea of textareas) {
        const name = await textarea.getAttribute('name');
        if (name) {
          const value = await textarea.getAttribute('value') || '';
          const placeholder = await textarea.getAttribute('placeholder') || '';
          
          fields[name] = {
            type: 'textarea',
            value,
            placeholder,
            element: 'textarea'
          };
        }
      }
      
    } catch (error) {
      logger.warn('Error extracting form fields:', error.message);
    }
    
    return fields;
  }

  /**
   * Find the best form for automation (most fields, likely to be main form)
   */
  async findBestForm() {
    const forms = await this.getAllForms();
    
    if (forms.length === 0) {
      throw new Error('No forms found on page');
    }
    
    // Find form with the most fields
    const bestForm = forms.reduce((best, current) => {
      return current.fieldCount > best.fieldCount ? current : best;
    });
    
    logger.info(`Selected best form: ${bestForm.id} with ${bestForm.fieldCount} fields`);
    return bestForm;
  }

  /**
   * Get all links on the page
   */
  async getAllLinks() {
    try {
      const links = await this.driver.findElements(By.css('a[href]'));
      const linkData = [];
      
      for (let i = 0; i < Math.min(links.length, 50); i++) { // Limit to prevent performance issues
        const link = links[i];
        
        try {
          const href = await link.getAttribute('href');
          const text = await link.getText();
          const title = await link.getAttribute('title') || '';
          
          if (href) {
            linkData.push({
              index: i,
              href,
              text: text.trim(),
              title,
              isExternal: !href.includes(await this.driver.getCurrentUrl().then(url => new URL(url).hostname))
            });
          }
          
        } catch (error) {
          // Skip problematic links
          continue;
        }
      }
      
      logger.info(`Found ${linkData.length} links on page`);
      return linkData;
      
    } catch (error) {
      logger.error('Link parsing failed:', error.message);
      return [];
    }
  }

  /**
   * Get page content summary
   */
  async getPageContentSummary() {
    try {
      const summary = await this.driver.executeScript(`
        return {
          title: document.title,
          url: window.location.href,
          headings: {
            h1: document.querySelectorAll('h1').length,
            h2: document.querySelectorAll('h2').length,
            h3: document.querySelectorAll('h3').length,
            h4: document.querySelectorAll('h4').length,
            h5: document.querySelectorAll('h5').length,
            h6: document.querySelectorAll('h6').length
          },
          elements: {
            paragraphs: document.querySelectorAll('p').length,
            divs: document.querySelectorAll('div').length,
            spans: document.querySelectorAll('span').length,
            images: document.querySelectorAll('img').length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            forms: document.querySelectorAll('form').length,
            links: document.querySelectorAll('a').length
          },
          text: {
            bodyText: document.body ? document.body.innerText.substring(0, 500) : '',
            wordCount: document.body ? document.body.innerText.split(/\\s+/).length : 0
          },
          meta: {
            charset: document.characterSet,
            language: document.documentElement.lang || 'unknown',
            viewport: document.querySelector('meta[name="viewport"]')?.content || 'not set'
          }
        };
      `);
      
      return summary;
      
    } catch (error) {
      logger.error('Page content summary failed:', error.message);
      return null;
    }
  }

  /**
   * Find elements that look like search inputs
   */
  async findSearchInputs() {
    try {
      const searchInputs = [];
      
      // Try multiple strategies to find search inputs
      const searchSelectors = [
        'input[type="search"]',
        'input[name*="search" i]',
        'input[id*="search" i]',
        'input[placeholder*="search" i]',
        'input[class*="search" i]',
        'input[aria-label*="search" i]'
      ];
      
      for (const selector of searchSelectors) {
        try {
          const elements = await this.driver.findElements(By.css(selector));
          
          for (const element of elements) {
            const name = await element.getAttribute('name') || '';
            const id = await element.getAttribute('id') || '';
            const placeholder = await element.getAttribute('placeholder') || '';
            const className = await element.getAttribute('class') || '';
            
            searchInputs.push({
              selector,
              name,
              id,
              placeholder,
              className,
              element
            });
          }
        } catch (error) {
          // Continue with next selector
          continue;
        }
      }
      
      // Remove duplicates based on name or id
      const uniqueInputs = searchInputs.filter((input, index, array) => {
        return array.findIndex(item => 
          (item.name && item.name === input.name) || 
          (item.id && item.id === input.id)
        ) === index;
      });
      
      logger.info(`Found ${uniqueInputs.length} search inputs`);
      return uniqueInputs;
      
    } catch (error) {
      logger.error('Search input detection failed:', error.message);
      return [];
    }
  }

  /**
   * Extract structured data from the page (JSON-LD, microdata, etc.)
   */
  async extractStructuredData() {
    try {
      const structuredData = await this.driver.executeScript(`
        const data = [];
        
        // Extract JSON-LD structured data
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach(script => {
          try {
            const jsonData = JSON.parse(script.textContent);
            data.push({
              type: 'json-ld',
              data: jsonData
            });
          } catch (e) {
            // Skip invalid JSON
          }
        });
        
        // Extract meta tags
        const metaTags = document.querySelectorAll('meta[property], meta[name]');
        const metaData = {};
        metaTags.forEach(tag => {
          const property = tag.getAttribute('property') || tag.getAttribute('name');
          const content = tag.getAttribute('content');
          if (property && content) {
            metaData[property] = content;
          }
        });
        
        if (Object.keys(metaData).length > 0) {
          data.push({
            type: 'meta-tags',
            data: metaData
          });
        }
        
        return data;
      `);
      
      logger.info(`Extracted ${structuredData.length} structured data items`);
      return structuredData;
      
    } catch (error) {
      logger.error('Structured data extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Check if page has specific capabilities (search, forms, etc.)
   */
  async analyzePageCapabilities() {
    try {
      const forms = await this.getAllForms();
      const searchInputs = await this.findSearchInputs();
      const links = await this.getAllLinks();
      
      const capabilities = {
        hasForms: forms.length > 0,
        hasSearch: searchInputs.length > 0,
        hasLinks: links.length > 0,
        formCount: forms.length,
        searchInputCount: searchInputs.length,
        linkCount: links.length,
        primaryForm: forms.length > 0 ? forms[0] : null,
        primarySearchInput: searchInputs.length > 0 ? searchInputs[0] : null
      };
      
      // Additional checks
      const hasLoginForm = forms.some(form => 
        Object.keys(form.fields).some(field => 
          field.toLowerCase().includes('password') || 
          field.toLowerCase().includes('login') ||
          field.toLowerCase().includes('email')
        )
      );
      
      const hasContactForm = forms.some(form =>
        Object.keys(form.fields).some(field =>
          field.toLowerCase().includes('message') ||
          field.toLowerCase().includes('contact') ||
          field.toLowerCase().includes('subject')
        )
      );
      
      capabilities.hasLoginForm = hasLoginForm;
      capabilities.hasContactForm = hasContactForm;
      
      logger.info('Page capabilities analyzed:', capabilities);
      return capabilities;
      
    } catch (error) {
      logger.error('Page capabilities analysis failed:', error.message);
      return {
        hasForms: false,
        hasSearch: false,
        hasLinks: false,
        formCount: 0,
        searchInputCount: 0,
        linkCount: 0
      };
    }
  }
}

module.exports = BaseBrowserParser;