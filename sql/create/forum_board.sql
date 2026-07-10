CREATE TABLE `forum_board`
(
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '论坛分区ID',
    `slug`        VARCHAR(80)     NOT NULL COMMENT '分区唯一标识，适合URL使用',
    `name`        VARCHAR(100)    NOT NULL COMMENT '分区名称',
    `description` TEXT                     DEFAULT NULL COMMENT '分区说明',
    `status`      VARCHAR(30)     NOT NULL DEFAULT 'active'
        COMMENT '状态：active正常 / hidden隐藏 / deleted已删除',
    `sort_order`  INT             NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at`  DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_forum_board_slug` (`slug`),
    KEY `idx_forum_board_status_sort` (`status`, `sort_order`, `id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='论坛分区表';