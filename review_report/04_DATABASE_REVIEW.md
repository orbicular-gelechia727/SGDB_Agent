# 数据库设计审查报告

## 1. 数据库概况

### 1.1 数据库文件

| 文件 | 大小 | 说明 |
|------|------|------|
| unified_metadata.db | 1.4 GB | 主数据库 (SQLite) |
| ontology_cache.db | 103 MB | 本体解析缓存 |
| episodic.db | 88 KB | 用户会话记忆 |
| semantic.db | 44 KB | 系统知识记忆 |
| **总计** | **~1.5 GB** | |

### 1.2 数据规模

| 实体 | 记录数 | 说明 |
|------|--------|------|
| unified_projects | 23,123 | 项目级元数据 |
| unified_series | 15,968 | 系列级元数据 |
| unified_samples | 756,579 | 样本级元数据 |
| unified_celltypes | 378,029 | 细胞类型注释 |
| entity_links | 9,966 | 跨库关联链接 |
| id_mappings | - | 外部 ID 映射 |
| dedup_candidates | 100,000 | 去重候选 |

---

## 2. Schema 设计评估

### 2.1 核心表结构

```sql
-- 4 级层级设计 (实际实现)
unified_projects      -- 项目级
    └── unified_series   -- 系列级  
            └── unified_samples    -- 样本级
                    └── unified_celltypes   -- 细胞类型
```

**设计评估**:
- ✅ 层级清晰，符合业务逻辑
- ✅ 支持灵活的元数据查询
- ⚠️ 与最初设计的 samples → datasets → experiments 有所不同

### 2.2 字段设计

| 表 | 字段数 | 关键字段 | 评估 |
|----|--------|----------|------|
| unified_projects | 15+ | project_id, title, pmid, doi | ✅ 完整 |
| unified_series | 12+ | series_id, assay, h5ad_url | ✅ 完整 |
| unified_samples | 18+ | sample_id, tissue, disease, sex, age | ✅ 完整 |
| unified_celltypes | 8+ | cell_type, cell_count, percentage | ✅ 完整 |

### 2.3 索引策略

```sql
-- 主要索引类型
1. 主键索引 (PRIMARY KEY) - 所有表
2. 外键索引 (FOREIGN KEY) - 关联查询
3. 复合索引 - 常见查询模式
4. FTS5 全文索引 - 文本搜索
```

**索引统计**:
- 普通/复合索引: 43 个
- FTS5 全文索引: 3 个
- 预计算统计表: 9 个

---

## 3. 性能优化评估

### 3.1 优化成果

| 指标 | 优化前 | 优化后 | 提升倍数 |
|------|--------|--------|----------|
| 仪表盘首次加载 | 90,000ms | 5ms | **16,657x** |
| 健康检查 | 1,655ms | 0.5ms | **3,310x** |
| Schema 分析 (启动) | 5,000ms | 1,038ms | **5x** |
| Explore 面板 (无筛选) | 29,000ms | 22ms | **1,329x** |

### 3.2 优化策略分析

#### 3.2.1 预计算统计表 ✅ 优秀

```sql
-- 9 个预计算统计表
stats_by_source, stats_by_tissue, stats_by_disease,
stats_by_assay, stats_by_organism, stats_by_sex,
stats_by_cell_type, stats_by_year, stats_overall
```

**优点**:
- 避免实时聚合大表
- 仪表盘查询从秒级降至毫秒级

**缺点**:
- ETL 后需手动刷新
- 数据实时性略降

#### 3.2.2 复合索引 ✅ 有效

```sql
-- 示例复合索引
CREATE INDEX idx_samples_tissue_disease 
ON unified_samples(tissue, disease);
```

#### 3.2.3 SQLite 优化参数 ✅ 有效

```python
PRAGMA mmap_size = 268435456;        -- 256MB 内存映射
PRAGMA temp_store = MEMORY;          -- 临时表放内存
PRAGMA journal_mode = WAL;           -- WAL 模式
```

### 3.3 性能瓶颈识别

| 查询类型 | 当前性能 | 瓶颈 | 建议 |
|----------|----------|------|------|
| 简单过滤 | < 100ms | 无 | ✅ |
| 全文搜索 | 200-500ms | FTS5 索引 | ✅ 可接受 |
| 复杂聚合 | 1-3s | 实时计算 | ⚠️ 考虑物化视图 |
| 跨表 JOIN | 500ms-2s | 索引选择 | ⚠️ 优化查询计划 |

---

## 4. ETL 流程评估

### 4.1 ETL 架构

```
run_pipeline.py (编排器)
    ├── NCBI/SRA ETL
    ├── GEO ETL
    ├── EBI ETL
    ├── CellXGene ETL
    └── Small Sources ETL
```

### 4.2 ETL 模块质量

| 模块 | 代码量 | 可维护性 | 健壮性 |
|------|--------|----------|--------|
| base.py | ~100 | ✅ 基类定义清晰 | ✅ |
| ncbi_sra_etl.py | ~400 | ✅ 逻辑清晰 | ✅ |
| geo_etl.py | ~300 | ✅ 结构良好 | ✅ |
| ebi_etl.py | ~350 | ✅ 分阶段处理 | ✅ |
| cellxgene_etl.py | ~250 | ✅ Census API 集成 | ✅ |
| small_sources_etl.py | ~200 | ✅ 多源处理 | ✅ |

### 4.3 ETL 问题与建议

1. **增量更新支持**
   ```python
   # 当前：全量重建
   # 建议：支持增量更新
   def incremental_update(self, since: datetime):
       ...
   ```

2. **错误恢复机制**
   ```python
   # 建议添加断点续传
   class ETLCheckpoint:
       last_processed_id: str
       last_processed_time: datetime
   ```

---

## 5. 跨库关联设计

### 5.1 关联策略

| 关联类型 | 数量 | 方法 | 置信度 |
|----------|------|------|--------|
| PRJNA↔GSE (same_as) | 4,142 | BioProject XML 双向匹配 | 高 |
| PMID 关联 | 5,756 | NCBI↔GEO PubMed ID 匹配 | 高 |
| DOI 关联 | 68 | CellXGene↔NCBI DOI 匹配 | 高 |
| Identity Hash | 100,000 | 生物学特征 hash 碰撞 | 中 |

### 5.2 关联表设计

```sql
CREATE TABLE entity_links (
    link_id INTEGER PRIMARY KEY,
    source_type TEXT,      -- 'project', 'sample', etc.
    source_id TEXT,
    target_type TEXT,
    target_id TEXT,
    relationship_type TEXT,  -- 'same_as', 'linked_via_pmid', etc.
    confidence TEXT          -- 'high', 'medium', 'low'
);
```

**评估**: 设计灵活，支持多种关系类型。

---

## 6. 数据质量评估

### 6.1 质量监控视图

```sql
-- v_data_quality: 字段填充率统计
-- v_field_quality: 字段值分布统计
```

### 6.2 字段填充率

| 字段 | 填充率 | 评估 |
|------|--------|------|
| organism | ~100% | ✅ 完整 |
| tissue | ~85% | ✅ 良好 |
| disease | ~40% | ⚠️ 较低（部分样本无疾病） |
| cell_type | ~30% | ⚠️ 较低（系列级未展开） |
| sex | ~60% | 🟡 中等 |
| age | ~45% | 🟡 中等 |

### 6.3 数据质量问题

1. **cell_type 位置问题**
   - 当前主要在 celltypes 表
   - samples 表 cell_type 字段为空
   - 需要视图或 JOIN 查询

2. **元数据不一致**
   - 不同来源 tissue 命名差异（如 "brain" vs "Brain"）
   - 建议统一标准化处理

---

## 7. 数据库改进建议

### 7.1 短期改进 (1-2 周)

| 建议 | 优先级 | 工作量 | 收益 |
|------|--------|--------|------|
| 添加样本级 cell_type 视图 | 🔴 高 | 半天 | 简化查询 |
| 自动化统计表刷新 | 🔴 高 | 1 天 | 减少运维 |
| 添加表分区（按 source_database） | 🟡 中 | 2 天 | 查询性能 |

### 7.2 中期改进 (1 个月)

| 建议 | 优先级 | 工作量 | 收益 |
|------|--------|--------|------|
| 引入物化视图自动刷新 | 🟡 中 | 1 周 | 数据实时性 |
| 字段值标准化（tissue/disease） | 🟡 中 | 1 周 | 查询准确率 |
| 增量 ETL 支持 | 🟡 中 | 2 周 | 减少重建时间 |

### 7.3 长期演进 (3 个月)

| 建议 | 优先级 | 工作量 | 收益 |
|------|--------|--------|------|
| PostgreSQL 迁移评估 | 🟢 低 | 2 周 | 并发性能 |
| 数据版本追踪完整实现 | 🟢 低 | 1 月 | 数据血缘 |
| 分布式查询支持 | 🟢 低 | 2 月 | 水平扩展 |

---

## 8. 审查结论

**总体评价**: 数据库设计合理，性能优化效果显著，ETL 流程稳健。

**核心优势**:
1. 预计算统计表大幅提升查询性能
2. 索引策略完善
3. ETL 模块化设计，易于维护

**主要问题**:
1. cell_type 不在 samples 表，查询需 JOIN
2. 统计表需手动刷新
3. 缺乏增量更新机制

**建议行动**:
1. 立即实施短期改进项
2. 规划中期改进计划
3. 评估 PostgreSQL 迁移可行性
