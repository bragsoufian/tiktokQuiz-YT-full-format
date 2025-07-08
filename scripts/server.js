const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const AzureTTS = require('./azure_tts'); // Import Azure TTS
const EncouragementManager = require('./encouragement_manager'); // Import Encouragement Manager
const AnswerAnnouncementManager = require('./answer_announcement_manager'); // Import Answer Announcement Manager
const WinnerAnnouncementManager = require('./winner_announcement_manager'); // Import Winner Announcement Manager
const UnsplashCacheManager = require('./unsplash_cache_manager'); // Import Enhanced Cache Manager
const UnsplashAccountManager = require('./unsplash_account_manager'); // Import Multi-Account Manager
const https = require('https');
const config = require('./config'); // Import configuration

//loochytv
//camyslive
//cross2crown
//tyrone
//cash4killz
//windpress
//user7165753005592
//valorantesports

const tiktokUsername = 'user7165753005592';
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

// Configuration du jeu
const QUESTION_TIMER = 7000; // 5 secondes par défaut
const ANSWER_DISPLAY_TIME = 3000; // 3 secondes pour voir la réponse
const READY_PAUSE_TIME = 4000; // 4 secondes de pause "Ready"
const GRACE_PERIOD = 4000; // 4 secondes de grâce pour les réponses tardives
const QUESTION_ACTIVATION_DELAY = 3000; // 7 secondes de délai avant d'accepter les réponses (pour compenser la latence TikTok)

// Définition des seuils pour chaque niveau
const LEVEL_THRESHOLDS = [
    1,    // Niveau 1 → 2
    4,
    10,
    15,
    21
];

// Configuration
const USE_TEST_PLAYER = false;  // Set to false to disable test player
const TEST_PLAYER_INTERVAL = 1000;  // 1 second interval

// État du match
let matchEnded = false;
let winner = null;

// État de la question
let questionActive = false;
let questionWaitingForActivation = false; // Nouveau: état d'attente avant activation
let currentQuestion = null;
let questionTimer = null;
let playersAnsweredCurrentQuestion = new Set(); // Nouveau: tracker les joueurs qui ont répondu à la question actuelle
let questionTransitionInProgress = false; // Protection contre les appels multiples pendant la transition

// Données des gifts reçus pour la question actuelle
let currentQuestionGifts = {
    users: new Set(),
    gifts: new Set(),
    totalGifts: 0
};

// Sons pour les nouveaux joueurs
const newPlayerSounds = [
    "res://assets/sounds/new viewers/pop1.mp3",
    "res://assets/sounds/new viewers/pop2.mp3", 
    "res://assets/sounds/new viewers/pop3.mp3",
    "res://assets/sounds/new viewers/pop4.mp3",
    "res://assets/sounds/new viewers/pop5.mp3"
];

// Stockage des joueurs
const players = new Map();

// Pour éviter les doublons de joueurs envoyés à Godot
let playersSentToGodot = new Set();

// Variables pour le test player
let testPlayerInterval = null;
let commentCount = 0;
let currentQuestionIndex = 0;

// Azure TTS instance
let azureTTS = null;

// Encouragement Manager instance
let encouragementManager = null;

// Answer Announcement Manager instance
let answerAnnouncementManager = null;

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
    player: (msg) => console.log('\x1b[35m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 👤 ${msg}`),   // Magenta
    system: (msg) => console.log('\x1b[34m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 🖥️ ${msg}`),   // Bleu
    question: (msg) => console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ❓ ${msg}`),   // Jaune pour les questions
    unsplash: (msg) => console.log('\x1b[36m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 🖼️ ${msg}`)   // Cyan pour Unsplash
};

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

// Charger les phrases d'introduction depuis le fichier JSON
let QUESTION_INTROS = [];
try {
    const introsPath = path.join(__dirname, 'question_intros.json');
    const introsData = fs.readFileSync(introsPath, 'utf8');
    const introsJson = JSON.parse(introsData);
    QUESTION_INTROS = introsJson.intros || [];
    log.success(`Chargement de ${QUESTION_INTROS.length} phrases d'introduction depuis question_intros.json`);
} catch (error) {
    log.error(`Erreur lors du chargement des phrases d'introduction: ${error.message}`);
    // Phrases par défaut en cas d'erreur
    QUESTION_INTROS = [
        "Next question : ",
        ""
    ];
}

// Afficher la configuration des niveaux au démarrage
const maxLevel = LEVEL_THRESHOLDS.length + 1;
log.system(`🏆 Configuration des niveaux:`);
for (let i = 1; i <= maxLevel; i++) {
    const minPoints = getMinPointsForLevel(i);
    if (i === maxLevel) {
        log.system(`   Niveau ${i}: ${minPoints} points minimum (NIVEAU GAGNANT)`);
    } else {
        log.system(`   Niveau ${i}: ${minPoints} points minimum`);
    }
}
log.system(`🎯 Pour gagner: Atteindre le niveau ${maxLevel}`);

// Fonction pour réinitialiser l'état du jeu
function resetGameState() {
    log.system('Réinitialisation de l\'état du jeu');
    players.clear();
    playersSentToGodot.clear(); // Réinitialiser la liste des joueurs envoyés
    matchEnded = false;
    winner = null;
    questionActive = false;
    questionWaitingForActivation = false; // Réinitialiser le nouvel état
    currentQuestion = null;
    questionTransitionInProgress = false; // Réinitialiser la protection de transition
    // NE PAS remettre currentQuestionIndex à 0 pour continuer avec les questions suivantes
    // currentQuestionIndex = 0; // COMMENTÉ - pour continuer les questions
    
    // Reset encouragement session for new match
    if (encouragementManager) {
        encouragementManager.resetSession();
        log.system('🔄 Encouragement session reset for new match');
    }
    
    // Reset gift data
    currentQuestionGifts = {
        users: new Set(),
        gifts: new Set(),
        totalGifts: 0
    };
    
    // Reset answer announcement session for new match
    if (answerAnnouncementManager) {
        answerAnnouncementManager.resetSession();
        log.system('🔄 Answer announcement session reset for new match');
    }
    
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
    
    if (USE_TEST_PLAYER) {
        startTestPlayer();
    }
    
    // Démarrer le cycle de questions
    startQuestionCycle();
}

// Fonction pour démarrer le cycle de questions
function startQuestionCycle() {
    log.question('Démarrage du cycle de questions');
    
    // Poser la première question immédiatement
    setTimeout(() => {
        if (!matchEnded) {
            askNewQuestion();
        }
    }, 3000); // Attendre 3 secondes avant la première question
}

// Fonction pour arrêter le cycle de questions
function stopQuestionCycle() {
    if (questionTimer) {
        clearTimeout(questionTimer);
        questionTimer = null;
    }
    questionActive = false;
    questionWaitingForActivation = false; // Arrêter aussi l'état d'attente
}

// Fonction pour poser une nouvelle question
async function askNewQuestion() {
    if (matchEnded || questionActive || questionWaitingForActivation) {
        log.question(`Question non posée: matchEnded=${matchEnded}, questionActive=${questionActive}, questionWaitingForActivation=${questionWaitingForActivation}`);
        return;
    }
    
    // Protection contre les appels multiples pendant la transition
    if (currentQuestion !== null) {
        log.question(`Question non posée: currentQuestion existe encore (transition en cours)`);
        return;
    }
    
    // Sélectionner la question suivante
    currentQuestion = QUESTIONS[currentQuestionIndex % QUESTIONS.length];
    currentQuestionIndex++;
    
    questionWaitingForActivation = true; // Commencer la période d'attente
    playersAnsweredCurrentQuestion.clear(); // Réinitialiser la liste des joueurs qui ont répondu
    
    // Réinitialiser les gifts pour la nouvelle question
    currentQuestionGifts = {
        users: new Set(),
        gifts: new Set(),
        totalGifts: 0
    };
    
    log.question(`Nouvelle question: ${currentQuestion.question}`);
    log.question(`Options: A) ${currentQuestion.options[0]}, B) ${currentQuestion.options[1]}, C) ${currentQuestion.options[2]}`);
    log.question(`Réponse correcte: ${currentQuestion.correctAnswer} - ${currentQuestion.options[parseInt(currentQuestion.correctAnswer.charCodeAt(0) - 65)]}`);
    
    // Generate dynamic background image based on question content
    let backgroundImageUrl = currentQuestion.backgroundImage || null;
    
    // If no background image is set, generate one based on backgroundKeyWords
    if (!backgroundImageUrl && currentQuestion.backgroundKeyWords) {
        // Use question index as cache key to ensure same question gets same image
        const cacheKey = `question_${currentQuestionIndex}_${currentQuestion.backgroundKeyWords}`;
        backgroundImageUrl = await getUnsplashImage(currentQuestion.backgroundKeyWords, cacheKey);
        log.unsplash(`Generated background image for keywords: "${currentQuestion.backgroundKeyWords}" (Question ${currentQuestionIndex})`);
    }
    
    // Envoyer la question à Godot SANS timer (on l'enverra après la lecture TTS)
    const questionMessage = {
        type: "new_question",
        question: currentQuestion.question,
        options: currentQuestion.options,
        image: currentQuestion.image,
        backgroundImage: backgroundImageUrl
        // Pas de timer ici - il sera envoyé séparément après la lecture TTS
    };
    
    log.question(`Envoi de la question à Godot (sans timer): ${JSON.stringify(questionMessage)}`);
    broadcastToGodot(questionMessage);

    // Envoyer le message pour mettre tous les flags en "go" dès le début du TTS
    const goMessage = {
        type: "question_active"
    };
    
    log.question(`Envoi du message d'activation de la question à Godot: ${JSON.stringify(goMessage)}`);
    broadcastToGodot(goMessage);

    // Use Azure TTS to read the question aloud and wait for it to finish
    if (azureTTS) {
        try {
            log.question('🎤 Début de la lecture TTS de la question...');
            
            // Sélectionner une phrase d'introduction aléatoire
            const randomIntro = QUESTION_INTROS[Math.floor(Math.random() * QUESTION_INTROS.length)];
            const fullQuestionText = `${randomIntro} ${currentQuestion.question}`;
            
            log.question(`🎤 Phrase d'introduction sélectionnée: "${randomIntro}"`);
            await azureTTS.speakQuestion(fullQuestionText, currentQuestionIndex);
            log.info('✅ Question spoken aloud (Azure TTS).');
        } catch (err) {
            log.error('❌ Azure TTS error: ' + err);
        }
    }
    
    // Maintenant que la lecture TTS est terminée, activer la question et démarrer le timer
    log.question('🎯 Lecture TTS terminée. Activation de la question et démarrage du timer...');
    
    if (matchEnded || !questionWaitingForActivation) {
        log.question("Question annulée - match terminé ou question déjà annulée");
        return;
    }
    
    questionWaitingForActivation = false;
    questionActive = true; // Maintenant la question est active et accepte les réponses
    
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
        // Check if currentQuestion still exists (it might have been cleared by endQuestion)
        if (!currentQuestion) {
            log.question(`⏰ Timer expiré mais question déjà terminée - ignoré`);
            return;
        }
        
        log.question(`⏰ Timer expiré pour la question: ${currentQuestion.question}`);
        
        // End the question immediately without grace period
        endQuestion();

    }, QUESTION_TIMER);
    
    log.question(`⏱️ Timer de réponses démarré pour ${QUESTION_TIMER}ms`);
}

// Fonction pour terminer la question
async function endQuestion() {
    if (!questionActive) return;
    
    // Ne pas marquer la question comme inactive immédiatement
    // questionActive = false; // COMMENTÉ - on garde les validations actives pendant TTS
    playersAnsweredCurrentQuestion.clear(); // Nettoyer la liste des joueurs qui ont répondu
    
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
    
    // Jouer une phrase d'encouragement si configurée
    if (encouragementManager && azureTTS) {
        try {
            // Calculer les statistiques des cadeaux pour cette question
            const giftData = {
                totalGifts: currentQuestionGifts.totalGifts
            };
            
            // Get a smart encouragement phrase based on game conditions
            const phrase = encouragementManager.getSmartPhrase(players, giftData);
            if (phrase) {
                log.system(`🎤 Playing smart encouragement phrase: "${phrase.text}"`);
                
                // Play the encouragement phrase
                await azureTTS.speakText(phrase.text);
                log.success('✅ Smart encouragement phrase spoken');
            }
        } catch (err) {
            log.error('❌ Error playing encouragement phrase: ' + err);
        }
    }
    
    // Announce the correct answer using TTS AFTER encouragement phrase
    if (answerAnnouncementManager && azureTTS) {
        try {
            const announcementText = answerAnnouncementManager.generateAnnouncementText(
                currentQuestion.correctAnswer, 
                correctOptionText, 
                currentQuestionIndex
            );
            
            log.system(`🎤 Announcing correct answer: "${announcementText}"`);
            await azureTTS.speakText(announcementText);
            log.success('✅ Answer announcement spoken');
            
            // Send message to Godot to show the correct answer after TTS announcement
            broadcastToGodot({
                type: "show_correct_answer",
                correctAnswer: currentQuestion.correctAnswer,
                correctOption: correctOptionText
            });
            log.question(`Envoi du message show_correct_answer à Godot: ${currentQuestion.correctAnswer} - ${correctOptionText}`);
            
        } catch (err) {
            log.error('❌ Error announcing answer: ' + err);
        }
    }
    
    // MAINTENANT on arrête les validations après l'annonce TTS
    questionActive = false;
    currentQuestion = null;
    log.system(`⏹️ Validations des réponses arrêtées après l'annonce TTS`);
    
    // Programmer la prochaine question après 4 secondes de pause
    if (!matchEnded) {
        // Show Ready screen after encouragement phrase and answer announcement
        setTimeout(() => {
            if (!matchEnded) {
                log.question("Affichage de l'écran 'Ready'");
                broadcastToGodot({
                    type: "show_ready",
                    image: "ready_image.png" // Tu peux changer le nom de l'image ici
                });
                
                // Programmer la prochaine question après 4 secondes
                setTimeout(() => {
                    if (!matchEnded) {
                        askNewQuestion();
                    }
                }, READY_PAUSE_TIME); // 4 secondes de pause "Ready"
            }
        }, ANSWER_DISPLAY_TIME); // 3 secondes pour voir la réponse
    }
}

// Fonction pour valider une réponse
function validateAnswer(username, answer) {
    if (!questionActive || !currentQuestion) return false;
    
    // Normaliser la réponse (A, a, etc.)
    const normalizedAnswer = answer.toUpperCase().trim();
    
    // Accepter seulement A, B, C comme réponses valides
    if (!['A', 'B', 'C'].includes(normalizedAnswer)) {
        return false;
    }
    
    // Vérifier si c'est la bonne réponse
    const isCorrect = normalizedAnswer === currentQuestion.correctAnswer;
    
    if (isCorrect) {
        log.success(`${username} a répondu correctement: ${normalizedAnswer}`);
        return true;
    }
    
    return false;
}

// Nettoyage des joueurs inactifs (plus de 5 minutes)
setInterval(() => {
    if (matchEnded) return;
    
    const now = Date.now();
    for (const [username, data] of players.entries()) {
        if (now - data.lastComment > 300000) { // 5 minutes
            players.delete(username);
            log.warning(`Joueur inactif supprimé: ${username}`);
            broadcastToGodot({
                type: "player_removed",
                user: username
            });
        }
    }
}, 60000);

log.system('Serveur WebSocket démarré sur ws://localhost:8080');

// Connexion à TikTok
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    log.success(`Connecté au live TikTok: ${state.roomId}`);
    if (USE_TEST_PLAYER) {
        startTestPlayer();
    }
}).catch(err => {
    log.error(`Erreur de connexion TikTok: ${err}`);
});

// Gestion des nouveaux membres qui rejoignent le live
tiktokLiveConnection.on('member', data => {
    if (matchEnded) return;
    
    const username = data.uniqueId;
    const profilePic = data.profilePictureUrl;
    
    // Créer automatiquement le joueur quand il rejoint
    if (!players.has(username)) {
        log.player(`Nouveau membre rejoint: ${username}`);
        players.set(username, {
            profilePic: profilePic,
            points: 0,
            currentLevel: 1,
            lastComment: Date.now()
        });
        
        // Déterminer le flag initial basé sur l'état du jeu
        const initialFlag = (questionActive && !questionWaitingForActivation) ? "go" : "wait";
        
        // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
        setTimeout(() => {
            // Vérifier si le joueur a déjà été envoyé à Godot
            if (hasPlayerBeenSentToGodot(username)) {
                log.warning(`${username} déjà envoyé à Godot - ignoré`);
                return;
            }
            
            broadcastToGodot({
                type: "new_player",
                user: username,
                profilePic: profilePic,
                points: 0,
                currentLevel: 1,
                initialFlag: initialFlag
            });
            
            // Marquer le joueur comme envoyé
            markPlayerAsSentToGodot(username);
            
            // Jouer un son de nouveau joueur
            playNewPlayerSound();
            
            log.info(`${username} a rejoint le jeu automatiquement (0 points) - Flag initial: ${initialFlag}`);
        }, 2000); // 2 secondes de délai
    }
});

// Gestion des autres types de joins (pour s'assurer de ne manquer personne)
tiktokLiveConnection.on('join', data => {
    if (matchEnded) return;
    
    const username = data.uniqueId;
    const profilePic = data.profilePictureUrl;
    
    // Créer automatiquement le joueur s'il n'existe pas déjà
    if (!players.has(username)) {
        log.player(`Nouveau join: ${username}`);
        players.set(username, {
            profilePic: profilePic,
            points: 0,
            currentLevel: 1,
            lastComment: Date.now()
        });
        
        // Déterminer le flag initial basé sur l'état du jeu
        const initialFlag = (questionActive && !questionWaitingForActivation) ? "go" : "wait";
        
        // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
        setTimeout(() => {
            // Vérifier si le joueur a déjà été envoyé à Godot
            if (hasPlayerBeenSentToGodot(username)) {
                log.warning(`${username} déjà envoyé à Godot - ignoré`);
                return;
            }
            
            broadcastToGodot({
                type: "new_player",
                user: username,
                profilePic: profilePic,
                points: 0,
                currentLevel: 1,
                initialFlag: initialFlag
            });
            
            // Marquer le joueur comme envoyé
            markPlayerAsSentToGodot(username);
            
            // Jouer un son de nouveau joueur
            playNewPlayerSound();
            
            log.info(`${username} a rejoint le jeu via join event (0 points) - Flag initial: ${initialFlag}`);
        }, 2000); // 2 secondes de délai
    }
});

// Gestion des gifts TikTok
tiktokLiveConnection.on('gift', data => {
    if (matchEnded) return;
    
    const username = data.uniqueId;
    const giftName = data.giftName;
    const giftCount = data.repeatCount || 1;
    
    log.system(`🎁 Gift reçu: ${username} a envoyé ${giftCount}x ${giftName}`);
    
    // Ajouter les données du gift pour la question actuelle
    currentQuestionGifts.users.add(username);
    currentQuestionGifts.gifts.add(giftName);
    currentQuestionGifts.totalGifts += giftCount;
    
    // Enregistrer le gift dans l'encouragement manager pour prioriser les phrases de gifts
    if (encouragementManager) {
        encouragementManager.recordGift();
        log.system(`🎁 Gift enregistré - phrases de gifts prioritaires pour les 30 prochaines secondes`);
    }
    
    // Créer le joueur s'il n'existe pas déjà
    if (!players.has(username)) {
        log.player(`Nouveau joueur via gift: ${username}`);
        players.set(username, {
            profilePic: data.profilePictureUrl,
            points: 0,
            currentLevel: 1,
            lastComment: Date.now()
        });
        
        // Déterminer le flag initial basé sur l'état du jeu
        const initialFlag = (questionActive && !questionWaitingForActivation) ? "go" : "wait";
        
        // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
        setTimeout(() => {
            // Vérifier si le joueur a déjà été envoyé à Godot
            if (hasPlayerBeenSentToGodot(username)) {
                log.warning(`${username} déjà envoyé à Godot - ignoré`);
                return;
            }
            
            broadcastToGodot({
                type: "new_player",
                user: username,
                profilePic: data.profilePictureUrl,
                points: 0,
                currentLevel: 1,
                initialFlag: initialFlag
            });
            
            // Marquer le joueur comme envoyé
            markPlayerAsSentToGodot(username);
            
            // Jouer un son de nouveau joueur
            playNewPlayerSound();
            
            log.info(`${username} a rejoint le jeu via gift (0 points) - Flag initial: ${initialFlag}`);
        }, 2000); // 2 secondes de délai
    } else {
        // Mettre à jour le lastComment pour les joueurs existants
        const playerData = players.get(username);
        playerData.lastComment = Date.now();
    }
});

// Fonction pour vérifier si un joueur a déjà été envoyé à Godot
function hasPlayerBeenSentToGodot(username) {
    return playersSentToGodot.has(username);
}

// Fonction pour marquer un joueur comme envoyé à Godot
function markPlayerAsSentToGodot(username) {
    playersSentToGodot.add(username);
}

// Fonction pour jouer un son de nouveau joueur
function playNewPlayerSound() {
    const randomSound = newPlayerSounds[Math.floor(Math.random() * newPlayerSounds.length)];
    broadcastToGodot({
        type: "play_new_player_sound",
        sound_file: randomSound
    });
    log.system(`🔊 Son de nouveau joueur joué: ${randomSound}`);
}

// Fonction pour envoyer des messages à Godot
function broadcastToGodot(message) {
    wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Fonction pour vérifier le niveau
function checkLevel(points) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (points >= LEVEL_THRESHOLDS[i]) {
            return i + 2; // +2 car le niveau 1 est le niveau de départ
        }
    }
    return 1; // Niveau de départ
}

// Fonction pour obtenir le minimum de points pour un niveau
function getMinPointsForLevel(level) {
    if (level <= 1) return 0;
    if (level <= LEVEL_THRESHOLDS.length + 1) {
        return LEVEL_THRESHOLDS[level - 2]; // -2 car le niveau 1 commence à 0 points
    }
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]; // Niveau maximum
}

// Gestion des messages du chat
tiktokLiveConnection.on('chat', async data => {
    if (matchEnded) return;
    
    const username = data.uniqueId;
    const comment = data.comment.trim();
    
    // Si une question est active ET pas en attente d'activation, traiter la réponse
    if (questionActive && !questionWaitingForActivation && currentQuestion) {
        // Créer le joueur s'il n'existe pas déjà
        if (!players.has(username)) {
            log.player(`Nouveau joueur via commentaire: ${username}`);
            
            // Utiliser exactement la même logique que les événements join/gift
            const profilePic = data.profilePictureUrl;
            
            players.set(username, {
                profilePic: profilePic,
                points: 0,
                currentLevel: 1,
                lastComment: Date.now()
            });
            
            // Déterminer le flag initial basé sur l'état du jeu
            const initialFlag = (questionActive && !questionWaitingForActivation) ? "go" : "wait";
            
            // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
            setTimeout(() => {
                // Vérifier si le joueur a déjà été envoyé à Godot
                if (hasPlayerBeenSentToGodot(username)) {
                    log.warning(`${username} déjà envoyé à Godot - ignoré`);
                    return;
                }
                
                broadcastToGodot({
                    type: "new_player",
                    user: username,
                    profilePic: profilePic,
                    points: 0,
                    currentLevel: 1,
                    initialFlag: initialFlag
                });
                
                // Marquer le joueur comme envoyé
                markPlayerAsSentToGodot(username);
                
                // Jouer un son de nouveau joueur
                playNewPlayerSound();
                
                log.info(`${username} a rejoint le jeu via commentaire (0 points) - Flag initial: ${initialFlag}`);
            }, 2000); // 2 secondes de délai
        }
        
        // Vérifier si c'est une réponse valide (A, B, C)
        const normalizedComment = comment.toUpperCase().trim();
        if (!['A', 'B', 'C'].includes(normalizedComment)) {
            // Commentaire ignoré - pas une réponse valide
            log.info(`${username}: ${comment} (commentaire ignoré - pas A, B, C)`);
            return;
        }
        
        // Vérifier si le joueur a déjà répondu à cette question
        if (playersAnsweredCurrentQuestion.has(username)) {
            log.warning(`${username} a déjà répondu à cette question - réponse ignorée`);
            return;
        }
        
        // Valider la réponse
        const isCorrect = validateAnswer(username, comment);
        if (isCorrect) {
            // Marquer le joueur comme ayant répondu à cette question
            playersAnsweredCurrentQuestion.add(username);
            
            // Envoyer l'animation de bonne réponse
            broadcastToGodot({
                type: "correct_answer",
                user: username
            });
            
            // Donner un point pour la bonne réponse
            const playerData = players.get(username);
            playerData.points += 1;
            playerData.lastComment = Date.now();
            
            // Vérifier si le joueur monte de niveau
            const newLevel = checkLevel(playerData.points);
            if (newLevel > playerData.currentLevel) {
                playerData.currentLevel = newLevel;
                log.success(`${username} monte au niveau ${newLevel}! (${playerData.points} points)`);
                
                // Vérifier si le joueur a gagné (niveau maximum basé sur LEVEL_THRESHOLDS)
                const maxLevel = LEVEL_THRESHOLDS.length + 1; // +1 car le niveau 1 est le niveau de départ
                if (newLevel === maxLevel) {
                    matchEnded = true;
                    winner = username;
                    log.success(`🏆 ${username} a gagné le match! (Niveau ${maxLevel} atteint)`);
                    stopQuestionCycle();
                    
                    // Récupérer les données du gagnant
                    const winnerData = players.get(username);
                    
                    // Trier les joueurs par points pour obtenir le top 3
                    const sortedPlayers = Array.from(players.entries())
                        .map(([username, data]) => ({
                            user: username,
                            points: data.points,
                            profilePic: data.profilePic
                        }))
                        .sort((a, b) => b.points - a.points);
                    
                    // Trouver le deuxième et troisième joueur en ignorant le gagnant
                    const secondPlace = sortedPlayers.find(p => p.user !== username);
                    const thirdPlace = sortedPlayers.find(p => p.user !== username && p.user !== secondPlace?.user);
                    
                    log.info("📊 Top 3 joueurs:", {
                        winner: username,
                        second: secondPlace?.user,
                        third: thirdPlace?.user
                    });
                    
                    // Envoyer les données du gagnant et du top 3
                    broadcastToGodot({
                        type: "match_ended",
                        winner: username,
                        points: playerData.points,
                        profilePic: winnerData ? winnerData.profilePic : "",
                        user: username,
                        second_place: secondPlace || null,
                        third_place: thirdPlace || null
                    });
                    
                    // 🎤 LANCER L'ANNONCE TTS DU GAGNANT
                    await handleMatchEnd(username, playerData.points);
                    return;
                }
            }
            
            log.info(`${username}: ${comment} (bonne réponse - Points: ${playerData.points}, Niveau: ${playerData.currentLevel})`);
            
            broadcastToGodot({
                type: "player_update",
                user: username,
                points: playerData.points,
                currentLevel: playerData.currentLevel
            });
        } else {
            // Mauvaise réponse - marquer comme ayant répondu et retirer 1 point
            playersAnsweredCurrentQuestion.add(username);
            
            // Envoyer l'animation de mauvaise réponse
            broadcastToGodot({
                type: "wrong_answer",
                user: username
            });
            
            const playerData = players.get(username);
            playerData.lastComment = Date.now();
            
            // Retirer 1 point mais jamais en dessous du minimum du niveau
            const currentLevel = playerData.currentLevel;
            const minPointsForLevel = getMinPointsForLevel(currentLevel);
            
            if (playerData.points > minPointsForLevel) {
                playerData.points -= 1;
                log.info(`${username}: ${comment} (mauvaise réponse - 1 point retiré, Points: ${playerData.points})`);
            } else {
                log.info(`${username}: ${comment} (mauvaise réponse - points déjà au minimum du niveau ${currentLevel}, Points: ${playerData.points})`);
            }
            
            // Mettre à jour le joueur dans Godot
            broadcastToGodot({
                type: "player_update",
                user: username,
                points: playerData.points,
                currentLevel: playerData.currentLevel
            });
        }
        return; // Ne pas traiter les réponses comme des commentaires normaux
    }
    
    // Si une question est en attente d'activation, créer le joueur s'il n'existe pas déjà
    if (questionWaitingForActivation && currentQuestion) {
        // Créer le joueur s'il n'existe pas déjà
        if (!players.has(username)) {
            log.player(`Nouveau joueur via commentaire (question en attente): ${username}`);
            
            // Utiliser exactement la même logique que les événements join/gift
            const profilePic = data.profilePictureUrl;
            
            players.set(username, {
                profilePic: profilePic,
                points: 0,
                currentLevel: 1,
                lastComment: Date.now()
            });
            
            // Déterminer le flag initial (wait car question en attente)
            const initialFlag = "wait";
            
            // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
            setTimeout(() => {
                // Vérifier si le joueur a déjà été envoyé à Godot
                if (hasPlayerBeenSentToGodot(username)) {
                    log.warning(`${username} déjà envoyé à Godot - ignoré`);
                    return;
                }
                
                broadcastToGodot({
                    type: "new_player",
                    user: username,
                    profilePic: profilePic,
                    points: 0,
                    currentLevel: 1,
                    initialFlag: initialFlag
                });
                
                // Marquer le joueur comme envoyé
                markPlayerAsSentToGodot(username);
                
                // Jouer un son de nouveau joueur
                playNewPlayerSound();
                
                log.info(`${username} a rejoint le jeu via commentaire (question en attente) - Flag initial: ${initialFlag}`);
            }, 2000); // 2 secondes de délai
        } else {
            const playerData = players.get(username);
            playerData.lastComment = Date.now();
        }
        
        // Vérifier si c'est une réponse valide (A, B, C) et l'ignorer pendant l'attente
        const normalizedComment = comment.toUpperCase().trim();
        if (['A', 'B', 'C'].includes(normalizedComment)) {
            log.info(`${username}: ${comment} (réponse ignorée - question en attente d'activation)`);
        } else {
            log.info(`${username}: ${comment} (commentaire ignoré - question en attente d'activation)`);
        }
        return; // Ne pas traiter comme des commentaires normaux
    }
    
    // Si pas de question active, créer le joueur s'il n'existe pas déjà
    if (!players.has(username)) {
        log.player(`Nouveau joueur via commentaire (entre deux quiz): ${username}`);
        
        // Utiliser exactement la même logique que les événements join/gift
        const profilePic = data.profilePictureUrl;
        
        players.set(username, {
            profilePic: profilePic,
            points: 0,
            currentLevel: 1,
            lastComment: Date.now()
        });
        
        // Déterminer le flag initial (wait car pas de question active)
        const initialFlag = "wait";
        
        // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
        setTimeout(() => {
            // Vérifier si le joueur a déjà été envoyé à Godot
            if (hasPlayerBeenSentToGodot(username)) {
                log.warning(`${username} déjà envoyé à Godot - ignoré`);
                return;
            }
            
            broadcastToGodot({
                type: "new_player",
                user: username,
                profilePic: profilePic,
                points: 0,
                currentLevel: 1,
                initialFlag: initialFlag
            });
            
            // Marquer le joueur comme envoyé
            markPlayerAsSentToGodot(username);
            
            // Jouer un son de nouveau joueur
            playNewPlayerSound();
            
            log.info(`${username} a rejoint le jeu via commentaire (entre deux quiz) - Flag initial: ${initialFlag}`);
        }, 2000); // 2 secondes de délai
    } else {
        const playerData = players.get(username);
        playerData.lastComment = Date.now();
        log.info(`${username}: ${comment} (commentaire ignoré - entre deux quiz)`);
    }
});

// Gestion des connexions WebSocket
wsServer.on('connection', socket => {
    log.system('Nouvelle connexion Godot');
    
    // Réinitialiser l'état du jeu pour la nouvelle connexion
    resetGameState();
    
    // Envoyer un message de début de match
    socket.send(JSON.stringify({
        type: "match_started"
    }));
});

// Gestion des déconnexions
wsServer.on('close', () => {
    log.warning('Connexion Godot fermée');
});

// Fonction pour gérer la fin du match
async function handleMatchEnd(winnerUsername, points) {
    matchEnded = true;
    winner = winnerUsername;
    log.success(`🏆 ${winnerUsername} a gagné le match!`);
    
    // Arrêter le cycle de questions
    stopQuestionCycle();
    
    // Récupérer les données du gagnant
    const winnerData = players.get(winnerUsername);
    
    // Trier les joueurs par points pour obtenir le top 3
    const sortedPlayers = Array.from(players.entries())
        .map(([username, data]) => ({
            user: username,
            points: data.points,
            profilePic: data.profilePic
        }))
        .sort((a, b) => b.points - a.points);
    
    // Trouver le deuxième et troisième joueur en ignorant le gagnant
    const secondPlace = sortedPlayers.find(p => p.user !== winnerUsername);
    const thirdPlace = sortedPlayers.find(p => p.user !== winnerUsername && p.user !== secondPlace?.user);
    
    log.info("📊 Top 3 joueurs:", {
        winner: winnerUsername,
        second: secondPlace?.user,
        third: thirdPlace?.user
    });
    
    // Envoyer les données du gagnant et du top 3
    broadcastToGodot({
        type: "match_ended",
        winner: winnerUsername,
        points: points,
        profilePic: winnerData ? winnerData.profilePic : "",
        user: winnerUsername,
        second_place: secondPlace || null,
        third_place: thirdPlace || null
    });

    // Announce the winner with TTS
    if (azureTTS) {
        try {
            log.system('🎤 Début de la lecture TTS du gagnant...');
            
            // Simple winner announcement (like questions do)
            const winnerAnnouncement = formatMessage(GAME_MESSAGES.winner.congratulations, { winner: winnerUsername, points: points });
            log.system(`🎤 Winner announcement text: "${winnerAnnouncement}"`);
            await azureTTS.speakText(winnerAnnouncement);
            log.success('✅ Winner announcement spoken aloud (Azure TTS).');
            
            // Wait a bit, then follow message
            await new Promise(resolve => setTimeout(resolve, 1000));
            const followMessage = formatMessage(GAME_MESSAGES.winner.follow, { winner: winnerUsername });
            log.system(`🎤 Follow message text: "${followMessage}"`);
            await azureTTS.speakText(followMessage);
            log.success('✅ Follow message spoken aloud (Azure TTS).');
            
            // Wait a bit, then thanks message
            await new Promise(resolve => setTimeout(resolve, 1000));
            const thanksMessage = GAME_MESSAGES.winner.thanks;
            log.system(`🎤 Thanks message text: "${thanksMessage}"`);
            await azureTTS.speakText(thanksMessage);
            log.success('✅ Thanks message spoken aloud (Azure TTS).');
            
            log.success('🎤 Tous les messages TTS du gagnant terminés');
            
        } catch (err) {
            log.error('❌ Azure TTS error: ' + err);
        }
    } else {
        log.error('❌ Azure TTS not available for winner announcement');
    }
    
    // Arrêter le test player si actif
    if (USE_TEST_PLAYER) {
        stopTestPlayer();
    }
    
    // Wait for winner announcement to finish, then let Godot control the restart timing
    log.system('⏳ Winner announcement finished - waiting for Godot to reconnect and restart...');
    
    // Don't automatically restart - let Godot control the timing
    // The server will reset when Godot reconnects via WebSocket
    log.system('🔄 Server ready for Godot reconnection - no automatic restart timer');
}

// Fonction pour démarrer le test player
function startTestPlayer() {
    if (testPlayerInterval) {
        clearInterval(testPlayerInterval);
    }
    
    const testPlayerUsername = "test-player";
    const testPlayerProfilePic = "https://p16-sign-useast2a.tiktokcdn.com/tos-useast2a-avt-0068-euttp/88bb481062c5534a774537485c4d9d96~tplv-tiktokx-cropcenter:100:100.webp?dr=10399&refresh_token=6effc9fa&x-expires=1750503600&x-signature=GTZ3DrDtwuoRPFqY%2Bc2Z4TBXOXw%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=fdd36af4&idc=no1a";
    
    // Créer le test player s'il n'existe pas
    if (!players.has(testPlayerUsername)) {
        players.set(testPlayerUsername, {
            profilePic: testPlayerProfilePic,
            points: 0,
            currentLevel: 1,
            lastComment: Date.now()
        });
        
        // Envoyer le message new_player avec un délai pour laisser le temps au client de charger l'image
        setTimeout(() => {
            broadcastToGodot({
                type: "new_player",
                user: testPlayerUsername,
                profilePic: testPlayerProfilePic,
                points: 0,
                currentLevel: 1
            });
        }, 2000); // 2 secondes de délai
    }
    
    // Démarrer l'intervalle pour envoyer des commentaires
    testPlayerInterval = setInterval(async () => {
        if (matchEnded) {
            stopTestPlayer();
            return;
        }
        
        const playerData = players.get(testPlayerUsername);
        if (playerData) {
            playerData.points += 1;
            playerData.lastComment = Date.now();
            
            // Vérifier si le joueur monte de niveau
            const newLevel = checkLevel(playerData.points);
            if (newLevel > playerData.currentLevel) {
                playerData.currentLevel = newLevel;
                log.success(`${testPlayerUsername} monte au niveau ${newLevel}! (${playerData.points} points)`);
                
                // Vérifier si le joueur a gagné (niveau 6)
                if (newLevel === 6) {
                    await handleMatchEnd(testPlayerUsername, playerData.points);
                    return;
                }
            }
            
            broadcastToGodot({
                type: "player_update",
                user: testPlayerUsername,
                points: playerData.points,
                currentLevel: playerData.currentLevel,
                profilePic: testPlayerProfilePic
            });
        }
    }, TEST_PLAYER_INTERVAL);
    
    log.success("Test player démarré");
}

// Fonction pour arrêter le test player
function stopTestPlayer() {
    if (testPlayerInterval) {
        clearInterval(testPlayerInterval);
        testPlayerInterval = null;
    }
}

// Initialize Azure TTS
(async () => {
    try {
        azureTTS = new AzureTTS();
        log.success('Azure TTS initialized and ready to speak!');
        
        // Initialize Encouragement Manager
        encouragementManager = new EncouragementManager();
        log.success('Encouragement Manager initialized and ready!');
        
        // Initialize Answer Announcement Manager
        answerAnnouncementManager = new AnswerAnnouncementManager();
        log.success('Answer Announcement Manager initialized and ready!');
        
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
});

// Add a command to reset cache stats
process.on('SIGUSR2', () => {
    unsplashCache.resetStats();
    console.log('📊 Cache statistics reset via signal');
});

// Add a command to check Unsplash account status
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

    // Add a seed based on cache key to get consistent results for the same query
    const seed = customCacheKey ? customCacheKey.hashCode() : query.toLowerCase().trim().hashCode();
    const baseUrl = `${UNSPLASH_API_URL}?query=${encodeURIComponent(query)}&orientation=landscape&w=800&h=600&seed=${seed}&client_id=PLACEHOLDER`;
    
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
    
    // Fallback: extract main nouns from the question
    const words = questionLower.split(' ');
    const importantWords = words.filter(word => 
        word.length > 3 && 
        !['which', 'what', 'where', 'when', 'that', 'this', 'with', 'from', 'have', 'been', 'will', 'can', 'the', 'and', 'for', 'are', 'was', 'has', 'had', 'not', 'but', 'they', 'have', 'this', 'with', 'his', 'her', 'its', 'out', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)
    );
    
    if (importantWords.length > 0) {
        return importantWords.slice(0, 2).join(' ');
    }
    
    // Ultimate fallback
    return 'abstract';
}