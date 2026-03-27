# 改进建议与行动计划

## 1. 问题汇总与优先级

### 1.1 高优先级 (立即处理)

| # | 问题 | 影响 | 建议方案 | 工作量 |
|---|------|------|----------|--------|
| 1 | 本体解析通过率 76% | 影响语义查询准确性 | 优化 umbrella term 扩展逻辑 | 3 天 |
| 2 | Memory 模块缺少测试 | 技术债务 | 添加单元测试 | 2 天 |
| 3 | 前端包体积 813KB | 首次加载性能 | 实施代码分割 | 2 天 |

### 1.2 中优先级 (1个月内)

| # | 问题 | 影响 | 建议方案 | 工作量 |
|---|------|------|----------|--------|
| 4 | 统计查询通过率 80% | 复杂统计能力 | 增强时间维度解析 | 1 周 |
| 5 | 预计算表需手动刷新 | 运维成本 | 自动化刷新机制 | 3 天 |
| 6 | cell_type 视图缺失 | 查询复杂度 | 创建联合视图 | 半天 |
| 7 | 移动端响应式优化 | 移动端体验 | 优化布局 | 1 周 |
| 8 | 缺少部署文档 | 部署便利 | 编写部署指南 | 2 天 |

### 1.3 低优先级 (3个月内)

| # | 问题 | 影响 | 建议方案 | 工作量 |
|---|------|------|----------|--------|
| 9 | SQLite 并发限制 | 扩展性 | 评估 PostgreSQL 迁移 | 2 周 |
| 10 | 增量 ETL 支持 | 重建时间 | 实现增量更新 | 2 周 |
| 11 | PWA 支持 | 离线访问 | 添加 Service Worker | 2 周 |
| 12 | 用户认证 | 个性化功能 | 实现认证系统 | 1 月 |

---

## 2. 详细改进方案

### 2.1 本体解析优化 (高优先级)

**问题**: Ontology Expansion 通过率 76% (19/25)

**根因分析**:
- Umbrella term 扩展深度不足
- 部分同义词未收录
- Fuzzy 匹配阈值过高

**改进方案**:
```python
# 1. 增加递归扩展深度
class OntologyResolver:
    def expand_term(self, term_id: str, depth: int = 3):  # depth: 1→3
        ...

# 2. 添加更多同义词源
# - 从 OBO 文件提取 exact_synonym
# - 从数据库常见值学习

# 3. 调整模糊匹配阈值
FUZZY_THRESHOLD = 0.75  # 0.85→0.75

# 4. 添加领域特定扩展规则
TISSUE_EXPAND_RULES = {
    "liver": ["hepatocyte", "bile duct", "kupffer cell"],
    "brain": ["neuron", "glia", "cortex", "hippocampus"],
}
```

**预期收益**: 通过率 76% → 90%

---

### 2.2 前端性能优化 (高优先级)

**问题**: 包体积 813KB (246KB gzip)

**改进方案**:
```typescript
// 1. 代码分割
// App.tsx
const StatsPage = lazy(() => import('./pages/StatsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const DownloadsPage = lazy(() => import('./pages/DownloadsPage'));

// 2. 按需导入 Recharts
// 当前
import { BarChart, Bar, LineChart, Line, PieChart, Pie, ... } from 'recharts';

// 优化
import { BarChart, Bar } from 'recharts/es6/chart/BarChart';
import { LineChart, Line } from 'recharts/es6/chart/LineChart';

// 3. Tree Shaking
// 确保使用 ES Module 导入
```

**预期收益**: 813KB → 500KB (首屏)

---

### 2.3 数据库优化 (中优先级)

**问题 1**: 预计算表需手动刷新

**解决方案**:
```python
# 在 run_pipeline.py 中添加
class PipelineOrchestrator:
    def run(self, phase: str):
        if phase in ('all', 'load'):
            self.run_etl()
            self.refresh_stats()  # 自动刷新
            self.apply_indexes()  # 自动应用索引
    
    def refresh_stats(self):
        subprocess.run(['python', 'populate_stats.py'])
        subprocess.run(['python', 'apply_fts5.py'])
```

**问题 2**: cell_type 查询需 JOIN

**解决方案**:
```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW v_sample_with_celltype AS
SELECT 
    s.*,
    GROUP_CONCAT(DISTINCT c.cell_type) as cell_types,
    SUM(c.cell_count) as total_cell_count
FROM unified_samples s
LEFT JOIN unified_celltypes c ON s.sample_id = c.sample_id
GROUP BY s.sample_id;

-- 创建索引
CREATE INDEX idx_v_sample_celltype ON v_sample_with_celltype(cell_types);
```

---

### 2.4 测试增强 (高优先级)

**添加 Memory 模块测试**:
```python
# tests/unit/test_memory.py
class TestEpisodicMemory:
    def test_record_query(self):
        ...
    
    def test_get_session_history(self):
        ...
    
    def test_memory_pruning(self):
        ...

class TestSemanticMemory:
    def test_record_successful_query(self):
        ...
    
    def test_find_similar_pattern(self):
        ...
```

---

## 3. 技术债务管理

### 3.1 当前技术债务

| 债务项 | 严重程度 | 产生原因 | 偿还计划 |
|--------|----------|----------|----------|
| 部分函数过长 | 中 | 快速迭代 | 逐步重构 |
| Memory 模块测试缺失 | 高 | 时间紧迫 | 立即补充 |
| 魔法字符串 | 低 | 编码规范 | 逐步提取 |
| 硬编码配置 | 中 | 初期设计 | 配置化 |

### 3.2 债务偿还计划

**Sprint 1 (2 周)**:
- [ ] 补充 Memory 模块测试
- [ ] 修复本体解析 6 个失败用例
- [ ] 提取核心魔法字符串为常量

**Sprint 2 (2 周)**:
- [ ] 实施前端代码分割
- [ ] 拆分过长函数 (coordinator.query)
- [ ] 自动化统计表刷新

**Sprint 3 (2 周)**:
- [ ] 优化统计查询模块
- [ ] 添加部署文档
- [ ] 代码审查流程建立

---

## 4. 长期演进路线

### 4.1 6 个月路线图

```
Month 1-2: 稳定性提升
├── 修复已知问题
├── 完善测试覆盖
├── 性能优化
└── 文档完善

Month 3-4: 功能增强
├── 本体解析准确率提升
├── 统计查询能力增强
├── 移动端优化
└── 用户认证

Month 5-6: 架构演进
├── PostgreSQL 评估
├── 分布式缓存
├── 增量 ETL
└── API 版本化
```

### 4.2 技术栈演进

**当前** → **目标**

| 组件 | 当前 | 目标 | 时间 |
|------|------|------|------|
| 数据库 | SQLite | PostgreSQL (评估) | 6 月 |
| 缓存 | 内存 | Redis | 3 月 |
| 前端状态 | Hooks | Zustand | 3 月 |
| 部署 | 手动 | Docker + CI/CD | 2 月 |
| 监控 | 日志 | APM (评估) | 6 月 |

---

## 5. 风险与缓解

### 5.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| SQLite 性能瓶颈 | 中 | 高 | 监控查询性能，准备 PostgreSQL 方案 |
| 本体库更新不兼容 | 低 | 中 | 版本锁定，升级测试 |
| LLM API 变更 | 中 | 中 | 多供应商支持 |
| 前端依赖漏洞 | 中 | 高 | 定期更新，安全扫描 |

### 5.2 项目风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 数据源 API 变更 | 中 | 高 | 抽象适配器层，监控变更 |
| 数据质量问题 | 中 | 中 | 质量监控视图，定期清洗 |
| 团队变动 | 低 | 高 | 完善文档，知识传承 |

---

## 6. 成功指标

### 6.1 技术指标

| 指标 | 当前 | 目标 (3月) | 目标 (6月) |
|------|------|------------|------------|
| 评测通过率 | 92.2% | 95% | 97% |
| 单元测试覆盖率 | ~70% | 80% | 85% |
| 前端包体积 | 813KB | 500KB | 400KB |
| 仪表盘加载 | 5ms | 5ms | 5ms |
| 平均查询延迟 | 1s | 800ms | 600ms |

### 6.2 业务指标

| 指标 | 当前 | 目标 (3月) | 目标 (6月) |
|------|------|------------|------------|
| 数据源数量 | 12 | 12 | 15 |
| 样本数量 | 75.6万 | 75.6万 | 100万 |
| 零 LLM 查询比例 | 84.9% | 88% | 90% |

---

## 7. 行动计划检查清单

### 立即行动 (本周)

- [ ] 创建问题跟踪 (GitHub Issues)
- [ ] 分配高优先级任务
- [ ] 设置代码审查流程
- [ ] 配置自动化测试

### 短期行动 (本月)

- [ ] 完成高优先级改进项
- [ ] 添加 Memory 模块测试
- [ ] 实施前端代码分割
- [ ] 优化本体解析
- [ ] 补充部署文档

### 中期行动 (3个月)

- [ ] 完成中优先级改进项
- [ ] 评估 PostgreSQL 迁移
- [ ] 实现增量 ETL
- [ ] 移动端优化完成
- [ ] 用户认证系统

### 长期行动 (6个月)

- [ ] 架构演进完成
- [ ] 性能目标达成
- [ ] 新数据源接入
- [ ] 用户反馈闭环

---

**审查报告完成。建议定期 (月度) 回顾改进进度，根据优先级调整计划。**
