const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

//loochytv
//camyslive
//cross2crown
//tyrone
//cash4killz
//windpress
//valorantesports
const tiktokUsername = 'windpress';
const wsServer = new WebSocket.Server({ port: 8080 });

// Configuration du jeu
const QUESTION_TIMER = 5000; // 5 secondes par défaut
const ANSWER_DISPLAY_TIME = 3000; // 3 secondes pour voir la réponse
const READY_PAUSE_TIME = 4000; // 4 secondes de pause "Ready"
const GRACE_PERIOD = 2000; // 2 secondes de grâce pour les réponses tardives

// Définition des seuils pour chaque niveau
const LEVEL_THRESHOLDS = [
    2,    // Niveau 1 → 2
    4,    // Niveau 2 → 3
    6,    // Niveau 3 → 4
    7,    // Niveau 4 → 5
    8     // Niveau 5 → 6
];

// Configuration
const USE_TEST_PLAYER = false;  // Set to false to disable test player
const TEST_PLAYER_INTERVAL = 1000;  // 1 second interval

// État du match
let matchEnded = false;
let winner = null;

// État de la question
let questionActive = false;
let currentQuestion = null;
let questionTimer = null;
let playersAnsweredCurrentQuestion = new Set(); // Nouveau: tracker les joueurs qui ont répondu à la question actuelle

// Stockage des joueurs
const players = new Map();

// Variables pour le test player
let testPlayerInterval = null;
let commentCount = 0;
let restartTimeout = null;
let currentQuestionIndex = 0;

// Fonction pour les logs colorés avec timestamps
const log = {
    info: (msg) => console.log('\x1b[36m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ℹ️ ${msg}`),    // Cyan
    success: (msg) => console.log('\x1b[32m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ✅ ${msg}`),  // Vert
    warning: (msg) => console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ⚠️ ${msg}`),  // Jaune
    error: (msg) => console.log('\x1b[31m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ❌ ${msg}`),    // Rouge
    player: (msg) => console.log('\x1b[35m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 👤 ${msg}`),   // Magenta
    system: (msg) => console.log('\x1b[34m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] 🖥️ ${msg}`),   // Bleu
    question: (msg) => console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleTimeString()}] ❓ ${msg}`)   // Jaune pour les questions
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

// Fonction pour réinitialiser l'état du jeu
function resetGameState() {
    log.system('Réinitialisation de l\'état du jeu');
    players.clear();
    matchEnded = false;
    winner = null;
    questionActive = false;
    currentQuestion = null;
    currentQuestionIndex = 0;
    
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
}

// Fonction pour poser une nouvelle question
function askNewQuestion() {
    if (matchEnded || questionActive) {
        log.question(`Question non posée: matchEnded=${matchEnded}, questionActive=${questionActive}`);
        return;
    }
    
    // Sélectionner la question suivante
    currentQuestion = QUESTIONS[currentQuestionIndex % QUESTIONS.length];
    currentQuestionIndex++;
    
    questionActive = true;
    playersAnsweredCurrentQuestion.clear(); // Réinitialiser la liste des joueurs qui ont répondu
    
    log.question(`Nouvelle question: ${currentQuestion.question}`);
    log.question(`Options: A) ${currentQuestion.options[0]}, B) ${currentQuestion.options[1]}, C) ${currentQuestion.options[2]}, D) ${currentQuestion.options[3]}`);
    log.question(`Réponse correcte: ${currentQuestion.correctAnswer} - ${currentQuestion.options[parseInt(currentQuestion.correctAnswer.charCodeAt(0) - 65)]}`);
    
    // Envoyer la question à Godot
    const questionMessage = {
        type: "new_question",
        question: currentQuestion.question,
        options: currentQuestion.options,
        image: currentQuestion.image,
        timer: QUESTION_TIMER / 1000 // Convertir en secondes
    };
    
    log.question(`Envoi de la question à Godot: ${JSON.stringify(questionMessage)}`);
    broadcastToGodot(questionMessage);
    
    // Démarrer le timer
    questionTimer = setTimeout(() => {
        log.question(`Timer expiré pour la question: ${currentQuestion.question}. Début de la période de grâce de ${GRACE_PERIOD / 1000}s.`);
        
        // Attendre la fin de la période de grâce avant de terminer la question
        setTimeout(() => {
            log.question("Période de grâce terminée. Finalisation de la question.");
            endQuestion();
        }, GRACE_PERIOD);

    }, QUESTION_TIMER);
    
    log.question(`Timer démarré pour ${QUESTION_TIMER}ms`);
}

// Fonction pour terminer la question
function endQuestion() {
    if (!questionActive) return;
    
    questionActive = false;
    playersAnsweredCurrentQuestion.clear(); // Nettoyer la liste des joueurs qui ont répondu
    
    const correctOptionText = currentQuestion.options[parseInt(currentQuestion.correctAnswer.charCodeAt(0) - 65)];
    log.question(`Question terminée. Réponse correcte: ${currentQuestion.correctAnswer} - ${correctOptionText}`);
    
    // Envoyer la fin de question à Godot
    const endQuestionMessage = {
        type: "question_ended",
        correctAnswer: currentQuestion.correctAnswer,
        correctOption: correctOptionText
    };
    
    log.question(`Envoi de la fin de question à Godot: ${JSON.stringify(endQuestionMessage)}`);
    broadcastToGodot(endQuestionMessage);
    
    currentQuestion = null;
    
    // Programmer la prochaine question après 4 secondes de pause
    if (!matchEnded) {
        // Envoyer le message "ready" avec image
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
    
    // Accepter seulement A, B, C, D comme réponses valides
    if (!['A', 'B', 'C', 'D'].includes(normalizedAnswer)) {
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

// Gestion des messages du chat
tiktokLiveConnection.on('chat', data => {
    if (matchEnded) return;
    
    const username = data.uniqueId;
    const comment = data.comment.trim();
    
    // Si une question est active, traiter la réponse
    if (questionActive && currentQuestion) {
        // Créer le joueur s'il n'existe pas (peu importe la réponse)
        if (!players.has(username)) {
            log.player(`Nouveau joueur: ${username}`);
            players.set(username, {
                profilePic: data.profilePictureUrl,
                points: 0,
                currentLevel: 1,
                lastComment: Date.now()
            });
            
            broadcastToGodot({
                type: "new_player",
                user: username,
                profilePic: data.profilePictureUrl,
                points: 0,
                currentLevel: 1
            });
            
            log.info(`${username}: ${comment} (nouveau joueur créé - 0 points)`);
            return; // Ne pas donner de point au premier commentaire
        }
        
        // Vérifier si c'est une réponse valide (A, B, C, D)
        const normalizedComment = comment.toUpperCase().trim();
        if (!['A', 'B', 'C', 'D'].includes(normalizedComment)) {
            // Commentaire ignoré - pas une réponse valide
            log.info(`${username}: ${comment} (commentaire ignoré - pas A, B, C, D)`);
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
                
                // Vérifier si le joueur a gagné (niveau 6)
                if (newLevel === 6) {
                    matchEnded = true;
                    winner = username;
                    log.success(`🏆 ${username} a gagné le match!`);
                    stopQuestionCycle();
                    broadcastToGodot({
                        type: "match_ended",
                        winner: username,
                        points: playerData.points,
                        profilePic: playerData.profilePic
                    });
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
            // Mauvaise réponse - marquer comme ayant répondu mais pas de point
            playersAnsweredCurrentQuestion.add(username);
            
            // Envoyer l'animation de mauvaise réponse
            broadcastToGodot({
                type: "wrong_answer",
                user: username
            });
            
            const playerData = players.get(username);
            playerData.lastComment = Date.now();
            log.info(`${username}: ${comment} (mauvaise réponse - pas de point)`);
        }
        return; // Ne pas traiter les réponses comme des commentaires normaux
    }
    
    // Si pas de question active, créer le joueur avec 0 points
    if (!players.has(username)) {
        log.player(`Nouveau joueur (pas de question active): ${username}`);
        players.set(username, {
            profilePic: data.profilePictureUrl,
            points: 0,
            currentLevel: 1,
            lastComment: Date.now()
        });
        
        broadcastToGodot({
            type: "new_player",
            user: username,
            profilePic: data.profilePictureUrl,
            points: 0,
            currentLevel: 1
        });
        
        log.info(`${username}: ${comment} (nouveau joueur créé - pas de question active)`);
    } else {
        // Joueur existe déjà, juste mettre à jour le lastComment
        const playerData = players.get(username);
        playerData.lastComment = Date.now();
        log.info(`${username}: ${comment} (commentaire ignoré - pas de question active)`);
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
function handleMatchEnd(winnerUsername, points) {
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
    
    // Arrêter le test player si actif
    if (USE_TEST_PLAYER) {
        stopTestPlayer();
    }
    
    // Réinitialiser le match après 10 secondes
    if (restartTimeout) {
        clearTimeout(restartTimeout);
    }
    restartTimeout = setTimeout(() => {
        resetGameState();
        // Redémarrer le test player si actif
        if (USE_TEST_PLAYER) {
            startTestPlayer();
        }
        // Envoyer un message de début de match pour fermer la popup
        broadcastToGodot({
            type: "match_started"
        });
    }, 10000); // 10 secondes
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
        
        broadcastToGodot({
            type: "new_player",
            user: testPlayerUsername,
            profilePic: testPlayerProfilePic,
            points: 0,
            currentLevel: 1
        });
    }
    
    // Démarrer l'intervalle pour envoyer des commentaires
    testPlayerInterval = setInterval(() => {
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
                    handleMatchEnd(testPlayerUsername, playerData.points);
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