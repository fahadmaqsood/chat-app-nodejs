import { SentimentIntensityAnalyzer } from 'vader-sentiment';

class SentimentAnalysis {
    // Scale mapping for mood categories
    moodScores = {
        sad: 0,         // Score for Sad
        unamused: 16,    // Score for Unamused
        neutral: 31,     // Score for Neutral
        calm: 46,        // Score for Calm
        happy: 61,       // Score for Happy
        laughing: 76,    // Score for Laughing
        rofl: 91         // Score for ROFL
    };

    constructor(parameters) {

    }

    analyzeText = (text) => {
        const sentimentIntensity = SentimentIntensityAnalyzer.polarity_scores(text);
        return sentimentIntensity; // It gives compound, positive, neutral, and negative scores
    };

    mapToCustomCategory = (sentimentResult) => {
        const { neg, neu, pos, compound } = sentimentResult;

        // Define thresholds for mood categories based on sentiment analysis
        if (compound < -0.5 && neg > 0.5) {
            return this.moodScores.sad;         // Return score for Sad
        } else if (compound < 0 && neg > 0.3) {
            return this.moodScores.unamused;     // Return score for Unamused
        } else if (compound > 0.5 && pos > 0.5) {
            return this.moodScores.happy;        // Return score for Happy
        } else if (compound > 0 && pos > 0.3 && neu > 0.2) {
            return this.moodScores.blushing;     // Return score for Blushing (if you want to keep it)
        } else if (compound > 0.3 && pos > 0.3 && neu < 0.4) {
            return this.moodScores.laughing;     // Return score for Laughing
        } else if (compound > 0.6 && pos > 0.5) {
            return this.moodScores.rofl;         // Return score for ROFL
        }

        return this.moodScores.neutral;         // Default fallback to Neutral
    };

    performAnalysis = (text) => {
        const sentimentResult = this.analyzeText(text);
        let category = this.mapToCustomCategory(sentimentResult);

        category = Object.keys(this.moodScores).find(key => this.moodScores[key] === category) || "neutral";

        return { category };
    };
}


export { SentimentAnalysis }