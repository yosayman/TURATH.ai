package com.ragagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Service for calling the local LLM (Apple MLX server running
 * a LoRA-fine-tuned LLaMA 3.1 model).
 *
 * Uses the OpenAI-compatible /v1/chat/completions API format.
 * Modernized with Spring Boot 3.2+ RestClient.
 */
@Service
public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    @Value("${llm.url}")
    private String llmUrl;

    @Value("${llm.model}")
    private String modelName;

    @Value("${llm.max-tokens}")
    private int maxTokens;

    @Value("${llm.temperature}")
    private double temperature;

    public LlmService(RestClient restClient, ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
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
            requestBody.put("stream", false);

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

            log.debug("Calling LLM at: {}", llmUrl);
            log.debug("Model: {}, Max tokens: {}, Temperature: {}", modelName, maxTokens, temperature);
            log.debug("System prompt length: {} chars, User message: '{}'",
                    systemPrompt.length(), userMessage);

            // Make the POST request using RestClient (Spring 6.1+)
            String response = restClient.post()
                    .uri(llmUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsString(requestBody))
                    .retrieve()
                    .body(String.class);

            // Parse the response — extract the assistant's message content
            return parseResponse(response);

        } catch (ResourceAccessException e) {
            log.error("LLM connection failed (timeout or refused): {}", e.getMessage());
            // BUG-C FIX: Arabic Darija error message instead of French
            return "سمحلي، خدمة الذكاء الاصطناعي ما كاينة دابا. عاود المحاولة من فضلك.";
        } catch (Exception e) {
            log.error("LLM call failed: {}", e.getMessage(), e);
            // BUG-C FIX: Arabic Darija error message instead of French
            return "سمحلي، وقع مشكل فالنظام. عاود المحاولة من فضلك.";
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

            if (choices != null && choices.isArray() && !choices.isEmpty()) {
                JsonNode firstChoice = choices.get(0);
                JsonNode message = firstChoice.get("message");
                if (message != null && message.has("content")) {
                    String content = message.get("content").asText();
                    
                    // Clean up Llama 3.1 special tokens that leaked into the response
                    String cleanedContent = cleanLlamaTokens(content);
                    
                    log.info("LLM response received ({} chars)", cleanedContent.length());
                    return cleanedContent;
                }
            }

            log.warn("Unexpected LLM response format: {}", responseBody);
            // BUG-C FIX: Arabic Darija error message instead of French
            return "سمحلي، وقع مشكل فالجواب. عاود المحاولة من فضلك.";

        } catch (Exception e) {
            log.error("Failed to parse LLM response: {}", e.getMessage());
            // BUG-C FIX: Arabic Darija error message instead of French
            return "سمحلي، وقع مشكل فالنظام. عاود المحاولة من فضلك.";
        }
    }

    /**
     * Removes Llama 3.1 special tokens from the generated text.
     * These tokens are used internally but should not be visible to users.
     */
    private String cleanLlamaTokens(String text) {
        if (text == null) return "";
        
        return text
                .replaceAll("<\\|eot_id\\|>", "")
                .replaceAll("<\\|start_header_id\\|>", "")
                .replaceAll("<\\|end_header_id\\|>", "")
                .replaceAll("<\\|begin_of_text\\|>", "")
                .replaceAll("<\\|end_of_text\\|>", "")
                .trim();
    }
}
