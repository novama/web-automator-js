/**
 * ConfigManager - Configuration Management Class
 * 
 * Manages application configuration from multiple sources with proper precedence:
 * 1. JSON configuration files (highest priority)
 * 2. Environment variables (fallback)
 * 
 * Features:
 * - Case-insensitive key matching
 * - JSON files override environment variables
 * - Comprehensive error handling
 * - Logging integration
 * - Type conversion support
 * - Configuration validation
 * - Hot reload capabilities
 * 
 * Usage:
 *   const ConfigManager = require('./configManager');
 *   const config = new ConfigManager('./config.json');
 *   const value = config.get('DATABASE_URL', 'localhost');
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ConfigManager {
    constructor(configFilePath = null, options = {}) {
        this.configFilePath = configFilePath;
        this.options = {
            caseSensitive: false,
            autoReload: false,
            validateOnLoad: true,
            ...options
        };
        
        this.jsonConfig = {};
        this.envConfig = {};
        this.lastModified = null;
        this.watchers = new Map();
        
        logger.info(`ConfigManager initialized with file: ${configFilePath || 'none'}`);
        
        this._loadEnvironmentVariables();
        
        if (this.configFilePath) {
            this._loadJsonConfig();
            
            if (this.options.autoReload) {
                this._setupFileWatcher();
            }
        }
    }

    /**
     * Load environment variables into internal cache
     * @private
     */
    _loadEnvironmentVariables() {
        try {
            this.envConfig = { ...process.env };
            
            // Create case-insensitive lookup if needed
            if (!this.options.caseSensitive) {
                this.envConfigLowerCase = {};
                Object.keys(this.envConfig).forEach(key => {
                    this.envConfigLowerCase[key.toLowerCase()] = {
                        originalKey: key,
                        value: this.envConfig[key]
                    };
                });
            }
            
            logger.debug(`Loaded ${Object.keys(this.envConfig).length} environment variables`);
        } catch (error) {
            logger.error(`Error loading environment variables: ${error.message}`);
            throw new Error(`Failed to load environment variables: ${error.message}`);
        }
    }

    /**
     * Load JSON configuration file
     * @private
     */
    _loadJsonConfig() {
        try {
            if (!fs.existsSync(this.configFilePath)) {
                logger.warn(`Configuration file not found: ${this.configFilePath}`);
                return;
            }

            const stats = fs.statSync(this.configFilePath);
            const fileContent = fs.readFileSync(this.configFilePath, 'utf8');
            
            this.jsonConfig = JSON.parse(fileContent);
            this.lastModified = stats.mtime;
            
            // Create case-insensitive lookup if needed
            if (!this.options.caseSensitive) {
                this.jsonConfigLowerCase = {};
                Object.keys(this.jsonConfig).forEach(key => {
                    this.jsonConfigLowerCase[key.toLowerCase()] = {
                        originalKey: key,
                        value: this.jsonConfig[key]
                    };
                });
            }
            
            logger.info(`Successfully loaded JSON config from: ${this.configFilePath}`);
            logger.debug(`JSON config contains ${Object.keys(this.jsonConfig).length} keys`);
            
            if (this.options.validateOnLoad) {
                this._validateConfiguration();
            }
            
        } catch (error) {
            logger.error(`Error loading JSON config file ${this.configFilePath}: ${error.message}`);
            throw new Error(`Failed to load JSON configuration: ${error.message}`);
        }
    }

    /**
     * Setup file system watcher for auto-reload
     * @private
     */
    _setupFileWatcher() {
        if (!this.configFilePath || !fs.existsSync(this.configFilePath)) {
            return;
        }

        try {
            const watcher = fs.watch(this.configFilePath, (eventType) => {
                if (eventType === 'change') {
                    logger.info(`Configuration file changed, reloading: ${this.configFilePath}`);
                    this._loadJsonConfig();
                }
            });

            this.watchers.set(this.configFilePath, watcher);
            logger.debug(`File watcher setup for: ${this.configFilePath}`);
        } catch (error) {
            logger.warn(`Failed to setup file watcher: ${error.message}`);
        }
    }

    /**
     * Validate configuration against expected schema
     * @private
     */
    _validateConfiguration() {
        try {
            // Basic validation - check for circular references
            JSON.stringify(this.jsonConfig);
            logger.debug('Configuration validation passed');
        } catch (error) {
            logger.error(`Configuration validation failed: ${error.message}`);
            throw new Error(`Invalid configuration: ${error.message}`);
        }
    }

    /**
     * Get configuration value by key
     * JSON config takes precedence over environment variables
     * 
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key not found
     * @param {string} type - Expected type for conversion ('string', 'number', 'boolean', 'array', 'object')
     * @returns {*} Configuration value
     */
    get(key, defaultValue = null, type = null) {
        if (!key || typeof key !== 'string') {
            logger.error(`Invalid configuration key provided: ${key}`);
            throw new Error('Configuration key must be a non-empty string');
        }

        let value = null;
        let source = 'default';

        try {
            // First, check JSON config (highest priority)
            if (this.options.caseSensitive) {
                if (this.jsonConfig.hasOwnProperty(key)) {
                    value = this.jsonConfig[key];
                    source = 'json';
                }
            } else {
                const lowerKey = key.toLowerCase();
                if (this.jsonConfigLowerCase && this.jsonConfigLowerCase[lowerKey]) {
                    value = this.jsonConfigLowerCase[lowerKey].value;
                    source = 'json';
                }
            }

            // If not found in JSON, check environment variables
            if (value === null) {
                if (this.options.caseSensitive) {
                    if (this.envConfig.hasOwnProperty(key)) {
                        value = this.envConfig[key];
                        source = 'env';
                    }
                } else {
                    const lowerKey = key.toLowerCase();
                    if (this.envConfigLowerCase && this.envConfigLowerCase[lowerKey]) {
                        value = this.envConfigLowerCase[lowerKey].value;
                        source = 'env';
                    }
                }
            }

            // Use default if still not found
            if (value === null) {
                value = defaultValue;
                source = 'default';
            }

            // Type conversion if requested
            if (value !== null && type) {
                value = this._convertType(value, type, key);
            }

            logger.debug(`Config get: ${key} = ${JSON.stringify(value)} (source: ${source})`);
            return value;

        } catch (error) {
            logger.error(`Error getting configuration key '${key}': ${error.message}`);
            return defaultValue;
        }
    }

    /**
     * Set configuration value (in-memory only, does not persist to file)
     * 
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     */
    set(key, value) {
        if (!key || typeof key !== 'string') {
            throw new Error('Configuration key must be a non-empty string');
        }

        try {
            this.jsonConfig[key] = value;

            // Update case-insensitive lookup
            if (!this.options.caseSensitive) {
                const lowerKey = key.toLowerCase();
                this.jsonConfigLowerCase[lowerKey] = {
                    originalKey: key,
                    value: value
                };
            }

            logger.debug(`Config set: ${key} = ${JSON.stringify(value)}`);
        } catch (error) {
            logger.error(`Error setting configuration key '${key}': ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if configuration key exists
     * 
     * @param {string} key - Configuration key to check
     * @returns {boolean} True if key exists
     */
    has(key) {
        if (!key || typeof key !== 'string') {
            return false;
        }

        try {
            if (this.options.caseSensitive) {
                return this.jsonConfig.hasOwnProperty(key) || this.envConfig.hasOwnProperty(key);
            } else {
                const lowerKey = key.toLowerCase();
                return (this.jsonConfigLowerCase && this.jsonConfigLowerCase[lowerKey]) ||
                       (this.envConfigLowerCase && this.envConfigLowerCase[lowerKey]);
            }
        } catch (error) {
            logger.error(`Error checking configuration key '${key}': ${error.message}`);
            return false;
        }
    }

    /**
     * Get all configuration keys
     * 
     * @returns {Array} Array of all configuration keys
     */
    getAllKeys() {
        try {
            const jsonKeys = Object.keys(this.jsonConfig);
            const envKeys = Object.keys(this.envConfig);
            const allKeys = [...new Set([...jsonKeys, ...envKeys])];
            
            logger.debug(`Retrieved ${allKeys.length} total configuration keys`);
            return allKeys;
        } catch (error) {
            logger.error(`Error getting all configuration keys: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all configuration as a single object
     * 
     * @returns {Object} Merged configuration object
     */
    getAll() {
        try {
            // Environment variables as base, JSON config overrides
            const merged = { ...this.envConfig, ...this.jsonConfig };
            
            logger.debug(`Retrieved complete configuration with ${Object.keys(merged).length} keys`);
            return merged;
        } catch (error) {
            logger.error(`Error getting all configuration: ${error.message}`);
            return {};
        }
    }

    /**
     * Convert value to specified type
     * @private
     */
    _convertType(value, type, key) {
        try {
            switch (type.toLowerCase()) {
                case 'string':
                    return String(value);
                
                case 'number':
                    const num = Number(value);
                    if (isNaN(num)) {
                        throw new Error(`Cannot convert '${value}' to number`);
                    }
                    return num;
                
                case 'boolean':
                    if (typeof value === 'boolean') return value;
                    if (typeof value === 'string') {
                        const lower = value.toLowerCase();
                        if (['true', '1', 'yes', 'on'].includes(lower)) return true;
                        if (['false', '0', 'no', 'off'].includes(lower)) return false;
                    }
                    throw new Error(`Cannot convert '${value}' to boolean`);
                
                case 'array':
                    if (Array.isArray(value)) return value;
                    if (typeof value === 'string') {
                        try {
                            return JSON.parse(value);
                        } catch {
                            return value.split(',').map(item => item.trim());
                        }
                    }
                    throw new Error(`Cannot convert '${value}' to array`);
                
                case 'object':
                    if (typeof value === 'object' && value !== null) return value;
                    if (typeof value === 'string') {
                        return JSON.parse(value);
                    }
                    throw new Error(`Cannot convert '${value}' to object`);
                
                default:
                    logger.warn(`Unknown type conversion requested: ${type} for key ${key}`);
                    return value;
            }
        } catch (error) {
            logger.error(`Type conversion failed for key '${key}': ${error.message}`);
            throw new Error(`Type conversion failed for '${key}': ${error.message}`);
        }
    }

    /**
     * Reload configuration from file
     */
    reload() {
        try {
            logger.info('Reloading configuration...');
            this._loadEnvironmentVariables();
            
            if (this.configFilePath) {
                this._loadJsonConfig();
            }
            
            logger.info('Configuration reloaded successfully');
        } catch (error) {
            logger.error(`Error reloading configuration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save current in-memory JSON config to file
     */
    save() {
        if (!this.configFilePath) {
            throw new Error('No configuration file path specified');
        }

        try {
            const jsonString = JSON.stringify(this.jsonConfig, null, 2);
            fs.writeFileSync(this.configFilePath, jsonString, 'utf8');
            
            logger.info(`Configuration saved to: ${this.configFilePath}`);
        } catch (error) {
            logger.error(`Error saving configuration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        try {
            // Close file watchers
            this.watchers.forEach((watcher, filePath) => {
                watcher.close();
                logger.debug(`Closed file watcher for: ${filePath}`);
            });
            
            this.watchers.clear();
            this.jsonConfig = {};
            this.envConfig = {};
            
            logger.info('ConfigManager destroyed and resources cleaned up');
        } catch (error) {
            logger.error(`Error during ConfigManager cleanup: ${error.message}`);
        }
    }
}

module.exports = ConfigManager;