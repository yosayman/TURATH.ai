package com.ragagent.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ChromaDbService {

    private static final Logger log = LoggerFactory.getLogger(ChromaDbService.class);

    @Value("${turath.sidecar.url:http://localhost:8002}")
    private String sidecarUrl;

    @Value("${turath.sidecar.top-k:3}")
    private int defaultTopK;

    private final org.springframework.web.client.RestTemplate restTemplate;

    // ══════════════════════════════════════════════════════
    // DTOs
    // ══════════════════════════════════════════════════════
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DocumentResult(
            @JsonProperty("content")        String              content,
            @JsonProperty("distance")       double              distance,
            @JsonProperty("similarity")     double              similarity,
            @JsonProperty("reranker_score") double              rerankerScore,
            @JsonProperty("metadata")       Map<String, Object> metadata
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SearchResponse(
            @JsonProperty("query")          String               query,
            @JsonProperty("documents")      List<DocumentResult> documents,
            @JsonProperty("total_found")    int                  totalFound,
            @JsonProperty("filtered_count") int                  filteredCount,
            @JsonProperty("pipeline")       String               pipeline,
            @JsonProperty("timing")         Map<String, Object>  timing
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HealthResponse(
            @JsonProperty("status")             String  status,
            @JsonProperty("model_loaded")       boolean modelLoaded,
            @JsonProperty("reranker_loaded")    boolean rerankerLoaded,
            @JsonProperty("chromadb_connected") boolean chromadbConnected,
            @JsonProperty("device")             String  device,
            @JsonProperty("collection_count")   int     collectionCount
    ) {}

    // ══════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════
    public ChromaDbService(RestTemplateBuilder builder) {
        // Configure timeouts via SimpleClientHttpRequestFactory (Spring Boot compatible)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(60).toMillis());
        
        this.restTemplate = builder
                .requestFactory(() -> factory)
                .build();
        log.info("🔌 ChromaDbService initialized — Sidecar Pattern v2.0");
    }

    // ══════════════════════════════════════════════════════
    // MAIN METHODS
    // ══════════════════════════════════════════════════════
    public List<String> retrieveRelevantChunks(String userQuery) {
        return retrieveRelevantChunks(userQuery, defaultTopK);
    }

    public List<String> retrieveRelevantChunks(String userQuery, int topK) {
        long start = System.currentTimeMillis();

        String url = UriComponentsBuilder
                .fromHttpUrl(sidecarUrl + "/search")
                .queryParam("q",     userQuery)
                .queryParam("top_k", topK)
                .build()
                .toUriString();

        log.info("══════════════════════════════════════════════════════");
        log.info("🔍 ChromaDbService.retrieveRelevantChunks()");
        log.info("   Query  : '{}'", userQuery);
        log.info("   Top-K  : {}", topK);
        log.info("   URL    : {}", url);
        log.info("══════════════════════════════════════════════════════");

        try {
            SearchResponse response = restTemplate.getForObject(url, SearchResponse.class);

            if (response == null) {
                log.error("❌ Sidecar returned null for: '{}'", userQuery);
                return Collections.emptyList();
            }

            long latency = System.currentTimeMillis() - start;

            // ── Timing ─────────────────────────────────────────────
            if (response.timing() != null) {
                log.info("⏱️  Pipeline timing:");
                log.info("   Stage1 (Bi-Encoder) : {}ms", response.timing().get("stage1_ms"));
                log.info("   Stage2 (Reranker)   : {}ms", response.timing().get("stage2_ms"));
                log.info("   Total               : {}ms", response.timing().get("total_ms"));
            }
            log.info("🔀 Pipeline  : {}", response.pipeline());
            log.info("📊 Docs      : {}/{}", response.filteredCount(), response.totalFound());
            log.info("🌐 Round-trip: {}ms", latency);

            if (response.documents() == null || response.documents().isEmpty()) {
                log.warn("⚠️  0 documents returned for: '{}'", userQuery);
                return Collections.emptyList();
            }

            // ── Log each result — ✅ Java format ───────────────────
            for (int i = 0; i < response.documents().size(); i++) {
                DocumentResult doc = response.documents().get(i);

                String preview = doc.content() != null && doc.content().length() > 60
                        ? doc.content().substring(0, 60).replace("\n", " ")
                        : doc.content();

                String topic = (doc.metadata() != null && doc.metadata().get("topic") != null)
                        ? String.valueOf(doc.metadata().get("topic"))
                        : "N/A";

                log.info("   [{}] reranker={} | sim={} | topic={} | {}...",
                        i + 1,
                        String.format("%.3f", doc.rerankerScore()),  // ✅ Java format
                        String.format("%.3f", doc.similarity()),      // ✅ Java format
                        topic,
                        preview);
            }

            List<String> contents = response.documents().stream()
                    .map(DocumentResult::content)
                    .collect(Collectors.toList());

            log.info("📦 Returning {} doc(s) to TurathRagService", contents.size());
            return contents;

        } catch (ResourceAccessException e) {
            log.error("══════════════════════════════════════════════════════");
            log.error("❌ ML Sidecar UNREACHABLE: {}", sidecarUrl);
            log.error("   Fix: python rag_api.py (port 8002)");
            log.error("   Error: {}", e.getMessage());
            log.error("══════════════════════════════════════════════════════");
            return Collections.emptyList();

        } catch (RestClientException e) {
            log.error("❌ REST error: {}", e.getMessage(), e);
            return Collections.emptyList();

        } catch (Exception e) {
            log.error("❌ Unexpected error: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    // ══════════════════════════════════════════════════════
    // HEALTH CHECK
    // ══════════════════════════════════════════════════════
    public boolean isSidecarHealthy() {
        try {
            HealthResponse health = restTemplate.getForObject(
                    sidecarUrl + "/health", HealthResponse.class
            );
            if (health == null) return false;

            log.info("🏥 Sidecar Health:");
            log.info("   Status    : {}", health.status());
            log.info("   BiEncoder : {}", health.modelLoaded()       ? "✅" : "❌");
            log.info("   Reranker  : {}", health.rerankerLoaded()    ? "✅" : "❌");
            log.info("   ChromaDB  : {}", health.chromadbConnected() ? "✅" : "❌");
            log.info("   Device    : {}", health.device());
            log.info("   Docs      : {}", health.collectionCount());

            return "healthy".equals(health.status());

        } catch (Exception e) {
            log.error("❌ Health check failed: {}", e.getMessage());
            return false;
        }
    }

    // ══════════════════════════════════════════════════════
    // RELAXED RETRIEVAL
    // ══════════════════════════════════════════════════════
    public List<String> retrieveRelevantChunksRelaxed(String userQuery) {
        log.info("🔄 Relaxed mode — top_k={}", defaultTopK * 2);
        return retrieveRelevantChunks(userQuery, defaultTopK * 2);
    }
}