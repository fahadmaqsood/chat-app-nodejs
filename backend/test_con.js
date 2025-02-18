
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

import { OpenAIEmbeddings } from "@langchain/openai";

import { ChromaClient } from 'chromadb';


const embeddingsProvider = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

const chroma = new ChromaClient({ path: "http://138.197.231.101:8000" });

const collection = await chroma.getOrCreateCollection({ name: "langchain" });

// console.log(await embeddingsProvider.embedQuery("شاعره سُندري اُتمچنداڻي ڪير هئي؟"));

let relevantDocs = [];
try {
    let message = "شاه عبدالطيف ڪهڙي قسم جي شائري ڪندو هو";
    let k = 5;
    const similarityThreshold = 0.25; // Adjust this value based on your needs

    if (message.split(" ").length < 5)
        k = 3  // Short query → fewer documents
    // else if (similarity_score < 0.7)
    //     k = 10  // Low confidence → fetch more documents

    const results = await collection.query({
        queryEmbeddings: await embeddingsProvider.embedQuery(message),
        nResults: k,
    });
    console.log(results);
    relevantDocs = results.metadatas[0]
        .map((metadata, index) => ({ metadata, document: results.documents[0][index], distance: results.distances[0][index] }))
        .filter(({ distance }) => distance <= similarityThreshold) // Exclude low similarity documents
        .map((metadata, index) => {
            const metadataText = Object.entries(metadata)
                .filter(([key]) => key !== "book_id") // Exclude book_id
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n");

            return `${metadataText}\nDocumentText: ${results.documents[0][index]}\n`;
        });
} catch (err) {
    console.error("Error retrieving from ChromaDB:", err);
}

console.log(relevantDocs.join("\n\n"));

// // Add relevant text to context
// if (relevantDocs.length > 0) {
//     chatMessages.push({
//         role: 'system',
//         content: `Here is some relevant information:\n\n${relevantDocs.join("\n\n")}`
//     });
// }

// console.log(chatMessages);



// const vectorstore = ChromaClient.fromExistingCollection(
//     new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
//     {
//         url: "http://localhost:8000/", // URL of the Chroma server
//         collectionName: "langchain",
//     }
// );