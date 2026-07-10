CREATE TABLE `media_variant_rule`
(
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '媒体版本规则ID',
    `code`           VARCHAR(50)     NOT NULL COMMENT '版本编码：thumbnail / preview / detail / avatar',
    `name`           VARCHAR(100)    NOT NULL COMMENT '版本名称',
    `media_type`     VARCHAR(30)     NOT NULL COMMENT '媒体类型：image / video',
    `provider_type`  VARCHAR(50)     NOT NULL COMMENT '存储服务类型：cos / oss / s3 / minio',
    `process_params` VARCHAR(500)    NOT NULL COMMENT '处理参数，如 imageMogr2/thumbnail/400x',
    `width`          INT UNSIGNED             DEFAULT NULL COMMENT '目标宽度',
    `height`         INT UNSIGNED             DEFAULT NULL COMMENT '目标高度',
    `status`         TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1启用 / 0禁用',
    `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_media_variant_code_provider_type` (`code`, `provider_type`, `media_type`),
    KEY `idx_media_variant_media_type` (`media_type`),
    KEY `idx_media_variant_provider_type` (`provider_type`),
    KEY `idx_media_variant_status` (`status`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='媒体版本规则表';