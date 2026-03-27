# 数据扩展工作流程

## 概述

本报告详细描述在现有架构下，如何高效、可靠地增加新数据源或更新现有数据源的工作流程。

---

## 1. 数据扩展类型

### 1.1 扩展分类

| 类型 | 描述 | 频率 | 复杂度 |
|------|------|------|--------|
| **新增数据源** | 整合全新的数据库 | 季度 | 高 |
| **数据源更新** | 现有数据源增量更新 | 周/月 | 中 |
| **Schema 扩展** | 新增字段或表 | 按需 | 中 |
| **本体更新** | UBERON/MONDO/CL 版本更新 | 半年 | 低 |
| **跨库关联更新** | 新增关联规则 | 月 | 中 |

---

## 2. 新增数据源工作流程

### 2.1 流程概览

```
阶段 1: 需求分析 (1-2 天)
    │
    ▼
阶段 2: 数据探索 (2-3 天)
    │
    ▼
阶段 3: ETL 开发 (3-5 天)
    │
    ▼
阶段 4: 测试验证 (2-3 天)
    │
    ▼
阶段 5: 集成上线 (1 天)
```

### 2.2 详细步骤

#### 阶段 1: 需求分析

**输入**: 数据源提案  
**输出**: 需求文档

```markdown
## 数据源评估模板

### 基本信息
- 数据源名称: 
- 数据规模: ___ 项目 / ___ 样本
- 更新频率: 
- 访问方式: API / FTP / 下载 / 爬虫

### 数据质量评估
- [ ] 元数据完整性 > 50%
- [ ] 有唯一标识符
- [ ] 数据可公开访问
- [ ] 有使用许可

### 技术可行性
- [ ] API 文档完整
- [ ] 提供测试环境
- [ ] 数据格式标准化

### 业务价值
- [ ] 补充现有数据空白
- [ ] 与现有数据源有重叠 (可关联)
- [ ] 有明确用户需求
```

#### 阶段 2: 数据探索

**目标**: 理解数据结构，制定映射策略

```python
# data_exploration.py 模板
import pandas as pd
import json

class DataExplorer:
    def __init__(self, source_name):
        self.source_name = source_name
        self.fields_stats = {}
        
    def analyze_structure(self, sample_data):
        """分析数据结构"""
        stats = {
            "total_records": len(sample_data),
            "fields": {},
            "id_fields": [],
            "hierarchy": []
        }
        
        # 字段统计
        for field in sample_data.columns:
            stats["fields"][field] = {
                "type": str(sample_data[field].dtype),
                "null_rate": sample_data[field].isnull().mean(),
                "unique_count": sample_data[field].nunique(),
                "sample_values": sample_data[field].dropna().head(5).tolist()
            }
            
        return stats
    
    def map_to_unified_schema(self, field_mapping):
        """映射到统一 Schema"""
        mapping_doc = {
            "source_database": self.source_name,
            "project_level": {},
            "series_level": {},
            "sample_level": {},
            "custom_transforms": []
        }
        return mapping_doc
```

**探索检查清单**:
- [ ] 数据层次结构分析
- [ ] ID 体系梳理
- [ ] 与现有数据源重叠分析
- [ ] 字段映射表制定
- [ ] 数据质量评估

#### 阶段 3: ETL 开发

**目标**: 实现新数据源的 ETL 模块

```python
# etl/new_source_etl.py
"""NewSource ETL: Import data into unified database."""

import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from etl.base import BaseETL
from config import NEW_SOURCE_DATA_PATH

logger = logging.getLogger(__name__)


class NewSourceETL(BaseETL):
    SOURCE_DATABASE = 'new_source'  # 数据源标识
    
    def extract_and_load(self):
        """主入口方法"""
        self._load_projects()
        self._load_series()
        self._load_samples()
        
    def _load_projects(self):
        """加载项目级数据"""
        logger.info(f"Loading {self.SOURCE_DATABASE} projects")
        # 实现项目加载逻辑
        pass
        
    def _load_series(self):
        """加载系列级数据"""
        logger.info(f"Loading {self.SOURCE_DATABASE} series")
        # 实现系列加载逻辑
        pass
        
    def _load_samples(self):
        """加载样本级数据"""
        logger.info(f"Loading {self.SOURCE_DATABASE} samples")
        # 实现样本加载逻辑
        pass


# ETL 开发检查清单
"""
[ ] 继承 BaseETL 基类
[ ] 定义 SOURCE_DATABASE 常量
[ ] 实现 extract_and_load 方法
[ ] 处理 ID 映射 (add_id_mapping)
[ ] 计算身份哈希 (compute_identity_hash)
[ ] 字段清洗和标准化
[ ] 错误处理和日志记录
[ ] 批处理优化
"""
```

**ETL 代码规范**:

```python
# 1. 数据源配置 (config.py)
NEW_SOURCE_PROJECTS = "data/new_source/projects.json"
NEW_SOURCE_SAMPLES = "data/new_source/samples.csv"

# 2. ETL 注册 (run_pipeline.py)
ETL_REGISTRY = {
    'cellxgene': CellXGeneETL,
    'ncbi': NcbiSraETL,
    'geo': GeoETL,
    'ebi': EbiETL,
    'new_source': NewSourceETL,  # 注册新 ETL
}

# 3. 字段映射文档
"""
字段映射表 (new_source → unified_schema):

Project Level:
- study_id → project_id
- study_title → title
- publication.pmid → pmid

Sample Level:
- donor_id → individual_id
- organ → tissue
- disease_status → disease
"""
```

#### 阶段 4: 测试验证

**单元测试**:
```python
# tests/unit/test_new_source_etl.py
import pytest
from etl.new_source_etl import NewSourceETL

class TestNewSourceETL:
    @pytest.fixture
    def etl(self, tmp_path):
        db_path = tmp_path / "test.db"
        return NewSourceETL(str(db_path))
    
    def test_extract_and_load(self, etl):
        etl.run()
        
        # 验证项目数
        cursor = etl.conn.execute(
            "SELECT COUNT(*) FROM unified_projects WHERE source_database = 'new_source'"
        )
        assert cursor.fetchone()[0] > 0
        
        # 验证样本数
        cursor = etl.conn.execute(
            "SELECT COUNT(*) FROM unified_samples WHERE source_database = 'new_source'"
        )
        assert cursor.fetchone()[0] > 0
        
    def test_id_mappings(self, etl):
        etl.run()
        
        # 验证 ID 映射
        cursor = etl.conn.execute(
            """SELECT COUNT(*) FROM id_mappings im
               JOIN unified_samples us ON im.entity_pk = us.pk
               WHERE us.source_database = 'new_source'"""
        )
        assert cursor.fetchone()[0] > 0
```

**集成测试**:
```python
# tests/integration/test_new_source_integration.py
def test_cross_database_linking():
    """测试跨库关联"""
    # 验证新数据源与现有数据源的关联
    pass

def test_ontology_mapping():
    """测试本体映射"""
    # 验证新数据源的组织/疾病字段能正确映射到本体
    pass
```

**验证检查清单**:
- [ ] 单元测试通过 (>90% 覆盖)
- [ ] 数据量验证 (与源数据一致)
- [ ] 字段映射验证
- [ ] ID 映射完整性验证
- [ ] 跨库关联验证
- [ ] 性能测试 (加载时间 < 目标值)

#### 阶段 5: 集成上线

**上线步骤**:
```bash
# 1. 数据库备份
cp unified_metadata.db unified_metadata.db.backup.$(date +%Y%m%d)

# 2. 运行新 ETL
python -m etl.new_source_etl

# 3. 运行跨库关联
python -m linker.id_linker
python -m linker.dedup

# 4. 更新统计表
python populate_stats.py

# 5. 更新索引
python apply_fts5.py

# 6. 验证
python -m tests.integration.test_new_source_integration

# 7. 上线
# - 更新生产数据库
# - 更新文档
# - 通知相关方
```

---

## 3. 数据源更新工作流程

### 3.1 增量更新流程

```
┌─────────────────────────────────────────────────────────────┐
│                    增量更新流程                              │
└─────────────────────────────────────────────────────────────┘

定时触发 (每周/每月)
    │
    ▼
┌─────────────────┐
│ 1. 检查数据源   │  ← API 获取最新记录数/更新时间
│    变更         │
└────────┬────────┘
         │ 有更新
         ▼
┌─────────────────┐
│ 2. 下载增量数据 │  ← 仅下载新增/修改记录
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. 加载增量数据 │  ← 使用 INSERT OR REPLACE
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. 更新关联     │  ← 增量 ID 匹配
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. 刷新统计     │  ← 增量更新统计表
└────────┬────────┘
         ▼
┌─────────────────┐
│ 6. 通知         │  ← 发送更新报告
└─────────────────┘
```

### 3.2 增量 ETL 实现

```python
class IncrementalETL(BaseETL):
    """增量更新基类"""
    
    def get_last_update_time(self) -> datetime:
        """从数据库获取最后更新时间"""
        cursor = self.conn.execute(
            """SELECT MAX(etl_loaded_at) FROM etl_run_log 
               WHERE source_database = ? AND status = 'completed'""",
            (self.SOURCE_DATABASE,)
        )
        result = cursor.fetchone()
        return datetime.fromisoformat(result[0]) if result[0] else None
    
    def extract_incremental(self, since: datetime):
        """提取增量数据 - 子类实现"""
        raise NotImplementedError
    
    def upsert_records(self, table: str, rows: List[Dict]):
        """插入或更新记录"""
        for row in rows:
            self.conn.execute(
                f"""INSERT INTO {table} ({columns}) VALUES ({placeholders})
                    ON CONFLICT(unique_key) DO UPDATE SET
                    {update_columns}""",
                values
            )
```

### 3.3 自动化调度

```yaml
# crontab 示例
# 每周日凌晨 2 点更新
0 2 * * 0 cd /opt/scgb && python run_pipeline.py --source cellxgene --incremental

# 每天凌晨 3 点更新 NCBI
0 3 * * * cd /opt/scgb && python run_pipeline.py --source ncbi --incremental
```

```python
# scheduler.py 使用 APScheduler
from apscheduler.schedulers.background import BackgroundScheduler

def schedule_updates():
    scheduler = BackgroundScheduler()
    
    # CellXGene: 每周更新
    scheduler.add_job(
        run_incremental_etl, 
        'cron', 
        day_of_week='sun', 
        hour=2,
        args=['cellxgene']
    )
    
    # NCBI: 每天更新
    scheduler.add_job(
        run_incremental_etl,
        'cron',
        hour=3,
        args=['ncbi']
    )
    
    scheduler.start()
```

---

## 4. Schema 扩展工作流程

### 4.1 Schema 变更类型

| 类型 | 示例 | 风险等级 |
|------|------|---------|
| 新增字段 | 添加 `sequencing_date` | 低 |
| 修改字段类型 | TEXT → JSON | 中 |
| 新增表 | 创建 `batch_metadata` | 低 |
| 修改索引 | 增加复合索引 | 低 |
| 删除字段 | 移除废弃字段 | 高 |

### 4.2 Schema 迁移流程

```
1. 设计评审
   - Schema 变更提案
   - 影响分析 (哪些 ETL 需要修改)
   - 回滚方案

2. 迁移脚本开发
   - 正向迁移 (upgrade)
   - 回滚脚本 (downgrade)

3. 测试环境验证
   - 迁移脚本测试
   - ETL 适配测试
   - API 兼容性测试

4. 生产环境部署
   - 数据库备份
   - 执行迁移
   - 验证

5. 文档更新
```

### 4.3 迁移脚本示例

```python
# migrations/20240312_add_sequencing_date.py
"""
Migration: Add sequencing_date field to unified_samples
"""

UPGRADE = """
-- 新增字段
ALTER TABLE unified_samples ADD COLUMN sequencing_date TEXT;

-- 创建索引
CREATE INDEX idx_samples_sequencing_date ON unified_samples(sequencing_date);

-- 更新统计
UPDATE stats_overall SET value = value + 1 WHERE metric = 'schema_version';
"""

DOWNGRADE = """
-- 删除索引
DROP INDEX IF EXISTS idx_samples_sequencing_date;

-- 删除字段 (SQLite 不支持直接删除，需要重建表)
-- 使用重建表策略
"""

def upgrade(conn):
    """执行升级"""
    conn.executescript(UPGRADE)
    conn.commit()
    
def downgrade(conn):
    """执行回滚"""
    conn.executescript(DOWNGRADE)
    conn.commit()

if __name__ == '__main__':
    import sqlite3
    conn = sqlite3.connect('unified_metadata.db')
    upgrade(conn)
```

---

## 5. 本体更新工作流程

### 5.1 本体版本管理

```
ontologies/
├── UBERON/
│   ├── uberon.obo (当前版本)
│   ├── uberon_v2023-09-.obo (历史版本)
│   └── uberon_v2024-01-.obo (新版本)
├── MONDO/
├── CL/
└── EFO/
```

### 5.2 本体更新流程

```bash
#!/bin/bash
# update_ontologies.sh

echo "Updating ontology cache..."

# 1. 下载新版本本体
./scripts/download_ontologies.sh

# 2. 构建新缓存
python scripts/build_ontology_cache.py --output ontology_cache_new.db

# 3. 验证新缓存
python -m tests.unit.test_ontology_resolver

# 4. 切换缓存 (原子操作)
mv ontology_cache.db ontology_cache.db.backup
mv ontology_cache_new.db ontology_cache.db

# 5. 重启应用以使用新缓存
systemctl restart scgb-api

echo "Ontology update completed"
```

---

## 6. 数据质量管理

### 6.1 质量检查规则

```python
# quality_checks.py
QUALITY_RULES = {
    "completeness": {
        "description": "必填字段非空率",
        "rules": [
            {"field": "organism", "min_rate": 0.99},
            {"field": "tissue", "min_rate": 0.50},
            {"field": "disease", "min_rate": 0.30},
        ]
    },
    "consistency": {
        "description": "跨库一致性",
        "rules": [
            {"check": "id_mapping_integrity", "min_rate": 0.95},
            {"check": "ontology_mapping_rate", "min_rate": 0.60},
        ]
    },
    "uniqueness": {
        "description": "唯一性约束",
        "rules": [
            {"constraint": "project_id + source_database", "unique": True},
            {"constraint": "sample_id + source_database", "unique": True},
        ]
    }
}
```

### 6.2 质量监控仪表板

```python
# quality_dashboard.py
def generate_quality_report():
    """生成数据质量报告"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "overall_score": 0,
        "by_source": {},
        "by_field": {},
        "issues": []
    }
    
    # 计算各数据源质量分数
    for source in DATA_SOURCES:
        report["by_source"][source] = calculate_source_quality(source)
    
    # 计算各字段完整度
    for field in FIELDS:
        report["by_field"][field] = calculate_field_completeness(field)
    
    return report
```

---

## 7. 文档与沟通

### 7.1 数据源文档模板

```markdown
# 数据源: [名称]

## 基本信息
- 接入时间: 
- 维护负责人: 
- 更新频率: 

## 数据规模
- 项目数: 
- 样本数: 
- 细胞类型注释: 

## 字段映射
| 源字段 | 目标字段 | 转换规则 |
|--------|---------|---------|
| | | |

## 特殊处理
- 

## 已知问题
- 
```

### 7.2 变更通知流程

```
数据变更
    │
    ▼
┌─────────────────┐
│ 1. 记录变更日志 │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. 发送通知     │  ← Slack/邮件
│    (相关人员)   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. 更新文档     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. 验证         │  ← 确认变更生效
└─────────────────┘
```

