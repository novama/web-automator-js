const BaseBrowserParser = require('./baseBrowserParser');
const { By } = require('selenium-webdriver');
const logger = require('../../../common/utils/logger');

/**
 * Enhanced Browser Parser - Advanced DOM analysis with Selenium WebDriver
 * 
 * Extends BaseBrowserParser with sophisticated content analysis and extraction
 * capabilities using live browser elements.
 */
class EnhancedBrowserParser extends BaseBrowserParser {
  constructor(driver) {
    super(driver);
  }

  /**
   * Intelligent content extraction with priority scoring
   */
  async getBestContent(maxLength = 1000) {
    try {
      // Extract content using multiple strategies and score them
      const contentSources = await this.driver.executeScript(`
        const sources = [];
        
        // Strategy 1: Main content areas
        const mainSelectors = ['main', '[role="main"]', '.main', '#main', '.content', '#content'];
        for (const selector of mainSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            sources.push({
              type: 'main',
              content: element.innerText.trim(),
              score: 10,
              selector
            });
          }
        }
        
        // Strategy 2: Article content
        const articles = document.querySelectorAll('article, .article, [role="article"]');
        articles.forEach((article, index) => {
          if (article.innerText.length > 100) {
            sources.push({
              type: 'article',
              content: article.innerText.trim(),
              score: 8,
              selector: 'article-' + index
            });
          }
        });
        
        // Strategy 3: Paragraphs with substantial content
        const paragraphs = document.querySelectorAll('p');
        let combinedParagraphs = '';
        paragraphs.forEach(p => {
          if (p.innerText.length > 50) {
            combinedParagraphs += p.innerText.trim() + ' ';
          }
        });
        
        if (combinedParagraphs.length > 200) {
          sources.push({
            type: 'paragraphs',
            content: combinedParagraphs.trim(),
            score: 6,
            selector: 'p-combined'
          });
        }
        
        // Strategy 4: Body text (fallback)
        if (document.body && document.body.innerText.length > 100) {
          sources.push({
            type: 'body',
            content: document.body.innerText.trim(),
            score: 3,
            selector: 'body'
          });
        }
        
        return sources;
      `);
      
      if (contentSources.length === 0) {
        return 'No content available';
      }
      
      // Sort by score and get the best content
      contentSources.sort((a, b) => b.score - a.score);
      const bestContent = contentSources[0].content;
      
      // Clean up the content
      const cleanContent = bestContent
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/\n+/g, ' ')           // Remove line breaks
        .trim();
      
      // Truncate if necessary
      const result = maxLength ? cleanContent.substring(0, maxLength) : cleanContent;
      
      logger.info(`Extracted ${result.length} characters using ${contentSources[0].type} strategy`);
      return result;
      
    } catch (error) {
      logger.error('Enhanced content extraction failed:', error.message);
      return 'Content extraction failed';
    }
  }

  /**
   * Advanced form analysis with field type detection
   */
  async analyzeForms() {
    try {
      const forms = await this.getAllForms();
      const analyzedForms = [];
      
      for (const form of forms) {
        const analysis = {
          ...form,
          purpose: await this._detectFormPurpose(form),
          complexity: this._calculateFormComplexity(form),
          validation: await this._analyzeFormValidation(form),
          submitButtons: await this._findSubmitButtons(form)
        };
        
        analyzedForms.push(analysis);
      }
      
      logger.info(`Analyzed ${analyzedForms.length} forms with detailed information`);
      return analyzedForms;
      
    } catch (error) {
      logger.error('Form analysis failed:', error.message);
      return [];
    }
  }

  /**
   * Detect the likely purpose of a form
   */
  async _detectFormPurpose(form) {
    const fieldNames = Object.keys(form.fields).map(name => name.toLowerCase());
    const formAction = form.action.toLowerCase();
    
    // Login form detection
    if (fieldNames.some(name => name.includes('password')) &&
        (fieldNames.some(name => name.includes('email') || name.includes('username') || name.includes('login')))) {
      return 'login';
    }
    
    // Registration form detection
    if (fieldNames.some(name => name.includes('password')) &&
        fieldNames.some(name => name.includes('confirm') || name.includes('repeat')) &&
        fieldNames.length > 3) {
      return 'registration';
    }
    
    // Contact form detection
    if (fieldNames.some(name => name.includes('message') || name.includes('comment')) ||
        formAction.includes('contact')) {
      return 'contact';
    }
    
    // Search form detection
    if (fieldNames.some(name => name.includes('search') || name.includes('query')) ||
        formAction.includes('search')) {
      return 'search';
    }
    
    // Payment form detection
    if (fieldNames.some(name => name.includes('card') || name.includes('payment') || name.includes('billing'))) {
      return 'payment';
    }
    
    // Newsletter form detection
    if (fieldNames.some(name => name.includes('email')) && fieldNames.length <= 2) {
      return 'newsletter';
    }
    
    return 'general';
  }

  /**
   * Calculate form complexity score
   */
  _calculateFormComplexity(form) {
    let complexity = 0;
    
    complexity += Object.keys(form.fields).length; // Base complexity from field count
    
    Object.values(form.fields).forEach(field => {
      switch (field.type) {
        case 'password':
          complexity += 2; // Passwords add complexity
          break;
        case 'select':
          complexity += 1.5; // Dropdowns are more complex
          break;
        case 'textarea':
          complexity += 1.5; // Text areas are more complex
          break;
        case 'email':
        case 'tel':
        case 'url':
          complexity += 1; // Specialized inputs add some complexity
          break;
        default:
          complexity += 0.5; // Basic inputs
      }
      
      if (field.required) {
        complexity += 0.5; // Required fields add complexity
      }
    });
    
    return Math.round(complexity * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Analyze form validation requirements
   */
  async _analyzeFormValidation(form) {
    try {
      const validation = {
        hasRequiredFields: false,
        requiredFields: [],
        hasPatternValidation: false,
        patternFields: [],
        hasLengthValidation: false,
        lengthFields: []
      };
      
      for (const [fieldName, field] of Object.entries(form.fields)) {
        if (field.required) {
          validation.hasRequiredFields = true;
          validation.requiredFields.push(fieldName);
        }
        
        // Check for pattern validation (would need to inspect actual elements)
        if (field.type === 'email' || field.type === 'tel' || field.type === 'url') {
          validation.hasPatternValidation = true;
          validation.patternFields.push(fieldName);
        }
        
        // Length validation would require element inspection
        if (field.type === 'password' || field.type === 'textarea') {
          validation.hasLengthValidation = true;
          validation.lengthFields.push(fieldName);
        }
      }
      
      return validation;
      
    } catch (error) {
      logger.warn('Form validation analysis failed:', error.message);
      return { hasRequiredFields: false, requiredFields: [], hasPatternValidation: false, patternFields: [] };
    }
  }

  /**
   * Find submit buttons for a form
   */
  async _findSubmitButtons(form) {
    try {
      // This would need the actual form element to search within it
      // For now, return a simplified version
      return [
        {
          type: 'input',
          selector: 'input[type="submit"]',
          text: 'Submit'
        }
      ];
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract and analyze page navigation structure
   */
  async analyzeNavigation() {
    try {
      const navigation = await this.driver.executeScript(`
        const nav = {
          primaryNav: null,
          breadcrumbs: null,
          footer: null,
          sidebar: null
        };
        
        // Primary navigation
        const navElements = document.querySelectorAll('nav, [role="navigation"], .nav, #nav, .navigation');
        if (navElements.length > 0) {
          const primaryNavElement = navElements[0];
          const navLinks = primaryNavElement.querySelectorAll('a');
          nav.primaryNav = {
            linkCount: navLinks.length,
            links: Array.from(navLinks).slice(0, 10).map(link => ({
              text: link.innerText.trim(),
              href: link.href
            }))
          };
        }
        
        // Breadcrumbs
        const breadcrumbElements = document.querySelectorAll('.breadcrumb, .breadcrumbs, [aria-label="breadcrumb"]');
        if (breadcrumbElements.length > 0) {
          const breadcrumb = breadcrumbElements[0];
          const crumbs = breadcrumb.querySelectorAll('a, span');
          nav.breadcrumbs = Array.from(crumbs).map(crumb => crumb.innerText.trim());
        }
        
        // Footer
        const footerElements = document.querySelectorAll('footer, .footer, #footer');
        if (footerElements.length > 0) {
          const footer = footerElements[0];
          const footerLinks = footer.querySelectorAll('a');
          nav.footer = {
            linkCount: footerLinks.length,
            hasContact: footer.innerText.toLowerCase().includes('contact'),
            hasPrivacy: footer.innerText.toLowerCase().includes('privacy'),
            hasTerms: footer.innerText.toLowerCase().includes('terms')
          };
        }
        
        return nav;
      `);
      
      logger.info('Navigation structure analyzed');
      return navigation;
      
    } catch (error) {
      logger.error('Navigation analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Comprehensive page analysis combining all parser capabilities
   */
  async analyzePage() {
    try {
      const [
        contentSummary,
        forms,
        capabilities,
        navigation,
        structuredData
      ] = await Promise.all([
        this.getPageContentSummary(),
        this.analyzeForms(),
        this.analyzePageCapabilities(),
        this.analyzeNavigation(),
        this.extractStructuredData()
      ]);
      
      const bestContent = await this.getBestContent(300);
      
      const analysis = {
        timestamp: new Date().toISOString(),
        url: await this.driver.getCurrentUrl(),
        title: await this.driver.getTitle(),
        contentSummary,
        forms,
        capabilities,
        navigation,
        structuredData,
        bestContent,
        analysisComplete: true
      };
      
      logger.info('Comprehensive page analysis completed');
      return analysis;
      
    } catch (error) {
      logger.error('Comprehensive page analysis failed:', error.message);
      throw error;
    }
  }
}

module.exports = EnhancedBrowserParser;