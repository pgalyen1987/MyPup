// Comprehensive Error Handling System
// Implements Phase 6: Error Handling & Recovery

import { CONFIG } from './config.js';

// Custom error types
export enum ErrorType {
    API_ERROR = 'API_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    ASSET_LOAD_ERROR = 'ASSET_LOAD_ERROR',
    TEXTURE_ERROR = 'TEXTURE_ERROR',
    ANIMATION_ERROR = 'ANIMATION_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorContext {
    operation: string;
    module: string;
    details?: any;
    timestamp?: number;
}

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryable?: (error: any) => boolean;
}

export class AppError extends Error {
    type: ErrorType;
    context: ErrorContext;
    originalError?: any;
    recoverable: boolean;
    userMessage: string;
    recoveryAction?: string;

    constructor(
        type: ErrorType,
        message: string,
        context: ErrorContext,
        originalError?: any,
        recoverable: boolean = true,
        userMessage?: string,
        recoveryAction?: string
    ) {
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
    private errorLog: AppError[] = [];
    private maxLogSize = 100;

    /**
     * Log an error with full context
     */
    logError(error: AppError): void {
        this.errorLog.push(error);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift(); // Remove oldest
        }

        // Enhanced console logging for diagnostics
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

        // Log to error tracking (could be extended to send to external service)
        if (CONFIG.DEBUG_MODE) {
            console.log('Error JSON:', JSON.stringify(error.toJSON(), null, 2));
        }
    }

    /**
     * Create a standardized error from various error types
     */
    createError(
        type: ErrorType,
        message: string,
        context: ErrorContext,
        originalError?: any,
        userMessage?: string,
        recoveryAction?: string
    ): AppError {
        const error = new AppError(
            type,
            message,
            context,
            originalError,
            true,
            userMessage,
            recoveryAction
        );
        this.logError(error);
        return error;
    }

    /**
     * Retry a function with exponential backoff
     */
    async retryWithBackoff<T>(
        fn: () => Promise<T>,
        options: RetryOptions = {},
        context: ErrorContext
    ): Promise<T> {
        const {
            maxRetries = 3,
            initialDelay = 1000,
            maxDelay = 10000,
            backoffMultiplier = 2,
            retryable = () => true
        } = options;

        let lastError: any;
        let delay = initialDelay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                // Check if error is retryable
                if (!retryable(error)) {
                    throw this.createError(
                        ErrorType.UNKNOWN_ERROR,
                        `Non-retryable error: ${error.message}`,
                        { ...context, details: { attempt, maxRetries } },
                        error,
                        `Operation failed: ${error.message}`,
                        'Check the console for details'
                    );
                }

                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Log retry attempt
                console.warn(
                    `⚠️ Retry attempt ${attempt + 1}/${maxRetries} for ${context.operation} after ${delay}ms`
                );

                // Wait with exponential backoff
                await this.delay(delay);
                delay = Math.min(delay * backoffMultiplier, maxDelay);
            }
        }

        // All retries exhausted
        throw this.createError(
            ErrorType.TIMEOUT_ERROR,
            `Operation failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`,
            { ...context, details: { attempts: maxRetries + 1 } },
            lastError,
            `Operation failed after multiple attempts. Please try again.`,
            'Refresh the page or check your connection'
        );
    }

    /**
     * Delay utility
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get recent errors for diagnostics
     */
    getRecentErrors(count: number = 10): AppError[] {
        return this.errorLog.slice(-count);
    }

    /**
     * Clear error log
     */
    clearLog(): void {
        this.errorLog = [];
    }

    /**
     * Handle texture-related errors
     */
    handleTextureError(error: any, textureKey: string, context: ErrorContext): AppError {
        return this.createError(
            ErrorType.TEXTURE_ERROR,
            `Failed to load/create texture: ${textureKey}`,
            { ...context, details: { ...context.details, textureKey } },
            error,
            `Texture "${textureKey}" could not be loaded. The game may not display correctly.`,
            'Try refreshing the page or clearing the cache'
        );
    }

    /**
     * Handle animation-related errors
     */
    handleAnimationError(error: any, animationKey: string, context: ErrorContext): AppError {
        return this.createError(
            ErrorType.ANIMATION_ERROR,
            `Failed to create animation: ${animationKey}`,
            { ...context, details: { ...context.details, animationKey } },
            error,
            `Animation "${animationKey}" could not be created. Sprites may not animate correctly.`,
            'Check console for details or try regenerating assets'
        );
    }

    /**
     * Handle API-related errors
     */
    handleApiError(error: any, operation: string, context: ErrorContext): AppError {
        const isNetworkError = error.message?.includes('fetch') || 
                              error.message?.includes('network') ||
                              error.message?.includes('Failed to fetch');
        
        const errorType = isNetworkError ? ErrorType.NETWORK_ERROR : ErrorType.API_ERROR;
        
        return this.createError(
            errorType,
            `API operation failed: ${operation}`,
            { ...context, operation },
            error,
            isNetworkError 
                ? 'Network connection issue. Please check your internet connection.'
                : `API request failed: ${error.message || 'Unknown error'}`,
            isNetworkError 
                ? 'Check your internet connection and try again'
                : 'Check API key settings or try again later'
        );
    }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

// Export to window for console access
if (typeof window !== 'undefined') {
    (window as any).errorHandler = errorHandler;
    (window as any).getRecentErrors = () => errorHandler.getRecentErrors();
    console.log('💡 Tip: Run getRecentErrors() in the console to see recent errors for diagnostics.');
}
