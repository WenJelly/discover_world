CREATE TABLE `entity_ranking`
(
    `ranking_id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '排名记录ID',
    `target_type`      VARCHAR(50)      NOT NULL COMMENT '目标类型，当前使用 media_asset',
    `target_id`        BIGINT UNSIGNED  NOT NULL COMMENT '目标对象ID',
    `hot_score`        DOUBLE           NOT NULL DEFAULT 0 COMMENT '预计算热门分数',
    `rising_score`     DOUBLE           NOT NULL DEFAULT 0 COMMENT '预计算上升分数',
    `score_updated_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分数刷新时间',
    PRIMARY KEY (`ranking_id`),
    UNIQUE KEY `uk_entity_ranking_target` (`target_type`, `target_id`),
    KEY `idx_entity_ranking_hot` (`target_type`, `hot_score` DESC, `target_id` DESC),
    KEY `idx_entity_ranking_rising` (`target_type`, `rising_score` DESC, `target_id` DESC)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='实体预计算排名表';
