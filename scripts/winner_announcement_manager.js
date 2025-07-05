// Winner Announcement Manager
// Handles TTS announcements for winners, second, and third place

const { GAME_MESSAGES, formatMessage } = require('./messages_config');

class WinnerAnnouncementManager {
    constructor() {
        this.azureTTS = null;
        this.edgeTTS = null;
        this.isInitialized = false;
    }

    async initialize(azureTTS, edgeTTS = null) {
        this.azureTTS = azureTTS;
        this.edgeTTS = edgeTTS;
        this.isInitialized = true;
        console.log('✅ Winner Announcement Manager initialized');
    }

    // Generate winner announcement text (dynamic - different players each time)
    generateWinnerAnnouncement(winner, secondPlace, thirdPlace) {
        let winnerAnnouncement = "";

        // Main winner announcement
        winnerAnnouncement += `Congratulations! ${winner.username} is our champion with ${winner.points} points! `;

        // Second place announcement
        if (secondPlace) {
            winnerAnnouncement += `In second place, we have ${secondPlace.username} with ${secondPlace.points} points. `;
        }

        // Third place announcement
        if (thirdPlace) {
            winnerAnnouncement += `And in third place, ${thirdPlace.username} with ${thirdPlace.points} points. `;
        }

        return [winnerAnnouncement];
    }

    // Generate follow encouragement (cachable - same format, just different winner name)
    generateFollowEncouragement(winner) {
        const followText = formatMessage(GAME_MESSAGES.winner.followExtended, { winner: winner.username });
        return [followText];
    }

    // Generate general thanks (cachable - always the same)
    generateGeneralThanks() {
        const thanksText = GAME_MESSAGES.winner.thanks;
        return [thanksText];
    }

    // Announce winner with Azure TTS
    async announceWinnerAzureTTS(winner, secondPlace, thirdPlace) {
        if (!this.azureTTS) {
            console.error('❌ Azure TTS not available for winner announcement');
            return false;
        }

        try {
            console.log('🎤 Starting winner announcement with Azure TTS...');
            
            // Audio 1: Winner announcement (dynamic)
            const winnerAnnouncement = this.generateWinnerAnnouncement(winner, secondPlace, thirdPlace)[0];
            console.log(`📢 Audio 1 - Winner Announcement: "${winnerAnnouncement}"`);
            await this.azureTTS.speakText(winnerAnnouncement);
            console.log('✅ Winner announcement completed');
            
            // Wait a bit between audios
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Audio 2: Follow encouragement (cachable)
            const followEncouragement = this.generateFollowEncouragement(winner)[0];
            console.log(`📢 Audio 2 - Follow Encouragement: "${followEncouragement}"`);
            await this.azureTTS.speakText(followEncouragement);
            console.log('✅ Follow encouragement completed');
            
            // Wait a bit between audios
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Audio 3: General thanks (cachable)
            const generalThanks = this.generateGeneralThanks()[0];
            console.log(`📢 Audio 3 - General Thanks: "${generalThanks}"`);
            await this.azureTTS.speakText(generalThanks);
            console.log('✅ General thanks completed');
            
            console.log('✅ All winner announcements completed with Azure TTS');
            return true;
        } catch (error) {
            console.error('❌ Error during Azure TTS winner announcement:', error);
            return false;
        }
    }

    // Announce winner with Edge TTS
    async announceWinnerEdgeTTS(winner, secondPlace, thirdPlace) {
        if (!this.edgeTTS) {
            console.error('❌ Edge TTS not available for winner announcement');
            return false;
        }

        try {
            console.log('🎤 Starting winner announcement with Edge TTS...');
            
            // Audio 1: Winner announcement (dynamic)
            const winnerAnnouncement = this.generateWinnerAnnouncement(winner, secondPlace, thirdPlace)[0];
            console.log(`📢 Audio 1 - Winner Announcement: "${winnerAnnouncement}"`);
            await this.edgeTTS.speak(winnerAnnouncement, {
                voice: 'aria',
                rate: 0.9,
                pitch: 1.0,
                volume: 0.8,
                waitTime: 3000
            });
            console.log('✅ Winner announcement completed');
            
            // Wait a bit between audios
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Audio 2: Follow encouragement (cachable)
            const followEncouragement = this.generateFollowEncouragement(winner)[0];
            console.log(`📢 Audio 2 - Follow Encouragement: "${followEncouragement}"`);
            await this.edgeTTS.speak(followEncouragement, {
                voice: 'aria',
                rate: 0.9,
                pitch: 1.0,
                volume: 0.8,
                waitTime: 3000
            });
            console.log('✅ Follow encouragement completed');
            
            // Wait a bit between audios
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Audio 3: General thanks (cachable)
            const generalThanks = this.generateGeneralThanks()[0];
            console.log(`📢 Audio 3 - General Thanks: "${generalThanks}"`);
            await this.edgeTTS.speak(generalThanks, {
                voice: 'aria',
                rate: 0.9,
                pitch: 1.0,
                volume: 0.8,
                waitTime: 3000
            });
            console.log('✅ General thanks completed');
            
            console.log('✅ All winner announcements completed with Edge TTS');
            return true;
        } catch (error) {
            console.error('❌ Error during Edge TTS winner announcement:', error);
            return false;
        }
    }

    // Main announcement function (tries Azure first, falls back to Edge)
    async announceWinner(winner, secondPlace, thirdPlace) {
        if (!this.isInitialized) {
            console.error('❌ Winner Announcement Manager not initialized');
            return false;
        }

        console.log('🏆 Starting winner announcement...');
        console.log(`🏆 Winner: ${winner.username} (${winner.points} points)`);
        if (secondPlace) console.log(`🥈 Second: ${secondPlace.username} (${secondPlace.points} points)`);
        if (thirdPlace) console.log(`🥉 Third: ${thirdPlace.username} (${thirdPlace.points} points)`);

        // Try Azure TTS first
        if (this.azureTTS) {
            const success = await this.announceWinnerAzureTTS(winner, secondPlace, thirdPlace);
            if (success) return true;
        }

        // Fallback to Edge TTS
        if (this.edgeTTS) {
            const success = await this.announceWinnerEdgeTTS(winner, secondPlace, thirdPlace);
            if (success) return true;
        }

        console.error('❌ No TTS system available for winner announcement');
        return false;
    }

    // Generate different announcement styles
    generateDramaticAnnouncement(winner, secondPlace, thirdPlace) {
        let fullAnnouncement = "";

        // Dramatic winner announcement
        fullAnnouncement += `Ladies and gentlemen! The moment you've all been waiting for! ${winner.username} has emerged victorious with an incredible ${winner.points} points! This is absolutely mind-blowing! `;

        // Dramatic second place
        if (secondPlace) {
            fullAnnouncement += `What an incredible performance! ${secondPlace.username} takes second place with ${secondPlace.points} points! Simply outstanding! `;
        }

        // Dramatic third place
        if (thirdPlace) {
            fullAnnouncement += `And rounding out our podium, ${thirdPlace.username} with ${thirdPlace.points} points! What a fantastic achievement! `;
        }

        // Dramatic follow encouragement
        fullAnnouncement += `${winner.username} is absolutely on fire! Make sure to follow them for more incredible content! This is the kind of talent that makes TikTok amazing!`;

        return [fullAnnouncement];
    }

    // Generate short announcement for quick games
    generateShortAnnouncement(winner, secondPlace, thirdPlace) {
        let fullAnnouncement = "";

        // Short winner announcement
        fullAnnouncement += `${winner.username} wins with ${winner.points} points! `;

        // Short second and third
        if (secondPlace && thirdPlace) {
            fullAnnouncement += `${secondPlace.username} in second with ${secondPlace.points} points, and ${thirdPlace.username} in third with ${thirdPlace.points} points. `;
        }

        // Short follow encouragement
        fullAnnouncement += `Follow ${winner.username}!`;

        return [fullAnnouncement];
    }

    // Test function
    async testAnnouncement() {
        const testWinner = { username: "TestWinner", points: 25 };
        const testSecond = { username: "TestSecond", points: 18 };
        const testThird = { username: "TestThird", points: 12 };

        console.log('🧪 Testing winner announcement...');
        return await this.announceWinner(testWinner, testSecond, testThird);
    }

    // Reset for new match
    resetSession() {
        console.log('🔄 Winner Announcement Manager session reset');
    }
}

module.exports = WinnerAnnouncementManager; 