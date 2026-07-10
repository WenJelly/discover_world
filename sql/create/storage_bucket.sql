CREATE TABLE `storage_bucket`
(
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '存储桶ID',

    `provider_id`   BIGINT UNSIGNED NOT NULL COMMENT '存储服务商ID',

    `bucket_name`   VARCHAR(255)    NOT NULL COMMENT '桶名称',
    `bucket_region` VARCHAR(100)             DEFAULT NULL COMMENT '桶所在地域',
    `endpoint`      VARCHAR(255)             DEFAULT NULL COMMENT '桶访问端点',
    `cdn_domain`    VARCHAR(255)             DEFAULT NULL COMMENT 'CDN域名',
    `base_path`     VARCHAR(255)             DEFAULT NULL COMMENT '基础路径，如 media/images',
    `access_type`   VARCHAR(30)     NOT NULL DEFAULT 'private'
        COMMENT '访问类型：public公开 / private私有',
    `usage_type`    VARCHAR(50)     NOT NULL DEFAULT 'media'
        COMMENT '用途：media普通媒体 / avatar头像 / video视频 / temp临时 / backup备份',
    `is_default`    TINYINT         NOT NULL DEFAULT 0 COMMENT '是否默认桶：1是 / 0否',
    `status`        TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1启用 / 0禁用',
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    KEY `idx_storage_bucket_provider_id` (`provider_id`),
    KEY `idx_storage_bucket_usage_type` (`usage_type`),
    KEY `idx_storage_bucket_access_type` (`access_type`),
    KEY `idx_storage_bucket_status` (`status`),
    UNIQUE KEY `uk_storage_bucket_provider_bucket` (`provider_id`, `bucket_name`),

    CONSTRAINT `fk_storage_bucket_provider`
        FOREIGN KEY (`provider_id`) REFERENCES `storage_provider` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='存储桶表';