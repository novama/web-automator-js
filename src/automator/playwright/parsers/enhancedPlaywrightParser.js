const BasePlaywrightParser = require('./basePlaywrightParser');
const logger = require('../../../common/utils/logger');

/**
 * Enhanced Playwright Parser - Advanced data extraction with AI-like capabilities
 * 
 * Extends BasePlaywrightParser with intelligent parsing, pattern recognition,
 * and advanced data extraction techniques specific to modern web applications.
 */
class EnhancedPlaywrightParser extends BasePlaywrightParser {
  constructor(page, options = {}) {
    super(page);
    this.options = {
      enableSmartDetection: true,
      enablePatternRecognition: true,
      enableContentAnalysis: true,
      ...options
    };
  }

  /**
   * Smart content extraction with automatic detection
   */
  async extractSmartContent(options = {}) {
    try {
      const content = {
        articles: [],
        navigation: [],
        forms: [],
        tables: [],
        lists: [],
        media: [],
        metadata: {}
      };

      // Auto-detect and extract articles/main content
      if (this.options.enableSmartDetection) {
        content.articles = await this._detectArticles();
        content.navigation = await this._detectNavigation();
        content.forms = await this._detectForms();
        content.tables = await this._detectTables();
        content.lists = await this._detectLists();
        content.media = await this._detectMedia();
      }

      // Extract page metadata
      content.metadata = await this.extractPageMetadata({ includeStructuredData: true });

      logger.info('Smart content extraction completed');
      return content;

    } catch (error) {
      logger.error(`Smart content extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Intelligent article/content detection
   */
  async _detectArticles() {
    try {
      const articles = [];
      
      // Common article selectors (semantic HTML and common patterns)
      const articleSelectors = [
        'article',
        'main article',
        '[role="article"]',
        '.article',
        '.post',
        '.content',
        '.entry',
        'main .content',
        '[itemtype*="Article"]'
      ];

      for (const selector of articleSelectors) {
        try {
          const elements = await this.page.locator(selector);
          const count = await elements.count();

          for (let i = 0; i < count; i++) {
            const article = elements.nth(i);
            
            // Extract article data
            const title = await this._extractArticleTitle(article);
            const content = await this._extractArticleContent(article);
            const author = await this._extractArticleAuthor(article);
            const date = await this._extractArticleDate(article);

            if (title || content) {
              articles.push({
                title,
                content,
                author,
                date,
                selector: `${selector}:nth-child(${i + 1})`,
                wordCount: content ? content.split(/\s+/).length : 0
              });
            }
          }
        } catch (error) {
          // Continue with other selectors if this one fails
          continue;
        }
      }

      // Remove duplicates based on content similarity
      return this._removeDuplicateArticles(articles);

    } catch (error) {
      logger.warn(`Article detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract article title with fallback strategies
   */
  async _extractArticleTitle(articleElement) {
    const titleSelectors = ['h1', 'h2', '.title', '.headline', '[itemprop="headline"]'];
    
    for (const selector of titleSelectors) {
      try {
        const titleElement = articleElement.locator(selector).first();
        const title = await titleElement.textContent();
        if (title && title.trim().length > 0) {
          return title.trim();
        }
      } catch {
        continue;
      }
    }
    return '';
  }

  /**
   * Extract article content with smart filtering
   */
  async _extractArticleContent(articleElement) {
    try {
      // Try structured content first
      const contentSelectors = ['.content', '.body', '.text', '[itemprop="articleBody"]', 'p'];
      
      for (const selector of contentSelectors) {
        try {
          const elements = articleElement.locator(selector);
          const count = await elements.count();
          
          if (count > 0) {
            const texts = [];
            for (let i = 0; i < count; i++) {
              const text = await elements.nth(i).textContent();
              if (text && text.trim().length > 20) { // Filter out short texts
                texts.push(text.trim());
              }
            }
            
            if (texts.length > 0) {
              return texts.join('\n\n');
            }
          }
        } catch {
          continue;
        }
      }
      
      // Fallback to all text content
      const allText = await articleElement.textContent();
      return allText ? allText.trim() : '';
      
    } catch {
      return '';
    }
  }

  /**
   * Extract article author information
   */
  async _extractArticleAuthor(articleElement) {
    const authorSelectors = [
      '.author',
      '.byline',
      '[rel="author"]',
      '[itemprop="author"]',
      '.post-author',
      '.article-author'
    ];
    
    for (const selector of authorSelectors) {
      try {
        const authorElement = articleElement.locator(selector).first();
        const author = await authorElement.textContent();
        if (author && author.trim().length > 0) {
          return author.trim();
        }
      } catch {
        continue;
      }
    }
    return '';
  }

  /**
   * Extract article publication date
   */
  async _extractArticleDate(articleElement) {
    const dateSelectors = [
      'time',
      '.date',
      '.published',
      '[itemprop="datePublished"]',
      '[datetime]'
    ];
    
    for (const selector of dateSelectors) {
      try {
        const dateElement = articleElement.locator(selector).first();
        
        // Try to get datetime attribute first
        const datetime = await dateElement.getAttribute('datetime');
        if (datetime) {
          return datetime;
        }
        
        // Fallback to text content
        const dateText = await dateElement.textContent();
        if (dateText && dateText.trim().length > 0) {
          return dateText.trim();
        }
      } catch {
        continue;
      }
    }
    return '';
  }

  /**
   * Intelligent navigation detection
   */
  async _detectNavigation() {
    try {
      const navigation = [];
      
      const navSelectors = [
        'nav',
        '[role="navigation"]',
        '.navigation',
        '.nav',
        '.menu',
        'header nav',
        '.navbar'
      ];

      for (const selector of navSelectors) {
        try {
          const elements = await this.page.locator(selector);
          const count = await elements.count();

          for (let i = 0; i < count; i++) {
            const nav = elements.nth(i);
            const links = await this.extractLinks(`${selector}:nth-child(${i + 1})`);
            
            if (links.length > 0) {
              navigation.push({
                type: 'navigation',
                selector: `${selector}:nth-child(${i + 1})`,
                links,
                linkCount: links.length
              });
            }
          }
        } catch {
          continue;
        }
      }

      return navigation;

    } catch (error) {
      logger.warn(`Navigation detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Smart form detection and analysis
   */
  async _detectForms() {
    try {
      const forms = [];
      
      const formElements = await this.page.locator('form');
      const formCount = await formElements.count();

      for (let i = 0; i < formCount; i++) {
        const form = formElements.nth(i);
        const selector = `form:nth-child(${i + 1})`;
        
        // Analyze form structure
        const formData = await this.extractFormData(selector);
        const action = await form.getAttribute('action');
        const method = await form.getAttribute('method') || 'GET';
        
        // Detect form purpose based on fields
        const formPurpose = this._detectFormPurpose(Object.keys(formData));
        
        forms.push({
          selector,
          action,
          method,
          purpose: formPurpose,
          fields: formData,
          fieldCount: Object.keys(formData).length
        });
      }

      return forms;

    } catch (error) {
      logger.warn(`Form detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Detect form purpose based on field names
   */
  _detectFormPurpose(fieldNames) {
    const fieldNameString = fieldNames.join(' ').toLowerCase();
    
    if (fieldNameString.includes('email') && fieldNameString.includes('password')) {
      return 'login';
    } else if (fieldNameString.includes('search') || fieldNameString.includes('query')) {
      return 'search';
    } else if (fieldNameString.includes('name') && fieldNameString.includes('email')) {
      return 'contact';
    } else if (fieldNameString.includes('card') || fieldNameString.includes('payment')) {
      return 'payment';
    } else if (fieldNames.length > 5) {
      return 'registration';
    } else {
      return 'unknown';
    }
  }

  /**
   * Smart table detection with enhanced analysis
   */
  async _detectTables() {
    try {
      const tables = [];
      
      const tableElements = await this.page.locator('table');
      const tableCount = await tableElements.count();

      for (let i = 0; i < tableCount; i++) {
        const tableSelector = `table:nth-child(${i + 1})`;
        const tableData = await this.extractTable(tableSelector);
        
        if (tableData.rowCount > 0) {
          // Analyze table structure
          const analysis = this._analyzeTableStructure(tableData);
          
          tables.push({
            selector: tableSelector,
            data: tableData,
            analysis
          });
        }
      }

      return tables;

    } catch (error) {
      logger.warn(`Table detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze table structure and content patterns
   */
  _analyzeTableStructure(tableData) {
    const analysis = {
      hasNumericColumns: false,
      hasDates: false,
      hasLinks: false,
      likelyDataTable: false
    };

    if (tableData.rows.length === 0) return analysis;

    const firstRow = tableData.rows[0];
    
    // Check for numeric columns
    Object.values(firstRow).forEach(value => {
      if (value && !isNaN(value.replace(/[,$%]/g, ''))) {
        analysis.hasNumericColumns = true;
      }
      
      // Check for dates (basic pattern)
      if (value && /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(value)) {
        analysis.hasDates = true;
      }
      
      // Check for links
      if (value && (value.includes('http') || value.includes('www'))) {
        analysis.hasLinks = true;
      }
    });

    // Determine if it's likely a data table
    analysis.likelyDataTable = (
      tableData.rowCount > 2 && 
      tableData.columnCount >= 2 &&
      (analysis.hasNumericColumns || analysis.hasDates)
    );

    return analysis;
  }

  /**
   * Smart list detection
   */
  async _detectLists() {
    try {
      const lists = [];
      
      const listSelectors = ['ul', 'ol', '.list'];

      for (const selector of listSelectors) {
        const elements = await this.page.locator(selector);
        const count = await elements.count();

        for (let i = 0; i < count; i++) {
          const list = elements.nth(i);
          const items = await this.extractTexts(`${selector}:nth-child(${i + 1}) li`);
          
          if (items.length > 1) { // Only include lists with multiple items
            lists.push({
              type: selector === 'ol' ? 'ordered' : 'unordered',
              selector: `${selector}:nth-child(${i + 1})`,
              items,
              itemCount: items.length
            });
          }
        }
      }

      return lists;

    } catch (error) {
      logger.warn(`List detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Enhanced media detection
   */
  async _detectMedia() {
    try {
      const media = {
        images: await this.extractImages(),
        videos: [],
        audio: []
      };

      // Detect videos
      const videoElements = await this.page.locator('video');
      const videoCount = await videoElements.count();

      for (let i = 0; i < videoCount; i++) {
        const video = videoElements.nth(i);
        const src = await video.getAttribute('src');
        const poster = await video.getAttribute('poster');
        const controls = await video.getAttribute('controls') !== null;
        
        media.videos.push({
          src,
          poster,
          controls,
          selector: `video:nth-child(${i + 1})`
        });
      }

      // Detect audio
      const audioElements = await this.page.locator('audio');
      const audioCount = await audioElements.count();

      for (let i = 0; i < audioCount; i++) {
        const audio = audioElements.nth(i);
        const src = await audio.getAttribute('src');
        const controls = await audio.getAttribute('controls') !== null;
        
        media.audio.push({
          src,
          controls,
          selector: `audio:nth-child(${i + 1})`
        });
      }

      return media;

    } catch (error) {
      logger.warn(`Media detection failed: ${error.message}`);
      return { images: [], videos: [], audio: [] };
    }
  }

  /**
   * Remove duplicate articles based on content similarity
   */
  _removeDuplicateArticles(articles) {
    if (articles.length <= 1) return articles;

    const unique = [];
    
    for (const article of articles) {
      const isDuplicate = unique.some(existing => {
        // Simple similarity check based on title and content length
        const titleSimilar = article.title === existing.title;
        const contentLengthSimilar = Math.abs(article.wordCount - existing.wordCount) < 10;
        
        return titleSimilar && contentLengthSimilar;
      });

      if (!isDuplicate) {
        unique.push(article);
      }
    }

    return unique;
  }

  /**
   * Extract structured data with validation
   */
  async extractStructuredData(options = {}) {
    try {
      const structuredData = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const microdata = Array.from(document.querySelectorAll('[itemscope]'));
        
        const jsonLD = scripts.map(script => {
          try {
            return JSON.parse(script.textContent);
          } catch {
            return null;
          }
        }).filter(data => data !== null);

        const microdataObjects = microdata.map(element => {
          const obj = { '@type': element.getAttribute('itemtype') };
          const props = element.querySelectorAll('[itemprop]');
          
          props.forEach(prop => {
            const name = prop.getAttribute('itemprop');
            const content = prop.getAttribute('content') || prop.textContent;
            obj[name] = content;
          });
          
          return obj;
        });

        return {
          jsonLD,
          microdata: microdataObjects
        };
      });

      logger.info(`Extracted structured data: ${structuredData.jsonLD.length} JSON-LD, ${structuredData.microdata.length} microdata`);
      return structuredData;

    } catch (error) {
      logger.error(`Structured data extraction failed: ${error.message}`);
      if (options.throwOnError !== false) {
        throw error;
      }
      return { jsonLD: [], microdata: [] };
    }
  }
}

module.exports = EnhancedPlaywrightParser;