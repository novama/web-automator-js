// logger.js
// Advanced logger with Winston integration and fallback support.
// Automatically falls back to SimpleLogger when Winston is not available.
// It supports log level configuration via the LOG_LEVEL environment variable.
// The log format includes a timestamp, log level, and message for clarity.
// Usage example:
//   const logger = require('./logger');
//   logger.info('Informational message');
//   logger.error('Error message');

/**
 * FallbackLogger - Unified fallback logger implementation without external dependencies
 * Provides robust logging functionality when Winston is not available
 */
class FallbackLogger {
    constructor() {
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        
        // Get log level from environment, default to 'info'
        const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
        this.currentLevel = this.levels[envLogLevel] !== undefined 
            ? this.levels[envLogLevel] 
            : this.levels.info;
    }

    /**
     * Internal logging method with level filtering and console routing
     * @param {string} level - Log level (debug, info, warn, error)
     * @param {string} message - Log message
     */
    _log(level, message) {
        // Check if this level should be logged
        if (this.levels[level] >= this.currentLevel) {
            const timestamp = new Date().toISOString();
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
            
            // Route to appropriate console method for better visibility
            switch (level) {
                case 'error':
                    console.error(formattedMessage);
                    break;
                case 'warn':
                    console.warn(formattedMessage);
                    break;
                case 'debug':
                case 'info':
                default:
                    console.log(formattedMessage);
                    break;
            }
        }
    }

    // Standard logging interface
    debug(message) { this._log('debug', message); }
    info(message) { this._log('info', message); }
    warn(message) { this._log('warn', message); }
    error(message) { this._log('error', message); }
    
    // Compatibility methods for Winston interface
    isWinstonLogger() { return false; }
    getLoggerType() { return 'fallback'; }
}

/**
 * Creates a Winston logger instance
 * @returns {Object} Winston logger instance
 */
function createWinstonLogger() {
    const {createLogger, format, transports} = require('winston');
    
    // Determine if running in Lambda environment
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    const logger = createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: format.combine(
            format.timestamp(),
            // Use different formats based on environment
            isLambda
                ? format.printf(({timestamp, level, message}) => {
                    try {
                        return JSON.stringify({
                            timestamp,
                            level: level.toLowerCase(),
                            message,
                            source: 'lambda'
                        });
                    } catch (error) {
                        return `${timestamp} [${level.toLowerCase()}] ${message}`;
                    }
                })
                : format.printf(({timestamp, level, message}) => {
                    return `${timestamp} [${level.toUpperCase()}] ${message}`;
                })
        ),
        transports: [new transports.Console()],
        defaultMeta: { 
            loggerType: 'winston',
            pid: process.pid
        }
    });
    
    // Add Winston-specific methods
    logger.isWinstonLogger = () => true;
    logger.getLoggerType = () => 'winston';
    
    return logger;
}

/**
 * Logger factory - Creates the appropriate logger based on available dependencies
 * Follows the hierarchy: Winston -> FallbackLogger
 * @returns {Object} Logger instance with consistent interface
 */
function createLogger() {
    let logger;
    let loggerType = 'unknown';

    // Try Winston first (most feature-rich)
    try {
        logger = createWinstonLogger();
        loggerType = 'winston';
        logger.debug('Logger initialized with Winston');
    } catch (winstonError) {
        // Fallback to our unified fallback logger (no dependencies)
        try {
            logger = new FallbackLogger();
            loggerType = 'fallback';
            logger.info(`Logger initialized with fallback implementation (Winston not available: ${winstonError.message})`);
        } catch (fallbackError) {
            // This should virtually never happen since FallbackLogger has no dependencies
            // But if it does, create the most basic logger possible
            const timestamp = () => new Date().toISOString();
            logger = {
                debug: (msg) => console.log(`${timestamp()} [DEBUG] ${msg}`),
                info: (msg) => console.log(`${timestamp()} [INFO] ${msg}`),
                warn: (msg) => console.warn(`${timestamp()} [WARN] ${msg}`),
                error: (msg) => console.error(`${timestamp()} [ERROR] ${msg}`),
                isWinstonLogger: () => false,
                getLoggerType: () => 'emergency'
            };
            loggerType = 'emergency';
            logger.error(`All logger implementations failed. Winston: ${winstonError.message}, Fallback: ${fallbackError.message}. Using emergency logger.`);
        }
    }
    
    return { logger, loggerType };
}

// Initialize the logger
const { logger: baseLogger, loggerType } = createLogger();

/**
 * EnhancedLogger - Wrapper class that provides additional functionality
 * Wraps the base logger with enhanced features while maintaining compatibility
 */
class EnhancedLogger {
    constructor(baseLogger, loggerType) {
        this.baseLogger = baseLogger;
        this.loggerType = loggerType;
    }

    // Core logging methods - delegate to base logger
    debug(...args) { 
        return this.baseLogger.debug(...args); 
    }

    info(...args) { 
        return this.baseLogger.info(...args); 
    }

    warn(...args) { 
        return this.baseLogger.warn(...args); 
    }

    error(...args) { 
        return this.baseLogger.error(...args); 
    }

    // Logger introspection methods
    getLoggerType() { 
        return this.baseLogger.getLoggerType ? this.baseLogger.getLoggerType() : this.loggerType; 
    }

    isWinstonLogger() { 
        return this.baseLogger.isWinstonLogger ? this.baseLogger.isWinstonLogger() : false; 
    }

    /**
     * Enhanced logging with context information
     * @param {string} level - Log level (debug, info, warn, error)
     * @param {string} message - Base log message
     * @param {Object} context - Additional context data to include
     */
    logWithContext(level, message, context = {}) {
        if (!message || typeof message !== 'string') {
            throw new Error('Message must be a non-empty string');
        }

        const contextStr = Object.keys(context).length > 0 
            ? ` [Context: ${JSON.stringify(context)}]` 
            : '';
        const enhancedMessage = `${message}${contextStr}`;
        
        const normalizedLevel = level.toLowerCase();
        switch (normalizedLevel) {
            case 'debug': 
                this.baseLogger.debug(enhancedMessage); 
                break;
            case 'info': 
                this.baseLogger.info(enhancedMessage); 
                break;
            case 'warn': 
                this.baseLogger.warn(enhancedMessage); 
                break;
            case 'error': 
                this.baseLogger.error(enhancedMessage); 
                break;
            default: 
                this.baseLogger.info(enhancedMessage);
        }
    }

    /**
     * Conditional debug logging - only logs if condition is true
     * @param {boolean} condition - Condition to check
     * @param {string} message - Message to log if condition is true
     */
    debugIf(condition, message) {
        if (condition && message) {
            this.baseLogger.debug(message);
        }
    }

    /**
     * Start performance timing
     * @param {string} label - Timer label
     */
    time(label) {
        if (console.time && label) {
            console.time(label);
        }
    }

    /**
     * End performance timing
     * @param {string} label - Timer label
     */
    timeEnd(label) {
        if (console.timeEnd && label) {
            console.timeEnd(label);
        }
    }

    /**
     * Error logging with optional stack trace
     * @param {string} message - Error message
     * @param {Error} error - Optional error object with stack trace
     */
    errorWithStack(message, error = null) {
        if (!message || typeof message !== 'string') {
            throw new Error('Message must be a non-empty string');
        }

        if (error && error.stack) {
            this.baseLogger.error(`${message}: ${error.message}\nStack: ${error.stack}`);
        } else if (error && error.message) {
            this.baseLogger.error(`${message}: ${error.message}`);
        } else {
            this.baseLogger.error(message);
        }
    }

    /**
     * Batch logging - log multiple messages at once
     * @param {string} level - Log level
     * @param {Array} messages - Array of messages to log
     */
    batch(level, messages) {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array');
        }

        messages.forEach(message => {
            if (typeof message === 'string') {
                this[level.toLowerCase()](message);
            }
        });
    }

    /**
     * Create a child logger with a prefix
     * @param {string} prefix - Prefix for all log messages
     * @returns {Object} Child logger with prefixed messages
     */
    child(prefix) {
        if (!prefix || typeof prefix !== 'string') {
            throw new Error('Prefix must be a non-empty string');
        }

        return {
            debug: (message) => this.debug(`[${prefix}] ${message}`),
            info: (message) => this.info(`[${prefix}] ${message}`),
            warn: (message) => this.warn(`[${prefix}] ${message}`),
            error: (message) => this.error(`[${prefix}] ${message}`),
            logWithContext: (level, message, context) => 
                this.logWithContext(level, `[${prefix}] ${message}`, context),
            errorWithStack: (message, error) => 
                this.errorWithStack(`[${prefix}] ${message}`, error)
        };
    }
}

// Create and export the enhanced logger instance
const enhancedLogger = new EnhancedLogger(baseLogger, loggerType);

module.exports = enhancedLogger;