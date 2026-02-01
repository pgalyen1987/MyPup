// Utility script to test which Gemini models are available
// Run this in browser console to check available models

async function testGeminiModels() {
    const apiKey = CONFIG.GEMINI_API_KEY || prompt('Enter your Gemini API key:');
    
    if (!apiKey) {
        console.error('No API key provided');
        return;
    }
    
    console.log('Testing available Gemini models...\n');
    
    // List of models to test - try both v1 and v1beta
    const textModels = [
        // v1 API models
        { name: 'gemini-pro', version: 'v1' },
        { name: 'gemini-1.5-flash', version: 'v1' },
        { name: 'gemini-1.5-pro', version: 'v1' },
        // v1beta API models
        { name: 'gemini-1.5-flash', version: 'v1beta' },
        { name: 'gemini-1.5-pro', version: 'v1beta' },
        { name: 'gemini-pro', version: 'v1beta' },
    ];
    
    const imageModels = [
        'gemini-2.0-flash-exp-image-generation',
        'gemini-2.5-flash-image',
        'gemini-3-pro-image-preview',
        'gemini-2.0-flash-exp'
    ];
    
    console.log('=== Testing Text Models ===');
    for (const model of textModels) {
        try {
            const version = model.version || 'v1beta';
            const modelName = typeof model === 'string' ? model : model.name;
            const response = await fetch(
                `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Say hello' }] }]
                    })
                }
            );
            
            if (response.ok) {
                console.log(`✅ ${modelName} (${version}) - WORKING`);
            } else {
                const error = await response.text();
                console.log(`❌ ${modelName} (${version}) - ${response.status}: ${error.substring(0, 100)}`);
            }
        } catch (error) {
            const modelName = typeof model === 'string' ? model : model.name;
            console.log(`❌ ${modelName} - Error: ${error.message}`);
        }
    }
    
    console.log('\n=== Testing Image Generation Models ===');
    for (const model of imageModels) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Create a simple red square' }] }]
                    })
                }
            );
            
            if (response.ok) {
                const data = await response.json();
                const hasImage = data.candidates?.[0]?.content?.parts?.some(p => p.inlineData || p.inline_data);
                if (hasImage) {
                    console.log(`✅ ${model} - WORKING (returns images)`);
                } else {
                    console.log(`⚠️ ${model} - Works but may not return images`);
                }
            } else {
                const error = await response.text();
                console.log(`❌ ${model} - ${response.status}: ${error.substring(0, 100)}`);
            }
        } catch (error) {
            console.log(`❌ ${model} - Error: ${error.message}`);
        }
    }
    
    console.log('\n=== Summary ===');
    console.log('✅ = Model works');
    console.log('⚠️ = Model exists but quota exceeded (429)');
    console.log('❌ = Model not found or not accessible');
    console.log('\n=== Next Steps ===');
    console.log('1. If you see ✅ models, update config.js with those model names');
    console.log('2. If you see ⚠️ (429), check your quota in Google Cloud Console');
    console.log('3. If all are ❌, make sure "Generative Language API" is enabled');
    console.log('4. Run listAvailableModels() to see all models your API key can access');
}

// Make it available globally
if (typeof window !== 'undefined') {
    window.testGeminiModels = testGeminiModels;
    console.log('Run testGeminiModels() in console to test available models');
}
