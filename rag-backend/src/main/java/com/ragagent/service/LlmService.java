package com.ragagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Service for calling the local LLM (Apple MLX server running
 * a LoRA-fine-tuned LLaMA 3.1 model).
 *
 * Uses the OpenAI-compatible /v1/chat/completions API format.
 */
@Service
public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${llm.url}")
    private String llmUrl;

    @Value("${llm.model}")
    private String modelName;

    @Value("${llm.max-tokens}")
    private int maxTokens;

    @Value("${llm.temperature}")
    private double temperature;

    public LlmService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Sends the composed prompt (system + user messages) to the local LLM
     * and returns the generated text.
     *
     * @param systemPrompt The system prompt with persona + context
     * @param userMessage  The user's original question
     * @return The LLM's generated response text
     */
    public String generateCompletion(String systemPrompt, String userMessage) {
        try {
            // Build the request body in OpenAI chat/completions format
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", modelName);
            requestBody.put("max_tokens", maxTokens);
            requestBody.put("temperature", temperature);

            // Messages array: [system, user]
            ArrayNode messages = objectMapper.createArrayNode();

            ObjectNode systemMsg = objectMapper.createObjectNode();
            systemMsg.put("role", "system");
            systemMsg.put("content", systemPrompt);
            messages.add(systemMsg);

            ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");
            userMsg.put("content", userMessage);
            messages.add(userMsg);

            requestBody.set("messages", messages);

            // Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(
                    objectMapper.writeValueAsString(requestBody), headers
            );

            log.debug("Calling LLM at: {}", llmUrl);
            log.debug("System prompt length: {} chars, User message: '{}'",
                    systemPrompt.length(), userMessage);

            // Make the POST request
            ResponseEntity<String> response = restTemplate.exchange(
                    llmUrl, HttpMethod.POST, entity, String.class
            );

            // Parse the response — extract the assistant's message content
            return parseResponse(response.getBody());

        } catch (Exception e) {
            log.error("LLM call failed: {}", e.getMessage(), e);
            return "I'm sorry, I encountered an error while generating a response. " +
                   "Please check that the LLM server is running and try again.";
        }
    }

    /**
     * Parses the OpenAI-compatible chat completion response.
     * Expected format:
     * {
     *   "choices": [{
     *     "message": { "role": "assistant", "content": "..." }
     *   }]
     * }
     */
    private String parseResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode choices = root.get("choices");

            if (choices != null && choices.isArray() && choices.size() > 0) {
                JsonNode firstChoice = choices.get(0);
                JsonNode message = firstChoice.get("message");
                if (message != null && message.has("content")) {
                    String content = message.get("content").asText();
                    log.info("LLM response received ({} chars)", content.length());
                    return content;
                }
            }

            log.warn("Unexpected LLM response format: {}", responseBody);
            return "Received an unexpected response format from the LLM.";

        } catch (Exception e) {
            log.error("Failed to parse LLM response: {}", e.getMessage());
            return "Failed to parse the LLM response.";
        }
    }
}
