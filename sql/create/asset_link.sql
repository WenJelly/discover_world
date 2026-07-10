CREATE TABLE `asset_link`
(
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '媒体资源关联ID',
    `asset_id`   BIGINT UNSIGNED NOT NULL COMMENT '媒体资源ID',
    `owner_type` VARCHAR(50)     NOT NULL COMMENT '归属对象类型：post / album / user_profile 等',
    `owner_id`   BIGINT UNSIGNED NOT NULL COMMENT '归属对象ID',
    `link_role`  VARCHAR(50)     NOT NULL DEFAULT 'attachment'
        COMMENT '关联角色：attachment附件 / album_item相册项 / featured精选 / cover封面',
    `sort_order` INT             NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
    `status`     TINYINT         NOT NULL DEFAULT 1 COMMENT '状态：1有效 / 0无效',
    `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_asset_link_owner_asset_role` (`owner_type`, `owner_id`, `asset_id`, `link_role`),
    KEY `idx_asset_link_owner` (`owner_type`, `owner_id`),
    KEY `idx_asset_link_asset_id` (`asset_id`),
    KEY `idx_asset_link_role` (`link_role`),
    KEY `idx_asset_link_sort` (`owner_type`, `owner_id`, `sort_order`),
    CONSTRAINT `fk_asset_link_asset`
        FOREIGN KEY (`asset_id`) REFERENCES `media_asset` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='媒体资源关联表';