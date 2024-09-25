import { SentimentIntensityAnalyzer } from 'vader-sentiment';

class SentimentAnalysis {
    // Scale mapping for mood categories
    moodScores = {
        Sad: 15,         // Score for Sad
        Unamused: 30,    // Score for Unamused
        Neutral: 45,     // Score for Neutral
        Calm: 60,        // Score for Calm
        Happy: 75,       // Score for Happy
        Laughing: 85,    // Score for Laughing
        ROFL: 90         // Score for ROFL
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
            return this.moodScores.Sad;         // Return score for Sad
        } else if (compound < 0 && neg > 0.3) {
            return this.moodScores.Unamused;     // Return score for Unamused
        } else if (compound > 0.5 && pos > 0.5) {
            return this.moodScores.Happy;        // Return score for Happy
        } else if (compound > 0 && pos > 0.3 && neu > 0.2) {
            return this.moodScores.Blushing;     // Return score for Blushing (if you want to keep it)
        } else if (compound > 0.3 && pos > 0.3 && neu < 0.4) {
            return this.moodScores.Laughing;     // Return score for Laughing
        } else if (compound > 0.6 && pos > 0.5) {
            return this.moodScores.ROFL;         // Return score for ROFL
        }

        return this.moodScores.Neutral;         // Default fallback to Neutral
    };

    performAnalysis = (text) => {
        const sentimentResult = this.analyzeText(text);
        let category = this.mapToCustomCategory(sentimentResult);

        category = Object.keys(this.moodScores).find(key => this.moodScores[key] === category) || "Neutral";

        return { category };
    };
}


export { SentimentAnalysis }