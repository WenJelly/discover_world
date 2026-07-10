CREATE TABLE `post`
(
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '动态ID',
    `user_id`    BIGINT UNSIGNED NOT NULL COMMENT '发布用户ID',
    `content`    TEXT                     DEFAULT NULL COMMENT '动态文本内容',
    `post_type`  VARCHAR(30)     NOT NULL DEFAULT 'daily'
        COMMENT '动态类型：daily日常动态 / travel_share旅游分享',
    `visibility` VARCHAR(30)     NOT NULL DEFAULT 'public'
        COMMENT '可见性：public公开 / private私有 / followers粉丝可见 / unlisted不公开但可访问',
    `status`     VARCHAR(30)     NOT NULL DEFAULT 'active'
        COMMENT '状态：active正常 / hidden隐藏 / deleted已删除 / pending待审核',
    `location`   VARCHAR(255)             DEFAULT NULL COMMENT '发布地点文本',
    `extra_json` JSON                     DEFAULT NULL COMMENT '扩展字段，如客户端信息、话题信息等',
    `is_pinned`  TINYINT         NOT NULL DEFAULT 0 COMMENT '是否置顶：1置顶 / 0不置顶',
    `pinned_at`  DATETIME                 DEFAULT NULL COMMENT '置顶时间，NULL表示未置顶',
    `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at` DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    KEY `idx_post_user_created` (`user_id`, `created_at`),
    KEY `idx_post_status_created` (`status`, `created_at`),
    KEY `idx_post_type_status_created` (`post_type`, `status`, `visibility`, `id`),
    KEY `idx_post_visibility` (`visibility`),
    KEY `idx_post_user_pinned` (`user_id`, `is_pinned`, `pinned_at`, `id`),
    CONSTRAINT `fk_post_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='用户动态表';