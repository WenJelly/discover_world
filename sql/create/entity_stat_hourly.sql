CREATE TABLE `entity_stat_hourly`
(
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '小时统计ID',
    `target_type`    VARCHAR(50)     NOT NULL COMMENT '目标类型：media_asset / post / album / comment_record / user_profile',
    `target_id`      BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `bucket_hour`    DATETIME        NOT NULL COMMENT '小时桶开始时间，例如 2026-07-07 15:00:00',
    `view_count`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该小时新增浏览数',
    `reaction_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该小时新增互动数，如点赞数',
    `favorite_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该小时新增收藏数',
    `comment_count`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该小时新增评论数',
    `share_count`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该小时新增分享数',
    `download_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '该小时新增下载数',
    `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_entity_stat_hourly_target_bucket` (`target_type`, `target_id`, `bucket_hour`),
    KEY `idx_entity_stat_hourly_target_time` (`target_type`, `target_id`, `bucket_hour`),
    KEY `idx_entity_stat_hourly_bucket_hour` (`bucket_hour`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用小时级统计表';