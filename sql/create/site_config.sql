CREATE TABLE `site_config`
(
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
    `config_key`   VARCHAR(100)    NOT NULL COMMENT '配置键，如 homepage_hero',
    `config_value` JSON            NULL COMMENT '配置值(JSON)，如 {"assetId":1,"focalX":50,"focalY":58}',
    `updated_by`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '最后修改管理员ID',
    `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_site_config_key` (`config_key`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='站点级配置表';