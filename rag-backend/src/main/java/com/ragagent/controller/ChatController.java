package com.ragagent.controller;

import com.ragagent.model.ChatRequest;
import com.ragagent.model.ChatResponse;
import com.ragagent.service.TurathRagService; // 👈 هادي هي الكلاس الواعرة ديالنا
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller for the Chat API.
 * Exposes POST /api/chat for the Next.js frontend.
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    private final TurathRagService turathRagService; // 👈 بدلنا السمية

    // Injection de dépendance
    public ChatController(TurathRagService turathRagService) {
        this.turathRagService = turathRagService;
    }

    /**
     * Accepts a user query and returns an AI-generated answer
     * using the full RAG pipeline (ChromaDB retrieval + LLM generation).
     */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        // Validate input
        if (request.getQuery() == null || request.getQuery().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new ChatResponse("Error: query cannot be empty."));
        }

        // Execute the REAL RAG pipeline (Fail-Fast + Sandwich Prompt)
        String answer = turathRagService.askTurath(request.getQuery()); // 👈 عيطنا لـ askTurath

        return ResponseEntity.ok(new ChatResponse(answer));
    }
}