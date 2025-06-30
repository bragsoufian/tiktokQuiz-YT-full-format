# Unsplash API Integration for Dynamic Background Images

## 🎨 Overview
This integration automatically generates beautiful background images for each quiz question using the Unsplash API. The system analyzes question content and fetches relevant images dynamically.

## 🚀 Setup Instructions

### 1. Get Your Free Unsplash API Key
1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Click "Register as a developer"
3. Create an account or sign in
4. Create a new application:
   - **Name**: "TikTok Quiz Backgrounds"
   - **Description**: "Dynamic background images for quiz questions"
   - **What are you building?**: "A quiz game with dynamic backgrounds"
5. Copy your API key (looks like: `abc123def456ghi789`)

### 2. Configure the API Key
1. Open `scripts/config.js`
2. Replace `'YOUR_UNSPLASH_API_KEY_HERE'` with your actual API key
3. Save the file

### 3. Restart Your Server
```bash
node scripts/server.js
```

## 🎯 How It Works

### Automatic Keyword Extraction
The system automatically extracts relevant keywords from each question:

- **"Which animal can survive in space?"** → `"space animal"`
- **"Which country eats the most chocolate?"** → `"chocolate food"`
- **"What's the fastest creature on Earth?"** → `"fast animal"`
- **"Which human organ can grow back?"** → `"medical anatomy"`

### Image Generation Process
1. **Question Analysis**: Extracts keywords from the question text
2. **API Request**: Fetches a random image from Unsplash using the keywords
3. **Image Processing**: Gets a landscape image (800x600) optimized for your game
4. **Background Application**: Sends the image URL to Godot for display

## 🖼️ Example Keywords Used

| Question Type | Keywords Generated |
|---------------|-------------------|
| Space questions | `space galaxy`, `space astronaut`, `space animal` |
| Food questions | `chocolate food`, `fruit food`, `luxury fruit` |
| Animal questions | `wildlife nature`, `nocturnal animal`, `fast animal` |
| Medical questions | `medical anatomy`, `regeneration medical` |
| Geography questions | `landscape`, `desert landscape`, `ancient history` |

## 🔧 Configuration Options

### API Limits
- **Free Tier**: 50 requests per hour
- **Image Quality**: High-quality photos
- **Image Size**: 800x600 landscape format

### Fallback System
If the Unsplash API fails or reaches its limit, the system automatically falls back to:
- `https://httpbin.org/image/png?width=800&height=600`

## 🎮 Testing

1. **Start the server** with your API key configured
2. **Run the Godot project**
3. **Watch the logs** for Unsplash API activity:
   ```
   🖼️ Fetching image for query: "space animal"
   🖼️ ✅ Image found: https://images.unsplash.com/photo-...
   ```

## 🛠️ Troubleshooting

### API Key Issues
- **Error**: "Unsplash API key not configured"
- **Solution**: Check your API key in `config.js`

### Rate Limiting
- **Error**: "Too many requests"
- **Solution**: Wait for the hourly limit to reset (50 requests/hour)

### Network Issues
- **Error**: "Error fetching from Unsplash"
- **Solution**: Check your internet connection

## 🎨 Customization

### Adding New Keywords
Edit the `keywordMappings` object in `server.js`:

```javascript
const keywordMappings = {
    'your keyword': 'unsplash search term',
    'new topic': 'relevant image search'
};
```

### Changing Image Size
Modify the URL parameters in `getUnsplashImage()`:
```javascript
const url = `${UNSPLASH_API_URL}?query=${query}&orientation=landscape&w=1920&h=1080&client_id=${UNSPLASH_ACCESS_KEY}`;
```

## 🎉 Benefits

✅ **Dynamic Content**: Every question gets a unique, relevant background
✅ **High Quality**: Professional photos from Unsplash
✅ **Automatic**: No manual image selection needed
✅ **Scalable**: Works with any number of questions
✅ **Fallback**: Always has a backup image if API fails

Enjoy your beautiful, dynamic quiz backgrounds! 🎨✨ 