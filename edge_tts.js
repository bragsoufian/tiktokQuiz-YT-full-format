const puppeteer = require('puppeteer');
const path = require('path');

class EdgeTTS {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: false,
                executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                userDataDir: path.join(process.cwd(), 'puppeteer_profile'),
                args: [
                    '--autoplay-policy=no-user-gesture-required',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });

            this.page = await this.browser.newPage();
            await this.page.goto('about:blank');
            
            // Attendre que les voix soient chargées
            await this.page.evaluate(() => {
                return new Promise((resolve) => {
                    if (speechSynthesis.getVoices().length > 0) {
                        resolve();
                    } else {
                        speechSynthesis.onvoiceschanged = resolve;
                    }
                });
            });

            // Afficher la liste des voix dans la console Node
            const voices = await this.page.evaluate(() => {
                return speechSynthesis.getVoices().map(v => ({ name: v.name, lang: v.lang }));
            });
            console.log('--- Voix disponibles dans Edge (via Puppeteer) ---');
            voices.forEach(v => console.log(v.name, v.lang));
            console.log('--------------------------------------------------');

            this.isInitialized = true;
            console.log('✅ Edge TTS initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            throw error;
        }
    }

    async speak(text, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const {
            voice = 'auto', // 'auto', 'aria', 'denise', 'guy', 'david'
            rate = 1.0,     // 0.1 à 10
            pitch = 1.0,    // 0 à 2
            volume = 1.0,   // 0 à 1
            waitTime = 3000 // temps d'attente en ms
        } = options;

        try {
            await this.page.evaluate(({ text, voice, rate, pitch, volume }) => {
                return new Promise((resolve, reject) => {
                    const utterance = new SpeechSynthesisUtterance(text);
                    const voices = speechSynthesis.getVoices();

                    // Sélection intelligente de la voix
                    let selectedVoice = null;
                    selectedVoice = voices.find(v => v.name === 'Microsoft Zira - English (United States)') || voices[0];

                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                        console.log(`🎤 Utilisation de la voix: ${selectedVoice.name}`);
                    }

                    // Configuration de la parole
                    utterance.rate = rate;
                    utterance.pitch = pitch;
                    utterance.volume = volume;

                    // Gestion des événements
                    utterance.onstart = () => console.log('🔊 Début de la synthèse vocale');
                    utterance.onend = () => {
                        console.log('✅ Synthèse vocale terminée');
                        resolve();
                    };
                    utterance.onerror = (error) => {
                        console.error('❌ Erreur de synthèse vocale:', error);
                        reject(error);
                    };

                    // Arrêter toute synthèse en cours
                    speechSynthesis.cancel();
                    
                    // Démarrer la nouvelle synthèse
                    speechSynthesis.speak(utterance);
                });
            }, { text, voice, rate, pitch, volume });

            // Attendre que la synthèse soit terminée
            await new Promise(resolve => setTimeout(resolve, waitTime));

        } catch (error) {
            console.error('❌ Erreur lors de la synthèse vocale:', error);
            throw error;
        }
    }

    async speakQuestion(question, questionNumber = 1) {
        const questionText = `Question ${questionNumber}: ${question}`;
        console.log(`📝 Génération de la question ${questionNumber}: ${question}`);
        
        await this.speak(questionText, {
            voice: 'aria',
            rate: 0.9,  // Un peu plus lent pour les questions
            pitch: 1.0,
            volume: 1.0,
            waitTime: 5000
        });
    }

    async speakAnswer(answer, questionNumber = 1) {
        const answerText = `La réponse est: ${answer}`;
        console.log(`💡 Génération de la réponse ${questionNumber}: ${answer}`);
        
        await this.speak(answerText, {
            voice: 'guy',
            rate: 1.0,
            pitch: 1.1,  // Pitch légèrement plus élevé pour les réponses
            volume: 1.0,
            waitTime: 4000
        });
    }

    async speakWelcome() {
        const welcomeText = "Bienvenue dans le quiz TikTok. Préparez-vous à répondre aux questions !";
        console.log('🎉 Message de bienvenue');
        
        await this.speak(welcomeText, {
            voice: 'aria',
            rate: 0.85,
            pitch: 1.0,
            volume: 1.0,
            waitTime: 6000
        });
    }

    async speakCorrect() {
        const correctText = "Correct ! Excellente réponse !";
        console.log('✅ Réponse correcte');
        
        await this.speak(correctText, {
            voice: 'denise',
            rate: 1.1,
            pitch: 1.2,
            volume: 1.0,
            waitTime: 3000
        });
    }

    async speakIncorrect() {
        const incorrectText = "Incorrect. Essayez encore !";
        console.log('❌ Réponse incorrecte');
        
        await this.speak(incorrectText, {
            voice: 'guy',
            rate: 0.9,
            pitch: 0.9,
            volume: 1.0,
            waitTime: 3000
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.isInitialized = false;
            console.log('🔒 Navigateur fermé');
        }
    }
}

// Exemple d'utilisation
async function demo() {
    const tts = new EdgeTTS();
    
    try {
        await tts.speakWelcome();
        await tts.speakQuestion("Quelle est la capitale de la France ?", 1);
        await tts.speakAnswer("Paris", 1);
        await tts.speakCorrect();
        await tts.speakIncorrect();
    } catch (error) {
        console.error('Erreur dans la démo:', error);
    } finally {
        await tts.close();
    }
}

module.exports = { EdgeTTS };

// Lancer la démo si le fichier est exécuté directement
if (require.main === module) {
    demo();
} 