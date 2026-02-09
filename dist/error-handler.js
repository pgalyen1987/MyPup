import { CONFIG } from './config.js';
export var ErrorType;
(function (ErrorType) {
    ErrorType["API_ERROR"] = "API_ERROR";
    ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorType["ASSET_LOAD_ERROR"] = "ASSET_LOAD_ERROR";
    ErrorType["TEXTURE_ERROR"] = "TEXTURE_ERROR";
    ErrorType["ANIMATION_ERROR"] = "ANIMATION_ERROR";
    ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorType["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorType || (ErrorType = {}));
export class AppError extends Error {
    constructor(type, message, context, originalError, recoverable = true, userMessage, recoveryAction) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.context = context;
        this.originalError = originalError;
        this.recoverable = recoverable;
        this.userMessage = userMessage || message;
        this.recoveryAction = recoveryAction;
        this.context.timestamp = Date.now();
    }
    toJSON() {
        return {
            type: this.type,
            message: this.message,
            userMessage: this.userMessage,
            context: this.context,
            recoverable: this.recoverable,
            recoveryAction: this.recoveryAction,
            originalError: this.originalError?.message || this.originalError
        };
    }
}
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
    }
    logError(error) {
        this.errorLog.push(error);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
        console.group(`❌ ${error.type} - ${error.context.operation}`);
        console.error('Message:', error.message);
        console.error('User Message:', error.userMessage);
        console.error('Context:', error.context);
        if (error.originalError) {
            console.error('Original Error:', error.originalError);
            if (error.originalError.stack) {
                console.error('Stack:', error.originalError.stack);
            }
        }
        if (error.recoveryAction) {
            console.info('Recovery Action:', error.recoveryAction);
        }
        console.groupEnd();
        if (CONFIG.DEBUG_MODE) {
            console.log('Error JSON:', JSON.stringify(error.toJSON(), null, 2));
        }
    }
    createError(type, message, context, originalError, userMessage, recoveryAction) {
        const error = new AppError(type, message, context, originalError, true, userMessage, recoveryAction);
        this.logError(error);
        return error;
    }
    async retryWithBackoff(fn, options = {}, context) {
        const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffMultiplier = 2, retryable = () => true } = options;
        let lastError;
        let delay = initialDelay;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (!retryable(error)) {
                    throw this.createError(ErrorType.UNKNOWN_ERROR, `Non-retryable error: ${error.message}`, { ...context, details: { attempt, maxRetries } }, error, `Operation failed: ${error.message}`, 'Check the console for details');
                }
                if (attempt === maxRetries) {
                    break;
                }
                console.warn(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} for ${context.operation} after ${delay}ms`);
                await this.delay(delay);
                delay = Math.min(delay * backoffMultiplier, maxDelay);
            }
        }
        throw this.createError(ErrorType.TIMEOUT_ERROR, `Operation failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`, { ...context, details: { attempts: maxRetries + 1 } }, lastError, `Operation failed after multiple attempts. Please try again.`, 'Refresh the page or check your connection');
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getRecentErrors(count = 10) {
        return this.errorLog.slice(-count);
    }
    clearLog() {
        this.errorLog = [];
    }
    handleTextureError(error, textureKey, context) {
        return this.createError(ErrorType.TEXTURE_ERROR, `Failed to load/create texture: ${textureKey}`, { ...context, details: { ...context.details, textureKey } }, error, `Texture "${textureKey}" could not be loaded. The game may not display correctly.`, 'Try refreshing the page or clearing the cache');
    }
    handleAnimationError(error, animationKey, context) {
        return this.createError(ErrorType.ANIMATION_ERROR, `Failed to create animation: ${animationKey}`, { ...context, details: { ...context.details, animationKey } }, error, `Animation "${animationKey}" could not be created. Sprites may not animate correctly.`, 'Check console for details or try regenerating assets');
    }
    handleApiError(error, operation, context) {
        const isNetworkError = error.message?.includes('fetch') ||
            error.message?.includes('network') ||
            error.message?.includes('Failed to fetch');
        const errorType = isNetworkError ? ErrorType.NETWORK_ERROR : ErrorType.API_ERROR;
        return this.createError(errorType, `API operation failed: ${operation}`, { ...context, operation }, error, isNetworkError
            ? 'Network connection issue. Please check your internet connection.'
            : `API request failed: ${error.message || 'Unknown error'}`, isNetworkError
            ? 'Check your internet connection and try again'
            : 'Check API key settings or try again later');
    }
}
export const errorHandler = new ErrorHandler();
if (typeof window !== 'undefined') {
    window.errorHandler = errorHandler;
    window.getRecentErrors = () => errorHandler.getRecentErrors();
    console.log('💡 Tip: Run getRecentErrors() in the console to see recent errors for diagnostics.');
}
