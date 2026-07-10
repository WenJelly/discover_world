CREATE TABLE `album`
(
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '相册ID',
    `user_id`        BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID',
    `name`           VARCHAR(100)    NOT NULL COMMENT '相册名称',
    `description`    TEXT                     DEFAULT NULL COMMENT '相册描述',
    `cover_asset_id` BIGINT UNSIGNED          DEFAULT NULL COMMENT '相册封面媒体资源ID',
    `visibility`     VARCHAR(30)     NOT NULL DEFAULT 'public'
        COMMENT '可见性：public公开 / private私有 / followers粉丝可见 / unlisted不公开但可访问',
    `status`         VARCHAR(30)     NOT NULL DEFAULT 'active'
        COMMENT '状态：active正常 / hidden隐藏 / deleted已删除',
    `sort_order`     INT             NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
    `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at`     DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    KEY `idx_album_user_id` (`user_id`),
    KEY `idx_album_user_sort` (`user_id`, `sort_order`),
    KEY `idx_album_visibility` (`visibility`),
    KEY `idx_album_status` (`status`),
    KEY `idx_album_cover_asset_id` (`cover_asset_id`),
    CONSTRAINT `fk_album_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT,
    CONSTRAINT `fk_album_cover_asset`
        FOREIGN KEY (`cover_asset_id`) REFERENCES `media_asset` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='相册表';