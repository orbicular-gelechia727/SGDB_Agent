# 生产级数据库方案推荐

## 概述

本报告为 SCGB 平台推荐生产环境数据库方案，评估不同数据库技术栈的适用性，并提供详细的迁移和部署建议。

---

## 1. 需求分析

### 1.1 当前数据规模

| 指标 | 当前值 | 年增长预估 |
|------|--------|-----------|
| 样本数 | 756,579 | +50% / 年 |
| 项目数 | 23,123 | +30% / 年 |
| 细胞类型注释 | 378,029 | +60% / 年 |
| 本体术语 | 113,000 | +10% / 年 |
| 数据库存储 | 1.4 GB | +100% / 年 |

### 1.2 查询负载特征

| 查询类型 | QPS 预估 | 延迟要求 | 占比 |
|----------|---------|---------|------|
| 简单搜索 | 50-100 | <100ms | 60% |
| 本体解析 | 20-30 | <50ms | 20% |
| 统计查询 | 5-10 | <500ms | 10% |
| 复杂分析 | 1-5 | <2s | 10% |

### 1.3 关键需求

- **并发支持**: 50+ 并发连接
- **全文检索**: 支持模糊匹配和语义搜索
- **JSON 支持**: 灵活存储非结构化元数据
- **扩展性**: 支持未来 1000 万+ 样本
- **高可用**: 99.9% 可用性

---

## 2. 数据库方案对比

### 2.1 方案概览

| 方案 | 主数据库 | 搜索引擎 | 缓存 | 适用场景 |
|------|---------|---------|------|---------|
| A | PostgreSQL | PostgreSQL FTS | Redis | 中小规模 |
| B | PostgreSQL | Elasticsearch | Redis | 大规模 |
| C | MySQL 8 | Meilisearch | Redis | 兼容性优先 |
| D | Cloud Native | Cloud Search | Cloud Cache | 全托管 |

### 2.2 方案 A: PostgreSQL + FTS (推荐)

**架构**:
```
┌─────────────────────────────────────────────────────────────┐
│  Application Layer (FastAPI + React)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Connection Pool (PgBouncer)                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (Primary)                                    │
│  ├── unified_metadata (主库)                                │
│  ├── ontology_cache (本体缓存)                              │
│  └── memory_store (会话记忆)                                │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  pg_trgm       │ │  pg_search     │ │  Redis         │
│  (模糊匹配)    │ │  (BM25 全文)   │ │  (热点缓存)    │
└────────────────┘ └────────────────┘ └────────────────┘
```

**配置建议**:
```sql
-- postgresql.conf 优化
shared_buffers = 4GB                          # 25% RAM
effective_cache_size = 12GB                   # 75% RAM
work_mem = 256MB                              # 复杂查询
maintenance_work_mem = 1GB                    # 索引构建
max_connections = 100                         # 连接数
random_page_cost = 1.1                        # SSD 优化
default_statistics_target = 1000              # 统计信息

-- 启用扩展
CREATE EXTENSION pg_trgm;                     -- 模糊匹配
CREATE EXTENSION btree_gin;                   -- GIN 索引
CREATE EXTENSION pg_search;                   -- BM25 全文 ( ParadeDB )
```

**Schema 迁移**:
```sql
-- 主键改为 BIGSERIAL
CREATE TABLE unified_projects (
    pk BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL,
    -- ...
);

-- GIN 索引替代 FTS5
CREATE INDEX idx_samples_metadata_gin ON unified_samples 
    USING GIN (raw_metadata jsonb_path_ops);

-- 全文搜索配置
CREATE INDEX idx_samples_tissue_trgm ON unified_samples 
    USING GIN (tissue gin_trgm_ops);
```

**优势**:
- 单一技术栈，运维简单
- ACID 事务保证数据一致性
- JSONB 支持灵活元数据
- 丰富的索引类型

**劣势**:
- 全文搜索性能不如 Elasticsearch
- 大规模数据需要分表/分库

**评分**: ⭐⭐⭐⭐⭐ (5/5) - **推荐方案**

---

### 2.3 方案 B: PostgreSQL + Elasticsearch

**架构**:
```
┌─────────────────────────────────────────────────────────────┐
│  Application Layer                                          │
└─────────────────────────────────────────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐  ┌──────────────────────────────┐
│  PostgreSQL         │  │  Elasticsearch Cluster       │
│  (结构化数据)       │  │  ├── samples_index           │
│  └── 关系查询       │  │  ├── projects_index          │
└─────────────────────┘  │  └── ontology_index          │
                         │      (全文 + 聚合)           │
                         └──────────────────────────────┘
```

**适用场景**:
- 搜索查询占主导 (>70%)
- 需要复杂聚合分析
- 团队有 Elasticsearch 运维经验

**评分**: ⭐⭐⭐⭐☆ (4/5)

---

### 2.4 方案 C: MySQL 8 + Meilisearch

**适用场景**:
- 已有 MySQL 生态
- 需要简单全文搜索

**劣势**:
- JSON 支持不如 PostgreSQL
- 扩展生态较少

**评分**: ⭐⭐⭐☆☆ (3/5) - **不推荐**

---

### 2.5 方案 D: 云原生 (AWS/GCP/Azure)

**AWS 方案**:
```
┌─────────────────────────────────────────────────────────────┐
│  Amazon RDS PostgreSQL (Multi-AZ)                           │
│  └── 主库 + 只读副本                                        │
├─────────────────────────────────────────────────────────────┤
│  Amazon OpenSearch (Elasticsearch)                          │
│  └── 全文搜索 + 日志分析                                    │
├─────────────────────────────────────────────────────────────┤
│  Amazon ElastiCache (Redis)                                 │
│  └── 会话缓存 + 热点数据                                    │
└─────────────────────────────────────────────────────────────┘
```

**适用场景**:
- 无专职 DBA
- 快速上线需求
- 弹性扩展需求

**成本预估**: $500-2000/月 (视规模)

**评分**: ⭐⭐⭐⭐☆ (4/5)

---

## 3. 详细推荐方案 (方案 A)

### 3.1 数据库选型

**主数据库**: PostgreSQL 16

**选择理由**:
1. **ACID 事务**: 数据一致性保证
2. **JSONB 支持**: 灵活元数据存储
3. **丰富索引**: B-tree, GIN, GiST, BRIN
4. **扩展生态**: PostGIS, pg_trgm, TimescaleDB
5. **成熟稳定**: 30 年发展历史

### 3.2 扩展选择

| 扩展 | 用途 | 版本要求 |
|------|------|---------|
| pg_trgm | 模糊匹配/相似度 | 9.1+ |
| btree_gin | GIN 索引支持 | 9.4+ |
| btree_gist | GiST 索引支持 | 9.4+ |
| pg_stat_statements | 查询统计 | 8.4+ |
| pg_search (ParadeDB) | BM25 全文搜索 | 14+ |

### 3.3 物理设计

```sql
-- 表空间设计 (大表分离)
CREATE TABLESPACE fast_ts LOCATION '/ssd/postgresql/fast';
CREATE TABLESPACE slow_ts LOCATION '/hdd/postgresql/slow';

-- 主表放在快速存储
CREATE TABLE unified_samples (...) TABLESPACE fast_ts;

-- 历史/日志表放在慢速存储
CREATE TABLE etl_run_log (...) TABLESPACE slow_ts;
```

### 3.4 索引策略

```sql
-- 主键和唯一索引
ALTER TABLE unified_projects ADD CONSTRAINT pk_projects PRIMARY KEY (pk);
ALTER TABLE unified_projects ADD CONSTRAINT uq_project_source 
    UNIQUE (project_id, source_database);

-- B-tree 索引 (等值/范围查询)
CREATE INDEX idx_samples_source ON unified_samples(source_database);
CREATE INDEX idx_samples_tissue ON unified_samples(tissue);
CREATE INDEX idx_samples_disease ON unified_samples(disease);
CREATE INDEX idx_samples_identity_hash ON unified_samples(biological_identity_hash);

-- 复合索引 (Faceted 搜索)
CREATE INDEX idx_samples_faceted ON unified_samples(
    source_database, 
    organism, 
    tissue, 
    disease
);

-- GIN 索引 (JSON 查询)
CREATE INDEX idx_samples_raw_metadata ON unified_samples 
    USING GIN (raw_metadata jsonb_path_ops);

-- GiST 索引 (全文/相似度)
CREATE INDEX idx_samples_tissue_trgm ON unified_samples 
    USING GIN (tissue gin_trgm_ops);

-- BRIN 索引 (大块数据范围)
CREATE INDEX idx_samples_loaded_at_brin ON unified_samples 
    USING BRIN (etl_loaded_at);
```

---

## 4. 迁移方案

### 4.1 迁移策略

```
阶段 1: 准备 (1 周)
├── PostgreSQL 环境搭建
├── Schema 转换
├── 索引创建
└── 数据验证脚本

阶段 2: 全量迁移 (1-2 天)
├── SQLite → PostgreSQL 导出
├── 数据清洗
├── 批量导入
└── 索引重建

阶段 3: 增量同步 (持续)
├── 双写机制
├── 差异校验
└── 一致性检查

阶段 4: 切换 (30 分钟)
├── 流量切换
├── 回滚准备
└── 监控验证
```

### 4.2 数据迁移脚本

```python
# pg_migrate.py
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

class SQLiteToPostgresMigrator:
    def __init__(self, sqlite_path, pg_dsn):
        self.sqlite_conn = sqlite3.connect(sqlite_path)
        self.pg_conn = psycopg2.connect(pg_dsn)
        
    def migrate_table(self, table_name, batch_size=10000):
        """分批迁移数据"""
        cursor_sqlite = self.sqlite_conn.cursor()
        cursor_pg = self.pg_conn.cursor()
        
        # 获取列信息
        cursor_sqlite.execute(f"PRAGMA table_info({table_name})")
        columns = [row[1] for row in cursor_sqlite.fetchall()]
        
        # 分批读取
        cursor_sqlite.execute(f"SELECT * FROM {table_name}")
        batch = []
        
        while True:
            rows = cursor_sqlite.fetchmany(batch_size)
            if not rows:
                break
                
            batch.extend(rows)
            if len(batch) >= batch_size:
                self._insert_batch(cursor_pg, table_name, columns, batch)
                batch = []
                
        if batch:
            self._insert_batch(cursor_pg, table_name, columns, batch)
            
        self.pg_conn.commit()
        
    def _insert_batch(self, cursor, table, columns, rows):
        """批量插入 PostgreSQL"""
        cols = ','.join(columns)
        query = f"INSERT INTO {table} ({cols}) VALUES %s"
        execute_values(cursor, query, rows)
```

### 4.3 Schema 差异对照

| 特性 | SQLite | PostgreSQL | 迁移注意 |
|------|--------|-----------|---------|
| 自增 | INTEGER PRIMARY KEY | BIGSERIAL | 类型转换 |
| 布尔 | INTEGER (0/1) | BOOLEAN | 值转换 |
| JSON | TEXT | JSONB | 解析转换 |
| 全文 | FTS5 | pg_search | 重建索引 |
| 时间 | TEXT | TIMESTAMP | 格式转换 |

---

## 5. 高可用设计

### 5.1 主从复制

```
┌─────────────────┐
│   Primary DB    │  ← 写入
│   (读写)        │
└────────┬────────┘
         │ Streaming Replication
         ▼
┌─────────────────┐
│   Standby DB    │  ← 读取
│   (只读)        │
└─────────────────┘
```

**配置**:
```ini
# postgresql.conf (Primary)
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10

# pg_hba.conf
host replication replicator 0.0.0.0/0 scram-sha-256
```

### 5.2 自动故障转移

**方案**: Patroni + etcd

```yaml
# patroni.yml
scope: scgb_cluster
namespace: /service/
name: node1

etcd:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379

postgresql:
  listen: 0.0.0.0:5432
  data_dir: /var/lib/postgresql/data
  pgpass: /tmp/pgpass
  authentication:
    replication:
      username: replicator
      password: ********
    superuser:
      username: postgres
      password: ********
```

---

## 6. 备份与恢复

### 6.1 备份策略

| 备份类型 | 频率 | 保留期 | 工具 |
|----------|------|--------|------|
| 全量备份 | 每日 | 30 天 | pg_dump / pg_basebackup |
| 增量备份 | 每小时 | 7 天 | WAL archiving |
| 实时备份 | 持续 | - | Streaming replication |

### 6.2 备份脚本

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgresql
RETENTION_DAYS=30

# 全量备份
pg_dump -Fc -Z9 scgb_db > $BACKUP_DIR/scgb_$DATE.dump

# WAL 归档
archive_command = 'cp %p /backups/wal/%f'

# 清理旧备份
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
```

---

## 7. 监控与告警

### 7.1 关键指标

| 指标 | 告警阈值 | 严重阈值 |
|------|---------|---------|
| 连接数 | >70 | >90 |
| 磁盘使用 | >70% | >85% |
| 查询延迟 (p99) | >500ms | >2s |
| 复制延迟 | >10s | >60s |
| 错误率 | >1% | >5% |

### 7.2 监控查询

```sql
-- 活跃连接
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- 慢查询
SELECT query, calls, mean_time, max_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- 表大小
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 索引使用
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

---

## 8. 性能优化建议

### 8.1 查询优化

```sql
-- 使用 EXPLAIN ANALYZE 分析慢查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM unified_samples 
WHERE tissue LIKE '%brain%' AND disease LIKE '%Alzheimer%';

-- 分区表 (未来扩展)
CREATE TABLE unified_samples_2024 PARTITION OF unified_samples
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### 8.2 连接池配置

```ini
# pgbouncer.ini
[databases]
scgb_db = host=localhost port=5432 dbname=scgb_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

---

## 9. 总结

### 推荐方案: PostgreSQL 16 + pg_trgm + Redis

**选择理由**:
1. 单一技术栈，降低运维复杂度
2. 完整 ACID 支持，数据可靠性高
3. JSONB 灵活存储，适应元数据变化
4. 丰富索引类型，查询性能优异
5. 成熟生态，社区支持强大

**实施路线图**:
- Week 1-2: 环境准备，Schema 设计
- Week 3: 数据迁移，索引构建
- Week 4: 性能测试，优化调优
- Week 5: 灰度发布，监控完善
- Week 6: 全量切换，旧系统下线

**预估成本** (自建):
- 硬件: $3000-5000 (服务器)
- 人力: 2 人周 (DBA + 开发)
- 维护: $200/月 (云存储/监控)

