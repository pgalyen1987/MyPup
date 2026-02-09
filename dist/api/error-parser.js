export const ErrorParser = {
    parse(errorText, statusCode) {
        try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
                return this._parseErrorObject(errorData.error, statusCode);
            }
        }
        catch {
        }
        return {
            type: 'UNKNOWN_ERROR',
            message: `API error (${statusCode}): ${errorText.substring(0, 200)}`,
            originalMessage: errorText,
            code: statusCode,
            action: 'check_key'
        };
    },
    _parseErrorObject(error, statusCode) {
        const message = error.message || 'Unknown API error';
        const code = error.code || statusCode;
        const patterns = [
            {
                keywords: ['expired', 'API key expired'],
                type: 'API_KEY_EXPIRED',
                getMessage: () => 'API key error. Check setup.',
                action: 'check_setup'
            },
            {
                keywords: ['invalid', 'API_KEY_INVALID', 'API key not valid'],
                type: 'API_KEY_INVALID',
                getMessage: () => 'Invalid API key.',
                action: 'clear_and_renew'
            },
            {
                keywords: ['quota', 'QUOTA_EXCEEDED', 'exceeded your current quota'],
                type: 'QUOTA_EXCEEDED',
                getMessage: () => 'API quota exceeded.',
                action: 'check_quota'
            },
            {
                keywords: ['not found', 'not supported', 'ListModels', 'is not found', 'not available'],
                type: 'MODEL_NOT_FOUND',
                getMessage: () => 'Model not found. Enable Generative Language API.',
                action: 'enable_api'
            }
        ];
        for (const pattern of patterns) {
            if (pattern.keywords.some(kw => message.includes(kw))) {
                return {
                    type: pattern.type,
                    message: pattern.getMessage(),
                    originalMessage: message,
                    code,
                    action: pattern.action
                };
            }
        }
        return {
            type: 'API_ERROR',
            message,
            originalMessage: message,
            code,
            action: 'check_key'
        };
    },
};
