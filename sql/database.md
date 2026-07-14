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

本次媒体排名性能优化新增：
1. `sql/create/entity_ranking.sql`：新增通用预计算排名表，媒体热门和排名上升查询只读取 `hot_score` / `rising_score`，不再在候选行上重复扫描统计表。
2. 排名游标固定为 `(score DESC, target_id DESC)`；对应索引为 `idx_entity_ranking_hot (target_type, hot_score DESC, target_id DESC)` 和 `idx_entity_ranking_rising (target_type, rising_score DESC, target_id DESC)`。
3. 浏览、点赞、下载、审核、上传完成和删除事件会增量刷新单条媒体排名；服务启动后按 `Ranking.RefreshIntervalSeconds` 定时、按 `Ranking.BatchSize` 分批全量刷新，以覆盖时间衰减和 24/48 小时窗口自然变化。
4. 本文件仅标注结构变更；部署应用前需要单独执行 `sql/create/entity_ranking.sql`，本次代码修改不自动执行 DDL。
5. 压测与执行计划：使用 `sql/benchmark/media_ranking_explain.sql` 分别记录 1 万、10 万、100 万数据量下的 actual rows、临时表/filesort 和耗时；设置 `DISCOVER_WORLD_BENCHMARK_MYSQL_DSN` 后运行 `go test ./model -run '^$' -bench 'BenchmarkMediaRanking' -count=5` 记录基准耗时，并运行 `go test ./model -run TestMediaRankingP95 -v` 记录 200 次查询的 P95。
