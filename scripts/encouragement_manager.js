const fs = require('fs');
const path = require('path');

class EncouragementManager {
    constructor() {
        this.phrases = [];
        this.settings = {};
        this.usedPhrases = new Set(); // Track used phrases to avoid repetition
        this.phrasesFile = path.join(__dirname, 'encouragement_phrases.json');
        this.loadPhrases();
        this.lastGiftTime = 0; // Track when last gift was received
        this.giftCooldown = 30000; // 30 seconds cooldown for gift phrases
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

    // Record when a gift is received
    recordGift() {
        this.lastGiftTime = Date.now();
        console.log('🎁 Gift received - gift phrases will be prioritized for next 30 seconds');
    }

    // Create dynamic gift phrase with multiple users and gifts
    createDynamicGiftPhrase(giftData) {
        const { users, gifts, totalGifts } = giftData;
        
        // Case 1: Single user, single gift
        if (users.length === 1 && gifts.length === 1) {
            const templates = [
                // Style 1: Direct and grateful
                `Thank you for the ${gifts[0]} ${users[0]}, glad you enjoy the stream!`,
                `Thanks ${users[0]} for the ${gifts[0]}, really appreciate it!`,
                `Awesome ${gifts[0]} ${users[0]}, thanks for the support!`,
                
                // Style 2: Enthusiastic and personal
                `Love the ${gifts[0]} ${users[0]}, you're the best!`,
                `Thanks ${users[0]} for the ${gifts[0]}, you rock!`,
                `Amazing ${gifts[0]} from ${users[0]}, thank you so much!`,
                
                // Style 3: Casual and fun
                `The ${gifts[0]} from ${users[0]} just made my day!`,
                `Thanks ${users[0]} for the ${gifts[0]}, you're keeping this fun!`,
                `That ${gifts[0]} from ${users[0]} is everything, thank you!`
            ];
            return {
                id: `dynamic_${Date.now()}`,
                text: templates[Math.floor(Math.random() * templates.length)],
                category: 'gifts',
                isDynamic: true
            };
        }
        
        // Case 2: Single user, multiple gifts
        if (users.length === 1 && gifts.length > 1) {
            const templates = [
                // Style 1: Direct and grateful
                `Thank you for the gifts ${users[0]}, you're amazing!`,
                `Thanks ${users[0]} for all the gifts, really appreciate it!`,
                `Awesome gifts ${users[0]}, thanks for the support!`,
                
                // Style 2: Enthusiastic and personal
                `Love all the gifts ${users[0]}, you're the best!`,
                `Thanks ${users[0]} for the gifts, you rock!`,
                `Amazing gifts from ${users[0]}, thank you so much!`,
                
                // Style 3: Casual and fun
                `All these gifts from ${users[0]} just made my day!`,
                `Thanks ${users[0]} for the gifts, you're keeping this fun!`,
                `You're spoiling me ${users[0]} with all these gifts, thank you!`
            ];
            return {
                id: `dynamic_${Date.now()}`,
                text: templates[Math.floor(Math.random() * templates.length)],
                category: 'gifts',
                isDynamic: true
            };
        }
        
        // Case 3: Multiple users
        if (users.length > 1) {
            const userList = users.join(', ');
            const templates = [
                // Style 1: Direct and grateful
                `Thank you ${userList} for the gifts, keep them coming!`,
                `Thanks ${userList} for all the gifts, you're all amazing!`,
                `Awesome gifts from ${userList}, thanks everyone!`,
                
                // Style 2: Enthusiastic and personal
                `Love the gifts from ${userList}, you're all the best!`,
                `Thanks ${userList} for the gifts, you all rock!`,
                `Amazing gifts from ${userList}, thank you all so much!`,
                
                // Style 3: Casual and fun
                `All these gifts from ${userList} just made my day!`,
                `Thanks ${userList} for the gifts, you're all keeping this fun!`,
                `You guys ${userList} are absolutely incredible with these gifts!`
            ];
            return {
                id: `dynamic_${Date.now()}`,
                text: templates[Math.floor(Math.random() * templates.length)],
                category: 'gifts',
                isDynamic: true
            };
        }
        
        // Fallback
        return {
            id: `dynamic_${Date.now()}`,
            text: `Thank you everyone for the gifts!`,
            category: 'gifts',
            isDynamic: true
        };
    }

    // Check if we should prioritize gift phrases
    shouldUseGiftPhrases() {
        return (Date.now() - this.lastGiftTime) < this.giftCooldown;
    }

    // Check if enough players are above level 2 for excitement phrases
    shouldUseExcitementPhrases(players) {
        if (!players || players.size === 0) return false;
        
        let highLevelPlayers = 0;
        for (const [username, data] of players.entries()) {
            if (data.currentLevel > 2) {
                highLevelPlayers++;
            }
        }
        
        return highLevelPlayers >= 3;
    }

    // Get a smart phrase based on game conditions
    getSmartPhrase(players = null, lastGiftData = null) {
        if (this.phrases.length === 0) {
            return null;
        }

        // If we've used most phrases, reset the used set
        if (this.usedPhrases.size >= this.phrases.length * 0.8) {
            console.log('🔄 Resetting used phrases (most phrases have been used)');
            this.usedPhrases.clear();
        }

        // Priority 1: Dynamic gift phrases if gift was recently received
        if (this.shouldUseGiftPhrases() && lastGiftData) {
            const dynamicPhrase = this.createDynamicGiftPhrase(lastGiftData);
            console.log('🎁 Created dynamic gift phrase:', dynamicPhrase.text);
            return dynamicPhrase;
        }

        // Priority 2: Static gift phrases if gift was recently received
        if (this.shouldUseGiftPhrases()) {
            const giftPhrases = this.phrases.filter(phrase => 
                phrase.category === 'gifts' && !this.usedPhrases.has(phrase.id)
            );
            
            if (giftPhrases.length > 0) {
                const randomIndex = Math.floor(Math.random() * giftPhrases.length);
                const selectedPhrase = giftPhrases[randomIndex];
                this.usedPhrases.add(selectedPhrase.id);
                console.log('🎁 Selected static gift phrase:', selectedPhrase.text.substring(0, 50) + '...');
                return selectedPhrase;
            }
        }

        // Priority 2: Excitement phrases if 3+ players above level 2
        if (this.shouldUseExcitementPhrases(players)) {
            const excitementPhrases = this.phrases.filter(phrase => 
                phrase.category === 'excitement' && !this.usedPhrases.has(phrase.id)
            );
            
            if (excitementPhrases.length > 0) {
                const randomIndex = Math.floor(Math.random() * excitementPhrases.length);
                const selectedPhrase = excitementPhrases[randomIndex];
                this.usedPhrases.add(selectedPhrase.id);
                console.log('🎉 Selected excitement phrase (3+ high level players):', selectedPhrase.text.substring(0, 50) + '...');
                return selectedPhrase;
            }
        }

        // Priority 3: Other categories (gratitude, community, encouragement, sharing, rules)
        const otherCategories = ['gratitude', 'community', 'encouragement', 'sharing', 'rules'];
        const otherPhrases = this.phrases.filter(phrase => 
            otherCategories.includes(phrase.category) && !this.usedPhrases.has(phrase.id)
        );
        
        if (otherPhrases.length > 0) {
            const randomIndex = Math.floor(Math.random() * otherPhrases.length);
            const selectedPhrase = otherPhrases[randomIndex];
            this.usedPhrases.add(selectedPhrase.id);
            console.log('💬 Selected general phrase:', selectedPhrase.text.substring(0, 50) + '...');
            return selectedPhrase;
        }

        // Fallback: if all phrases in priority categories are used, reset and try again
        this.usedPhrases.clear();
        return this.getSmartPhrase(players);
    }

    // Get a random phrase that hasn't been used recently (legacy method)
    getRandomPhrase() {
        return this.getSmartPhrase();
    }

    // Get a phrase by category
    getPhraseByCategory(category) {
        const categoryPhrases = this.phrases.filter(phrase => 
            phrase.category === category && !this.usedPhrases.has(phrase.id)
        );
        
        if (categoryPhrases.length === 0) {
            return this.getSmartPhrase();
        }
        
        const randomIndex = Math.floor(Math.random() * categoryPhrases.length);
        const selectedPhrase = categoryPhrases[randomIndex];
        this.usedPhrases.add(selectedPhrase.id);
        return selectedPhrase;
    }

    // Get multiple phrases for a session
    getSessionPhrases(count = null) {
        const maxCount = count || this.settings.maxPhrasesPerSession || 2;
        const phrases = [];
        
        for (let i = 0; i < maxCount; i++) {
            const phrase = this.getSmartPhrase();
            if (phrase) {
                phrases.push(phrase);
            }
        }
        
        return phrases;
    }

    // Reset used phrases (useful for new sessions)
    resetSession() {
        this.usedPhrases.clear();
        this.lastGiftTime = 0; // Reset gift tracking
        console.log('🔄 Encouragement session reset');
    }

    // Get statistics
    getStats() {
        return {
            totalPhrases: this.phrases.length,
            usedPhrases: this.usedPhrases.size,
            availablePhrases: this.phrases.length - this.usedPhrases.size,
            categories: [...new Set(this.phrases.map(p => p.category))],
            lastGiftTime: this.lastGiftTime,
            giftCooldownActive: this.shouldUseGiftPhrases()
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