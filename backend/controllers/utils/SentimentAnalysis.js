import { SentimentIntensityAnalyzer } from 'vader-sentiment';

class SentimentAnalysis {
    constructor(parameters) {

    }

    analyzeText = (text) => {
        const sentimentIntensity = SentimentIntensityAnalyzer.polarity_scores(text);
        return sentimentIntensity; // It gives compound, positive, neutral, and negative scores
    };

    mapToCustomCategory = (sentimentResult) => {
        const { neg, neu, pos, compound } = sentimentResult;

        if (compound < -0.5 && neg > 0.5) {
            return 'Frustrated'; // Strongly negative sentiment
        } else if (compound < 0 && neg > 0.3) {
            return 'Sad'; // Negative sentiment but not strongly frustrated
        } else if (compound > 0.5 && pos > 0.5) {
            return 'Happy'; // Strongly positive sentiment
        } else if (compound > 0 && pos > 0.3 && neu > 0.2) {
            return 'Blushing'; // Slightly positive or neutral, blushing-like sentiment
        } else if (compound > 0.3 && pos > 0.3 && neu < 0.4) {
            return 'Laughing'; // Positive sentiment, leaning towards laughter
        }

        return 'Neutral'; // Default fallback
    };

    performAnalysis = (text) => {
        const sentimentResult = this.analyzeText(text);
        const category = this.mapToCustomCategory(sentimentResult);
        return { category };
    };
}


export { SentimentAnalysis }