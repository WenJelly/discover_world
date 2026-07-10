CREATE TABLE `comment_record`
(
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论ID',
    `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '评论用户ID',
    `target_type` VARCHAR(50)     NOT NULL COMMENT '目标类型：post / media_asset / album',
    `target_id`   BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `parent_id`   BIGINT UNSIGNED          DEFAULT NULL COMMENT '父评论ID，用于回复',
    `root_id`     BIGINT UNSIGNED          DEFAULT NULL COMMENT '根评论ID，方便查询评论树',
    `content`     TEXT            NOT NULL COMMENT '评论内容',
    `status`      VARCHAR(30)     NOT NULL DEFAULT 'active'
        COMMENT '状态：active正常 / hidden隐藏 / deleted已删除',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at`  DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    KEY `idx_comment_target_created` (`target_type`, `target_id`, `created_at`),
    KEY `idx_comment_parent_id` (`parent_id`),
    KEY `idx_comment_root_id` (`root_id`),
    KEY `idx_comment_user_id` (`user_id`),
    KEY `idx_comment_status` (`status`),
    CONSTRAINT `fk_comment_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
    CONSTRAINT `fk_comment_parent`
        FOREIGN KEY (`parent_id`) REFERENCES `comment_record` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
    CONSTRAINT `fk_comment_root`
        FOREIGN KEY (`root_id`) REFERENCES `comment_record` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用评论表';