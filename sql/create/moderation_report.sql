CREATE TABLE `moderation_report`
(
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '举报ID',
    `reporter_user_id` BIGINT UNSIGNED NOT NULL COMMENT '举报用户ID',
    `target_type`      VARCHAR(50)     NOT NULL COMMENT '目标类型：post / comment_record',
    `target_id`        BIGINT UNSIGNED NOT NULL COMMENT '目标对象ID',
    `reason`           VARCHAR(80)     NOT NULL COMMENT '举报原因',
    `description`      TEXT                     DEFAULT NULL COMMENT '补充说明',
    `status`           VARCHAR(30)     NOT NULL DEFAULT 'open'
        COMMENT '状态：open待处理 / accepted已采纳 / rejected已驳回 / resolved已处理',
    `handler_user_id`  BIGINT UNSIGNED          DEFAULT NULL COMMENT '处理管理员用户ID',
    `resolution`       VARCHAR(30)              DEFAULT NULL COMMENT '处理结论：accepted / rejected / resolved',
    `resolution_note`  TEXT                     DEFAULT NULL COMMENT '处理说明',
    `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `resolved_at`      DATETIME                 DEFAULT NULL COMMENT '处理时间',
    PRIMARY KEY (`id`),
    KEY `idx_moderation_report_target` (`target_type`, `target_id`, `status`),
    KEY `idx_moderation_report_reporter` (`reporter_user_id`, `created_at`),
    KEY `idx_moderation_report_handler` (`handler_user_id`, `resolved_at`),
    KEY `idx_moderation_report_status_created` (`status`, `created_at`),
    CONSTRAINT `fk_moderation_report_reporter`
        FOREIGN KEY (`reporter_user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    ,
    CONSTRAINT `fk_moderation_report_handler`
        FOREIGN KEY (`handler_user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='内容举报表';

ALTER TABLE `moderation_report`
    ADD COLUMN `handler_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '处理管理员用户ID' AFTER `status`,
    ADD COLUMN `resolution` VARCHAR(30) DEFAULT NULL COMMENT '处理结论：accepted / rejected / resolved' AFTER `handler_user_id`,
    ADD COLUMN `resolution_note` TEXT DEFAULT NULL COMMENT '处理说明' AFTER `resolution`,
    ADD KEY `idx_moderation_report_handler` (`handler_user_id`, `resolved_at`);
