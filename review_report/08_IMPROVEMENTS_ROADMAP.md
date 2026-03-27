# 改进建议与开发路线图

## 概述

本报告总结 SCGB 平台当前需要改进的地方，并提供分阶段的开发路线图。

---

## 1. 当前改进优先级

### 1.1 P0 - 立即行动 (阻塞性问题)

| 问题 | 影响 | 解决方案 | 预估工作量 |
|------|------|---------|-----------|
| SQLite 并发限制 | 生产部署阻塞 | 迁移至 PostgreSQL | 2 周 |
| 缺少连接池监控 | 连接泄漏风险 | 增加连接池指标 | 2 天 |
| 无数据备份策略 | 数据丢失风险 | 实现自动备份 | 3 天 |

### 1.2 P1 - 短期优化 (1-3 个月)

| 问题 | 影响 | 解决方案 | 预估工作量 |
|------|------|---------|-----------|
| 本体解析通过率 76% | 查询准确性 | 增强 umbrella 术语 | 1 周 |
| 统计查询通过率 80% | 复杂查询体验 | 统计模板库 | 2 周 |
| 前端包 813KB | 首屏加载慢 | 代码分割 + Lazy | 3 天 |
| 缺少数据版本追踪 | 溯源困难 | 版本表 + 审计日志 | 1 周 |
| 无管理后台 | 运维效率低 | 简单管理界面 | 2 周 |

### 1.3 P2 - 中期演进 (3-6 个月)

| 改进项 | 价值 | 解决方案 | 预估工作量 |
|--------|------|---------|-----------|
| 接入更多数据源 | 数据覆盖 | ENCODE, Allen Brain | 3 周 |
| 用户认证系统 | 个性化服务 | JWT + OAuth | 2 周 |
| 数据下载中心 | 用户体验 | 批量下载 + 脚本生成 | 1 周 |
| API 限流优化 | 稳定性 | 令牌桶限流 | 3 天 |

### 1.4 P3 - 长期规划 (6-12 个月)

| 改进项 | 价值 | 解决方案 | 预估工作量 |
|--------|------|---------|-----------|
| 空间转录组支持 | 技术领先 | 空间坐标存储 | 4 周 |
| 单细胞多组学 | 数据深度 | ATAC-seq 整合 | 6 周 |
| 联邦学习架构 | 隐私计算 | 数据联邦化 | 8 周 |
| 机器学习平台 | 智能分析 | 自动注释 pipeline | 8 周 |

---

## 2. 详细改进计划

### 2.1 PostgreSQL 迁移 (P0)

**迁移方案**:
```python
# 迁移步骤
MIGRATION_STEPS = [
    "1. PostgreSQL 环境搭建",
    "2. Schema 转换 (SQLite → PostgreSQL)",
    "3. 数据导出导入",
    "4. 索引重建",
    "5. 应用配置更新",
    "6. 性能测试",
    "7. 灰度切换",
    "8. 旧系统下线"
]
```

**关键变更**:
```sql
-- 主键类型
BIGSERIAL PRIMARY KEY  -- 替代 INTEGER PRIMARY KEY

-- 布尔类型
BOOLEAN                -- 替代 INTEGER (0/1)

-- JSON 类型
JSONB                  -- 替代 TEXT (JSON 字符串)

-- 全文搜索
USING GIN (tissue gin_trgm_ops)  -- 替代 FTS5
```

**回滚方案**:
- 双写机制: 同时写入 SQLite 和 PostgreSQL
- 数据校验: 定期对比两个数据库的数据一致性
- 快速回滚: DNS 切回 SQLite 服务

---

### 2.2 本体解析增强 (P1)

**问题分析**:
- Umbrella 术语覆盖率不足
- LLM 辅助消歧未实现
- 中文支持有限

**解决方案**:
```python
class EnhancedOntologyResolver(OntologyResolver):
    """增强版本体解析器"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 扩展 umbrella 术语库
        self.UMBRELLA_TERMS.update({
            "hematopoietic system": [
                "bone marrow", "spleen", "thymus", 
                "lymph node", "blood"
            ],
            "nervous system": [
                "brain", "spinal cord", "peripheral nerve",
                "cerebral cortex", "hippocampus", "cerebellum"
            ],
            # 更多...
        })
    
    def _step4_llm_disambiguation(self, candidates: List[Dict], context: str) -> Dict:
        """LLM 辅助消歧"""
        if not self.llm or len(candidates) <= 1:
            return candidates[0] if candidates else None
            
        prompt = f"""
        从以下候选术语中选择最匹配的一个:
        上下文: {context}
        候选:
        {json.dumps(candidates, indent=2)}
        
        返回最佳匹配的索引 (0-{len(candidates)-1})
        """
        
        response = self.llm.complete(prompt)
        try:
            best_idx = int(response.strip())
            return candidates[best_idx]
        except:
            return candidates[0]
```

**预期提升**:
- 本体解析通过率: 76% → 90%
- 模糊查询准确率: +15%

---

### 2.3 统计查询优化 (P1)

**问题分析**:
- 复杂统计查询需要 LLM 辅助
- 部分查询无法生成有效 SQL

**解决方案**:
```python
# 统计查询模板库
STATS_TEMPLATES = {
    "count_by_year": """
        SELECT 
            substr(publication_date, 1, 4) as year,
            COUNT(*) as project_count
        FROM unified_projects
        WHERE publication_date IS NOT NULL
        GROUP BY year
        ORDER BY year
    """,
    
    "tissue_disease_heatmap": """
        SELECT 
            tissue,
            disease,
            COUNT(*) as sample_count
        FROM unified_samples
        WHERE tissue IS NOT NULL AND disease IS NOT NULL
        GROUP BY tissue, disease
        ORDER BY sample_count DESC
        LIMIT 100
    """,
    
    "data_growth_trend": """
        SELECT 
            strftime('%Y-%m', etl_loaded_at) as month,
            COUNT(*) as new_samples
        FROM unified_samples
        GROUP BY month
        ORDER BY month
    """
}

class StatsQueryHandler:
    """统计查询专用处理器"""
    
    def handle(self, parsed_query: ParsedQuery) -> Optional[str]:
        """匹配统计模板"""
        query_type = self.classify_stats_query(parsed_query)
        return STATS_TEMPLATES.get(query_type)
    
    def classify_stats_query(self, parsed: ParsedQuery) -> str:
        """分类统计查询类型"""
        text = parsed.original_text.lower()
        
        if "year" in text and "count" in text:
            return "count_by_year"
        if "heatmap" in text or "correlation" in text:
            return "tissue_disease_heatmap"
        if "growth" in text or "trend" in text:
            return "data_growth_trend"
        
        return "custom"
```

---

### 2.4 前端优化 (P1)

**代码分割**:
```typescript
// router.tsx
import { lazy, Suspense } from 'react';

const Explore = lazy(() => import('./pages/Explore'));
const Stats = lazy(() => import('./pages/Stats'));
const Chat = lazy(() => import('./pages/Chat'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Suspense>
  );
}
```

**预期效果**:
- 首屏加载: 813KB → ~300KB
- 首次内容绘制 (FCP): <1.5s

---

### 2.5 管理后台 (P1)

**功能设计**:
```
管理后台功能:
├── 数据管理
│   ├── ETL 运行状态
│   ├── 数据质量报告
│   └── 跨库关联审核
├── 系统监控
│   ├── API 调用统计
│   ├── 查询性能分析
│   └── 错误日志
├── 内容管理
│   ├── 精选数据集
│   └── 公告管理
└── 用户管理 (P2)
    ├── 用户列表
    └── 权限管理
```

**技术栈**:
- 前端: React + Ant Design Pro
- 后端复用现有 FastAPI
- 权限: JWT + RBAC

---

### 2.6 新数据源接入 (P2)

**优先级排序**:

| 数据源 | 样本预估 | 价值 | 难度 | 优先级 |
|--------|---------|------|------|--------|
| Tabula Sapiens | 50,000 | 高 | 中 | 1 |
| ENCODE | 50,000 | 高 | 高 | 2 |
| Allen Brain Atlas | 30,000 | 高 | 中 | 3 |
| Mouse Cell Atlas | 100,000 | 中 | 低 | 4 |
| CNGBdb | 20,000 | 中 | 中 | 5 |

**Tabula Sapiens ETL 示例**:
```python
class TabulaSapiensETL(BaseETL):
    SOURCE_DATABASE = 'tabula_sapiens'
    
    def extract_and_load(self):
        # Tabula Sapiens 提供标准化的 H5AD 文件
        # 使用 scanpy 读取
        import scanpy as sc
        
        adata = sc.read_h5ad(TABULA_SAPIENS_PATH)
        
        # 提取观测数据 (obs)
        obs_df = adata.obs
        
        # 映射到统一 Schema
        for idx, row in obs_df.iterrows():
            sample_rec = {
                'sample_id': row['donor_id'],
                'tissue': row['tissue'],
                'cell_type': row['cell_type'],
                'organism': 'Homo sapiens',
                # ...
            }
            self.insert_one('unified_samples', sample_rec)
```

---

## 3. 开发路线图

### 3.1 Q2 2026 (4-6 月)

```
Month 1 (4月)
├── Week 1-2: PostgreSQL 迁移
│   └── 核心任务: 数据库迁移
├── Week 3: 连接池监控 + 备份策略
└── Week 4: 性能优化 + 压力测试

Month 2 (5月)
├── Week 1-2: 本体解析增强
│   └── 目标: 通过率 76% → 90%
├── Week 3: 统计查询模板库
└── Week 4: 前端代码分割

Month 3 (6月)
├── Week 1-2: 管理后台开发
├── Week 3: Tabula Sapiens 接入
└── Week 4: 测试 + 文档更新
```

### 3.2 Q3 2026 (7-9 月)

```
Month 4 (7月)
├── ENCODE 数据接入
├── 用户认证系统
└── API 限流优化

Month 5 (8月)
├── Allen Brain Atlas 接入
├── 数据下载中心增强
└── 性能监控完善

Month 6 (9月)
├── 数据版本追踪系统
├── 本体缓存增量更新
└── Q3 总结 + Q4 规划
```

### 3.3 Q4 2026 (10-12 月)

```
Month 7-8 (10-11月)
├── 空间转录组支持
│   └── 空间坐标存储
│   └── 组织切片图像元数据
├── 单细胞多组学整合
│   └── ATAC-seq 元数据
│   └── 蛋白组数据链接

Month 9 (12月)
├── 年度总结
├── 性能基准测试
└── 2027 年规划
```

---

## 4. 技术债务清理

### 4.1 债务清单

| 债务项 | 创建时间 | 影响 | 清理计划 |
|--------|---------|------|---------|
| 硬编码配置 | 初始开发 | 部署不灵活 | Q2 M1 |
| 缺少类型注解 | 初始开发 | 可维护性 | Q2 M2 |
| 测试覆盖率不足 | 持续 | 质量风险 | Q2-Q3 |
| 文档不完整 | 持续 | 上手困难 | 持续 |

### 4.2 代码重构计划

```python
# 重构: 配置管理
# Before
DB_PATH = "data/unified_metadata.db"

# After
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_path: str = "data/unified_metadata.db"
    pg_host: str = "localhost"
    pg_port: int = 5432
    # ...
    
    class Config:
        env_file = ".env"
```

---

## 5. 团队能力建设

### 5.1 技能矩阵

| 技能 | 当前 | 需求 | 提升计划 |
|------|------|------|---------|
| PostgreSQL DBA | 中 | 高 | 培训 + 实践 |
| DevOps | 低 | 中 | 工具链学习 |
| 前端性能优化 | 中 | 高 | 专项训练 |
| 生物信息学 | 低 | 中 | 领域知识 |

### 5.2 知识管理

```
docs/
├── architecture/       # 架构文档
├── api/               # API 文档
├── deployment/        # 部署文档
├── etl/              # ETL 开发指南
└── onboarding/       # 新人上手
```

---

## 6. 风险评估与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 数据库迁移失败 | 中 | 高 | 双写 + 灰度 + 回滚方案 |
| 数据源 API 变更 | 高 | 中 | 监控 + 适配器模式 |
| 性能不达标 | 中 | 高 | 提前压测 + 优化预案 |
| 人员变动 | 中 | 中 | 文档 + 知识传承 |

