# 架构设计审核报告 #3：数据模型与数据库设计

**审核日期**: 2026-03-06  
**审核维度**: 数据模型、数据库schema、数据一致性  
**审核人员**: 独立架构审核员

---

## 1. 数据模型评估

### 1.1 实体关系分析

```
unified_projects (1)
    │
    ├── unified_series (N)    via project_pk
    │       │
    │       └── unified_samples (N)    via series_pk
    │               │
    │               └── unified_celltypes (N)    via sample_pk
    │
    └── unified_samples (N)   via project_pk (直接关联)

entity_links (M:N)        跨库关联
id_mappings (1:N)         ID映射
dedup_candidates (M:N)    去重候选
```

### 1.2 归一化程度评估

| 表 | 当前范式 | 评估 |
|----|---------|------|
| unified_projects | 3NF | ✅ 结构合理 |
| unified_series | 3NF | ✅ 结构合理 |
| unified_samples | 3NF | ⚠️ 字段较多，考虑垂直拆分 |
| unified_celltypes | 3NF | ✅ 结构合理 |
| entity_links | BCNF | ✅ 关联表设计正确 |
| id_mappings | BCNF | ✅ 映射表设计正确 |

---

## 2. Schema详细审查

### 2.1 unified_samples 表结构建议

当前设计（推断）:
```sql
CREATE TABLE unified_samples (
    pk INTEGER PRIMARY KEY,
    sample_id TEXT,
    project_pk INTEGER,
    series_pk INTEGER,
    -- 核心字段
    organism TEXT,
    tissue TEXT,
    disease TEXT,
    cell_type TEXT,
    sex TEXT,
    age TEXT,
    -- 统计字段
    n_cells INTEGER,
    -- 元数据
    source_database TEXT,
    -- ... 更多字段
);
```

**问题与建议**:

1. **字段数量过多**
   - 预计超过30个字段
   - 查询时IO开销大
   - 建议拆分为:
     ```sql
     unified_samples (核心字段)
     unified_sample_details (扩展字段)
     unified_sample_stats (统计字段)
     ```

2. **年龄字段设计**
   ```sql
   -- 当前: age TEXT (可能存 "25", "P56", "adult" 等)
   -- 建议: 拆分结构化存储
   age_value REAL,           -- 数值
   age_unit TEXT,            -- 'years', 'days', 'weeks'
   age_original TEXT,        -- 原始值
   age_normalized_min REAL,  -- 标准化范围
   age_normalized_max REAL,
   ```

3. **缺失关键字段**
   - `created_at` / `updated_at`: 数据更新时间追踪
   - `data_quality_score`: 预计算的字段完整性评分
   - `has_celltype_annotation`: 是否有细胞类型注释

### 2.2 索引策略建议

```sql
-- 当前设计可能缺失的索引

-- 1. 全文搜索索引 (SQLite FTS5 或 PG tsvector)
CREATE VIRTUAL TABLE samples_fts USING fts5(
    sample_id, tissue, disease, cell_type,
    content=unified_samples,
    content_rowid=pk
);

-- 2. 复合查询索引
CREATE INDEX idx_samples_tissue_disease ON unified_samples(tissue, disease);
CREATE INDEX idx_samples_organism_assay ON unified_samples(organism, assay);
CREATE INDEX idx_samples_source_db ON unified_samples(source_database, pk);

-- 3. 去重哈希索引
CREATE INDEX idx_samples_bio_hash ON unified_samples(biological_identity_hash);

-- 4. 时间范围查询索引 (如果有发布时间字段)
CREATE INDEX idx_samples_published ON unified_samples(published_date);
```

### 2.3 entity_links 表设计优化

当前设计:
```sql
CREATE TABLE entity_links (
    source_pk INTEGER,
    target_pk INTEGER,
    relationship_type TEXT,  -- 'same_as', 'part_of', etc.
    evidence TEXT            -- JSON?
);
```

**建议优化**:
```sql
CREATE TABLE entity_links (
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_pk INTEGER NOT NULL,
    source_entity_type TEXT NOT NULL,  -- 'project', 'sample'
    target_pk INTEGER NOT NULL,
    target_entity_type TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,       -- 关联置信度
    evidence_type TEXT,                -- 'pmid_link', 'doi_match', 'manual'
    evidence_details TEXT,             -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- 复合主键避免重复
    UNIQUE(source_pk, target_pk, relationship_type)
);

-- 双向查询索引
CREATE INDEX idx_links_source ON entity_links(source_pk, relationship_type);
CREATE INDEX idx_links_target ON entity_links(target_pk, relationship_type);
```

---

## 3. 数据一致性考量

### 3.1 外键约束策略

**当前风险**:
- 文档未明确说明是否启用外键约束
- 数据ETL过程中可能出现孤儿记录

**建议**:
```sql
-- SQLite 需要显式启用
PRAGMA foreign_keys = ON;

-- 定义外键
CREATE TABLE unified_series (
    pk INTEGER PRIMARY KEY,
    project_pk INTEGER,
    -- ...
    FOREIGN KEY (project_pk) 
        REFERENCES unified_projects(pk)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
```

### 3.2 数据完整性检查

建议添加数据库级别的CHECK约束:
```sql
CREATE TABLE unified_samples (
    -- ...
    sex TEXT CHECK(sex IN ('male', 'female', 'unknown', 'mixed')),
    n_cells INTEGER CHECK(n_cells > 0),
    organism TEXT CHECK(organism LIKE 'Homo %'),  -- 仅人源数据
    -- ...
);
```

### 3.3 去重策略的数据一致性

**identity_hash 生成策略**:
```python
# 文档提到的 biological_identity_hash
# 需要明确定义算法确保一致性

def compute_identity_hash(sample) -> str:
    """
    标准化后计算哈希
    """
    components = [
        normalize_organism(sample.organism),
        normalize_tissue(sample.tissue),
        normalize_disease(sample.disease),
        sample.individual_id or '',  # 如果可用
    ]
    normalized = '|'.join(components).lower().strip()
    return hashlib.sha256(normalized.encode()).hexdigest()[:32]
```

---

## 4. 性能考量

### 4.1 查询模式分析

| 查询类型 | 频率 | 性能要求 | 优化策略 |
|----------|------|---------|---------|
| ID精确查询 | 高 | <50ms | 主键索引 |
| 多条件过滤 | 高 | <200ms | 复合索引 |
| 本体扩展查询 | 中 | <500ms | 预计算value_to_ontology |
| 跨库融合 | 中 | <500ms | Union-Find + 缓存 |
| 统计聚合 | 低 | <2s | 物化视图 |

### 4.2 物化视图建议

```sql
-- 预计算的统计视图
CREATE MATERIALIZED VIEW mv_source_statistics AS
SELECT 
    source_database,
    COUNT(*) as sample_count,
    COUNT(DISTINCT project_pk) as project_count,
    SUM(n_cells) as total_cells
FROM unified_samples
GROUP BY source_database;

-- 组织-疾病分布矩阵
CREATE MATERIALIZED VIEW mv_tissue_disease_matrix AS
SELECT 
    tissue,
    disease,
    COUNT(*) as sample_count,
    source_database
FROM unified_samples
WHERE tissue IS NOT NULL AND disease IS NOT NULL
GROUP BY tissue, disease, source_database;
```

### 4.3 分区策略（PostgreSQL迁移后）

```sql
-- 按source_database分区
CREATE TABLE unified_samples (
    -- ...
) PARTITION BY LIST (source_database);

CREATE TABLE unified_samples_cellxgene PARTITION OF unified_samples
    FOR VALUES IN ('cellxgene');
CREATE TABLE unified_samples_geo PARTITION OF unified_samples
    FOR VALUES IN ('geo');
-- ...
```

---

## 5. 数据迁移与演进

### 5.1 Schema版本管理

建议引入数据库迁移工具:
```
选项1: Alembic (SQLAlchemy生态)
选项2: yoyo-migration (轻量级)
选项3: 自研版本控制
```

### 5.2 向后兼容性策略

```python
# Schema变更兼容性检查清单
def check_schema_compatibility(old_schema, new_schema):
    checks = [
        # 1. 不删除已有字段
        all(f in new_schema for f in old_schema.fields),
        
        # 2. 新增字段有默认值或可为NULL
        all(new_schema[f].has_default or new_schema[f].nullable 
            for f in new_schema.fields if f not in old_schema.fields),
        
        # 3. 不改变已有字段类型
        all(old_schema[f].type == new_schema[f].type 
            for f in old_schema.fields),
    ]
    return all(checks)
```

---

## 6. 数据质量保障

### 6.1 字段完整性监控

```sql
-- 数据质量监控查询
CREATE VIEW data_quality_report AS
SELECT 
    source_database,
    COUNT(*) as total_samples,
    
    -- 字段填充率
    ROUND(100.0 * COUNT(tissue) / COUNT(*), 2) as tissue_filled_pct,
    ROUND(100.0 * COUNT(disease) / COUNT(*), 2) as disease_filled_pct,
    ROUND(100.0 * COUNT(sex) / COUNT(*), 2) as sex_filled_pct,
    ROUND(100.0 * COUNT(age) / COUNT(*), 2) as age_filled_pct,
    
    -- 异常值检测
    COUNT(CASE WHEN n_cells > 1000000 THEN 1 END) as suspicious_cell_count
FROM unified_samples
GROUP BY source_database;
```

### 6.2 数据血缘追踪

```sql
-- 记录数据来源和ETL历史
CREATE TABLE data_lineage (
    entity_pk INTEGER,
    entity_type TEXT,
    source_database TEXT,
    original_id TEXT,
    etl_batch_id TEXT,
    etl_timestamp TEXT,
    etl_version TEXT,
    raw_data_checksum TEXT
);
```

---

## 7. 结论与建议

| 维度 | 当前状态 | 建议 |
|------|---------|------|
| Schema设计 | 良好 | 考虑样本表垂直拆分 |
| 索引策略 | 不完整 | 补充全文搜索和复合索引 |
| 数据一致性 | 待明确 | 启用外键约束 |
| 性能优化 | 基础 | 引入物化视图 |
| 可扩展性 | 良好 | PostgreSQL分区就绪 |

**关键行动项**:
1. [P0] 完善索引策略，确保查询性能
2. [P1] 明确外键和约束策略
3. [P1] 设计数据质量监控机制
4. [P2] 规划PostgreSQL迁移的schema适配

**综合评级**: **B+ (数据库设计专业，细节需完善)**

---

*审核完成*
