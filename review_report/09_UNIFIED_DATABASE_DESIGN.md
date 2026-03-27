# 统一数据库专业设计建议

## 概述

本报告结合各数据库本身的数据特点、单细胞测序领域的专业特性，为 SCGB 统一数据库提供深度的设计建议和优化方案。

---

## 1. 单细胞元数据核心概念模型

### 1.1 生物学实体关系

```
┌─────────────────────────────────────────────────────────────────┐
│                    单细胞元数据核心模型                          │
└─────────────────────────────────────────────────────────────────┘

Study (研究项目)
│   ├── 科学问题/实验设计
│   ├── 发表信息 (PMID/DOI)
│   └── 伦理审批
│
└──► Subject/Donor (个体)
     │   ├── 人口统计学 (年龄/性别/种族)
     │   ├── 疾病史
     │   └── 基因型 (可选)
     │
     └──► Sample (生物样本)
          │   ├── 组织来源 (UBERON)
          │   ├── 取样位置
          │   ├── 取样时间
          │   └── 处理条件
          │
          └──► Cell Suspension (细胞悬液)
               │   ├── 细胞数量
               │   ├── 活力
               │   └── 质控指标
               │
               └──► Library (测序文库)
                    │   ├── 技术平台 (EFO)
                    │   ├── 化学版本
                    │   └── 条形码方案
                    │
                    └──► Sequencing Run (测序运行)
                         ├── 测序仪
                         ├── 运行参数
                         └── 原始数据文件
```

### 1.2 与现有 Schema 的映射

| 核心概念 | 现有 Schema | 覆盖度 |
|----------|------------|--------|
| Study | unified_projects | 80% |
| Subject | unified_samples (individual_id) | 60% |
| Sample | unified_samples | 90% |
| Library/Assay | unified_series (assay) | 70% |
| Sequencing Run | - | 0% |

**建议**: 当前 4 级 Schema 覆盖了主要概念，建议增加 `unified_experiments` 表存储测序级元数据。

---

## 2. 领域本体深度集成

### 2.1 本体选择策略

| 领域 | 主本体 | 备用本体 | 使用场景 |
|------|--------|---------|---------|
| 解剖结构 | UBERON | FMA | 组织/器官标注 |
| 疾病 | MONDO | DOID/ICD10 | 疾病状态 |
| 细胞类型 | CL | BTO | 细胞类型标注 |
| 实验方法 | EFO | OBI | 测序技术 |
| 发育阶段 | HsapDv | MmusDv | 年龄/发育 |
| 种族/族群 | HANCESTRO | - | 族群信息 |

### 2.2 本体字段设计

```sql
-- 推荐: 双字段存储 (原始值 + 本体ID)
CREATE TABLE unified_samples (
    pk SERIAL PRIMARY KEY,
    
    -- 组织信息
    tissue TEXT,                    -- 原始值: "frontal cortex"
    tissue_ontology_term_id TEXT,   -- 本体ID: "UBERON:0001950"
    tissue_general TEXT,            -- 归一化: "brain"
    
    -- 疾病信息
    disease TEXT,                   -- 原始值: "Alzheimer's disease"
    disease_ontology_term_id TEXT,  -- 本体ID: "MONDO:0004975"
    disease_general TEXT,           -- 归一化: "neurodegenerative disease"
    
    -- 细胞类型
    cell_type TEXT,                 -- 原始值: "excitatory neuron"
    cell_type_ontology_term_id TEXT,-- 本体ID: "CL:0000598"
    
    -- 实验方法
    assay TEXT,                     -- 原始值: "10x 3' v3"
    assay_ontology_term_id TEXT,    -- 本体ID: "EFO:0009922"
);
```

### 2.3 本体层级查询优化

```sql
-- 使用物化路径实现高效层级查询
CREATE TABLE ontology_hierarchy (
    ontology_id TEXT PRIMARY KEY,
    ontology_source TEXT,
    label TEXT,
    parent_ids JSONB,      -- ["UBERON:0000955"]
    ancestor_ids JSONB,    -- 所有祖先节点
    descendant_ids JSONB,  -- 所有后代节点
    depth INTEGER,         -- 层级深度
    path TEXT              -- 物化路径 "1.2.5.8"
);

-- 层级查询示例: 查找所有脑相关样本
SELECT s.*
FROM unified_samples s
JOIN ontology_hierarchy oh ON s.tissue_ontology_term_id = oh.ontology_id
WHERE oh.ancestor_ids @> '["UBERON:0000955"]';  -- brain
```

---

## 3. 数据血缘与溯源设计

### 3.1 数据溯源追踪

```sql
-- 数据版本追踪表
CREATE TABLE data_lineage (
    lineage_id SERIAL PRIMARY KEY,
    
    entity_type TEXT,      -- 'sample', 'series', 'project'
    entity_pk INTEGER,     -- 对应表的 pk
    
    -- 数据来源
    source_database TEXT,
    source_id TEXT,        -- 原始数据库 ID
    source_url TEXT,
    
    -- ETL 信息
    etl_version TEXT,
    etl_script TEXT,       -- 执行的 ETL 脚本
    etl_timestamp TIMESTAMP,
    etl_checksum TEXT,     -- 数据校验和
    
    -- 原始数据快照
    raw_data JSONB,        -- 原始记录完整备份
    
    -- 版本链
    previous_version_id INTEGER REFERENCES data_lineage(lineage_id),
    is_current BOOLEAN DEFAULT true
);

-- 创建索引
CREATE INDEX idx_lineage_entity ON data_lineage(entity_type, entity_pk);
CREATE INDEX idx_lineage_source ON data_lineage(source_database, source_id);
```

### 3.2 数据质量评分

```sql
-- 数据质量维度表
CREATE TABLE data_quality_scores (
    pk SERIAL PRIMARY KEY,
    entity_type TEXT,
    entity_pk INTEGER,
    
    -- 各维度评分 (0-100)
    completeness_score INTEGER,  -- 完整性
    consistency_score INTEGER,   -- 一致性
    accuracy_score INTEGER,      -- 准确性
    timeliness_score INTEGER,    -- 时效性
    
    overall_score INTEGER,       -- 综合评分
    
    -- 评分详情
    missing_fields JSONB,        -- 缺失字段列表
    quality_flags JSONB,         -- 质量标记
    
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(entity_type, entity_pk)
);

-- 完整性评分计算示例
UPDATE data_quality_scores
SET completeness_score = (
    CASE WHEN tissue IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN disease IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN cell_type IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN sex IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN age IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN development_stage IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN ethnicity IS NOT NULL THEN 5 ELSE 0 END +
    CASE WHEN raw_metadata IS NOT NULL THEN 5 ELSE 0 END
)
FROM unified_samples
WHERE data_quality_scores.entity_pk = unified_samples.pk;
```

---

## 4. 跨库关联高级设计

### 4.1 实体解析策略

```python
# 多层次实体匹配策略
ENTITY_RESOLUTION_STRATEGIES = {
    # 第一层: 确定性匹配 (高置信度)
    "deterministic": [
        {"fields": ["pmid"], "weight": 1.0},
        {"fields": ["doi"], "weight": 1.0},
        {"fields": ["biosample_id"], "weight": 1.0},
    ],
    
    # 第二层: 概率匹配 (中置信度)
    "probabilistic": [
        {"fields": ["title"], "weight": 0.8, "method": "text_similarity"},
        {"fields": ["organism", "tissue", "disease"], "weight": 0.6, "method": "exact_match"},
        {"fields": ["individual_id"], "weight": 0.9, "method": "exact_match"},
    ],
    
    # 第三层: 生物学特征匹配
    "biological": [
        {"fields": ["biological_identity_hash"], "weight": 0.7},
        {"fields": ["cell_type_profile"], "weight": 0.5, "method": "jaccard"},
    ]
}
```

### 4.2 关联置信度模型

```sql
-- 关联置信度表
CREATE TABLE entity_links_enhanced (
    link_id SERIAL PRIMARY KEY,
    
    source_type TEXT,
    source_pk INTEGER,
    source_database TEXT,
    
    target_type TEXT,
    target_pk INTEGER,
    target_database TEXT,
    
    relationship_type TEXT,
    
    -- 置信度评分
    confidence_score REAL,       -- 0-1
    confidence_level TEXT,       -- 'high' (>0.9), 'medium' (0.7-0.9), 'low' (<0.7)
    
    -- 匹配证据
    match_evidence JSONB,        -- 详细匹配依据
    {
        "matching_fields": ["pmid", "tissue", "disease"],
        "field_scores": {"pmid": 1.0, "tissue": 0.8, "disease": 0.9},
        "matching_method": "deterministic+probabilistic"
    }
    
    -- 人工审核
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    review_status TEXT,          -- 'pending', 'approved', 'rejected'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(source_type, source_pk, target_type, target_pk, relationship_type)
);
```

---

## 5. 时序与版本数据设计

### 5.1 时间维度建模

```sql
-- 支持时间序列分析的设计
CREATE TABLE unified_samples_temporal (
    pk SERIAL PRIMARY KEY,
    sample_id TEXT NOT NULL,
    source_database TEXT NOT NULL,
    
    -- 绝对时间
    collection_date DATE,           -- 样本采集日期
    collection_time TIME,           -- 采集时间 (可选)
    collection_datetime TIMESTAMP,  -- 完整时间戳
    
    -- 相对时间 (临床试验)
    time_point TEXT,                -- "baseline", "week_4", "post_treatment"
    days_from_baseline INTEGER,     -- 距基线天数
    
    -- 发育时间
    developmental_stage TEXT,
    developmental_stage_ontology TEXT,
    gestational_age_weeks REAL,     -- 孕周
    postnatal_age_days INTEGER,     -- 出生后天数
    
    -- 时间标准化 (便于比较)
    age_in_days INTEGER,            -- 统一转换为天数
    age_category TEXT,              -- 'embryonic', 'fetal', 'neonatal', 'infant', 'child', 'adult', 'elderly'
    
    UNIQUE(sample_id, source_database)
);

-- 时间索引
CREATE INDEX idx_samples_temporal_date ON unified_samples_temporal(collection_date);
CREATE INDEX idx_samples_temporal_age ON unified_samples_temporal(age_in_days);
```

### 5.2 数据版本控制

```sql
-- 数据版本表
CREATE TABLE data_versions (
    version_id SERIAL PRIMARY KEY,
    
    entity_type TEXT,          -- 'sample', 'project', etc.
    entity_pk INTEGER,
    
    version_number INTEGER,
    version_tag TEXT,          -- 'v1.0', 'v2.0'
    
    change_type TEXT,          -- 'create', 'update', 'delete', 'merge'
    changed_fields JSONB,      -- 变更字段详情
    
    old_values JSONB,          -- 旧值
    new_values JSONB,          -- 新值
    
    changed_by TEXT,           -- 变更者
    changed_at TIMESTAMP,
    
    -- 版本链
    previous_version_id INTEGER REFERENCES data_versions(version_id),
    is_current BOOLEAN DEFAULT false,
    
    UNIQUE(entity_type, entity_pk, version_number)
);

-- 查询特定版本
CREATE OR REPLACE FUNCTION get_entity_at_version(
    p_entity_type TEXT,
    p_entity_pk INTEGER,
    p_version_number INTEGER
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- 累积所有变更到指定版本
    SELECT jsonb_agg(changed_fields ORDER BY version_number)
    INTO result
    FROM data_versions
    WHERE entity_type = p_entity_type
      AND entity_pk = p_entity_pk
      AND version_number <= p_version_number;
      
    RETURN result;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. 空间数据扩展设计

### 6.1 空间转录组支持

```sql
-- 空间元数据扩展表
CREATE TABLE spatial_metadata (
    pk SERIAL PRIMARY KEY,
    sample_pk INTEGER REFERENCES unified_samples(pk),
    
    -- 空间技术
    spatial_technology TEXT,     -- 'Visium', 'Slide-seq', 'Stereo-seq'
    spatial_ontology TEXT,       -- EFO ID
    
    -- 组织切片信息
    tissue_section_id TEXT,
    section_number INTEGER,      -- 切片序号
    section_thickness_um REAL,
    
    -- 空间坐标系
    coordinate_system TEXT,      -- 'pixel', 'micrometer', 'normalized'
    
    -- 图像信息
    has_h_e_image BOOLEAN,       -- H&E 染色图像
    has_if_image BOOLEAN,        -- 免疫荧光图像
    image_urls JSONB,            -- 图像文件链接
    
    -- 空间范围
    x_min REAL, x_max REAL,
    y_min REAL, y_max REAL,
    spot_count INTEGER,          -- 空间点数
    
    raw_metadata JSONB
);

-- 空间坐标表 (点级数据)
CREATE TABLE spatial_coordinates (
    pk BIGSERIAL PRIMARY KEY,
    spatial_pk INTEGER REFERENCES spatial_metadata(pk),
    
    spot_id TEXT,
    barcode TEXT,                -- 空间条形码
    
    -- 坐标
    x REAL,
    y REAL,
    
    -- 组织覆盖
    in_tissue BOOLEAN,
    tissue_type TEXT,
    
    -- 细胞组成 (反卷积结果)
    cell_type_composition JSONB  -- {"CD4_T_cell": 0.3, "B_cell": 0.2, ...}
);
```

---

## 7. 多组学数据整合设计

### 7.1 多组学元数据模型

```sql
-- 多组学实验表
CREATE TABLE multiomics_experiments (
    pk SERIAL PRIMARY KEY,
    sample_pk INTEGER REFERENCES unified_samples(pk),
    
    -- 组学类型
    omics_type TEXT,             -- 'transcriptomics', 'epigenomics', 'proteomics', 'genomics'
    omics_subtype TEXT,          -- 'scRNA-seq', 'scATAC-seq', 'CITE-seq', 'scDNA-seq'
    
    -- 实验详情
    experiment_id TEXT,
    library_id TEXT,
    
    -- 技术平台
    platform TEXT,
    platform_ontology TEXT,
    
    -- 数据处理
    processing_pipeline TEXT,    -- 'Cell Ranger', 'STARsolo', 'ArchR'
    reference_genome TEXT,       -- 'GRCh38', 'GRCm39'
    
    -- 数据文件
    raw_data_files JSONB,        -- FASTQ 文件
    processed_data_files JSONB,  -- 矩阵文件
    
    -- 质控
    qc_metrics JSONB,            -- 详细的质控指标
    
    UNIQUE(sample_pk, omics_type, experiment_id)
);

-- CITE-seq 蛋白标记表
CREATE TABLE cite_seq_antibodies (
    pk SERIAL PRIMARY KEY,
    experiment_pk INTEGER REFERENCES multiomics_experiments(pk),
    
    antibody_id TEXT,
    target_protein TEXT,
    target_gene TEXT,
    
    isotype TEXT,
    clone_id TEXT,
    
    positive_count INTEGER,      -- 阳性细胞数
    mean_expression REAL
);
```

---

## 8. 索引策略优化

### 8.1 查询模式分析

| 查询模式 | 频率 | 建议索引类型 |
|----------|------|-------------|
| 按组织搜索 | 高 | B-tree + Trigram |
| 按疾病搜索 | 高 | B-tree + Trigram |
| 按细胞类型 | 高 | B-tree + GIN |
| Faceted 过滤 | 高 | 复合索引 |
| 全文搜索 | 中 | GIN (pg_trgm) |
| 时间范围 | 中 | BRIN |
| 地理位置 | 低 | GiST (PostGIS) |

### 8.2 推荐索引配置

```sql
-- 核心查询索引
CREATE INDEX idx_samples_organism ON unified_samples(organism);
CREATE INDEX idx_samples_tissue ON unified_samples(tissue);
CREATE INDEX idx_samples_tissue_trgm ON unified_samples USING GIN (tissue gin_trgm_ops);
CREATE INDEX idx_samples_disease ON unified_samples(disease);
CREATE INDEX idx_samples_disease_trgm ON unified_samples USING GIN (disease gin_trgm_ops);

-- Faceted 搜索复合索引
CREATE INDEX idx_samples_faceted ON unified_samples(
    organism,
    source_database,
    tissue,
    disease,
    cell_type
);

-- 跨库关联索引
CREATE INDEX idx_identity_hash ON unified_samples(biological_identity_hash);
CREATE INDEX idx_individual_id ON unified_samples(individual_id);

-- 时间索引
CREATE INDEX idx_samples_collection_date ON unified_samples(collection_date);
CREATE INDEX idx_samples_loaded_brin ON unified_samples USING BRIN (etl_loaded_at);

-- JSON 索引
CREATE INDEX idx_samples_raw_metadata ON unified_samples USING GIN (raw_metadata jsonb_path_ops);
```

---

## 9. 数据分区策略

### 9.1 分区方案

```sql
-- 按数据源分区 (适合异构数据)
CREATE TABLE unified_samples (
    pk BIGSERIAL,
    sample_id TEXT NOT NULL,
    source_database TEXT NOT NULL,
    -- ...
) PARTITION BY LIST (source_database);

-- 创建分区
CREATE TABLE unified_samples_geo PARTITION OF unified_samples
    FOR VALUES IN ('geo');
    
CREATE TABLE unified_samples_ncbi PARTITION OF unified_samples
    FOR VALUES IN ('ncbi');
    
CREATE TABLE unified_samples_cellxgene PARTITION OF unified_samples
    FOR VALUES IN ('cellxgene');

-- 按时间分区 (适合时序数据)
CREATE TABLE unified_samples_2023 PARTITION OF unified_samples
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
```

### 9.2 分区优势

| 优势 | 说明 |
|------|------|
| 查询优化 | 分区裁剪减少扫描数据量 |
| 维护便利 | 可单独备份/归档旧分区 |
| 加载性能 | 并行加载到不同分区 |
| 数据生命周期 | 自动归档策略 |

---

## 10. 总结与建议

### 10.1 核心设计原则

1. **本体优先**: 所有生物学概念优先使用标准本体
2. **灵活扩展**: JSONB 字段支持非结构化元数据
3. **血缘追踪**: 完整的数据溯源和版本控制
4. **质量驱动**: 内置数据质量评分体系
5. **性能优化**: 针对查询模式设计索引策略

### 10.2 实施优先级

| 阶段 | 改进项 | 工作量 | 价值 |
|------|--------|--------|------|
| 1 | 本体双字段存储 | 1 周 | 高 |
| 2 | 数据血缘表 | 1 周 | 高 |
| 3 | 质量评分系统 | 2 周 | 中 |
| 4 | 时间维度优化 | 3 天 | 中 |
| 5 | 空间数据支持 | 2 周 | 中 |
| 6 | 多组学扩展 | 3 周 | 高 |

### 10.3 长期演进方向

1. **知识图谱**: 构建生物实体关系图谱
2. **语义搜索**: 基于本体的语义相似性搜索
3. **联邦查询**: 支持跨数据中心查询
4. **实时分析**: 流式数据处理和实时统计

