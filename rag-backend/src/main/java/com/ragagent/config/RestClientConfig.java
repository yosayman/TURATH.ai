package com.ragagent.config;

import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Configuration for RestClient with appropriate timeouts.
 * LLM calls can take a while, so we set generous timeouts.
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient restClient() {
        // Configure timeouts: 10s connect, 120s read (LLM generation can be slow)
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(Duration.ofSeconds(10))
                .withReadTimeout(Duration.ofSeconds(120));

        ClientHttpRequestFactory factory = ClientHttpRequestFactories.get(settings);

        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }
}
