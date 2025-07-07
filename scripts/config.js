// Configuration file for API keys and settings
module.exports = {
    // Unsplash API Configuration - Multiple accounts for better rate limits
    // Get your free API keys from: https://unsplash.com/developers
    UNSPLASH_ACCESS_KEYS: [
        'kIahGTC6D_LlrsiPjzWOHrw0FAY-uHJ0x15y98Lmd2I', // Primary key
        'CENk_ZWTxQjYFy_bw6uSDzKQ4xDQRBFvd6qjY6ydgZ0', // Second key
        // Add your third Unsplash API key here:
        // 'YOUR_THIRD_UNSPLASH_API_KEY_HERE',
    ],
    
    // Unsplash API settings
    UNSPLASH_API_URL: 'https://api.unsplash.com/photos/random',
    UNSPLASH_RATE_LIMIT_PER_HOUR: 50, // Default rate limit per hour per account
    UNSPLASH_RETRY_DELAY: 1000, // Delay in ms before retrying with different account
    
    // Other API configurations can be added here
    // PIXABAY_API_KEY: 'your_pixabay_key_here',
    // PEXELS_API_KEY: 'your_pexels_key_here',
}; 