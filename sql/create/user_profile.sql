CREATE TABLE `user_profile`
(
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户资料ID',
    `user_id`         BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `nickname`        VARCHAR(100)             DEFAULT NULL COMMENT '昵称',
    `avatar_asset_id` BIGINT UNSIGNED          DEFAULT NULL COMMENT '头像媒体资源ID',
    `bio`             TEXT                     DEFAULT NULL COMMENT '个人简介',
    `gender`          VARCHAR(30)              DEFAULT NULL COMMENT '性别，可选：male / female / unknown',
    `birthday`        DATE                     DEFAULT NULL COMMENT '生日',
    `location`        VARCHAR(100)             DEFAULT NULL COMMENT '所在地',
    `badge_json`      JSON                     DEFAULT NULL COMMENT '徽章、成就、称号等',
    `extra_json`      JSON                     DEFAULT NULL COMMENT '扩展资料',
    `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_profile_user_id` (`user_id`),
    KEY `idx_user_profile_avatar_asset_id` (`avatar_asset_id`),
    CONSTRAINT `fk_user_profile_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
    CONSTRAINT `fk_user_profile_avatar_asset`
        FOREIGN KEY (`avatar_asset_id`) REFERENCES `media_asset` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='用户资料表';