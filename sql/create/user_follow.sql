CREATE TABLE `user_follow`
(
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关注关系ID',
    `follower_id`  BIGINT UNSIGNED NOT NULL COMMENT '关注者用户ID',
    `following_id` BIGINT UNSIGNED NOT NULL COMMENT '被关注者用户ID',
    `status`       TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1关注 / 0取消关注',
    `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_follow_pair` (`follower_id`, `following_id`),
    KEY `idx_user_follow_follower_id` (`follower_id`),
    KEY `idx_user_follow_following_id` (`following_id`),
    KEY `idx_user_follow_status` (`status`),
    KEY `idx_user_follow_follower_status_id` (`follower_id`, `status`, `id`),
    KEY `idx_user_follow_following_status_id` (`following_id`, `status`, `id`),
    CONSTRAINT `fk_user_follow_follower`
        FOREIGN KEY (`follower_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
    CONSTRAINT `fk_user_follow_following`
        FOREIGN KEY (`following_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='用户关注表';