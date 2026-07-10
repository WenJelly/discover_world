CREATE TABLE `tag`
(
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '标签ID',
    `name`       VARCHAR(50)     NOT NULL COMMENT '标签名称',
    `slug`       VARCHAR(80)              DEFAULT NULL COMMENT '标签唯一标识，适合URL使用',
    `tag_type`   VARCHAR(30)     NOT NULL DEFAULT 'normal'
        COMMENT '标签类型：normal普通 / system系统 / ai机器生成 / topic话题',
    `status`     TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1启用 / 0禁用',
    `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tag_name` (`name`),
    UNIQUE KEY `uk_tag_slug` (`slug`),
    KEY `idx_tag_type` (`tag_type`),
    KEY `idx_tag_status` (`status`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='标签表';