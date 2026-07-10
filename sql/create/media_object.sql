CREATE TABLE `media_object`
(
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '媒体对象ID',
    `asset_id`    BIGINT UNSIGNED NOT NULL COMMENT '媒体资源ID',
    `bucket_id`   BIGINT UNSIGNED NOT NULL COMMENT '存储桶ID',
    `object_role` VARCHAR(50)     NOT NULL DEFAULT 'original'
        COMMENT '对象角色：original原文件 / cover封面 / transcoded转码文件 / attachment附件',
    `object_key`  VARCHAR(500)    NOT NULL COMMENT '对象存储key，如 media/images/asset-1001/original.jpg',
    `storage_uri` VARCHAR(800)    NOT NULL COMMENT '统一存储URI，如 cos://bucket/key 或 s3://bucket/key',
    `mime_type`   VARCHAR(100)             DEFAULT NULL COMMENT 'MIME类型，如 image/jpeg、video/mp4',
    `file_ext`    VARCHAR(20)              DEFAULT NULL COMMENT '文件后缀，如 jpg / png / mp4 / webp',
    `file_size`   BIGINT UNSIGNED          DEFAULT NULL COMMENT '文件大小，单位字节',
    `width`       INT UNSIGNED             DEFAULT NULL COMMENT '图片/视频宽度',
    `height`      INT UNSIGNED             DEFAULT NULL COMMENT '图片/视频高度',
    `duration_ms` BIGINT UNSIGNED          DEFAULT NULL COMMENT '音视频时长，单位毫秒',
    `checksum`    VARCHAR(128)             DEFAULT NULL COMMENT '文件校验值，如 sha256/md5',
    `etag`        VARCHAR(255)             DEFAULT NULL COMMENT '对象存储返回的 ETag',
    `access_type` VARCHAR(30)     NOT NULL DEFAULT 'private'
        COMMENT '访问类型：public公开 / private私有',
    `status`      VARCHAR(30)     NOT NULL DEFAULT 'active'
        COMMENT '状态：active正常 / failed失败 / deleted已删除',
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_media_object_bucket_key` (`bucket_id`, `object_key`),
    KEY `idx_media_object_asset_id` (`asset_id`),
    KEY `idx_media_object_bucket_id` (`bucket_id`),
    KEY `idx_media_object_role` (`object_role`),
    KEY `idx_media_object_status` (`status`),
    KEY `idx_media_object_checksum` (`checksum`),
    CONSTRAINT `fk_media_object_asset`
        FOREIGN KEY (`asset_id`) REFERENCES `media_asset` (`id`)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
    CONSTRAINT `fk_media_object_bucket`
        FOREIGN KEY (`bucket_id`) REFERENCES `storage_bucket` (`id`)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='媒体资源对象表';