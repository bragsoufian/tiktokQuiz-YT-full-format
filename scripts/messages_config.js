// Messages Configuration
// Centralized storage for all game messages to avoid duplication

const GAME_MESSAGES = {
    winner: {
        thanks: "lets Keep going !",
        follow: "Don't forget to follow the winnner !",
        congratulations: "Congratulations! {winner} is our champion with {points} points!",
        followExtended: ""
    },
    encouragement: {
        general: "You're all winners for participating!",
        nextQuestion: "Next question coming up — get ready to type!",
        sharing: "Know someone who'd love this? Go ahead and send them the stream."
    },
    game: {
        ready: "Ready for the next question!",
        matchStart: "Let's start a new quiz!",
        matchEnd: "Quiz completed!"
    }
};

// Helper function to replace placeholders in messages
function formatMessage(message, replacements = {}) {
    let formattedMessage = message;
    for (const [key, value] of Object.entries(replacements)) {
        formattedMessage = formattedMessage.replace(`{${key}}`, value);
    }
    return formattedMessage;
}

module.exports = {
    GAME_MESSAGES,
    formatMessage
}; 