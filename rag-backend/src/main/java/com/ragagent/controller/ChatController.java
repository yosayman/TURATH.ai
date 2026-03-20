package com.ragagent.controller;

import com.ragagent.model.ChatRequest;
import com.ragagent.model.ChatResponse;
import com.ragagent.service.RagService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller for the Chat API.
 * Exposes POST /api/chat for the Next.js frontend.
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    private final RagService ragService;

    public ChatController(RagService ragService) {
        this.ragService = ragService;
    }

    /**
     * Accepts a user query and returns an AI-generated answer
     * using the full RAG pipeline (ChromaDB retrieval + LLM generation).
     *
     * @param request JSON payload with "query" field
     * @return JSON payload with "answer" field
     */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        // Validate input
        if (request.getQuery() == null || request.getQuery().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new ChatResponse("Error: query cannot be empty."));
        }

        // Execute RAG pipeline
        String answer = ragService.getAnswer(request.getQuery());
        return ResponseEntity.ok(new ChatResponse(answer));
    }
}
