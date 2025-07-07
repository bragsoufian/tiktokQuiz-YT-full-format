# Multi-Account Unsplash System

This system allows you to use multiple Unsplash API accounts to avoid rate limits and ensure continuous image availability for your quiz game.

## 🚀 Benefits

- **Higher Rate Limits**: Each Unsplash account gets 50 requests per hour
- **Automatic Rotation**: System automatically switches between accounts
- **Fault Tolerance**: If one account fails, others continue working
- **Persistent Caching**: Images are cached to reduce API calls
- **Real-time Monitoring**: Track account usage and performance

## 📋 Setup Instructions

### 1. Create Multiple Unsplash Developer Accounts

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Create multiple developer accounts (you can use different email addresses)
3. For each account:
   - Create a new application
   - Get your Access Key
   - Note: Each account gets 50 requests per hour

### 2. Configure Your API Keys

Edit `scripts/config.js` and add your API keys:

```javascript
module.exports = {
    UNSPLASH_ACCESS_KEYS: [
        'your_first_api_key_here',
        'your_second_api_key_here', 
        'your_third_api_key_here',
        // Add more keys as needed
    ],
    
    // Optional settings
    UNSPLASH_RATE_LIMIT_PER_HOUR: 50, // Default per account
    UNSPLASH_RETRY_DELAY: 1000, // Delay between retries (ms)
};
```

### 3. Test Your Setup

Run the test script to verify everything works:

```bash
node scripts/test_multi_account.js
```

## 🔧 How It Works

### Account Management
- **Round-Robin Selection**: Requests are distributed evenly across accounts
- **Rate Limit Tracking**: Each account's usage is monitored hourly
- **Error Handling**: Accounts with too many errors are temporarily disabled
- **Automatic Recovery**: Disabled accounts are re-enabled after error reset

### Request Flow
1. Check cache first (reduces API calls)
2. Select next available account
3. Make API request
4. If rate limited, try next account
5. Cache successful results
6. Update account statistics

### Rate Limit Handling
- Each account: 50 requests per hour
- Automatic rotation when limits are reached
- Graceful fallback to other accounts
- Hourly counter reset

## 📊 Monitoring

### Real-time Status
Use the SIGUSR1 signal to check account status:

```bash
# On Linux/Mac
kill -USR1 <process_id>

# On Windows (if supported)
# The status is also logged every 10 minutes
```

### Status Information
- Total accounts and active accounts
- Requests per hour for each account
- Error counts and last used times
- Cache hit rates and performance

### Log Messages
- `🔄 Using Unsplash account X` - Shows which account is being used
- `⚠️ Rate limit hit for account X` - Rate limit warnings
- `❌ Account X error` - Error notifications
- `✅ Image found` - Successful image retrieval

## 🧪 Testing

### Test Script Features
- **Image Request Testing**: Tests multiple queries
- **Rate Limit Simulation**: Simulates hitting rate limits
- **Account Rotation**: Verifies round-robin selection
- **Error Handling**: Tests error scenarios

### Running Tests
```bash
node scripts/test_multi_account.js
```

## 📈 Performance Optimization

### Caching Strategy
- **Persistent Cache**: Images cached to disk
- **Cache Expiration**: 7-day cache lifetime
- **Cache Size Limits**: Prevents disk space issues
- **Hit Rate Tracking**: Monitor cache effectiveness

### Best Practices
1. **Use Multiple Accounts**: More accounts = higher rate limits
2. **Monitor Usage**: Check account status regularly
3. **Cache Effectively**: Reduce API calls with good caching
4. **Handle Errors**: System automatically handles most errors
5. **Backup Keys**: Keep spare API keys ready

## 🔍 Troubleshooting

### Common Issues

**"No available Unsplash accounts"**
- Check if API keys are valid
- Verify rate limits haven't been exceeded
- Ensure accounts aren't disabled due to errors

**"Rate limit exceeded"**
- Add more API keys
- Check account usage with SIGUSR1
- Wait for hourly reset

**"Network errors"**
- Check internet connection
- Verify API endpoints are accessible
- Monitor error logs

### Debug Commands

```bash
# Check account status
kill -USR1 <process_id>

# Reset cache statistics  
kill -USR2 <process_id>

# View logs for detailed information
tail -f server.log
```

## 📝 Configuration Options

### Advanced Settings
```javascript
module.exports = {
    UNSPLASH_ACCESS_KEYS: [...],
    UNSPLASH_API_URL: 'https://api.unsplash.com/photos/random',
    UNSPLASH_RATE_LIMIT_PER_HOUR: 50,
    UNSPLASH_RETRY_DELAY: 1000,
    
    // Cache settings (in unsplash_cache_manager.js)
    CACHE_EXPIRY_DAYS: 7,
    CACHE_MAX_SIZE: 1000,
    CACHE_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
};
```

## 🎯 Example Usage

With 3 accounts, you get:
- **150 requests per hour** (3 × 50)
- **Automatic rotation** between accounts
- **Fault tolerance** if one account fails
- **Persistent caching** reduces actual API calls

This means you can run your quiz game continuously without worrying about running out of images!

## 📞 Support

If you encounter issues:
1. Check the logs for error messages
2. Verify your API keys are correct
3. Test with the test script
4. Monitor account status with SIGUSR1
5. Ensure you have sufficient API keys configured 