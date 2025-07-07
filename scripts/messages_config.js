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
        general: "",
        nextQuestion: "",
        sharing: ""
    },
    game: {
        ready: "",
        matchStart: "",
        matchEnd: ""
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