package com.ragagent.model;

import com.fasterxml.jackson.annotation.JsonAlias;

/**
 * DTO for incoming chat requests from the frontend.
 * Accepts JSON: { "query": "..." } or { "question": "..." }
 */
public class ChatRequest {

    @JsonAlias({"question", "message"})
    private String query;

    public ChatRequest() {}

    public ChatRequest(String query) {
        this.query = query;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }
}
