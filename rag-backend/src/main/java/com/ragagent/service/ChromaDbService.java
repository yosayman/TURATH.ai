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

import java.util.ArrayList;
import java.util.List;

/**
 * Service for interacting with a locally-running ChromaDB instance.
 *
 * ChromaDB REST API (v0.4+):
 *   POST /api/v1/collections/{collection_id}/query
 *
 * This service:
 *   1. Looks up the collection by name to get its ID.
 *   2. Sends the user query text for embedding + retrieval.
 *   3. Returns the top-K document chunks as a list of strings.
 */
@Service
public class ChromaDbService {

    private static final Logger log = LoggerFactory.getLogger(ChromaDbService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${chromadb.url}")
    private String chromaDbUrl;

    @Value("${chromadb.collection}")
    private String collectionName;

    @Value("${chromadb.top-k}")
    private int topK;

    public ChromaDbService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Retrieves the top-K most relevant document chunks from ChromaDB
     * based on the user's query text.
     *
     * @param queryText The user's natural language question
     * @return List of relevant document chunk strings
     */
    public List<String> retrieveRelevantChunks(String queryText) {
        try {
            // Step 1: Get the collection ID by name
            String collectionId = getCollectionId();
            if (collectionId == null) {
                log.warn("ChromaDB collection '{}' not found. Returning empty context.", collectionName);
                return List.of();
            }

            // Step 2: Query the collection with the user's text
            String queryUrl = chromaDbUrl + "/api/v1/collections/" + collectionId + "/query";

            // Build the query request body
            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode queryTexts = objectMapper.createArrayNode();
            queryTexts.add(queryText);
            requestBody.set("query_texts", queryTexts);
            requestBody.put("n_results", topK);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);

            log.debug("Querying ChromaDB: POST {} with query: '{}'", queryUrl, queryText);
            ResponseEntity<String> response = restTemplate.exchange(queryUrl, HttpMethod.POST, entity, String.class);

            // Step 3: Parse the response and extract document texts
            return parseDocuments(response.getBody());

        } catch (Exception e) {
            log.error("Failed to query ChromaDB: {}", e.getMessage(), e);
            // Return empty list on failure — the RAG pipeline will proceed without context
            return List.of();
        }
    }

    /**
     * Looks up the ChromaDB collection by name and returns its ID.
     */
    private String getCollectionId() {
        try {
            String url = chromaDbUrl + "/api/v1/collections";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            JsonNode collections = objectMapper.readTree(response.getBody());

            for (JsonNode collection : collections) {
                if (collectionName.equals(collection.get("name").asText())) {
                    return collection.get("id").asText();
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch ChromaDB collections: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Parses the ChromaDB query response to extract document texts.
     * Response format: { "documents": [["doc1", "doc2", ...]], ... }
     */
    private List<String> parseDocuments(String responseBody) {
        List<String> documents = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode documentsNode = root.get("documents");

            if (documentsNode != null && documentsNode.isArray() && documentsNode.size() > 0) {
                JsonNode firstResult = documentsNode.get(0);
                for (JsonNode doc : firstResult) {
                    documents.add(doc.asText());
                }
            }
            log.info("Retrieved {} document chunks from ChromaDB", documents.size());
        } catch (Exception e) {
            log.error("Failed to parse ChromaDB response: {}", e.getMessage());
        }
        return documents;
    }
}
