const fs = require('fs');
const path = require('path');

class UnsplashCacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheFile = path.join(__dirname, 'unsplash_cache.json');
        this.statsFile = path.join(__dirname, 'unsplash_cache_stats.json');
        this.CACHE_DURATION = 604800000; // 7 days
        this.MAX_CACHE_SIZE = 1000; // Maximum number of cached items
        
        // Statistics tracking
        this.stats = {
            hits: 0,
            misses: 0,
            totalRequests: 0,
            lastReset: Date.now()
        };
        
        this.loadCache();
        this.loadStats();
        this.startCleanupInterval();
    }

    // Load cache from disk
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const data = fs.readFileSync(this.cacheFile, 'utf8');
                const cacheData = JSON.parse(data);
                
                // Filter out expired entries
                const now = Date.now();
                for (const [key, value] of Object.entries(cacheData)) {
                    if (now - value.timestamp < this.CACHE_DURATION) {
                        this.cache.set(key, value);
                    }
                }
                
                console.log(`🖼️ Loaded ${this.cache.size} cached images from disk`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load cache from disk:', error.message);
        }
    }

    // Load statistics from disk
    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const data = fs.readFileSync(this.statsFile, 'utf8');
                this.stats = JSON.parse(data);
                console.log(`📊 Loaded cache statistics from disk`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load statistics from disk:', error.message);
        }
    }

    // Save cache to disk
    saveCache() {
        try {
            const cacheData = {};
            for (const [key, value] of this.cache) {
                cacheData[key] = value;
            }
            
            fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
            console.log(`💾 Saved ${this.cache.size} cached images to disk`);
        } catch (error) {
            console.error('❌ Could not save cache to disk:', error.message);
        }
    }

    // Save statistics to disk
    saveStats() {
        try {
            fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
        } catch (error) {
            console.error('❌ Could not save statistics to disk:', error.message);
        }
    }

    // Get cached image
    get(key) {
        this.stats.totalRequests++;
        
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
            this.stats.hits++;
            console.log(`💾 Cache HIT for key: "${key}"`);
            return cached.url;
        }
        
        this.stats.misses++;
        
        if (cached) {
            console.log(`⏰ Cache EXPIRED for key: "${key}"`);
            this.cache.delete(key);
        } else {
            console.log(`❌ Cache MISS for key: "${key}"`);
        }
        
        // Save stats periodically
        if (this.stats.totalRequests % 50 === 0) {
            this.saveStats();
        }
        
        return null;
    }

    // Set cached image
    set(key, url) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.cleanupOldest();
        }
        
        this.cache.set(key, {
            url: url,
            timestamp: Date.now()
        });
        
        console.log(`💾 Cached image for key: "${key}"`);
        
        // Save to disk periodically (not on every set to avoid I/O overhead)
        if (this.cache.size % 10 === 0) {
            this.saveCache();
        }
    }

    // Clean up oldest entries
    cleanupOldest() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.2); // Remove 20% of oldest
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
        
        console.log(`🧹 Cleaned up ${toRemove} oldest cache entries`);
    }

    // Clean up expired entries
    cleanupExpired() {
        const now = Date.now();
        let removed = 0;
        
        for (const [key, value] of this.cache) {
            if (now - value.timestamp >= this.CACHE_DURATION) {
                this.cache.delete(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} expired cache entries`);
            this.saveCache();
        }
    }

    // Start periodic cleanup
    startCleanupInterval() {
        // Clean up expired entries every hour
        setInterval(() => {
            this.cleanupExpired();
        }, 3600000); // 1 hour
        
        // Save cache every 30 minutes
        setInterval(() => {
            this.saveCache();
        }, 1800000); // 30 minutes
        
        // Save stats every 15 minutes
        setInterval(() => {
            this.saveStats();
        }, 900000); // 15 minutes
    }

    // Get cache statistics
    getStats() {
        const now = Date.now();
        let expired = 0;
        let valid = 0;
        
        for (const [key, value] of this.cache) {
            if (now - value.timestamp >= this.CACHE_DURATION) {
                expired++;
            } else {
                valid++;
            }
        }
        
        const hitRate = this.stats.totalRequests > 0 
            ? ((this.stats.hits / this.stats.totalRequests) * 100).toFixed(2) + '%'
            : '0%';
        
        const uptime = Math.floor((now - this.stats.lastReset) / 1000 / 60); // minutes
        
        return {
            cache: {
                total: this.cache.size,
                valid: valid,
                expired: expired,
                maxSize: this.MAX_CACHE_SIZE
            },
            performance: {
                hits: this.stats.hits,
                misses: this.stats.misses,
                totalRequests: this.stats.totalRequests,
                hitRate: hitRate,
                uptimeMinutes: uptime
            }
        };
    }

    // Reset statistics
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            totalRequests: 0,
            lastReset: Date.now()
        };
        this.saveStats();
        console.log('📊 Cache statistics reset');
    }

    // Clear all cache
    clear() {
        this.cache.clear();
        this.saveCache();
        console.log('🗑️ Cache cleared');
    }

    // Get cache size in MB
    getCacheSize() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const stats = fs.statSync(this.cacheFile);
                return (stats.size / 1024 / 1024).toFixed(2) + ' MB';
            }
            return '0 MB';
        } catch (error) {
            return 'Unknown';
        }
    }
}

module.exports = UnsplashCacheManager; 