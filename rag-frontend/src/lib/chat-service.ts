/**
 * Chat API Service
 * Handles communication with the Spring Boot RAG backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ApiResponse {
  answer: string;
}

/**
 * Sends a user message to the RAG backend and returns the AI response.
 *
 * @param query - The user's question
 * @returns The AI-generated answer string
 * @throws Error if the API call fails
 */
export async function sendMessage(query: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `API request failed (${response.status}): ${errorText}`
    );
  }

  const data: ApiResponse = await response.json();
  return data.answer;
}

/**
 * Generates a unique ID for messages.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
