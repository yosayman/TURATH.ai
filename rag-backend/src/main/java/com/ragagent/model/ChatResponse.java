package com.ragagent.model;

/**
 * DTO for outgoing chat responses to the frontend.
 * Returns JSON: { "answer": "AI response text" }
 */
public class ChatResponse {

    private String answer;

    public ChatResponse() {}

    public ChatResponse(String answer) {
        this.answer = answer;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
