const sdk = require("microsoft-cognitiveservices-speech-sdk");
const player = require('play-sound')();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');

class AzureTTS {
    constructor() {
        // Azure Speech Service credentials
        this.subscriptionKey = "EAGD0VPvkiWuxEq2SqTsdQIhYkvXExvaQ6iJv2emwqiwWXMud80hJQQJ99BFACYeBjFXJ3w3AAAYACOGv5rJ";
        this.region = "eastus";
        this.speechConfig = null;
        this.tempFiles = []; // Track temporary files for cleanup
        this.audioDir = path.join(__dirname, '../tts_audio');
        this.cacheDir = path.join(this.audioDir, 'cache');
        
        this.initialize();
    }

    initialize() {
        try {
            this.speechConfig = sdk.SpeechConfig.fromSubscription(this.subscriptionKey, this.region);
            this.speechConfig.speechSynthesisVoiceName = "en-US-GuyNeural"; // English male voice
            this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
            
            // Create both directories if they don't exist
            if (!fs.existsSync(this.audioDir)) {
                fs.mkdirSync(this.audioDir, { recursive: true });
                console.log('📁 Audio directory created:', this.audioDir);
            }
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
                console.log('📁 Cache directory created:', this.cacheDir);
            }
            
            console.log('✅ Azure TTS initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Azure TTS:', error);
        }
    }

    // Generate hash from text for consistent filename
    generateHash(text) {
        return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
    }

    // Get cached file path for a question
    getCachedFilePath(text) {
        const hash = this.generateHash(text);
        return path.join(this.cacheDir, `${hash}.wav`);
    }

    // Check if audio is already cached and valid
    isCached(text) {
        const filePath = this.getCachedFilePath(text);
        if (!fs.existsSync(filePath)) return false;
        try {
            const stats = fs.statSync(filePath);
            // Consider files <2KB as corrupt
            if (stats.size < 2048) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Generate unique filename for non-cached content
    generateUniqueFilename() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return path.join(this.audioDir, `tts_output_${timestamp}_${random}.wav`);
    }

    async speakText(text) {
        if (!this.speechConfig) {
            console.error('❌ Azure TTS not initialized');
            return false;
        }

        const cachedPath = this.getCachedFilePath(text);
        let isFromCache = false;

        // Check if we have a cached version and it's valid
        if (this.isCached(text)) {
            console.log('💾 Using cached audio file for:', text.substring(0, 50) + '...');
            isFromCache = true;
        } else {
            console.log('🆕 Generating new audio file for:', text.substring(0, 50) + '...');
        }

        return new Promise((resolve, reject) => {
            try {
                if (isFromCache) {
                    // Use cached file directly, but check size again before playing
                    const stats = fs.statSync(cachedPath);
                    if (stats.size < 2048) {
                        console.warn('⚠️ Cached file is too small/corrupt, regenerating...');
                        fs.unlinkSync(cachedPath);
                        // Regenerate by calling this method again
                        this.speakText(text).then(resolve).catch(reject);
                        return;
                    }
                    this.playAudio(cachedPath)
                        .then(() => resolve(true))
                        .catch(err => {
                            console.error('❌ Error playing cached audio:', err);
                            resolve(false);
                        });
                } else {
                    // Generate new audio file directly to cache location
                    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(cachedPath);
                    const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);

                    synthesizer.speakTextAsync(text, result => {
                        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                            console.log('✅ TTS audio generated and cached successfully');
                            // Play the cached audio
                            this.playAudio(cachedPath)
                                .then(() => resolve(true))
                                .catch(err => {
                                    console.error('❌ Error playing audio:', err);
                                    // Clean up the failed cache file
                                    this.cleanupFile(cachedPath);
                                    resolve(false);
                                });
                        } else {
                            console.error('❌ TTS failed:', result.errorDetails);
                            // Clean up the failed cache file
                            this.cleanupFile(cachedPath);
                            reject(new Error(result.errorDetails));
                        }
                        synthesizer.close();
                    }, error => {
                        console.error('❌ TTS error:', error);
                        // Clean up the failed cache file
                        this.cleanupFile(cachedPath);
                        reject(error);
                    });
                }

            } catch (error) {
                console.error('❌ Error in speakText:', error);
                if (!isFromCache) {
                    this.cleanupFile(cachedPath);
                }
                reject(error);
            }
        });
    }

    async playAudio(audioPath) {
        return new Promise(async (resolve, reject) => {
            if (!fs.existsSync(audioPath)) {
                reject(new Error('Audio file not found'));
                return;
            }

            // Get the duration of the audio file
            let durationSec = 0;
            try {
                const metadata = await mm.parseFile(audioPath);
                durationSec = metadata.format.duration;
                if (!durationSec || isNaN(durationSec)) durationSec = 0;
            } catch (e) {
                console.warn('⚠️ Could not read audio duration, fallback to 2s:', e.message);
                durationSec = 2;
            }

            // Play the audio
            const child = player.play(audioPath, (err) => {
                if (err) {
                    console.error('❌ Error playing audio:', err);
                    reject(err);
                } else {
                    console.log('✅ Audio playback started');
                    // Do not resolve here!
                }
            });

            // Wait for the duration of the audio, then resolve
            setTimeout(() => {
                console.log(`⏳ Waited ${durationSec}s for audio playback to finish.`);
                resolve();
            }, Math.max(500, durationSec * 1000));
        });
    }

    // Method specifically for quiz questions
    async speakQuestion(questionText, questionNumber = 1) {
        const formattedText = `Question ${questionNumber}: ${questionText}`;
        return this.speakText(formattedText);
    }

    // Clean up a specific file
    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🗑️ Audio file cleaned up:', path.basename(filePath));
            }
        } catch (error) {
            // File might still be in use, that's okay
            console.log('⚠️ Could not clean up file (still in use):', path.basename(filePath));
        }
    }

    // Clean up all temporary files (but keep cache)
    cleanup() {
        console.log('🧹 No temporary files to clean up (using direct cache generation)');
        // Since we generate directly to cache, there are no temp files to clean
    }

    // Get cache statistics
    getCacheStats() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            const wavFiles = files.filter(file => file.endsWith('.wav'));
            const totalSize = wavFiles.reduce((size, file) => {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);
                return size + stats.size;
            }, 0);
            
            return {
                fileCount: wavFiles.length,
                totalSize: totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
            };
        } catch (error) {
            return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' };
        }
    }

    // Clear cache
    clearCache() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            files.forEach(file => {
                if (file.endsWith('.wav')) {
                    fs.unlinkSync(path.join(this.cacheDir, file));
                }
            });
            console.log('🗑️ Cache cleared');
        } catch (error) {
            console.error('❌ Error clearing cache:', error);
        }
    }
}

module.exports = AzureTTS; 