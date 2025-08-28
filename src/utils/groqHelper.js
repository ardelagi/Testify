const Groq = require('groq-sdk');

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Groq Chat Function - Pengganti ApexChat
 * @param {string} model - Model name (e.g., "llama-3.3-70b-versatile")
 * @param {string} prompt - User prompt
 * @param {object} options - Chat options
 * @returns {string} AI response
 */
async function GroqChat(model, prompt, options = {}) {
    try {
        const {
            userId = 'anonymous',
            memory = false,
            limit = 0,
            instruction = 'You are a helpful assistant.',
        } = options;

        // Build messages array
        const messages = [
            {
                role: 'system',
                content: instruction
            },
            {
                role: 'user', 
                content: prompt
            }
        ];

        // Call Groq API
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: model,
            max_tokens: limit > 0 ? limit * 10 : 1000, // Convert word limit to token limit
            temperature: 0.7,
            stream: false
        });

        return completion.choices[0]?.message?.content || 'No response generated.';
    } catch (error) {
        console.error('[GROQ] Error:', error);
        throw error;
    }
}

/**
 * Groq Image Analysis Function - Pengganti ApexImageAnalyzer
 * Note: Groq doesn't support image analysis yet, 
 * you might need to use OpenAI vision or other service
 */
async function GroqImageAnalyzer({ imgURL, prompt }) {
    // Groq belum support image analysis
    // Alternatif: gunakan OpenAI GPT-4 Vision atau service lain
    throw new Error('Image analysis not supported by Groq. Use OpenAI GPT-4 Vision instead.');
}

/**
 * Image Generation Function - Groq tidak support image gen
 * Alternatif bisa pakai OpenAI DALL-E, Stability AI, atau Hugging Face
 */
async function GroqImageGenerate(model, prompt, options) {
    // Groq tidak support image generation
    throw new Error('Image generation not supported by Groq. Use OpenAI DALL-E or other service.');
}

module.exports = {
    GroqChat,
    GroqImageAnalyzer,
    GroqImageGenerate
};