CREATE TABLE `reaction`
(
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '互动ID',
    `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '操作用户ID',
    `target_type`   VARCHAR(50)     NOT NULL COMMENT '目标类型：post / media_asset / comment_record / album',
    `target_id`     BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `reaction_type` VARCHAR(30)     NOT NULL DEFAULT 'like'
        COMMENT '互动类型：like点赞 / love爱心 / clap鼓掌 / wow惊喜',
    `status`        TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1有效 / 0取消',
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_reaction_user_target_type` (`user_id`, `target_type`, `target_id`, `reaction_type`),
    KEY `idx_reaction_target` (`target_type`, `target_id`),
    KEY `idx_reaction_user_id` (`user_id`),
    KEY `idx_reaction_type` (`reaction_type`),
    KEY `idx_reaction_status` (`status`),
    CONSTRAINT `fk_reaction_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用互动表';