// Simple Winner Test - Azure TTS Only
// Quick test for winner announcements without Edge TTS

const AzureTTS = require('./azure_tts');

class SimpleWinnerTester {
    constructor() {
        this.azureTTS = null;
    }

    async initialize() {
        try {
            this.azureTTS = new AzureTTS();
            console.log('✅ Azure TTS initialized');
            return true;
        } catch (error) {
            console.error('❌ Error initializing Azure TTS:', error);
            return false;
        }
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
        const followText = `Don't forget to follow ${winner.username} for more amazing content! They're absolutely crushing it!`;
        return [followText];
    }

    // Generate general thanks (cachable - always the same)
    generateGeneralThanks() {
        const thanksText = `Thanks to everyone who played! You're all winners for participating! Stay tuned for the next quiz!`;
        return [thanksText];
    }

    // Test winner announcement
    async testWinnerAnnouncement(winner, secondPlace, thirdPlace) {
        if (!this.azureTTS) {
            console.error('❌ Azure TTS not initialized');
            return false;
        }

        try {
            console.log('🎤 Testing Winner Announcement with Azure TTS...');
            
            // Audio 1: Winner announcement (dynamic)
            const winnerAnnouncement = this.generateWinnerAnnouncement(winner, secondPlace, thirdPlace)[0];
            console.log(`\n📢 Audio 1 - Winner Announcement: "${winnerAnnouncement}"`);
            await this.azureTTS.speakText(winnerAnnouncement);
            console.log('✅ Winner announcement completed');
            
            // Wait a bit between audios
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Audio 2: Follow encouragement (cachable)
            const followEncouragement = this.generateFollowEncouragement(winner)[0];
            console.log(`\n📢 Audio 2 - Follow Encouragement: "${followEncouragement}"`);
            await this.azureTTS.speakText(followEncouragement);
            console.log('✅ Follow encouragement completed');
            
            // Wait a bit between audios
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Audio 3: General thanks (cachable)
            const generalThanks = this.generateGeneralThanks()[0];
            console.log(`\n📢 Audio 3 - General Thanks: "${generalThanks}"`);
            await this.azureTTS.speakText(generalThanks);
            console.log('✅ General thanks completed');
            
            console.log('\n✅ All winner announcements completed successfully!');
            return true;
        } catch (error) {
            console.error('❌ Error during winner announcement:', error);
            return false;
        }
    }

    // Cleanup
    cleanup() {
        if (this.azureTTS) {
            this.azureTTS.cleanup();
        }
        console.log('🔒 Cleanup completed');
    }
}

// Test function
async function runTest() {
    console.log('🧪 Simple Winner Announcement Test\n');

    const tester = new SimpleWinnerTester();
    
    try {
        // Initialize
        const initialized = await tester.initialize();
        if (!initialized) {
            console.error('❌ Failed to initialize TTS');
            return;
        }

        // Test data
        const winner = { username: "TikTokQueen", points: 25 };
        const secondPlace = { username: "QuizMaster", points: 18 };
        const thirdPlace = { username: "Brainiac", points: 12 };

        console.log('📊 Test Results:');
        console.log(`🏆 Winner: ${winner.username} (${winner.points} points)`);
        console.log(`🥈 Second: ${secondPlace.username} (${secondPlace.points} points)`);
        console.log(`🥉 Third: ${thirdPlace.username} (${thirdPlace.points} points)\n`);

        // Run the test
        const success = await tester.testWinnerAnnouncement(winner, secondPlace, thirdPlace);

        if (success) {
            console.log('\n🎉 Test completed successfully!');
        } else {
            console.log('\n❌ Test failed!');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup
        tester.cleanup();
    }
}

// Run the test
runTest(); 