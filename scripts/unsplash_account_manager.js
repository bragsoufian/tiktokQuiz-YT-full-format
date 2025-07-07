const config = require('./config');

class UnsplashAccountManager {
    constructor() {
        this.accounts = this.initializeAccounts();
        this.currentAccountIndex = 0;
        this.requestCounts = new Map(); // Track requests per account
        this.lastResetTime = Date.now();
        this.rateLimitWindow = 60 * 60 * 1000; // 1 hour in milliseconds
        this.retryDelay = config.UNSPLASH_RETRY_DELAY || 1000;
        
        // Reset counters every hour
        setInterval(() => this.resetCounters(), this.rateLimitWindow);
        
        console.log(`🔄 Unsplash Account Manager initialized with ${this.accounts.length} accounts`);
        this.logAccountStatus();
    }
    
    initializeAccounts() {
        const keys = config.UNSPLASH_ACCESS_KEYS || [];
        const validKeys = keys.filter(key => key && key !== 'YOUR_SECOND_UNSPLASH_API_KEY_HERE' && key !== 'YOUR_THIRD_UNSPLASH_API_KEY_HERE');
        
        if (validKeys.length === 0) {
            console.warn('⚠️ No valid Unsplash API keys found in config');
            return [];
        }
        
        return validKeys.map((key, index) => ({
            id: index + 1,
            key: key,
            requestsThisHour: 0,
            lastUsed: null,
            isActive: true,
            errors: 0
        }));
    }
    
    resetCounters() {
        const now = Date.now();
        this.lastResetTime = now;
        
        this.accounts.forEach(account => {
            account.requestsThisHour = 0;
            account.errors = 0;
        });
        
        console.log('🔄 Unsplash rate limit counters reset');
    }
    
    getNextAvailableAccount() {
        const now = Date.now();
        const rateLimit = config.UNSPLASH_RATE_LIMIT_PER_HOUR || 50;
        
        // Find accounts that haven't hit their rate limit
        const availableAccounts = this.accounts.filter(account => 
            account.isActive && 
            account.requestsThisHour < rateLimit &&
            account.errors < 3 // Don't use accounts with too many errors
        );
        
        if (availableAccounts.length === 0) {
            console.warn('⚠️ All Unsplash accounts have hit rate limits or have too many errors');
            return null;
        }
        
        // Round-robin selection among available accounts
        const selectedAccount = availableAccounts[this.currentAccountIndex % availableAccounts.length];
        this.currentAccountIndex = (this.currentAccountIndex + 1) % availableAccounts.length;
        
        return selectedAccount;
    }
    
    markRequest(accountId, success = true) {
        const account = this.accounts.find(acc => acc.id === accountId);
        if (account) {
            account.requestsThisHour++;
            account.lastUsed = Date.now();
            
            if (!success) {
                account.errors++;
                if (account.errors >= 3) {
                    console.warn(`⚠️ Account ${accountId} disabled due to too many errors`);
                    account.isActive = false;
                }
            }
        }
    }
    
    async makeRequest(url, retryCount = 0) {
        const maxRetries = this.accounts.length;
        
        if (retryCount >= maxRetries) {
            throw new Error('All Unsplash accounts exhausted');
        }
        
        const account = this.getNextAvailableAccount();
        if (!account) {
            throw new Error('No available Unsplash accounts');
        }
        
        // Replace the API key in the URL
        const urlWithKey = url.replace(/client_id=[^&]+/, `client_id=${account.key}`);
        
        console.log(`🔄 Using Unsplash account ${account.id} (${account.requestsThisHour + 1}/${config.UNSPLASH_RATE_LIMIT_PER_HOUR || 50} requests this hour)`);
        
        try {
            const response = await this.fetchWithTimeout(urlWithKey);
            
            if (response.status === 200) {
                this.markRequest(account.id, true);
                return response;
            } else if (response.status === 403) {
                // Rate limit hit for this account
                console.warn(`⚠️ Rate limit hit for account ${account.id}`);
                this.markRequest(account.id, false);
                
                // Wait before retrying with different account
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.makeRequest(url, retryCount + 1);
            } else {
                // Other error
                console.error(`❌ Account ${account.id} error: HTTP ${response.status}`);
                this.markRequest(account.id, false);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.makeRequest(url, retryCount + 1);
            }
        } catch (error) {
            console.error(`❌ Account ${account.id} network error: ${error.message}`);
            this.markRequest(account.id, false);
            
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            return this.makeRequest(url, retryCount + 1);
        }
    }
    
    fetchWithTimeout(url, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const req = https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    res.body = data;
                    resolve(res);
                });
            });
            
            req.on('error', reject);
            req.setTimeout(timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
    
    getStats() {
        const totalRequests = this.accounts.reduce((sum, acc) => sum + acc.requestsThisHour, 0);
        const activeAccounts = this.accounts.filter(acc => acc.isActive).length;
        const totalAccounts = this.accounts.length;
        
        return {
            totalAccounts,
            activeAccounts,
            totalRequests,
            accounts: this.accounts.map(acc => ({
                id: acc.id,
                requestsThisHour: acc.requestsThisHour,
                isActive: acc.isActive,
                errors: acc.errors,
                lastUsed: acc.lastUsed
            }))
        };
    }
    
    logAccountStatus() {
        const stats = this.getStats();
        console.log('\n📊 Unsplash Account Status:');
        console.log('==========================');
        console.log(`Total Accounts: ${stats.totalAccounts}`);
        console.log(`Active Accounts: ${stats.activeAccounts}`);
        console.log(`Total Requests This Hour: ${stats.totalRequests}`);
        console.log('\nAccount Details:');
        
        stats.accounts.forEach(acc => {
            const status = acc.isActive ? '✅' : '❌';
            const lastUsed = acc.lastUsed ? new Date(acc.lastUsed).toLocaleTimeString() : 'Never';
            console.log(`  Account ${acc.id}: ${status} ${acc.requestsThisHour} requests, ${acc.errors} errors, last used: ${lastUsed}`);
        });
        console.log('==========================\n');
    }
    
    // Method to manually check account status
    checkStatus() {
        this.logAccountStatus();
    }
    
    // Method to reset a specific account (useful for testing)
    resetAccount(accountId) {
        const account = this.accounts.find(acc => acc.id === accountId);
        if (account) {
            account.requestsThisHour = 0;
            account.errors = 0;
            account.isActive = true;
            console.log(`🔄 Account ${accountId} reset`);
        }
    }
}

module.exports = UnsplashAccountManager; 