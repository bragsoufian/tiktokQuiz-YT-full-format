// Example integration of enhanced Unsplash cache manager
const UnsplashCacheManager = require('./unsplash_cache_manager');

// Initialize the enhanced cache manager
const unsplashCache = new UnsplashCacheManager();

// Enhanced getUnsplashImage function using the new cache manager
function getUnsplashImage(query, customCacheKey = null) {
    return new Promise((resolve, reject) => {
        if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === 'YOUR_UNSPLASH_API_KEY_HERE') {
            log.warning('Unsplash API key not configured, using fallback image');
            resolve('https://httpbin.org/image/png?width=800&height=600');
            return;
        }

        // Use custom cache key if provided, otherwise use query
        const cacheKey = customCacheKey || query.toLowerCase().trim();
        
        // Check cache first
        const cachedUrl = unsplashCache.get(cacheKey);
        if (cachedUrl) {
            resolve(cachedUrl);
            return;
        }

        // Add a seed based on cache key to get consistent results for the same query
        const seed = customCacheKey ? customCacheKey.hashCode() : query.toLowerCase().trim().hashCode();
        const url = `${UNSPLASH_API_URL}?query=${encodeURIComponent(query)}&orientation=landscape&w=800&h=600&seed=${seed}&client_id=${UNSPLASH_ACCESS_KEY}`;
        
        log.unsplash(`Fetching image for query: "${query}"`);
        
        https.get(url, (res) => {
            let data = '';
            
            // Check for rate limit or other HTTP errors
            if (res.statusCode === 403) {
                log.error('❌ Unsplash API: Rate limit exceeded or unauthorized access');
                log.warning('⚠️ Using fallback image due to rate limit');
                resolve('https://httpbin.org/image/png?width=800&height=600');
                return;
            }
            
            if (res.statusCode !== 200) {
                log.error(`❌ Unsplash API error: HTTP ${res.statusCode}`);
                log.warning('⚠️ Using fallback image due to API error');
                resolve('https://httpbin.org/image/png?width=800&height=600');
                return;
            }
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    // Check if response is JSON or error text
                    if (data.includes('Rate Limit Exceeded') || data.includes('error')) {
                        log.error(`❌ Unsplash API error: ${data}`);
                        log.warning('⚠️ Using fallback image due to API error');
                        resolve('https://httpbin.org/image/png?width=800&height=600');
                        return;
                    }
                    
                    const imageData = JSON.parse(data);
                    if (imageData.urls && imageData.urls.regular) {
                        const imageUrl = imageData.urls.regular;
                        log.unsplash(`✅ Image found: ${imageUrl}`);
                        
                        // Cache the result using the enhanced cache manager
                        unsplashCache.set(cacheKey, imageUrl);
                        
                        resolve(imageUrl);
                    } else {
                        log.warning('No image found in response, using fallback');
                        resolve('https://httpbin.org/image/png?width=800&height=600');
                    }
                } catch (error) {
                    log.error(`❌ Error parsing Unsplash response: ${error.message}`);
                    log.error(`Raw response: ${data.substring(0, 200)}...`);
                    log.warning('⚠️ Using fallback image due to parsing error');
                    resolve('https://httpbin.org/image/png?width=800&height=600');
                }
            });
        }).on('error', (error) => {
            log.error(`❌ Network error fetching from Unsplash: ${error.message}`);
            log.warning('⚠️ Using fallback image due to network error');
            resolve('https://httpbin.org/image/png?width=800&height=600');
        });
    });
}

// Function to display cache statistics
function displayCacheStats() {
    const stats = unsplashCache.getStats();
    const cacheSize = unsplashCache.getCacheSize();
    
    console.log('\n📊 Unsplash Cache Statistics:');
    console.log('==============================');
    console.log(`Cache Size: ${stats.cache.total}/${stats.cache.maxSize} entries (${cacheSize})`);
    console.log(`Valid Entries: ${stats.cache.valid}`);
    console.log(`Expired Entries: ${stats.cache.expired}`);
    console.log(`Hit Rate: ${stats.performance.hitRate}`);
    console.log(`Total Requests: ${stats.performance.totalRequests}`);
    console.log(`Hits: ${stats.performance.hits}`);
    console.log(`Misses: ${stats.performance.misses}`);
    console.log(`Uptime: ${stats.performance.uptimeMinutes} minutes`);
    console.log('==============================\n');
}

// Example usage in your existing server
// Add this to your server.js:

// Display cache stats every 10 minutes
setInterval(() => {
    displayCacheStats();
}, 600000); // 10 minutes

// Add a command to manually display stats
process.on('SIGUSR1', () => {
    displayCacheStats();
});

// Add a command to reset cache stats
process.on('SIGUSR2', () => {
    unsplashCache.resetStats();
    console.log('📊 Cache statistics reset via signal');
});

// Example: Cleanup on server shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down server...');
    displayCacheStats(); // Show final stats
    unsplashCache.saveCache(); // Ensure cache is saved
    process.exit(0);
}); 