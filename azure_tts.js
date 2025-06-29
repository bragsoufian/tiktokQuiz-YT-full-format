// azure_tts.js
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");

const AZURE_KEY = "EAGD0VPvkiWuxEq2SqTsdQIhYkvXExvaQ6iJv2emwqiwWXMud80hJQQJ99BFACYeBjFXJ3w3AAAYACOGv5rJ";
const AZURE_REGION = "eastus";

async function speakAzure(text, voice = "en-US-JennyNeural", outputFile = "tts_output.ogg") {
    return new Promise((resolve, reject) => {
        const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
        
        // Set voice
        speechConfig.speechSynthesisVoiceName = voice;
        
        // Use OggOpus format - optimal for web/game applications
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.OggOpus;
        
        // Set optimal audio settings for game audio
        speechConfig.speechSynthesisSampleRate = 24000; // 24kHz - good balance of quality and file size
        
        // Configure SSML for better speech quality
        const ssml = `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="medium" pitch="medium" volume="medium">
                        ${text}
                    </prosody>
                </voice>
            </speak>
        `;

        const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFile);
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

        synthesizer.speakSsmlAsync(
            ssml,
            result => {
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    console.log(`Audio generated successfully: ${outputFile}`);
                    resolve(outputFile);
                } else {
                    console.error(`Speech synthesis failed: ${result.errorDetails}`);
                    reject(result.errorDetails);
                }
                synthesizer.close();
            },
            error => {
                console.error(`Speech synthesis error: ${error}`);
                synthesizer.close();
                reject(error);
            }
        );
    });
}

// Helper function to generate question audio with different voices
async function generateQuestionAudio(question, answer, questionNumber = 1) {
    const questionText = `Question ${questionNumber}: ${question}`;
    const answerText = `The answer is: ${answer}`;
    
    try {
        // Generate question audio with a clear voice
        await speakAzure(questionText, "en-US-JennyNeural", `question_${questionNumber}.ogg`);
        console.log(`Question ${questionNumber} audio generated`);
        
        // Generate answer audio with a different voice for variety
        await speakAzure(answerText, "en-US-GuyNeural", `answer_${questionNumber}.ogg`);
        console.log(`Answer ${questionNumber} audio generated`);
        
        return {
            question: `question_${questionNumber}.ogg`,
            answer: `answer_${questionNumber}.ogg`
        };
    } catch (error) {
        console.error(`Error generating audio for question ${questionNumber}:`, error);
        throw error;
    }
}

module.exports = { speakAzure, generateQuestionAudio }; 