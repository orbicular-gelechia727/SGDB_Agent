# 单细胞测序领域数据特点深度分析

## 概述

单细胞 RNA 测序 (scRNA-seq) 数据具有独特的生物学和技术特征，这些特征对元数据管理、数据整合和查询系统提出了特殊挑战。

---

## 1. 单细胞数据的多层次结构

### 1.1 生物学层次 vs 数据层次

```
生物学层次 (Biological Hierarchy):
┌─────────────────────────────────────────────────────────────┐
│  Individual (个体)                                          │
│    ├── Donor/Patient (捐赠者/患者)                          │
│    │     └── 不同时间点/条件采样                            │
│    │                                                         │
│    └── Samples (样本)                                       │
│          ├── Tissue (组织) - liver, brain, etc.             │
│          │     └── Multiple cell populations                 │
│          └── Cell Types (细胞类型)                          │
│                ├── Hepatocyte                                │
│                ├── T-cell                                    │
│                └── ... (thousands of types)                  │
└─────────────────────────────────────────────────────────────┘

数据层次 (Data Hierarchy):
┌─────────────────────────────────────────────────────────────┐
│  Study/Project (研究项目)                                   │
│    ├── Series/Experiment (实验批次)                         │
│    │     └── Multiple sequencing runs                        │
│    │                                                         │
│    └── Dataset (数据集)                                     │
│          ├── Raw Data (FASTQ)                                │
│          ├── Processed (Count Matrix)                        │
│          └── Analyzed (H5AD/RDS with embeddings)             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据版本复杂性

**版本链示例**:
```
原始测序数据 (SRA/FASTQ)
    │
    ├──► Cell Ranger 处理
    │       └── raw_feature_bc_matrix.h5
    │
    ├──► 作者处理版本 (Seurat/Scanpy)
    │       └── Seurat object / H5AD
    │
    └──► CellXGene 标准化版本
            └── 标准化 H5AD + 统一注释
```

**对统一数据库的影响**:
- 同一样本可能关联多个数据集版本
- 需要追踪数据血缘 (data lineage)
- 查询时需要选择"最佳"版本

---

## 2. 技术平台多样性

### 2.1 主要测序平台

| 平台 | 特点 | 数据量 | 占平台比例 |
|------|------|--------|-----------|
| 10x Genomics | 高通量，3'/5' 端 | ~3K-10K cells/sample | ~70% |
| Smart-seq2 | 全长，低通量 | ~100-500 cells/sample | ~10% |
| Drop-seq | 早期高通量 | ~1K-5K cells/sample | ~5% |
| Seq-Well | 便携式 | ~1K-3K cells/sample | ~3% |
| inDrops | 哈佛开发 | ~1K-5K cells/sample | ~2% |
| 其他 | 各种定制方法 | 各异 | ~10% |

### 2.2 技术元数据字段

```python
# 技术平台相关字段
technology_metadata = {
    "assay": "10x 3' v3",                    # 实验方法
    "assay_ontology": "EFO:0009922",        # 标准本体ID
    "platform": "ILLUMINA",                  # 测序平台
    "instrument_model": "NovaSeq 6000",     # 仪器型号
    "chemistry_version": "v3",               # 化学版本
    "suspension_type": "cell",               # cell/nucleus
    "library_strategy": "RNA-Seq",
    "library_selection": "cDNA",
    "library_layout": "SINGLE/PAIRED",
    "read_length": 98,
    "run_count": 4,
}
```

### 2.3 数据质量指标

| 指标 | 正常范围 | 说明 |
|------|---------|------|
| n_cells | 100 - 30,000 | 细胞数量 |
| n_genes | 500 - 8,000 | 每个细胞检测到的基因数 |
| mean_genes_per_cell | 1,000 - 4,000 | 平均基因检测数 |
| total_counts | 2,000 - 20,000 | 每个细胞总UMI数 |
| percent_mitochondrial | <5-20% | 线粒体基因比例 |
| percent_ribosomal | 5-50% | 核糖体基因比例 |

---

## 3. 细胞类型注释的复杂性

### 3.1 细胞类型本体挑战

**命名不一致性**:
```
同一细胞类型的多种命名:
- "CD4 T cell" / "CD4+ T cell" / "T helper cell"
- "Macrophage" / "Macrophage M1" / "Pro-inflammatory macrophage"
- "Fibroblast" / "fibroblast cell" / "fibroblasts"
```

**层级关系**:
```
Cell Ontology (CL) 层级示例:
CL:0000542  (lymphocyte)
├── CL:0000084 (T cell)
│     ├── CL:0000624 (CD4+ T cell)
│     │     ├── CL:0000895 (naive thymus-derived CD4+ T cell)
│     │     └── CL:0000909 (CD4+ memory T cell)
│     └── CL:0000625 (CD8+ T cell)
└── CL:0000236 (B cell)
```

### 3.2 细胞类型存储策略

```sql
-- 策略 1: 主细胞类型 + 详细类型表
CREATE TABLE unified_celltypes (
    pk INTEGER PRIMARY KEY,
    sample_pk INTEGER REFERENCES unified_samples(pk),
    cell_type_name TEXT NOT NULL,        -- 如 "CD4+ T cell"
    cell_type_ontology_term_id TEXT,      -- 如 "CL:0000624"
    cell_type_general TEXT,              -- 如 "T cell" (上层)
    cell_count INTEGER,                  -- 该类型细胞数
    proportion REAL,                     -- 比例
    source_database TEXT,
    annotation_method TEXT               -- 注释方法: author/algorithm
);
```

### 3.3 细胞类型统计

| 统计项 | 数值 |
|--------|------|
| 唯一细胞类型名称 | ~50,000 |
| CL 本体映射率 | 60-70% |
| 平均每个样本细胞类型数 | 15-30 |
| 最大细胞类型数 (样本) | >100 |

---

## 4. 组织与空间复杂性

### 4.1 UBERON 本体映射

**组织层次**:
```
UBERON:0000062  (organ)
├── UBERON:0002107 (liver)
│     ├── UBERON:0001279 (lobule of liver)
│     └── UBERON:0001172 (biliary tree)
├── UBERON:0000955 (brain)
│     ├── UBERON:0001950 (neocortex)
│     ├── UBERON:0002421 (hippocampus)
│     └── ... (hundreds of subregions)
```

### 4.2 组织标注挑战

| 挑战 | 示例 | 解决方案 |
|------|------|---------|
| 精度差异 | "brain" vs "frontal cortex" vs "layer 5 pyramidal neuron" | 本体层级扩展 |
| 疾病状态 | "tumor" vs "adjacent normal" vs "healthy" | 标准化疾病词汇 |
| 空间位置 | "proximal tubule" vs "distal tubule" | 解剖学本体 |

---

## 5. 疾病状态标注

### 5.1 MONDO 疾病本体

```
MONDO:0000001  (disease)
├── MONDO:0005027 (epilepsy)
├── MONDO:0007254 (hepatocellular carcinoma)
├── MONDO:0004975 (Alzheimer disease)
│     └── MONDO:0004976 (familial Alzheimer disease)
└── MONDO:0005267 (inflammatory bowel disease)
      ├── MONDO:0000709 (Crohn disease)
      └── MONDO:0005095 (ulcerative colitis)
```

### 5.2 疾病标注模式

| 数据源 | 标注方式 | 完整度 |
|--------|---------|--------|
| CellXGene | MONDO 本体 + "normal" | 95% |
| GEO | 自由文本 | 40% |
| HCA | 标准化 + developmental stage | 90% |
| NCBI | 稀疏 | 30% |

### 5.3 疾病状态分类

```python
disease_categories = {
    "cancer": ["carcinoma", "sarcoma", "leukemia", "lymphoma", "tumor"],
    "neurodegenerative": ["Alzheimer", "Parkinson", "ALS", "Huntington"],
    "autoimmune": ["lupus", "rheumatoid arthritis", "multiple sclerosis"],
    "metabolic": ["diabetes", "obesity", "NAFLD"],
    "infectious": ["COVID-19", "HIV", "hepatitis"],
    "cardiovascular": ["heart failure", "atherosclerosis", "hypertension"],
    "normal": ["healthy", "normal", "control"],
}
```

---

## 6. 发育阶段追踪

### 6.1 HsapDv (人类发育阶段)

```
HsapDv:0000001 (human life cycle stage)
├── HsapDv:0000002 (embryonic stage)         # 胚胎期
├── HsapDv:0000037 (fetal stage)             # 胎儿期
├── HsapDv:0000080 (newborn)                 # 新生儿
├── HsapDv:0000086 (child stage)             # 儿童期
├── HsapDv:0000081 (adolescent stage)        # 青春期
├── HsapDv:0000087 (human adult stage)       # 成年期
│     ├── HBERON:0000001 (young adult)       # 青年
│     ├── HBERON:0000002 (middle aged)       # 中年
│     └── HBERON:0000003 (elderly)           # 老年
└── HsapDv:0000095 (deceased)
```

### 6.2 年龄表示标准化

```python
# 年龄解析策略
def normalize_age(age_str: str) -> Tuple[float, str]:
    """
    输入: "35-year-old", "P35Y", "35", "fetal week 12"
    输出: (35.0, "year")
    """
    patterns = [
        (r'(\d+)-year-old', lambda m: (float(m.group(1)), 'year')),
        (r'(\d+)\s*y', lambda m: (float(m.group(1)), 'year')),
        (r'(\d+)\s*months?', lambda m: (float(m.group(1)) / 12, 'year')),
        (r'fetal week (\d+)', lambda m: (float(m.group(1)), 'gestational_week')),
        (r'P(\d+)Y', lambda m: (float(m.group(1)), 'year')),  # ISO 8601
    ]
```

---

## 7. 批次效应与技术噪声

### 7.1 批次信息追踪

```sql
-- 批次相关信息
CREATE TABLE batch_metadata (
    pk INTEGER PRIMARY KEY,
    series_pk INTEGER REFERENCES unified_series(pk),
    batch_id TEXT,              -- 批次标识
    sequencing_date TEXT,       -- 测序日期
    sequencing_center TEXT,     -- 测序中心
    library_preparation_date TEXT,
    technician_id TEXT,
    kit_lot_number TEXT,        -- 试剂盒批次
    flowcell_id TEXT,           -- 测序芯片ID
);
```

### 7.2 技术协变量

| 协变量 | 影响 | 存储方式 |
|--------|------|---------|
| sequencing_date | 时间批次效应 | batch_metadata |
| sequencing_center | 实验室批次效应 | batch_metadata |
| library_prep_batch | 建库批次 | batch_metadata |
| percent_mito | 细胞质量 | unified_samples |
| nCount_RNA | 测序深度 | unified_samples |

---

## 8. 对统一数据库的设计要求

### 8.1 Schema 设计原则

1. **多对多关系支持**: 样本-细胞类型、样本-疾病、样本-数据集
2. **版本追踪**: 数据血缘、处理流程追踪
3. **本体集成**: UBERON/MONDO/CL/EFO 标准术语
4. **灵活扩展**: JSON 字段支持非标准元数据

### 8.2 查询模式分析

| 查询类型 | 频率 | 复杂度 | 优化策略 |
|----------|------|--------|---------|
| 按组织查询 | 高 | 低 | 索引 + 本体扩展 |
| 按疾病查询 | 高 | 中 | 索引 + 同义词 |
| 按细胞类型 | 高 | 高 | 细胞类型表 + JOIN |
| 跨库去重 | 中 | 高 | Identity Hash |
| 统计分析 | 中 | 高 | 预计算表 |

### 8.3 数据质量要求

```python
# 数据质量评分维度
quality_metrics = {
    "completeness": 0.85,    # 元数据完整度
    "consistency": 0.90,     # 跨库一致性
    "accuracy": 0.80,        # 本体映射准确度
    "timeliness": 0.95,      # 数据时效性
    "traceability": 0.70,    # 数据溯源完整度
}
```

---

## 9. 单细胞数据未来趋势

### 9.1 新兴技术

| 技术 | 数据特点 | 元数据需求 |
|------|---------|-----------|
| 空间转录组 | 空间坐标 + 表达 | 组织切片、空间坐标 |
| 单细胞 ATAC-seq | 染色质可及性 | 峰值注释、调控元件 |
| 单细胞多组学 | 转录+蛋白+表观 | 多模态对齐 |
| 单细胞 CRISPR | 扰动信息 | gRNA 序列、扰动条件 |

### 9.2 对系统的扩展要求

1. **空间数据支持**: 增加空间坐标存储
2. **多组学整合**: 扩展 assays 表支持多组学
3. **时间序列**: 支持发育/疾病时间轨迹
4. **图像数据**: 组织切片图像元数据

