CREATE TABLE `admin_operation_log`
(
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '后台操作日志ID',
    `operator_user_id` BIGINT UNSIGNED NOT NULL COMMENT '操作管理员用户ID',
    `action`           VARCHAR(80)     NOT NULL COMMENT '操作类型',
    `target_type`      VARCHAR(50)     NOT NULL COMMENT '目标类型',
    `target_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '目标ID，0表示无单一目标',
    `reason`           VARCHAR(500)             DEFAULT NULL COMMENT '操作原因或备注',
    `before_json`      JSON                     DEFAULT NULL COMMENT '操作前快照',
    `after_json`       JSON                     DEFAULT NULL COMMENT '操作后快照',
    `metadata_json`    JSON                     DEFAULT NULL COMMENT '扩展元数据',
    `client_ip`        VARCHAR(64)              DEFAULT NULL COMMENT '操作来源IP',
    `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_admin_operation_operator_created` (`operator_user_id`, `created_at`),
    KEY `idx_admin_operation_target` (`target_type`, `target_id`, `created_at`),
    KEY `idx_admin_operation_action_created` (`action`, `created_at`),
    CONSTRAINT `fk_admin_operation_operator`
        FOREIGN KEY (`operator_user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='后台操作审计日志表';
