package com.ragagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * RAG (Retrieval-Augmented Generation) Service.
 *
 * Orchestrates the full RAG pipeline:
 *   1. Receives the user's query
 *   2. Retrieves relevant document chunks from ChromaDB
 *   3. Constructs a master prompt with context + Moroccan/Hassani persona
 *   4. Calls the local LLM for generation
 *   5. Returns the answer
 */
@Service
public class RagService {

    private static final Logger log = LoggerFactory.getLogger(RagService.class);

    private final ChromaDbService chromaDbService;
    private final LlmService llmService;

    /**
     * System prompt that enforces the Moroccan/Hassani cultural expert persona.
     * This is prepended to every LLM call.
     */
    private static final String SYSTEM_PERSONA = """
            You are a highly knowledgeable cultural expert specializing in Moroccan and Hassani \
            (Sahrawi) culture, history, traditions, language, and heritage. You have deep expertise in:

            - Moroccan history from ancient kingdoms to modern times
            - Hassani poetry (including Tebraa, Talhit, and Gaf)
            - Traditional Moroccan and Sahrawi music, dance, and art
            - Moroccan dialects including Darija and Hassaniya
            - Traditional cuisine, customs, ceremonies, and festivals
            - Geography, tribal structures, and social traditions of the Saharan regions
            - Islamic heritage and its influence on Moroccan/Hassani culture

            INSTRUCTIONS:
            - Always respond in a warm, respectful, and informative tone.
            - When relevant, include cultural context and historical background.
            - If the user asks in Arabic or Darija, respond in the same language.
            - Use the provided context documents to ground your answers in factual information.
            - If the context doesn't contain relevant information, use your general knowledge \
              but clearly indicate when you are doing so.
            - Format your responses with markdown for readability (headers, lists, bold text).
            """;

    public RagService(ChromaDbService chromaDbService, LlmService llmService) {
        this.chromaDbService = chromaDbService;
        this.llmService = llmService;
    }

    /**
     * Executes the full RAG pipeline for a given user query.
     *
     * @param userQuery The user's natural language question
     * @return The AI-generated answer string
     */
    public String getAnswer(String userQuery) {
        log.info("=== RAG Pipeline Started ===");
        log.info("User query: '{}'", userQuery);

        // -------------------------------------------------------
        // Step 1: Retrieve relevant document chunks from ChromaDB
        // -------------------------------------------------------
        log.info("Step 1: Retrieving context from ChromaDB...");
        List<String> relevantChunks = chromaDbService.retrieveRelevantChunks(userQuery);
        log.info("Retrieved {} context chunks", relevantChunks.size());

        // -------------------------------------------------------
        // Step 2: Construct the master prompt with context
        // -------------------------------------------------------
        log.info("Step 2: Constructing prompt...");
        String systemPrompt = buildSystemPrompt(relevantChunks);

        // -------------------------------------------------------
        // Step 3: Call the local LLM with the composed prompt
        // -------------------------------------------------------
        log.info("Step 3: Calling local LLM...");
        String answer = llmService.generateCompletion(systemPrompt, userQuery);

        log.info("=== RAG Pipeline Complete ===");
        return answer;
    }

    /**
     * Builds the full system prompt by combining the persona instructions
     * with the retrieved context from ChromaDB.
     *
     * @param contextChunks List of relevant document chunks
     * @return The complete system prompt string
     */
    private String buildSystemPrompt(List<String> contextChunks) {
        StringBuilder prompt = new StringBuilder(SYSTEM_PERSONA);

        if (!contextChunks.isEmpty()) {
            prompt.append("\n\n--- RETRIEVED CONTEXT FROM KNOWLEDGE BASE ---\n\n");

            for (int i = 0; i < contextChunks.size(); i++) {
                prompt.append(String.format("[Document %d]:\n%s\n\n", i + 1, contextChunks.get(i)));
            }

            prompt.append("--- END OF CONTEXT ---\n\n");
            prompt.append("Use the above context to inform your answer. ");
            prompt.append("Cite the document numbers when referencing specific information.");
        } else {
            prompt.append("\n\nNote: No relevant context was retrieved from the knowledge base. ");
            prompt.append("Answer based on your general knowledge about Moroccan and Hassani culture, ");
            prompt.append("and clearly indicate that your response is based on general knowledge.");
        }

        return prompt.toString();
    }
}
