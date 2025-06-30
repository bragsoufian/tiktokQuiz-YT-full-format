const sdk = require("microsoft-cognitiveservices-speech-sdk");

class AzureVoiceList {
    constructor() {
        // Azure Speech Service credentials
        this.subscriptionKey = "EAGD0VPvkiWuxEq2SqTsdQIhYkvXExvaQ6iJv2emwqiwWXMud80hJQQJ99BFACYeBjFXJ3w3AAAYACOGv5rJ";
        this.region = "eastus";
        this.speechConfig = null;
        
        this.initialize();
    }

    initialize() {
        try {
            console.log('🔧 Initializing Azure TTS...');
            this.speechConfig = sdk.SpeechConfig.fromSubscription(this.subscriptionKey, this.region);
            console.log('✅ Azure TTS initialized successfully');
            console.log('📍 Region:', this.region);
            console.log('🔑 Subscription key:', this.subscriptionKey.substring(0, 10) + '...');
        } catch (error) {
            console.error('❌ Error initializing Azure TTS:', error);
        }
    }

    async getVoices() {
        if (!this.speechConfig) {
            console.error('❌ Azure TTS not initialized');
            return [];
        }

        return new Promise((resolve, reject) => {
            try {
                console.log('🎤 Creating synthesizer...');
                const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
                console.log('✅ Synthesizer created');
                
                console.log('🔍 Fetching voices...');
                synthesizer.getVoicesAsync("", result => {
                    console.log('📡 Voice result received');
                    console.log('Result reason:', result.reason);
                    
                    if (result.reason === sdk.ResultReason.VoicesListRetrieved) {
                        console.log('✅ Voices retrieved successfully');
                        console.log('Number of voices:', result.voices.length);
                        
                        const voices = result.voices;
                        
                        // Group voices by language
                        const voicesByLanguage = {};
                        
                        voices.forEach(voice => {
                            const language = voice.locale;
                            if (!voicesByLanguage[language]) {
                                voicesByLanguage[language] = [];
                            }
                            voicesByLanguage[language].push({
                                name: voice.shortName,
                                displayName: voice.displayName,
                                gender: voice.gender,
                                locale: voice.locale,
                                sampleRateHertz: voice.sampleRateHertz,
                                voiceType: voice.voiceType,
                                status: voice.status
                            });
                        });

                        // Display voices organized by language
                        console.log('\n🎤 Available Azure TTS Voices:\n');
                        console.log('=' .repeat(80));
                        
                        Object.keys(voicesByLanguage).sort().forEach(language => {
                            console.log(`\n🌍 ${language} (${voicesByLanguage[language].length} voices):`);
                            console.log('-'.repeat(60));
                            
                            voicesByLanguage[language].forEach(voice => {
                                const status = voice.status === 'GA' ? '✅' : '🔄';
                                const gender = voice.gender === 'Female' ? '👩' : '👨';
                                console.log(`${status} ${gender} ${voice.shortName} - ${voice.displayName}`);
                            });
                        });

                        console.log('\n' + '='.repeat(80));
                        console.log('\n💡 To use a voice, update the voice name in azure_tts.js:');
                        console.log('   this.speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";');
                        
                        resolve(voices);
                    } else {
                        console.error('❌ Failed to retrieve voices');
                        console.error('Error details:', result.errorDetails);
                        console.error('Error code:', result.errorCode);
                        reject(new Error(result.errorDetails || 'Unknown error'));
                    }
                    synthesizer.close();
                }, error => {
                    console.error('❌ Error getting voices:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('❌ Error in getVoices:', error);
                reject(error);
            }
        });
    }

    // Get voices for a specific language
    async getVoicesByLanguage(locale) {
        const allVoices = await this.getVoices();
        return allVoices.filter(voice => voice.locale.startsWith(locale));
    }

    // Get neural voices only
    async getNeuralVoices() {
        const allVoices = await this.getVoices();
        return allVoices.filter(voice => voice.voiceType === 'Neural');
    }
}

// Run the script
async function main() {
    const voiceList = new AzureVoiceList();
    
    try {
        console.log('🔍 Fetching Azure TTS voices...\n');
        await voiceList.getVoices();
        
        console.log('\n🎯 Popular voice recommendations:');
        console.log('• en-US-JennyNeural (English, Female, Neural)');
        console.log('• en-US-GuyNeural (English, Male, Neural)');
        console.log('• fr-FR-DeniseNeural (French, Female, Neural)');
        console.log('• fr-FR-HenriNeural (French, Male, Neural)');
        console.log('• es-ES-ElviraNeural (Spanish, Female, Neural)');
        console.log('• de-DE-KatjaNeural (German, Female, Neural)');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = AzureVoiceList; 