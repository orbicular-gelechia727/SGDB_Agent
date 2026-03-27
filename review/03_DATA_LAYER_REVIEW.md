# SCGB 项目评审报告 — 数据层评审

> **评审日期**: 2026-03-12  
> **评审对象**: 统一数据库设计与ETL流程  
> **评审范围**: Schema设计、索引策略、ETL流程、数据质量  

---

## 1. 执行摘要

### 1.1 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| Schema设计 | 8.5/10 | 4级层级清晰，符合领域模型 |
| 索引策略 | 9.0/10 | 43个索引+3个FTS5，覆盖全面 |
| ETL流程 | 8.0/10 | 模块化设计，可扩展 |
| 数据质量 | 8.0/10 | 跨库关联完善，部分字段稀疏 |
| 性能优化 | 9.5/10 | 预计算表策略效果显著 |
| **综合评分** | **8.6/10** | **优秀** |

### 1.2 关键发现

**优势**:
- ✅ 4级统一Schema (projects→series→samples→celltypes)
- ✅ 43个索引 + 3个FTS5全文索引
- ✅ 9个预计算统计表，性能提升显著
- ✅ 9,966条跨库关联链接

**待改进**:
- ⚠️ EGA数据源元数据过于稀疏
- ⚠️ 预计算表需手动刷新
- ⚠️ SQLite并发写入限制

---

## 2. Schema设计评审

### 2.1 核心表结构

```sql
-- 4级层级设计
unified_projects      -- 23,123行 (项目级)
    └── unified_series    -- 15,968行 (系列级)
            └── unified_samples   -- 756,579行 (样本级)
                    └── unified_celltypes -- 378,029行 (细胞类型)
```

**设计评估**:

| 表 | 行数 | 设计评估 |
|----|------|----------|
| unified_projects | 23,123 | ✅ 项目级聚合合理 |
| unified_series | 15,968 | ✅ 系列级中间层必要 |
| unified_samples | 756,579 | ✅ 样本级详细数据 |
| unified_celltypes | 378,029 | ✅ 细胞类型独立存储 |

### 2.2 Schema设计优点

```
┌─────────────────────────────────────────────────────────────┐
│                    Schema设计亮点                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. 层级清晰                                                  │
│    - 符合生物学研究组织方式                                  │
│    - 支持灵活的查询粒度                                      │
│                                                             │
│ 2. 跨库关联完善                                              │
│    - entity_links: 9,966条硬链接                            │
│    - id_mappings: 外部ID映射                                │
│    - dedup_candidates: 100,000条去重候选                    │
│                                                             │
│ 3. 质量监控                                                  │
│    - v_data_quality: 数据质量视图                            │
│    - v_field_quality: 字段完整度视图                         │
│                                                             │
│ 4. 预计算优化                                                │
│    - 9个统计表预先计算                                       │
│    - 仪表盘响应从90s→5ms                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 字段设计评估

#### unified_samples 核心字段

| 字段 | 类型 | 覆盖率 | 评估 |
|------|------|--------|------|
| sample_id | TEXT | 100% | ✅ 主键设计合理 |
| tissue | TEXT | ~85% | ✅ 本体标准化 |
| disease | TEXT | ~70% | ⚠️ 部分数据源缺失 |
| cell_type | TEXT | ~45% | ⚠️ 覆盖率偏低 |
| assay | TEXT | ~90% | ✅ 覆盖良好 |
| sex | TEXT | ~60% | ⚠️ 隐私原因缺失 |
| age | REAL | ~40% | ⚠️ 覆盖率偏低 |

### 2.4 建议改进

#### 建议1: 增加数据质量评分字段

```sql
-- 建议增加质量评分字段
ALTER TABLE unified_samples ADD COLUMN 
    quality_score REAL GENERATED ALWAYS AS (
        (CASE WHEN tissue IS NOT NULL THEN 0.2 ELSE 0 END) +
        (CASE WHEN disease IS NOT NULL THEN 0.2 ELSE 0 END) +
        (CASE WHEN cell_type IS NOT NULL THEN 0.2 ELSE 0 END) +
        (CASE WHEN assay IS NOT NULL THEN 0.2 ELSE 0 END) +
        (CASE WHEN sex IS NOT NULL THEN 0.1 ELSE 0 END) +
        (CASE WHEN age IS NOT NULL THEN 0.1 ELSE 0 END)
    ) STORED;

CREATE INDEX idx_samples_quality ON unified_samples(quality_score);
```

---

## 3. 索引策略评审

### 3.1 索引覆盖情况

```
总计: 43个普通/复合索引 + 3个FTS5全文索引

分布:
├── unified_projects: 8个索引
├── unified_series: 10个索引
├── unified_samples: 18个索引
├── unified_celltypes: 4个索引
├── entity_links: 3个索引
└── FTS5索引: 3个 (fts_samples, fts_series, fts_projects)
```

### 3.2 关键索引评估

| 索引 | 用途 | 评估 |
|------|------|------|
| idx_samples_tissue | 组织过滤 | ✅ 高频使用 |
| idx_samples_disease | 疾病过滤 | ✅ 高频使用 |
| idx_samples_source_db | 数据源过滤 | ✅ 必要 |
| idx_entity_links_pk | 跨库关联 | ✅ 核心索引 |
| idx_identity_hash | 去重检测 | ✅ 核心索引 |
| fts_samples | 全文搜索 | ✅ 必要功能 |

### 3.3 索引建议

#### 建议2: 增加复合索引

```sql
-- 高频查询场景: tissue + disease
CREATE INDEX idx_samples_tissue_disease 
ON unified_samples(tissue, disease) 
WHERE tissue IS NOT NULL AND disease IS NOT NULL;

-- 统计查询场景: source_database + assay
CREATE INDEX idx_series_source_assay 
ON unified_series(source_database, assay);
```

---

## 4. ETL流程评审

### 4.1 ETL架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ETL流程架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  run_pipeline.py (编排器)                                    │
│       │                                                     │
│       ├──► NCBI/SRA ETL    ──► 217,513 samples              │
│       ├──► GEO ETL         ──► 342,368 samples              │
│       ├──► EBI ETL         ──► 160,135 samples              │
│       ├──► CellXGene ETL   ──►  33,984 samples              │
│       └──► Small Sources   ──►   2,579 samples              │
│                               (HCA, HTAN, PsychAD, ...)     │
│                                                             │
│       │                                                     │
│       ▼                                                     │
│  ID Linker (跨库关联)                                        │
│       ├──► PRJNA↔GSE matching: 4,142 links                  │
│       ├──► PMID matching: 5,756 links                       │
│       └──► DOI matching: 68 links                           │
│                                                             │
│       │                                                     │
│       ▼                                                     │
│  Deduplication (去重检测)                                    │
│       └──► 100,000 identity hash candidates                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 ETL模块评估

| 模块 | 数据源 | 质量 | 评估 |
|------|--------|------|------|
| ncbi_sra_etl.py | NCBI/SRA | 良好 | ✅ API获取稳定 |
| geo_etl.py | GEO | 良好 | ✅ Excel处理完善 |
| ebi_etl.py | EBI | 良好 | ✅ REST API整合 |
| cellxgene_etl.py | CellXGene | 优秀 | ✅ Census API |
| small_sources_etl.py | 其他 | 可接受 | ⚠️ 数据源质量参差 |

### 4.3 数据质量分析

#### 各数据源字段完整度

| 数据源 | 样本数 | tissue | disease | cell_type | assay |
|--------|--------|--------|---------|-----------|-------|
| GEO | 342,368 | 85% | 65% | 40% | 95% |
| NCBI/SRA | 217,513 | 80% | 60% | 35% | 90% |
| EBI | 160,135 | 90% | 75% | 50% | 95% |
| CellXGene | 33,984 | 95% | 80% | 85% | 98% |
| HCA | 143 | 98% | 85% | 90% | 100% |
| HTAN | 942 | 90% | 95% | 60% | 95% |
| PsychAD | 1,494 | 100% | 100% | 70% | 95% |
| EGA | - | 10% | 5% | 0% | 20% |

**关键发现**:
- ✅ CellXGene/HCA质量最高
- ⚠️ EGA元数据过于稀疏
- ⚠️ cell_type整体覆盖率偏低

### 4.4 ETL改进建议

#### 建议3: 自动化统计刷新

```python
# 当前: 手动执行
# python populate_stats.py

# 建议: ETL后自动触发
class ETLPipeline:
    def run(self):
        # ... ETL执行 ...
        
        # 自动刷新统计
        self._refresh_stats()
        
    def _refresh_stats(self):
        """自动刷新预计算统计表"""
        for table in self.STAT_TABLES:
            self.db.execute(f"DELETE FROM {table}")
            self.db.execute(f"INSERT INTO {table} ...")
        self.db.commit()
```

#### 建议4: 增量ETL支持

```python
class IncrementalETL:
    """支持增量更新，避免全量重建"""
    
    def extract(self, source: str, since: datetime) -> DataFrame:
        """只获取变更数据"""
        return self.source_client.get_updates(since)
    
    def transform(self, df: DataFrame) -> DataFrame:
        """增量转换"""
        return df
    
    def load(self, df: DataFrame):
        """UPSERT更新"""
        for row in df:
            self.db.upsert('unified_samples', row, key='sample_id')
```

---

## 5. 性能优化评审

### 5.1 优化策略评估

| 策略 | 实现 | 效果 | 评估 |
|------|------|------|------|
| 预计算统计表 | 9个表 | 仪表盘5ms | ✅ 效果显著 |
| FTS5全文索引 | 3个 | 文本搜索加速 | ✅ 必要 |
| 复合索引 | 多个 | 查询加速 | ✅ 良好 |
| 视图简化 | v_sample_with_hierarchy | 简化查询 | ✅ 良好 |
| SQLite优化 | mmap_size, temp_store | IO优化 | ✅ 良好 |

### 5.2 性能基准

| 查询类型 | 优化前 | 优化后 | 提升 |
|----------|--------|--------|------|
| 仪表盘加载 | 90,000ms | 5ms | 18,000x |
| 健康检查 | 1,655ms | 0.5ms | 3,310x |
| Explore无筛选 | 29,000ms | 22ms | 1,318x |
| 样本ID查询 | ~50ms | ~5ms | 10x |
| 组织过滤 | ~200ms | ~50ms | 4x |

### 5.3 进一步优化建议

#### 建议5: 查询结果缓存层

```python
class QueryResultCache:
    """SQL查询结果缓存"""
    
    CACHE_TTL = {
        'stats': 3600 * 24,      # 统计类24小时
        'search': 3600,           # 搜索类1小时
        'ontology': 3600 * 24 * 7, # 本体类7天
    }
    
    def get_or_execute(self, sql: str, category: str) -> Result:
        key = hash(sql)
        if cached := self._get_cached(key, category):
            return cached
        result = self.db.execute(sql)
        self._cache(key, result, category)
        return result
```

---

## 6. 数据质量监控

### 6.1 现有监控

```sql
-- 数据质量视图
v_data_quality:
├── 字段完整度统计
├── 跨库一致性检查
└── 异常值检测

v_field_quality:
├── 各字段覆盖率
├── 数据源分布
└── 质量趋势
```

### 6.2 建议增强

#### 建议6: 自动化质量报告

```python
class DataQualityMonitor:
    """自动化数据质量监控"""
    
    def generate_report(self) -> QualityReport:
        return QualityReport(
            overall_score=self._calc_overall_score(),
            coverage=self._check_field_coverage(),
            consistency=self._check_cross_db_consistency(),
            freshness=self._check_data_freshness(),
            anomalies=self._detect_anomalies()
        )
    
    def alert_on_degradation(self, threshold: float = 0.8):
        """质量下降时告警"""
        report = self.generate_report()
        if report.overall_score < threshold:
            self._send_alert(report)
```

---

## 7. 生产环境考量

### 7.1 SQLite限制

| 场景 | 限制 | 影响 |
|------|------|------|
| 并发写入 | 单写锁 | 高并发时排队 |
| 文件大小 | 无硬性限制 | 当前1.4GB可接受 |
| 网络访问 | 不支持 | 需应用层封装 |

### 7.2 PostgreSQL迁移评估

```
迁移优势:
├── 并发写入: MVCC支持，多写并发
├── 全文搜索: tsvector性能优于FTS5
├── 水平扩展: 主从+读副本
├── 备份恢复: pg_dump + WAL归档
└── 监控运维: pg_stat + 生态完善

迁移成本:
├── DAL适配: 1-2天
├── Schema迁移: 1天
├── SQL兼容性: 1-2天
├── 性能调优: 2-3天
├── 数据迁移: 1-2天
└── 测试验证: 2-3天
总计: 10-15人天
```

---

## 8. 评审结论

### 8.1 总体评价

SCGB项目的数据层设计展现了**扎实的数据工程能力**。4级Schema设计合理，索引策略完善，预计算优化效果显著。ETL流程模块化，支持多种数据源。

### 8.2 评分详情

| 维度 | 评分 | 说明 |
|------|------|------|
| Schema设计 | 8.5/10 | 层级清晰，符合领域模型 |
| 索引策略 | 9.0/10 | 覆盖全面，FTS5完善 |
| ETL流程 | 8.0/10 | 模块化，可扩展 |
| 性能优化 | 9.5/10 | 预计算策略效果显著 |
| 数据质量 | 8.0/10 | 监控完善，部分字段稀疏 |
| **综合** | **8.6/10** | **优秀** |

### 8.3 关键建议

1. **自动化统计刷新** (P1): ETL后自动刷新预计算表
2. **增量ETL支持** (P2): 避免全量重建，提升更新效率
3. **质量评分字段** (P2): 增加样本质量评分，便于排序
4. **PG迁移评估** (P1): 评估生产环境数据库迁移方案

---

*本评审完成。*
