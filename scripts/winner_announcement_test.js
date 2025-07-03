// Winner Announcement Test File
// This script tests TTS announcements for winners, second, and third place

const AzureTTS = require('./azure_tts');
const { EdgeTTS } = require('../edge_tts');

class WinnerAnnouncementTester {
    constructor() {
        this.azureTTS = null;
        this.edgeTTS = null;
        this.testPlayers = [
            {
                username: "TikTokQueen",
                points: 25,
                profilePic: "https://example.com/queen.jpg"
            },
            {
                username: "QuizMaster",
                points: 18,
                profilePic: "https://example.com/master.jpg"
            },
            {
                username: "Brainiac",
                points: 12,
                profilePic: "https://example.com/brain.jpg"
            },
            {
                username: "SpeedDemon",
                points: 8,
                profilePic: "https://example.com/speed.jpg"
            },
            {
                username: "LuckyCharm",
                points: 5,
                profilePic: "https://example.com/lucky.jpg"
            }
        ];
    }

    async initialize() {
        try {
            // Initialize Azure TTS
            this.azureTTS = new AzureTTS();
            console.log('✅ Azure TTS initialized');

            // Initialize Edge TTS
            this.edgeTTS = new EdgeTTS();
            await this.edgeTTS.initialize();
            console.log('✅ Edge TTS initialized');

            return true;
        } catch (error) {
            console.error('❌ Error initializing TTS systems:', error);
            return false;
        }
    }

    // Generate winner announcement text
    generateWinnerAnnouncement(winner, secondPlace, thirdPlace) {
        let fullAnnouncement = "";

        // Main winner announcement
        fullAnnouncement += `Congratulations! ${winner.username} is our champion with ${winner.points} points! `;

        // Second place announcement
        if (secondPlace) {
            fullAnnouncement += `In second place, we have ${secondPlace.username} with ${secondPlace.points} points. `;
        }

        // Third place announcement
        if (thirdPlace) {
            fullAnnouncement += `And in third place, ${thirdPlace.username} with ${thirdPlace.points} points. `;
        }

        // Follow encouragement
        fullAnnouncement += `Don't forget to follow ${winner.username} for more amazing content! They're absolutely crushing it! `;

        // General encouragement
        fullAnnouncement += `Thanks to everyone who played! You're all winners for participating! Stay tuned for the next quiz!`;

        return [fullAnnouncement];
    }

    // Test with Azure TTS
    async testAzureTTS(winner, secondPlace, thirdPlace) {
        console.log('\n🎤 Testing Azure TTS Winner Announcements...');
        
        const announcements = this.generateWinnerAnnouncement(winner, secondPlace, thirdPlace);
        
        for (let i = 0; i < announcements.length; i++) {
            const announcement = announcements[i];
            console.log(`\n📢 Azure TTS Announcement ${i + 1}: "${announcement}"`);
            
            try {
                await this.azureTTS.speakText(announcement);
                console.log(`✅ Azure TTS announcement ${i + 1} completed`);
                
                // Wait a bit between announcements
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ Azure TTS announcement ${i + 1} failed:`, error);
            }
        }
    }

    // Test with Edge TTS
    async testEdgeTTS(winner, secondPlace, thirdPlace) {
        console.log('\n🎤 Testing Edge TTS Winner Announcements...');
        
        const announcements = this.generateWinnerAnnouncement(winner, secondPlace, thirdPlace);
        
        for (let i = 0; i < announcements.length; i++) {
            const announcement = announcements[i];
            console.log(`\n📢 Edge TTS Announcement ${i + 1}: "${announcement}"`);
            
            try {
                await this.edgeTTS.speak(announcement, {
                    voice: 'aria',
                    rate: 0.9,
                    pitch: 1.0,
                    volume: 0.8,
                    waitTime: 3000
                });
                console.log(`✅ Edge TTS announcement ${i + 1} completed`);
                
                // Wait a bit between announcements
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ Edge TTS announcement ${i + 1} failed:`, error);
            }
        }
    }

    // Test different winner scenarios
    async testDifferentScenarios() {
        console.log('\n🎯 Testing Different Winner Scenarios...\n');

        // Scenario 1: Clear winner with good competition
        console.log('📊 Scenario 1: Clear Winner');
        const scenario1 = {
            winner: this.testPlayers[0],
            second: this.testPlayers[1],
            third: this.testPlayers[2]
        };
        
        console.log(`🏆 Winner: ${scenario1.winner.username} (${scenario1.winner.points} points)`);
        console.log(`🥈 Second: ${scenario1.second.username} (${scenario1.second.points} points)`);
        console.log(`🥉 Third: ${scenario1.third.username} (${scenario1.third.points} points)`);
        
        await this.testAzureTTS(scenario1.winner, scenario1.second, scenario1.third);
        await this.testEdgeTTS(scenario1.winner, scenario1.second, scenario1.third);

        // Scenario 2: Close competition
        console.log('\n📊 Scenario 2: Close Competition');
        const closePlayers = [
            { username: "SpeedDemon", points: 20 },
            { username: "Brainiac", points: 19 },
            { username: "LuckyCharm", points: 18 }
        ];
        
        console.log(`🏆 Winner: ${closePlayers[0].username} (${closePlayers[0].points} points)`);
        console.log(`🥈 Second: ${closePlayers[1].username} (${closePlayers[1].points} points)`);
        console.log(`🥉 Third: ${closePlayers[2].username} (${closePlayers[2].points} points)`);
        
        await this.testAzureTTS(closePlayers[0], closePlayers[1], closePlayers[2]);
        await this.testEdgeTTS(closePlayers[0], closePlayers[1], closePlayers[2]);

        // Scenario 3: Only winner (no second/third)
        console.log('\n📊 Scenario 3: Solo Winner');
        const soloWinner = { username: "LoneWolf", points: 30 };
        
        console.log(`🏆 Winner: ${soloWinner.username} (${soloWinner.points} points)`);
        console.log(`🥈 Second: None`);
        console.log(`🥉 Third: None`);
        
        await this.testAzureTTS(soloWinner, null, null);
        await this.testEdgeTTS(soloWinner, null, null);
    }

    // Test specific announcement types
    async testSpecificAnnouncements() {
        console.log('\n🎤 Testing Specific Announcement Types...\n');

        // Test winner announcement only
        console.log('🏆 Testing Winner Announcement Only');
        const winnerOnly = `🎉 CONGRATULATIONS! TikTokQueen is our champion with 25 points! 🏆`;
        await this.azureTTS.speakText(winnerOnly);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test follow encouragement
        console.log('👥 Testing Follow Encouragement');
        const followOnly = `Don't forget to follow TikTokQueen for more amazing content! They're absolutely crushing it! 🔥`;
        await this.azureTTS.speakText(followOnly);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test dramatic announcement
        console.log('🎭 Testing Dramatic Announcement');
        const dramatic = `🎊 LADIES AND GENTLEMEN! The moment you've all been waiting for! TikTokQueen has emerged victorious with an incredible 25 points! This is absolutely mind-blowing! 🚀`;
        await this.azureTTS.speakText(dramatic);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Test with different voices and styles
    async testVoiceVariations() {
        console.log('\n🎵 Testing Voice Variations...\n');

        const testText = "Congratulations to our winner!";

        // Test different Azure voices
        console.log('🎤 Testing different voice styles...');
        
        // You can modify the Azure TTS voice in the azure_tts.js file
        // For now, we'll test with the current voice
        await this.azureTTS.speakText(testText);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test Edge TTS with different voices
        await this.edgeTTS.speak(testText, {
            voice: 'aria',
            rate: 0.8,
            pitch: 1.2,
            volume: 0.9,
            waitTime: 2000
        });
    }

    // Cleanup
    async cleanup() {
        if (this.edgeTTS) {
            await this.edgeTTS.close();
        }
        if (this.azureTTS) {
            this.azureTTS.cleanup();
        }
        console.log('🔒 TTS systems cleaned up');
    }
}

// Command line interface
if (require.main === module) {
    const tester = new WinnerAnnouncementTester();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    async function main() {
        await tester.initialize();

        switch (command) {
            case 'scenarios':
                await tester.testDifferentScenarios();
                break;

            case 'specific':
                await tester.testSpecificAnnouncements();
                break;

            case 'voices':
                await tester.testVoiceVariations();
                break;

            case 'all':
                await tester.testDifferentScenarios();
                await tester.testSpecificAnnouncements();
                await tester.testVoiceVariations();
                break;

            default:
                console.log('Winner Announcement Tester - Available commands:');
                console.log('  scenarios  - Test different winner scenarios');
                console.log('  specific   - Test specific announcement types');
                console.log('  voices     - Test voice variations');
                console.log('  all        - Run all tests');
                console.log('');
                console.log('Examples:');
                console.log('  node winner_announcement_test.js scenarios');
                console.log('  node winner_announcement_test.js all');
        }

        await tester.cleanup();
    }

    main().catch(console.error);
}

module.exports = { WinnerAnnouncementTester }; 