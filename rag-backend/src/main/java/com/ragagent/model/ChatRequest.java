package com.ragagent.model;

/**
 * DTO for incoming chat requests from the frontend.
 * Expects JSON: { "query": "user question" }
 */
public class ChatRequest {

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
