CREATE TABLE `media_asset`
(
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '媒体资源ID',
    `owner_user_id`     BIGINT UNSIGNED NOT NULL COMMENT '上传者/所有者用户ID',
    `media_type`        VARCHAR(30)     NOT NULL COMMENT '媒体类型：image / video / audio / document',
    `asset_usage`       VARCHAR(30)     NOT NULL DEFAULT 'work'
        COMMENT '业务用途：work作品 / post动态附件 / avatar头像 / temp临时',
    `title`             VARCHAR(255)             DEFAULT NULL COMMENT '标题',
    `description`       TEXT                     DEFAULT NULL COMMENT '描述',
    `original_filename` VARCHAR(255)             DEFAULT NULL COMMENT '原始文件名',
    `visibility`        VARCHAR(30)     NOT NULL DEFAULT 'private'
        COMMENT '可见性：public公开 / private私有 / followers粉丝可见 / unlisted不公开但可访问',
    `status`            VARCHAR(30)     NOT NULL DEFAULT 'uploading'
        COMMENT '资源状态：uploading上传中 / processing处理中 / active正常 / failed失败 / deleted已删除',
    `audit_status`      VARCHAR(30)     NOT NULL DEFAULT 'pending'
        COMMENT '审核状态：pending待审核 / approved通过 / rejected拒绝',
    `metadata_json`     JSON                     DEFAULT NULL COMMENT '扩展元数据，如 EXIF、AI标签、拍摄设备、地点等',
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `deleted_at`        DATETIME                 DEFAULT NULL COMMENT '软删除时间',
    PRIMARY KEY (`id`),
    KEY `idx_media_asset_owner_user_id` (`owner_user_id`),
    KEY `idx_media_asset_media_type` (`media_type`),
    KEY `idx_media_asset_usage_public` (`asset_usage`, `status`, `visibility`, `audit_status`, `id`),
    KEY `idx_media_asset_visibility` (`visibility`),
    KEY `idx_media_asset_status` (`status`),
    KEY `idx_media_asset_audit_status` (`audit_status`),
    KEY `idx_media_asset_created_at` (`created_at`),
    CONSTRAINT `fk_media_asset_owner_user`
        FOREIGN KEY (`owner_user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='媒体资源信息表';