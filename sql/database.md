> 数据库基础设置：
> 
> MySQL 8.x
> 
> 字符集：utf8mb4
> 
> 存储引擎：InnoDB


如果项目有数据库表结构的新增、修改、删除，需要在对应的 .sql 文件内进行补充

例如：
1. 新增 xxx 表，则新增 xxx.sql 文件，并在文件内写上对应的建表语句
2. 修改已有的表结构，则在对应的 .sql 文件内的最下方追加对应的 sql 语句

本次后台增强新增：
1. `sql/create/admin_operation_log.sql`：后台操作审计日志表
2. `sql/create/admin_role_policy.sql`：后台角色权限策略表
3. `sql/create/moderation_report.sql`：补充举报处理人、处理结论和处理说明字段

本次 IP 属地后端化新增：
1. `sql/create/content_ip_attribution.sql`：内容 IP 属地快照表，记录动态、媒体等内容在创建/上传时解析出的归属地、解析来源和 IP HMAC，不保存明文 IP。
2. 第一阶段不新增地域表；`ip2region` 使用离线 xdb 文件解析，库文件路径通过 `etc/application.yaml` 的 `IpGeo.Ip2Region.DBPath` / `IPv6DBPath` 配置。
3. 动态和论坛发布请求不接受用户填写地点；`post.location` 暂时保留用于兼容历史数据，新内容只展示服务端生成的 `ipRegion`。
