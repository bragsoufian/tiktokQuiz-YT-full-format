const fs = require('fs');
const path = require('path');

class EncouragementManager {
    constructor() {
        this.phrases = [];
        this.settings = {};
        this.usedPhrases = new Set(); // Track used phrases to avoid repetition
        this.phrasesFile = path.join(__dirname, 'encouragement_phrases.json');
        this.loadPhrases();
    }

    loadPhrases() {
        try {
            const data = fs.readFileSync(this.phrasesFile, 'utf8');
            const jsonData = JSON.parse(data);
            this.phrases = jsonData.phrases || [];
            this.settings = jsonData.settings || {};
            console.log('✅ Encouragement phrases loaded:', this.phrases.length, 'phrases');
        } catch (error) {
            console.error('❌ Error loading encouragement phrases:', error.message);
            this.phrases = [];
            this.settings = {
                playBeforeReady: true,
                randomSelection: true,
                maxPhrasesPerSession: 2
            };
        }
    }

    // Get a random phrase that hasn't been used recently
    getRandomPhrase() {
        if (this.phrases.length === 0) {
            return null;
        }

        // If we've used most phrases, reset the used set
        if (this.usedPhrases.size >= this.phrases.length * 0.8) {
            console.log('🔄 Resetting used phrases (most phrases have been used)');
            this.usedPhrases.clear();
        }

        // Filter out recently used phrases
        const availablePhrases = this.phrases.filter(phrase => 
            !this.usedPhrases.has(phrase.id)
        );

        if (availablePhrases.length === 0) {
            // If all phrases have been used, reset and try again
            this.usedPhrases.clear();
            return this.getRandomPhrase();
        }

        // Select a random phrase
        const randomIndex = Math.floor(Math.random() * availablePhrases.length);
        const selectedPhrase = availablePhrases[randomIndex];
        
        // Mark as used
        this.usedPhrases.add(selectedPhrase.id);
        
        console.log('🎤 Selected encouragement phrase:', selectedPhrase.text.substring(0, 50) + '...');
        return selectedPhrase;
    }

    // Get a phrase by category
    getPhraseByCategory(category) {
        const categoryPhrases = this.phrases.filter(phrase => phrase.category === category);
        if (categoryPhrases.length === 0) {
            return this.getRandomPhrase();
        }
        
        const randomIndex = Math.floor(Math.random() * categoryPhrases.length);
        return categoryPhrases[randomIndex];
    }

    // Get multiple phrases for a session
    getSessionPhrases(count = null) {
        const maxCount = count || this.settings.maxPhrasesPerSession || 2;
        const phrases = [];
        
        for (let i = 0; i < maxCount; i++) {
            const phrase = this.getRandomPhrase();
            if (phrase) {
                phrases.push(phrase);
            }
        }
        
        return phrases;
    }

    // Reset used phrases (useful for new sessions)
    resetSession() {
        this.usedPhrases.clear();
        console.log('🔄 Encouragement session reset');
    }

    // Get statistics
    getStats() {
        return {
            totalPhrases: this.phrases.length,
            usedPhrases: this.usedPhrases.size,
            availablePhrases: this.phrases.length - this.usedPhrases.size,
            categories: [...new Set(this.phrases.map(p => p.category))]
        };
    }

    // Add a new phrase (useful for dynamic content)
    addPhrase(text, category = 'general') {
        const newPhrase = {
            id: Date.now(), // Simple ID generation
            text: text,
            category: category
        };
        
        this.phrases.push(newPhrase);
        console.log('➕ Added new encouragement phrase:', text.substring(0, 50) + '...');
        return newPhrase;
    }

    // Save phrases back to file (if modified)
    savePhrases() {
        try {
            const data = {
                phrases: this.phrases,
                settings: this.settings
            };
            fs.writeFileSync(this.phrasesFile, JSON.stringify(data, null, 2));
            console.log('💾 Encouragement phrases saved');
        } catch (error) {
            console.error('❌ Error saving encouragement phrases:', error.message);
        }
    }
}

module.exports = EncouragementManager; 