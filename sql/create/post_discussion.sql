CREATE TABLE `post_discussion`
(
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '论坛动态扩展ID',
    `post_id`          BIGINT UNSIGNED NOT NULL COMMENT '动态ID',
    `board_id`         BIGINT UNSIGNED NOT NULL COMMENT '论坛分区ID',
    `title`            VARCHAR(120)    NOT NULL COMMENT '论坛帖子标题',
    `status`           VARCHAR(30)     NOT NULL DEFAULT 'active'
        COMMENT '状态：active正常 / hidden隐藏 / deleted已删除',
    `is_locked`        TINYINT         NOT NULL DEFAULT 0 COMMENT '是否锁帖：1锁定 / 0未锁定',
    `is_board_pinned`  TINYINT         NOT NULL DEFAULT 0 COMMENT '是否在分区置顶：1置顶 / 0不置顶',
    `board_pinned_at`  DATETIME                 DEFAULT NULL COMMENT '分区置顶时间',
    `last_activity_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
    `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at`       DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_post_discussion_post_id` (`post_id`),
    KEY `idx_post_discussion_board_activity` (`board_id`, `status`, `is_board_pinned`, `board_pinned_at`,
                                              `last_activity_at`, `id`),
    KEY `idx_post_discussion_last_activity` (`last_activity_at`, `id`),
    CONSTRAINT `fk_post_discussion_post`
        FOREIGN KEY (`post_id`) REFERENCES `post` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
    CONSTRAINT `fk_post_discussion_board`
        FOREIGN KEY (`board_id`) REFERENCES `forum_board` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='论坛动态扩展表';