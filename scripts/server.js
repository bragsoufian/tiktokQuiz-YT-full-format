/**
 * 🎬 YOUTUBE QUIZ VIDEO GENERATOR
 * 
 * BUT: Générer automatiquement des vidéos de quiz pour YouTube
 * WORKFLOW: Génération -> Enregistrement -> Montage -> Upload
 * 
 * Ce serveur génère du contenu de quiz avec TTS, images de fond,
 * et effets sonores pour créer des vidéos prêtes au montage.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const AzureTTS = require('./azure_tts'); // Import Azure TTS
const WinnerAnnouncementManager = require('./winner_announcement_manager'); // Import Winner Announcement Manager
const UnsplashCacheManager = require('./unsplash_cache_manager'); // Import Enhanced Cache Manager
const UnsplashAccountManager = require('./unsplash_account_manager'); // Import Multi-Account Manager
const https = require('https');
const config = require('./config'); // Import configuration

const wsServer = new WebSocket.Server({ port: 8080 });

// Unsplash API Configuration
const UNSPLASH_API_URL = config.UNSPLASH_API_URL || 'https://api.unsplash.com/photos/random';

// Initialize the enhanced persistent cache manager
const unsplashCache = new UnsplashCacheManager();

// Initialize the multi-account manager
const unsplashAccountManager = new UnsplashAccountManager();

// Test API keys on startup
setTimeout(async () => {
    console.log('\n🔍 Testing API keys on startup...');
    await unsplashAccountManager.testApiKeys();
}, 2000);

// Helper function to generate a simple hash code for strings
String.prototype.hashCode = function() {
    let hash = 0;
    if (this.length === 0) return hash;
    for (let i = 0; i < this.length; i++) {
        const char = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
};

// Configuration du générateur de vidéos YouTube
const QUESTION_TIMER = 7000; // 7 secondes par défaut (durée de la question dans la vidéo)
const ANSWER_DISPLAY_TIME = 3000; // 3 secondes pour voir la réponse (montage)
const READY_PAUSE_TIME = 4000; // 4 secondes de pause "Ready" (transition)
const GRACE_PERIOD = 1000; // 1 seconde de grâce pour les réponses tardives

// État de la question
let questionActive = false;
let questionWaitingForActivation = false;
let currentQuestion = null;
let questionTimer = null;
let questionTransitionInProgress = false;
let currentQuestionIndex = 0;

// Question pool for random selection without repetition
let questionPool = [];
let usedQuestions = new Set();

// Azure TTS instance
let azureTTS = null;

// Winner Announcement Manager instance
let winnerAnnouncementManager = null;

// Messages configuration
const { GAME_MESSAGES, formatMessage } = require('./messages_config');

// Fonction pour les logs colorés avec timestamps
const log = {
    info: (msg) => console.log('\x1b[36m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ℹ️ ${msg}`),    // Cyan
    success: (msg) => console.log('\x1b[32m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ✅ ${msg}`),  // Vert
    warning: (msg) => console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ⚠️ ${msg}`),  // Jaune
    error: (msg) => console.log('\x1b[31m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ❌ ${msg}`),    // Rouge
    system: (msg) => console.log('\x1b[34m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 🖥️ ${msg}`),   // Bleu
    question: (msg) => console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ❓ ${msg}`),   // Jaune pour les questions
    unsplash: (msg) => console.log('\x1b[36m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 🖼️ ${msg}`)   // Cyan pour Unsplash
};

// Function to load greetings messages
function loadGreetings() {
    try {
        const greetingsPath = path.join(__dirname, 'greetings.json');
        const greetingsData = fs.readFileSync(greetingsPath, 'utf8');
        const loadedGreetings = JSON.parse(greetingsData);
        log.success(`Chargement des messages de bienvenue depuis greetings.json`);
        return loadedGreetings;
    } catch (error) {
        log.error(`Erreur lors du chargement des messages de bienvenue: ${error.message}`);
        // Messages par défaut en cas d'erreur
        return {
            welcome: {
                text: "Bonjour à tous ! Bienvenue dans notre quiz TikTok."
            },
            goodbye: {
                text: "Merci à tous d'avoir participé à notre quiz !"
            }
        };
    }
}

// Load greetings messages
let GREETINGS = loadGreetings();

// Charger les questions depuis le fichier JSON
let QUESTIONS = [];
try {
    const questionsPath = path.join(__dirname, 'questions.json');
    const questionsData = fs.readFileSync(questionsPath, 'utf8');
    QUESTIONS = JSON.parse(questionsData);
    log.success(`Chargement de ${QUESTIONS.length} questions depuis questions.json`);
} catch (error) {
    log.error(`Erreur lors du chargement des questions: ${error.message}`);
    // Questions par défaut en cas d'erreur
    QUESTIONS = [
        {
            question: "Quelle est la capitale de la France?",
            options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
            correctAnswer: "A",
            image: null
        }
    ];
}

// Shuffle functionality for random questions without repetition
let SHUFFLED_QUESTIONS = [];

// Fisher-Yates shuffle algorithm for efficient random shuffling
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Initialize questions in order for a new game
function initializeShuffledQuestions() {
    SHUFFLED_QUESTIONS = [...QUESTIONS]; // Use questions in original order
    currentQuestionIndex = 0;
    log.success(`📋 Questions en ordre: ${SHUFFLED_QUESTIONS.length} questions prêtes`);
}

// Plus de chargement des phrases d'introduction - logique simplifiée
log.success(`Logique des catégories supprimée - questions simples numérotées`);

// Fonction pour réinitialiser l'état du générateur de vidéos - SIMPLIFIÉE
async function resetGameState() {
    log.system('Réinitialisation de l\'état du générateur de vidéos');
    questionActive = false;
    questionWaitingForActivation = false;
    currentQuestion = null;
    questionTransitionInProgress = false;
    
    // 📋 INITIALIZE QUESTIONS IN ORDER FOR NEW GAME
    initializeShuffledQuestions();
    
    // Reset winner announcement session for new match
    if (winnerAnnouncementManager) {
        winnerAnnouncementManager.resetSession();
        log.system('🔄 Winner announcement session reset for new match');
    }
    
    // Arrêter les timers existants
    if (questionTimer) {
        clearTimeout(questionTimer);
        questionTimer = null;
    }
    
    // Démarrer le cycle de questions
    await startQuestionCycle();
}

// Fonction pour démarrer le cycle de questions
async function startQuestionCycle() {
    log.question('Démarrage du cycle de questions');
    
    // Recharger les greetings pour avoir les dernières modifications
    GREETINGS = loadGreetings();
    
    // Générer l'image de fond par défaut
    let defaultBackgroundUrl = null;
    if (GREETINGS.defaultBackground && GREETINGS.defaultBackground.theme) {
        try {
            log.unsplash(`Génération de l'image de fond par défaut: "${GREETINGS.defaultBackground.theme}"`);
            const timestamp = Date.now();
            defaultBackgroundUrl = await getUnsplashImage(GREETINGS.defaultBackground.theme, `default_background_${timestamp}`);
        } catch (err) {
            log.error('❌ Erreur lors de la génération de l\'image de fond par défaut: ' + err);
        }
    }
    
    // Envoyer l'image de fond par défaut à Godot
    if (defaultBackgroundUrl) {
        const backgroundMessage = {
            type: "set_background",
            backgroundImage: defaultBackgroundUrl
        };
        broadcastToGodot(backgroundMessage);
        log.unsplash(`Image de fond par défaut envoyée à Godot: ${defaultBackgroundUrl}`);
    }
    
    // Lire le message de bienvenue et attendre qu'il soit terminé
    if (azureTTS && GREETINGS.welcome) {
        try {
            log.question('🎤 Lecture du message de bienvenue...');
            const welcomeSSML = formatGreetingWithSSML(GREETINGS.welcome.text);
            // Attendre que l'audio soit terminé
            await azureTTS.speakQuestion(welcomeSSML, 0);
            log.info('✅ Message de bienvenue lu avec succès.');
        } catch (err) {
            log.error('❌ Erreur TTS pour le message de bienvenue: ' + err);
        }
    }
    
    // Poser la première question
    askNewQuestion();
}

// Fonction pour arrêter le cycle de questions
function stopQuestionCycle() {
    if (questionTimer) {
        clearTimeout(questionTimer);
        questionTimer = null;
    }
    questionActive = false;
    questionWaitingForActivation = false;
}

// Fonction pour poser une nouvelle question
async function askNewQuestion() {
    // Vérifier si Godot est connecté
    if (!godotConnected) {
        log.warning('⚠️ Question non posée: Godot non connecté');
        return;
    }
    
    if (questionActive || questionWaitingForActivation) {
        log.question(`Question non posée: questionActive=${questionActive}, questionWaitingForActivation=${questionWaitingForActivation}`);
        return;
    }
    
    // Protection contre les appels multiples pendant la transition
    if (currentQuestion !== null) {
        log.question(`Question non posée: currentQuestion existe encore (transition en cours)`);
        return;
    }
    
    // Check if we need to restart from beginning (all questions used)
    if (currentQuestionIndex >= SHUFFLED_QUESTIONS.length) {
        log.question('🏁 Toutes les questions utilisées, fin du quiz...');
        
        // Lire le message d'au revoir
        if (azureTTS && GREETINGS.goodbye) {
            try {
                log.question('🎤 Lecture du message d\'au revoir...');
                
                // Recharger les greetings pour avoir les dernières modifications
                GREETINGS = loadGreetings();
                
                // Générer l'image de fond pour le message d'au revoir
                let goodbyeBackgroundUrl = null;
                if (GREETINGS.goodbye.backgroundTheme) {
                    try {
                        log.unsplash(`Génération de l'image de fond pour l'au revoir: "${GREETINGS.goodbye.backgroundTheme}"`);
                        const timestamp = Date.now();
                        goodbyeBackgroundUrl = await getUnsplashImage(GREETINGS.goodbye.backgroundTheme, `goodbye_background_${timestamp}`);
                    } catch (err) {
                        log.error('❌ Erreur lors de la génération de l\'image de fond pour l\'au revoir: ' + err);
                    }
                }
                
                // Envoyer l'image de fond pour l'au revoir à Godot
                if (goodbyeBackgroundUrl) {
                    const backgroundMessage = {
                        type: "set_background",
                        backgroundImage: goodbyeBackgroundUrl
                    };
                    broadcastToGodot(backgroundMessage);
                    log.unsplash(`Image de fond pour l'au revoir envoyée à Godot: ${goodbyeBackgroundUrl}`);
                }
                
                const goodbyeSSML = formatGreetingWithSSML(GREETINGS.goodbye.text);
                azureTTS.speakQuestion(goodbyeSSML, 0).then(() => {
                    log.info('✅ Message d\'au revoir lu avec succès.');
                    // Redémarrer le quiz après 3 secondes
                    setTimeout(() => {
                        log.question('🔄 Redémarrage du quiz...');
                        initializeShuffledQuestions();
                        askNewQuestion();
                    }, 3000);
                }).catch(err => {
                    log.error('❌ Erreur TTS pour le message d\'au revoir: ' + err);
                    // Redémarrer même en cas d'erreur
                    setTimeout(() => {
                        log.question('🔄 Redémarrage du quiz...');
                        initializeShuffledQuestions();
                        askNewQuestion();
                    }, 3000);
                });
            } catch (err) {
                log.error('❌ Erreur TTS pour le message d\'au revoir: ' + err);
                // Redémarrer même en cas d'erreur
                setTimeout(() => {
                    log.question('🔄 Redémarrage du quiz...');
                    initializeShuffledQuestions();
                    askNewQuestion();
                }, 3000);
            }
        } else {
            // Si pas de TTS, redémarrer directement
            setTimeout(() => {
                log.question('🔄 Redémarrage du quiz...');
                initializeShuffledQuestions();
                askNewQuestion();
            }, 3000);
        }
        return;
    }
    
    // Sélectionner la question suivante depuis le tableau mélangé
    currentQuestion = SHUFFLED_QUESTIONS[currentQuestionIndex];
    currentQuestionIndex++;
    
    questionWaitingForActivation = true;
    
    log.question(`Nouvelle question: ${currentQuestion.question}`);
    log.question(`Options: A) ${currentQuestion.options[0]}, B) ${currentQuestion.options[1]}, C) ${currentQuestion.options[2]}`);
    log.question(`Réponse correcte: ${currentQuestion.correctAnswer} - ${currentQuestion.options[parseInt(currentQuestion.correctAnswer.charCodeAt(0) - 65)]}`);
    
    // Generate dynamic background image based on question content
    let backgroundImageUrl = currentQuestion.backgroundImage || null;
    
    // If no background image is set, generate one based on backgroundKeyWords
    if (!backgroundImageUrl && currentQuestion.backgroundKeyWords) {
        // Use timestamp to ensure different images each time
        const timestamp = Date.now();
        const cacheKey = `question_${currentQuestionIndex}_${timestamp}`;
        backgroundImageUrl = await getUnsplashImage(currentQuestion.backgroundKeyWords, cacheKey);
        log.unsplash(`Generated background image for keywords: "${currentQuestion.backgroundKeyWords}" (Question ${currentQuestionIndex})`);
    }
    
    // Envoyer la question à Godot
    const questionMessage = {
        type: "new_question",
        question: currentQuestion.question,
        options: currentQuestion.options,
        image: currentQuestion.image,
        backgroundImage: backgroundImageUrl,
        category: null,
        questionNumber: parseInt(currentQuestionIndex),
        niveau: currentQuestion.niveau || "easy"
    };
    
    log.question(`Envoi de la question à Godot: ${JSON.stringify(questionMessage)}`);
    broadcastToGodot(questionMessage);

    // Envoyer le message pour mettre tous les flags en "go"
    const goMessage = {
        type: "question_active"
    };
    
    log.question(`Envoi du message d'activation de la question à Godot: ${JSON.stringify(goMessage)}`);
    broadcastToGodot(goMessage);

    // Use Azure TTS to read the question aloud
    if (azureTTS) {
        try {
            log.question('🎤 Début de la lecture TTS de la question...');
            
            // Phrase d'introduction simple sans catégorie
            const questionNumber = parseInt(currentQuestionIndex);
            
            // Format SSML pour une meilleure prononciation
            const fullQuestionText = formatQuestionWithSSML(questionNumber, currentQuestion.questionTTS || currentQuestion.question, currentQuestion.options);
            
            log.question(`🎤 Phrase d'introduction: "Question ${questionNumber} :"`);
            
            // Lancer le TTS sans attendre (non-blocking)
            azureTTS.speakQuestion(fullQuestionText, questionNumber).then(() => {
                log.info('✅ Question spoken aloud (Azure TTS).');
            }).catch(err => {
                log.error('❌ Azure TTS error: ' + err);
            });
        } catch (err) {
            log.error('❌ Azure TTS error: ' + err);
        }
    }
    
    // Activer la question immédiatement
    if (!questionWaitingForActivation) {
        log.question("Question annulée - question déjà annulée");
        return;
    }
    
    questionWaitingForActivation = false;
    questionActive = true;
    
    // Envoyer le message pour démarrer le timer dans Godot
    const startTimerMessage = {
        type: "start_timer",
        timer: QUESTION_TIMER / 1000 // Convertir en secondes
    };
    
    log.question(`Envoi du message de démarrage du timer à Godot: ${JSON.stringify(startTimerMessage)}`);
    broadcastToGodot(startTimerMessage);
    
    log.question(`✅ Question activée. Début de la période de réponses de ${QUESTION_TIMER / 1000}s.`);
    
    // Démarrer le timer pour la période de réponses
    questionTimer = setTimeout(() => {
        // Check if currentQuestion still exists
        if (!currentQuestion) {
            log.question(`⏰ Timer expiré mais question déjà terminée - ignoré`);
            return;
        }
        
        log.question(`⏰ Timer expiré pour la question: ${currentQuestion.question}. Début de la période de grâce de ${GRACE_PERIOD / 1000}s.`);
        
        // Attendre la fin de la période de grâce avant de terminer la question
        setTimeout(() => {
            log.question("🏁 Période de grâce terminée. Finalisation de la question.");
            endQuestion();
        }, GRACE_PERIOD);

    }, QUESTION_TIMER);
    
    log.question(`⏱️ Timer de réponses démarré pour ${QUESTION_TIMER}ms`);
}

// Fonction pour terminer la question
async function endQuestion() {
    if (!questionActive) return;
    
    // Vérifier si Godot est toujours connecté
    if (!godotConnected) {
        log.warning('⚠️ Fin de question annulée: Godot déconnecté');
        return;
    }
    
    questionActive = false;
    
    const correctOptionText = currentQuestion.options[parseInt(currentQuestion.correctAnswer.charCodeAt(0) - 65)];
    log.question(`Question terminée. Réponse correcte: ${currentQuestion.correctAnswer} - ${correctOptionText}`);
    
    // Envoyer la fin de question à Godot
    const endQuestionMessage = {
        type: "question_ended",
        correctAnswer: currentQuestion.correctAnswer,
        correctOption: correctOptionText
    };
    broadcastToGodot(endQuestionMessage);
    log.question(`Envoi du message de fin de question à Godot: ${JSON.stringify(endQuestionMessage)}`);
    
    // Send message to Godot to show the correct answer immediately
    broadcastToGodot({
        type: "show_correct_answer",
        correctAnswer: currentQuestion.correctAnswer,
        correctOption: correctOptionText
    });
    log.question(`Envoi du message show_correct_answer à Godot: ${currentQuestion.correctAnswer} - ${correctOptionText}`);
    
    currentQuestion = null;
    log.system(`⏹️ Validations des réponses arrêtées`);
    
            // Programmer la prochaine question après 4 secondes de pause
        // Attendre un peu avant d'afficher Ready
        setTimeout(async () => {
            // Vérifier si Godot est toujours connecté
            if (!godotConnected) {
                log.warning('⚠️ Affichage Ready annulé: Godot déconnecté');
                return;
            }
            
            // Show Ready screen
            log.question("Affichage de l'écran 'Ready'");
            broadcastToGodot({
                type: "show_ready",
                image: "ready_image.png"
            });
            
            // Programmer la prochaine question après 4 secondes
            setTimeout(() => {
                askNewQuestion();
            }, READY_PAUSE_TIME); // 4 secondes de pause "Ready"
        }, ANSWER_DISPLAY_TIME); // 3 secondes pour voir la réponse
}

// Fonction pour envoyer des messages à Godot
function broadcastToGodot(message) {
    wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Variable pour tracker si Godot est connecté
let godotConnected = false;

// Gestion des connexions WebSocket
wsServer.on('connection', (ws) => {
    log.system('🔗 Nouvelle connexion Godot établie');
    godotConnected = true;
    
    // Démarrer le cycle de génération de vidéos seulement si c'est la première connexion
    if (!questionActive && !questionWaitingForActivation) {
        log.system('🚀 Démarrage du générateur de vidéos (Godot connecté)');
        resetGameState().catch(err => {
            log.error('❌ Erreur lors du démarrage du générateur de vidéos: ' + err);
        });
    }
    
    // Gestion de la déconnexion
    ws.on('close', () => {
        log.system('🔌 Connexion Godot fermée');
        godotConnected = false;
        // Arrêter le générateur de vidéos
        stopQuestionCycle();
        log.system('⏹️ Générateur de vidéos arrêté (Godot déconnecté)');
    });
    
    // Gestion des erreurs
    ws.on('error', (error) => {
        log.error('❌ Erreur WebSocket: ' + error.message);
    });
});

log.system('🎬 Générateur de vidéos YouTube démarré sur ws://localhost:8080');

// Initialize Azure TTS
(async () => {
    try {
        azureTTS = new AzureTTS();
        log.success('Azure TTS initialized and ready to speak!');
        
        // Initialize Winner Announcement Manager
        winnerAnnouncementManager = new WinnerAnnouncementManager();
        await winnerAnnouncementManager.initialize(azureTTS);
        log.success('Winner Announcement Manager initialized and ready!');
    } catch (error) {
        log.error('Failed to initialize Azure TTS:', error);
    }
})();

// Display cache statistics every 10 minutes
setInterval(() => {
    const stats = unsplashCache.getStats();
    const cacheSize = unsplashCache.getCacheSize();
    
    console.log('\n📊 Unsplash Cache Statistics:');
    console.log('==============================');
    console.log(`Cache Size: ${stats.cache.total}/${stats.cache.maxSize} entries (${cacheSize})`);
    console.log(`Valid Entries: ${stats.cache.valid}`);
    console.log(`Expired Entries: ${stats.cache.expired}`);
    console.log(`Hit Rate: ${stats.performance.hitRate}`);
    console.log(`Total Requests: ${stats.performance.totalRequests}`);
    console.log(`Hits: ${stats.performance.hits}`);
    console.log(`Misses: ${stats.performance.misses}`);
    console.log(`Uptime: ${stats.performance.uptimeMinutes} minutes`);
    console.log('==============================\n');
}, 600000); // 10 minutes

// Add a command to manually display stats
process.on('SIGUSR1', () => {
    const stats = unsplashCache.getStats();
    const cacheSize = unsplashCache.getCacheSize();
    
    console.log('\n📊 Unsplash Cache Statistics:');
    console.log('==============================');
    console.log(`Cache Size: ${stats.cache.total}/${stats.cache.maxSize} entries (${cacheSize})`);
    console.log(`Valid Entries: ${stats.cache.valid}`);
    console.log(`Expired Entries: ${stats.cache.expired}`);
    console.log(`Hit Rate: ${stats.performance.hitRate}`);
    console.log(`Total Requests: ${stats.performance.totalRequests}`);
    console.log(`Hits: ${stats.performance.hits}`);
    console.log(`Misses: ${stats.performance.misses}`);
    console.log(`Uptime: ${stats.performance.uptimeMinutes} minutes`);
    console.log('==============================\n');
    
    // Also show account status
    unsplashAccountManager.checkStatus();
});

// Add a command to test API keys
process.on('SIGUSR2', () => {
    unsplashAccountManager.testApiKeys();
});

// Cleanup on process exit
process.on('SIGINT', () => {
    log.system('Shutting down server...');
    
    // Display final cache stats
    const stats = unsplashCache.getStats();
    const cacheSize = unsplashCache.getCacheSize();
    console.log('\n📊 Final Cache Statistics:');
    console.log(`Cache Size: ${stats.cache.total} entries (${cacheSize})`);
    console.log(`Hit Rate: ${stats.performance.hitRate}`);
    
    // Ensure cache is saved
    unsplashCache.saveCache();
    
    if (azureTTS) {
        azureTTS.cleanup();
    }
    process.exit(0);
});

// Function to get random image from Unsplash
async function getUnsplashImage(query, customCacheKey = null) {
    // Check if we have any available accounts
    if (unsplashAccountManager.accounts.length === 0) {
        log.warning('No Unsplash API keys configured, using fallback image');
        return 'https://httpbin.org/image/png?width=800&height=600';
    }

    // Use custom cache key if provided, otherwise use query
    const cacheKey = customCacheKey || query.toLowerCase().trim();
    
    // Check cache first using the enhanced cache manager
    const cachedUrl = unsplashCache.get(cacheKey);
    if (cachedUrl) {
        return cachedUrl;
    }

    // Generate a random seed for variety, but keep some consistency for the same query
    const randomSeed = Math.floor(Math.random() * 1000000);
    const baseUrl = `${UNSPLASH_API_URL}?query=${encodeURIComponent(query)}&orientation=landscape&w=800&h=600&seed=${randomSeed}&client_id=PLACEHOLDER`;
    
    log.unsplash(`Fetching image for query: "${query}"`);
    
    try {
        const response = await unsplashAccountManager.makeRequest(baseUrl);
        
        // Check if response is JSON or error text
        if (response.body.includes('Rate Limit Exceeded') || response.body.includes('error')) {
            log.error(`❌ Unsplash API error: ${response.body}`);
            log.warning('⚠️ Using fallback image due to API error');
            return 'https://httpbin.org/image/png?width=800&height=600';
        }
        
        const imageData = JSON.parse(response.body);
        if (imageData.urls && imageData.urls.regular) {
            const imageUrl = imageData.urls.regular;
            log.unsplash(`✅ Image found: ${imageUrl}`);
            
            // Cache the result using the enhanced cache manager
            unsplashCache.set(cacheKey, imageUrl);
            
            return imageUrl;
        } else {
            log.warning('No image found in response, using fallback');
            return 'https://httpbin.org/image/png?width=800&height=600';
        }
    } catch (error) {
        log.error(`❌ Error fetching from Unsplash: ${error.message}`);
        log.warning('⚠️ Using fallback image due to error');
        return 'https://httpbin.org/image/png?width=800&height=600';
    }
}

// Function to extract keywords from question for image search
function extractKeywordsFromQuestion(question) {
    const questionLower = question.toLowerCase();
    
    // Define keyword mappings for different question types
    const keywordMappings = {
        // Space related
        'space': 'space galaxy',
        'survive in space': 'space astronaut',
        'animal can survive': 'space animal',
        
        // Food related
        'chocolate': 'chocolate food',
        'fruit': 'fruit food',
        'expensive fruit': 'luxury fruit',
        'paper money': 'money currency',
        
        // Animal related
        'animal': 'wildlife nature',
        'never sleeps': 'nocturnal animal',
        'fastest creature': 'fast animal',
        'bird': 'bird flying',
        'sleep while flying': 'bird in flight',
        
        // Medical related
        'human organ': 'medical anatomy',
        'grow back': 'regeneration medical',
        
        // Geography related
        'country': 'landscape',
        'no rivers': 'desert landscape',
        'first to use': 'ancient history'
    };
    
    // Check for specific keywords
    for (const [key, value] of Object.entries(keywordMappings)) {
        if (questionLower.includes(key)) {
            return value;
        }
    }
    
    // Default fallback
    return 'abstract';
}

// Function to format greeting text with SSML
function formatGreetingWithSSML(text) {
    // Start with SSML wrapper
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">`;
    ssml += `<voice name="fr-FR-Remy:DragonHDLatestNeural">`;
    ssml += `<prosody rate="medium" pitch="medium" volume="medium">`;
    ssml += text;
    ssml += `</prosody>`;
    ssml += `</voice>`;
    ssml += `</speak>`;
    
    return ssml;
}

// Function to format question text with SSML for better pronunciation
function formatQuestionWithSSML(questionNumber, question, options) {
    // Start with SSML wrapper
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">`;
    ssml += `<voice name="fr-FR-Remy:DragonHDLatestNeural">`;
    
    // Add question number
    ssml += `<prosody rate="medium" pitch="medium" volume="medium">`;
    ssml += `Question ${questionNumber} : `;
    
    // Use the question text directly (it can contain SSML tags)
    ssml += question;
    ssml += `</prosody>`;
    
    ssml += `</voice>`;
    ssml += `</speak>`;
    
    return ssml;
}

// 🎲 Initialize shuffled questions for the first game
initializeShuffledQuestions();

// Le générateur de vidéos ne démarre que quand Godot se connecte
log.system('⏳ En attente de connexion Godot pour démarrer le générateur de vidéos...'); 