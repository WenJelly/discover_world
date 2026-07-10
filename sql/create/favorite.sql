CREATE TABLE `favorite`
(
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收藏ID',
    `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '收藏用户ID',
    `target_type` VARCHAR(50)     NOT NULL COMMENT '目标类型：post / media_asset / album',
    `target_id`   BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `status`      TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1收藏 / 0取消收藏',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_favorite_user_target` (`user_id`, `target_type`, `target_id`),
    KEY `idx_favorite_user_id` (`user_id`),
    KEY `idx_favorite_target` (`target_type`, `target_id`),
    KEY `idx_favorite_status` (`status`),
    CONSTRAINT `fk_favorite_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='通用收藏表';