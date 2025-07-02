const fs = require('fs');
const path = require('path');

class AnswerAnnouncementManager {
    constructor() {
        this.announcements = [];
        this.settings = {};
        this.usedAnnouncements = new Set(); // Track used announcements to avoid repetition
        this.announcementsFile = path.join(__dirname, 'answer_announcements.json');
        this.loadAnnouncements();
    }

    loadAnnouncements() {
        try {
            const data = fs.readFileSync(this.announcementsFile, 'utf8');
            const jsonData = JSON.parse(data);
            this.announcements = jsonData.announcements || [];
            this.settings = jsonData.settings || {};
            console.log('✅ Answer announcements loaded:', this.announcements.length, 'announcements');
        } catch (error) {
            console.error('❌ Error loading answer announcements:', error.message);
            this.announcements = [];
            this.settings = {
                randomSelection: true,
                includeQuestionNumber: false
            };
        }
    }

    // Get a random announcement template
    getRandomAnnouncement() {
        if (this.announcements.length === 0) {
            return null;
        }

        // If we've used most announcements, reset the used set
        if (this.usedAnnouncements.size >= this.announcements.length * 0.8) {
            console.log('🔄 Resetting used answer announcements (most have been used)');
            this.usedAnnouncements.clear();
        }

        // Filter out recently used announcements
        const availableAnnouncements = this.announcements.filter(announcement => 
            !this.usedAnnouncements.has(announcement.id)
        );

        if (availableAnnouncements.length === 0) {
            // If all announcements have been used, reset and try again
            this.usedAnnouncements.clear();
            return this.getRandomAnnouncement();
        }

        // Select a random announcement
        const randomIndex = Math.floor(Math.random() * availableAnnouncements.length);
        const selectedAnnouncement = availableAnnouncements[randomIndex];
        
        // Mark as used
        this.usedAnnouncements.add(selectedAnnouncement.id);
        
        console.log('🎤 Selected answer announcement template:', selectedAnnouncement.text);
        return selectedAnnouncement;
    }

    // Generate the final announcement text with the correct answer
    generateAnnouncementText(correctAnswer, correctOptionText, questionNumber = null) {
        const announcement = this.getRandomAnnouncement();
        if (!announcement) {
            // Fallback if no announcements are available
            return `The correct answer is ${correctAnswer}: ${correctOptionText}`;
        }

        let text = announcement.text;
        
        // Replace placeholders
        text = text.replace('{letter}', correctAnswer);
        text = text.replace('{answer}', correctOptionText);
        
        // Add question number if enabled
        if (this.settings.includeQuestionNumber && questionNumber) {
            text = `Question ${questionNumber}: ${text}`;
        }

        console.log('🎤 Generated answer announcement:', text);
        return text;
    }

    // Get announcement by category
    getAnnouncementByCategory(category) {
        const categoryAnnouncements = this.announcements.filter(announcement => 
            announcement.category === category
        );
        if (categoryAnnouncements.length === 0) {
            return this.getRandomAnnouncement();
        }
        
        const randomIndex = Math.floor(Math.random() * categoryAnnouncements.length);
        return categoryAnnouncements[randomIndex];
    }

    // Reset used announcements (useful for new sessions)
    resetSession() {
        this.usedAnnouncements.clear();
        console.log('🔄 Answer announcement session reset');
    }

    // Get statistics
    getStats() {
        return {
            totalAnnouncements: this.announcements.length,
            usedAnnouncements: this.usedAnnouncements.size,
            availableAnnouncements: this.announcements.length - this.usedAnnouncements.size,
            categories: [...new Set(this.announcements.map(a => a.category))]
        };
    }

    // Add a new announcement (useful for dynamic content)
    addAnnouncement(text, category = 'general') {
        const newAnnouncement = {
            id: Date.now(), // Simple ID generation
            text: text,
            category: category
        };
        
        this.announcements.push(newAnnouncement);
        console.log('➕ Added new answer announcement:', text.substring(0, 50) + '...');
        return newAnnouncement;
    }

    // Save announcements back to file (if modified)
    saveAnnouncements() {
        try {
            const data = {
                announcements: this.announcements,
                settings: this.settings
            };
            fs.writeFileSync(this.announcementsFile, JSON.stringify(data, null, 2));
            console.log('💾 Answer announcements saved');
        } catch (error) {
            console.error('❌ Error saving answer announcements:', error.message);
        }
    }
}

module.exports = AnswerAnnouncementManager; 