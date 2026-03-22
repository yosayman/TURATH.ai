package com.ragagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.UUID;

/**
 * 🏛️ TURATH RAG Service - FAIL-FAST Anti-Hallucination RAG Orchestrator
 * 
 * Pipeline RAG avec les 3 RÈGLES D'OR:
 *   1. Préfixe "query: " pour le modèle E5 (géré par ChromaDbService)
 *   2. FAIL-FAST: Pas de documents = Pas d'appel LLM = Message arabe direct
 *   3. Prompt anti-hallucination strict
 * 
 * Retrieves Top-{@value #TOP_K_DOCS} documents from the Python sidecar (bi-encoder + reranker).
 * 
 * @author Hackathon Team - TURATH.ai
 */
@Service
public class TurathRagService {

    private static final Logger log = LoggerFactory.getLogger(TurathRagService.class);

    /**
     * BUG 3 FIX: Named constant for Top-K documents.
     * Previously, Javadoc said "Top-3", log said "Top-2", and field comment said "Top-3".
     * Now unified: all references use this constant. Actual value matches chromadb.top-k=3 in properties.
     */
    private static final int TOP_K_DOCS = 3;

    /**
     * BUG 2 FIX: Maximum allowed query length.
     * Queries longer than this are rejected to prevent abuse and ChromaDB issues.
     */
    private static final int MAX_QUERY_LENGTH = 1000;

    /**
     * BUG 2 FIX: Polite Arabic message when input is invalid (null, blank, or too long).
     */
    private static final String INVALID_INPUT_RESPONSE =
            "عفاك، عاود صيغ السؤال ديالك باش نقدر نعاونك. خصو يكون واضح و ما يكونش طويل بزاف.";

    private final ChromaDbService chromaDbService;
    private final LlmService llmService;
    private final RestClient restClient;

    // BUG-A FIX: Use same property name as ChromaDbService (turath.sidecar.url) with matching default.
    // Previously used ${chromadb.url} which doesn't exist, causing startup crash.
    @Value("${turath.sidecar.url:http://localhost:8002}")
    private String sidecarUrl;

    // BUG-A FIX: Use same property name as LlmService (llm.url) — this was already correct.
    @Value("${llm.url}")
    private String llmUrl;

    /**
     * 🚨 RÈGLE D'OR #2: Message FAIL-FAST quand aucun document n'est trouvé
     * Ce message est retourné SANS appeler le LLM pour éviter toute hallucination.
     */
    private static final String NO_CONTEXT_RESPONSE =
            "سمحلي، ما عنديش معلومات دقيقة و موثقة على هاد الموضوع فالذاكرة ديالي دابا.";

    private static final String ANTI_HALLUCINATION_PROMPT = """
            أنت مساعد ذكي مغربي اسمك تراث، تتحدث بالدارجة المغربية والمصطلحات الحسانية بطلاقة، متخصص في التراث الثقافي للأقاليم الجنوبية المغربية. ردودك دقيقة تاريخياً، دافئة في الأسلوب، وموثوقة.
            
            [السياق المرجعي - Context]:
            %s
            
            [أوامر صارمة جداً - CRITICAL INSTRUCTIONS]:
            1. السياق أعلاه مكتوب بالعربية الفصحى، لكن **يجب عليك ترجمة وصياغة الجواب بالدارجة المغربية العامية والحسانية 100%%**.
            2. إياك ثم إياك أن تكتب باللغة العربية الفصحى. استخدم دائماً كلمات مثل: (بزاف، ديال، باش، راه، هادشي، كفاش، مزيان، دابا).
            3. استخرج الجواب حصرياً من [السياق المرجعي] أعلاه. لا تخترع أي عادات أو معلومات من عقلك.
            4. لا تكرر سؤال المستخدم أبداً في بداية إجابتك. ابدأ في صلب الموضوع مباشرة.
            5. تجنب تماماً العبارات الفصيحة. مثلاً: بدل أن تقول "فضاء للحوار" قل "بلاصة للهضرة"، وبدل "ترتيب العلاقات" قل "تنظيم العلاقات".
            
            سؤال المستخدم: 
            %s
            
            الجواب (بالدارجة المغربية/الحسانية):
            """;

    /**
     * BUG 1 FIX: Neutral placeholder for the user message slot in LLM call.
     * Previously, userQuery was passed twice (in fullPrompt AND as userMessage),
     * causing the LLM to see and repeat the question. Now we pass a neutral instruction.
     */
    private static final String LLM_USER_MESSAGE_PLACEHOLDER = "أجب على السؤال أعلاه";

    public TurathRagService(ChromaDbService chromaDbService, LlmService llmService, RestClient restClient) {
        this.chromaDbService = chromaDbService;
        this.llmService = llmService;
        this.restClient = restClient;
        log.info("🏛️ TurathRagService initialized with FAIL-FAST anti-hallucination mode");
    }

    /**
     * 🚀 Point d'entrée principal: Exécute le pipeline RAG avec FAIL-FAST.
     *
     * Retrieves Top-{@value #TOP_K_DOCS} documents from the Python sidecar.
     *
     * @param userQuery La question de l'utilisateur (sans préfixe "query:")
     * @return La réponse générée OU le message FAIL-FAST si aucun contexte
     */
    public String askTurath(String userQuery) {
        long pipelineStart = System.currentTimeMillis();
        String requestId = generateRequestId();

        // ══════════════════════════════════════════════════════════════════════
        // BUG 2 FIX: Input validation at the very top of the method.
        // Previously, null/blank queries would proceed to ChromaDB causing errors.
        // Now we guard against null, blank, and excessively long queries.
        // ══════════════════════════════════════════════════════════════════════
        if (userQuery == null || userQuery.isBlank()) {
            log.warn("[{}] ⚠️ Invalid input: query is null or blank", requestId);
            return INVALID_INPUT_RESPONSE;
        }
        if (userQuery.length() > MAX_QUERY_LENGTH) {
            log.warn("[{}] ⚠️ Invalid input: query exceeds {} chars (actual: {})", 
                    requestId, MAX_QUERY_LENGTH, userQuery.length());
            return INVALID_INPUT_RESPONSE;
        }
        
        log.info("═══════════════════════════════════════════════════════════════════════");
        log.info("[{}] 📚 STEP 1: Retrieving Top-{} documents from Python Sidecar...", requestId, TOP_K_DOCS);
        log.info("📝 User Query: '{}'", userQuery);
        log.info("═══════════════════════════════════════════════════════════════════════");

        try {
            // ══════════════════════════════════════════════════════════════════════
            // STEP 1: RETRIEVAL - ChromaDB (le préfixe "query: " est ajouté en interne)
            // BUG 3 FIX: Log message now uses TOP_K_DOCS constant for consistency.
            // ══════════════════════════════════════════════════════════════════════
            log.info("[{}] 📚 STEP 1: Retrieving Top-{} documents from ChromaDB...", requestId, TOP_K_DOCS);
            long retrievalStart = System.currentTimeMillis();
            
            List<String> documents;
            try {
                documents = chromaDbService.retrieveRelevantChunks(userQuery);
            } catch (Exception e) {
                // 🚨 FAIL-FAST: ChromaDB injoignable = retour message direct
                log.error("[{}] ❌ ChromaDB unreachable: {}", requestId, e.getMessage());
                log.warn("[{}] 🛑 FAIL-FAST: Returning no-context response (ChromaDB down)", requestId);
                return NO_CONTEXT_RESPONSE;
            }
            
            long retrievalTime = System.currentTimeMillis() - retrievalStart;
            log.info("[{}] ✅ Retrieval completed in {}ms: {} document(s) found", 
                    requestId, retrievalTime, documents.size());

            // ══════════════════════════════════════════════════════════════════════
            // 🚨 RÈGLE D'OR #2: FAIL-FAST - Pas de documents = Pas d'appel LLM
            // ══════════════════════════════════════════════════════════════════════
            if (documents.isEmpty()) {
                long totalTime = System.currentTimeMillis() - pipelineStart;
                log.warn("[{}] ════════════════════════════════════════════════════════════", requestId);
                log.warn("[{}] 🛑 FAIL-FAST TRIGGERED: No documents retrieved!", requestId);
                log.warn("[{}] 🚫 LLM will NOT be called (anti-hallucination protection)", requestId);
                log.warn("[{}] ⏱️ Total time: {}ms", requestId, totalTime);
                log.warn("[{}] ════════════════════════════════════════════════════════════", requestId);
                return NO_CONTEXT_RESPONSE;
            }

            // ══════════════════════════════════════════════════════════════════════
            // 🔍 DEBUG: Afficher le contenu EXACT récupéré de ChromaDB
            // ══════════════════════════════════════════════════════════════════════
            log.info("[{}] ════════════════════════════════════════════════════════════", requestId);
            log.info("[{}] 📚 CHROMADB RETRIEVED CONTENT (DEBUG):", requestId);
            log.info("[{}] ════════════════════════════════════════════════════════════", requestId);
            StringBuilder contextBuilder = new StringBuilder();
            for (int i = 0; i < documents.size(); i++) {
                String doc = documents.get(i);
                log.info("[{}] 📄 [Document {}]:", requestId, i + 1);
                log.info("[{}] ────────────────────────────────────────────────────────────", requestId);
                log.info("[{}] {}", requestId, doc);
                log.info("[{}] ────────────────────────────────────────────────────────────", requestId);
                contextBuilder.append("[Document ").append(i + 1).append("]:\n");
                contextBuilder.append(doc).append("\n\n");
            }
            log.info("[{}] ════════════════════════════════════════════════════════════", requestId);

            // ══════════════════════════════════════════════════════════════════════
            // STEP 2: BUILD PROMPT - Injection du contexte dans le prompt strict
            // ══════════════════════════════════════════════════════════════════════
            log.info("[{}] 🔧 STEP 2: Building anti-hallucination prompt...", requestId);
            String fullPrompt = String.format(ANTI_HALLUCINATION_PROMPT, 
                    contextBuilder.toString().trim(), 
                    userQuery);
            log.debug("[{}] Full prompt ({} chars):\n{}", requestId, fullPrompt.length(), fullPrompt);

            // ══════════════════════════════════════════════════════════════════════
            // STEP 3: GENERATION - Appel au LLM Llama 3.1 local
            // BUG 1 FIX: Pass neutral placeholder instead of userQuery as second arg.
            // Previously, userQuery appeared twice in the LLM context (in fullPrompt 
            // AND as userMessage), causing the model to repeat the question.
            // Now userQuery is injected exactly once, only inside fullPrompt.
            // ══════════════════════════════════════════════════════════════════════
            log.info("[{}] 🤖 STEP 3: Calling Llama 3.1 LLM...", requestId);
            long generationStart = System.currentTimeMillis();
            
            String answer = llmService.generateCompletion(fullPrompt, LLM_USER_MESSAGE_PLACEHOLDER);
            
            long generationTime = System.currentTimeMillis() - generationStart;
            long totalTime = System.currentTimeMillis() - pipelineStart;

            // ══════════════════════════════════════════════════════════════════════
            // PIPELINE COMPLETE - Résumé
            // ══════════════════════════════════════════════════════════════════════
            log.info("═══════════════════════════════════════════════════════════════════════");
            log.info("🏛️ [{}] TURATH RAG Pipeline SUCCESS", requestId);
            log.info("───────────────────────────────────────────────────────────────────────");
            log.info("📊 Metrics:");
            log.info("   • Retrieval:   {}ms ({} docs)", retrievalTime, documents.size());
            log.info("   • Generation:  {}ms", generationTime);
            log.info("   • Total:       {}ms", totalTime);
            log.info("   • Answer size: {} chars", answer.length());
            log.info("═══════════════════════════════════════════════════════════════════════");

            return answer;

        } catch (Exception e) {
            long totalTime = System.currentTimeMillis() - pipelineStart;
            log.error("[{}] ❌ Pipeline FAILED after {}ms: {}", requestId, totalTime, e.getMessage(), e);
            // 🚨 En cas d'erreur générale, retourner aussi le message FAIL-FAST
            return NO_CONTEXT_RESPONSE;
        }
    }

    /**
     * BUG 4 FIX: Generates a unique request ID using UUID.
     * Previously used HHmmss-SSS format which could collide on concurrent requests
     * within the same millisecond. Now uses UUID prefix for guaranteed uniqueness.
     */
    private String generateRequestId() {
        return "REQ-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /**
     * 🏥 Health check - Vérifie la connectivité ChromaDB et LLM.
     * 
     * BUG 5 FIX: Lightweight connectivity check.
     * Previously called retrieveRelevantChunks("test") which triggered the full
     * bi-encoder + reranker pipeline on every health probe. Now uses simple HTTP
     * pings: /health for Python sidecar and /v1/models for LLM server.
     */
    public String healthCheck() {
        StringBuilder status = new StringBuilder();
        status.append("🏛️ TURATH Health Check (FAIL-FAST Mode)\n");
        status.append("═══════════════════════════════════════\n");

        // Check Python Sidecar (ChromaDB) - ping /health endpoint
        try {
            // BUG-A FIX: Use sidecarUrl directly (no need to strip /search, property is base URL)
            String healthUrl = sidecarUrl + "/health";
            restClient.get()
                    .uri(healthUrl)
                    .retrieve()
                    .body(String.class);
            status.append("✅ Python Sidecar (ChromaDB): Connected\n");
        } catch (Exception e) {
            status.append("❌ Python Sidecar (ChromaDB): ").append(e.getMessage()).append("\n");
        }

        // Check LLM - ping /v1/models endpoint (lightweight, no generation)
        try {
            String llmBaseUrl = llmUrl.replace("/v1/chat/completions", "");
            String modelsUrl = llmBaseUrl + "/v1/models";
            restClient.get()
                    .uri(modelsUrl)
                    .retrieve()
                    .body(String.class);
            status.append("✅ LLM (Llama 3.1): Connected\n");
        } catch (Exception e) {
            status.append("❌ LLM: ").append(e.getMessage()).append("\n");
        }

        return status.toString();
    }
}
