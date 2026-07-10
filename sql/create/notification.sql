CREATE TABLE `notification`
(
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知ID',
    `recipient_user_id` BIGINT UNSIGNED NOT NULL COMMENT '接收通知的用户ID',
    `actor_user_id`     BIGINT UNSIGNED          DEFAULT NULL COMMENT '触发通知的用户ID，系统通知可为空',
    `event_type`        VARCHAR(50)     NOT NULL COMMENT '事件类型：follow / post_comment / post_reaction / post_favorite / media_reaction / media_review',
    `target_type`       VARCHAR(50)     NOT NULL COMMENT '目标类型：user_account / post / media_asset',
    `target_id`         BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `title`             VARCHAR(120)    NOT NULL COMMENT '通知标题',
    `content`           TEXT                     DEFAULT NULL COMMENT '通知内容',
    `metadata_json`     JSON                     DEFAULT NULL COMMENT '扩展元数据',
    `read_at`           DATETIME                 DEFAULT NULL COMMENT '读取时间，NULL表示未读',
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_notification_recipient_id` (`recipient_user_id`, `id`),
    KEY `idx_notification_recipient_read` (`recipient_user_id`, `read_at`, `id`),
    KEY `idx_notification_target` (`target_type`, `target_id`),
    KEY `idx_notification_event` (`event_type`, `created_at`),
    CONSTRAINT `fk_notification_recipient`
        FOREIGN KEY (`recipient_user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
    CONSTRAINT `fk_notification_actor`
        FOREIGN KEY (`actor_user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='用户通知表';