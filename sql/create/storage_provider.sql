CREATE TABLE `storage_provider`
(
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '存储服务商ID',
    `code`          VARCHAR(50)     NOT NULL COMMENT '服务商编码，如 cos / oss / s3 / minio / local',
    `name`          VARCHAR(100)    NOT NULL COMMENT '服务商名称，如 腾讯云COS',
    `provider_type` VARCHAR(50)     NOT NULL COMMENT '服务商类型：cos / oss / s3 / minio / local',
    `endpoint`      VARCHAR(255)             DEFAULT NULL COMMENT '服务端点',
    `region`        VARCHAR(100)             DEFAULT NULL COMMENT '默认地域',
    `config_json`   JSON                     DEFAULT NULL COMMENT '非敏感配置，如 pathStyle、是否启用CDN等',
    `secret_ref`    VARCHAR(255)             DEFAULT NULL COMMENT '密钥引用，不建议直接存密钥明文',
    `status`        TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1启用 / 0禁用',
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_storage_provider_code` (`code`),
    KEY `idx_storage_provider_type` (`provider_type`),
    KEY `idx_storage_provider_status` (`status`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='存储服务商表';