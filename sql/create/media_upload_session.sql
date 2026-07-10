CREATE TABLE `media_upload_session`
(
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '上传会话ID',
    `user_id`           BIGINT UNSIGNED NOT NULL COMMENT '上传用户ID',
    `asset_id`          BIGINT UNSIGNED          DEFAULT NULL COMMENT '关联媒体资源ID，可在上传完成后绑定',
    `provider_id`       BIGINT UNSIGNED          DEFAULT NULL COMMENT '存储服务商ID',
    `bucket_id`         BIGINT UNSIGNED          DEFAULT NULL COMMENT '存储桶ID',
    `upload_type`       VARCHAR(30)     NOT NULL DEFAULT 'direct'
        COMMENT '上传类型：direct直传 / multipart分片 / server_proxy服务端代理',
    `upload_id`         VARCHAR(255)             DEFAULT NULL COMMENT '对象存储分片上传ID',
    `object_key`        VARCHAR(500)    NOT NULL COMMENT '目标对象key',
    `original_filename` VARCHAR(255)             DEFAULT NULL COMMENT '原始文件名',
    `mime_type`         VARCHAR(100)             DEFAULT NULL COMMENT 'MIME类型',
    `file_size`         BIGINT UNSIGNED          DEFAULT NULL COMMENT '文件大小，单位字节',
    `status`            VARCHAR(30)     NOT NULL DEFAULT 'created'
        COMMENT '状态：created已创建 / uploading上传中 / completed已完成 / failed失败 / expired已过期',
    `expire_at`         DATETIME                 DEFAULT NULL COMMENT '上传凭证或会话过期时间',
    `callback_payload`  JSON                     DEFAULT NULL COMMENT '对象存储回调数据',
    `extra_json`        JSON                     DEFAULT NULL COMMENT '扩展字段',
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_media_upload_user_id` (`user_id`),
    KEY `idx_media_upload_asset_id` (`asset_id`),
    KEY `idx_media_upload_provider_id` (`provider_id`),
    KEY `idx_media_upload_bucket_id` (`bucket_id`),
    KEY `idx_media_upload_status` (`status`),
    KEY `idx_media_upload_object_key` (`object_key`),
    KEY `idx_media_upload_expire_at` (`expire_at`),
    CONSTRAINT `fk_media_upload_user`
        FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT,
    CONSTRAINT `fk_media_upload_asset`
        FOREIGN KEY (`asset_id`) REFERENCES `media_asset` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
    CONSTRAINT `fk_media_upload_provider`
        FOREIGN KEY (`provider_id`) REFERENCES `storage_provider` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
    CONSTRAINT `fk_media_upload_bucket`
        FOREIGN KEY (`bucket_id`) REFERENCES `storage_bucket` (`id`)
            ON UPDATE CASCADE
            ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='媒体上传会话表';