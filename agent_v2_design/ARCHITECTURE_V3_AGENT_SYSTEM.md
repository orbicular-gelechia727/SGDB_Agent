# SCeQTL-Agent V3: 精准检索型智能Agent架构设计

> **版本**: 3.0 | **日期**: 2026-03-16 | **状态**: 架构定稿
> 
> **设计原则**: 精准优先，扩展预留，拒绝过度设计

---

## 1. 核心定位与边界

### 1.1 系统定位

**一句话定义**: 面向单细胞基因表达元数据的**高精度自然语言检索系统**。

**核心能力**: 将用户的生物学意图（自然语言）准确转化为**可执行的数据库查询**，并返回**可验证的结果**。

**非目标**（明确排除）:
- ❌ 不追求开放式知识问答（如"什么是阿尔茨海默病"）
- ❌ 不追求复杂推理（如"基于这些数据预测XX"）


### 1.2 能力边界定义

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Capability Map                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  L1: 精确检索层 (核心能力)  ████████████████████  优先级: P0   │
│     ├─ ID识别 (GSE/PRJNA/Sample ID)                            │
│     ├─ 结构化过滤 (tissue/disease/assay等)                      │
│     ├─ 聚合统计 (COUNT/GROUP BY/分布)                           │
│     └─ 跨库关联 (entity_links查询)                              │
│                                                                 │
│  L2: 语义扩展层 (必要能力)  ████████████████░░░░  优先级: P1   │
│     ├─ 本体映射 (brain → cerebral cortex/hippocampus)          │
│     ├─ 同义词处理 (cancer/tumor/carcinoma)                      │
│     └─ 隐含字段消解 ("健康" → disease IS NULL/normal)          │
│                                                                 │
│  L3: 知识推理层 (延后/外包) ░░░░░░░░░░░░░░░░░░░░  优先级: P2   │
│     ├─ 生物学推理 ("免疫治疗相关" → marker基因推断)            │
│     ├─ 跨库数据融合策略选择                                     │
│     └─ 结果可信度评估与排序                                     │
│                                                                 │
│  【明确决策】: L3能力现阶段通过LLM外包，不作为系统核心构建       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 影响准确性的核心因素

| 因素 | 权重 | 当前状态 | 优化策略 |
|------|------|---------|---------|
| **Schema知识准确性** | 40% | ⚠️ 部分硬编码 | 配置化知识库 |
| **意图解析准确率** | 30% | ✅ 92% | 提升本体覆盖率 |
| **SQL生成正确性** | 20% | ✅ 95%+ | 模板+验证机制 |
| **结果验证机制** | 10% | ⚠️ 基础验证 | 增加置信度评分 |

**关键洞察**: 准确性瓶颈主要在**Schema知识覆盖度**（因素1）而非生成能力（因素3）。

---

## 2. 架构设计

### 2.1 核心架构: Pipeline模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SCeQTL-Agent V3 Pipeline                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Input: "找GEO数据库中10x平台的肝癌单细胞数据"                                │
│                    │                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 1: INTENT UNDERSTANDING (意图理解)                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Query       │  │  Entity      │  │  Constraint  │              │   │
│  │  │  Classification│  │  Extraction  │  │  Extraction  │              │   │
│  │  │  (SEARCH/    │  │  (liver/     │  │  (GEO/10x/   │              │   │
│  │  │  STATS/COMPARE)│  │  cancer/HCC) │  │  human)      │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  实现: Rule-based + LLM Fallback                                    │   │
│  │  目标: >95% 意图识别准确率                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 2: KNOWLEDGE ENRICHMENT (知识增强)                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Ontology    │  │  Schema      │  │  Term        │              │   │
│  │  │  Expansion   │  │  Validation  │  │  Normalization│             │   │
│  │  │              │  │              │  │              │              │   │
│  │  │  liver →     │  │  validate    │  │  tumor →     │              │   │
│  │  │  [liver,     │  │  tissue      │  │  cancer      │              │   │
│  │  │   hepatic]   │  │  field       │  │  (标准术语)   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  实现: SchemaKnowledgeBase (配置驱动)                               │   │
│  │  目标: 消除硬编码，支持动态扩展                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 3: QUERY CONSTRUCTION (查询构建)                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Strategy    │  │  SQL         │  │  Validation  │              │   │
│  │  │  Selection   │  │  Generation  │  │  & Fallback  │              │   │
│  │  │              │  │              │  │              │              │   │
│  │  │  Template/   │  │  Parameterized│  │  Syntax/     │              │   │
│  │  │  Rule/LLM    │  │  Query       │  │  Semantic    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  实现: Multi-candidate + Execution Validation                       │   │
│  │  目标: 100% 语法正确，>98% 语义正确                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 4: EXECUTION & SYNTHESIS (执行与合成)                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Query       │  │  Result      │  │  Answer      │              │   │
│  │  │  Execution   │  │  Structuring │  │  Generation  │              │   │
│  │  │              │  │              │  │              │              │   │
│  │  │  Parallel    │  │  Cross-DB    │  │  Natural     │              │   │
│  │  │  Execution   │  │  Fusion      │  │  Language    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  实现: DAL + FusionEngine + Synthesizer                             │   │
│  │  目标: <500ms 响应，结果可解释                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                        │
│                    ▼                                                        │
│  Output: "找到 156 个GEO数据库的肝癌单细胞样本，主要使用10x Genomics平台..."
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 关键组件设计

#### 2.2.1 SchemaKnowledgeBase (核心基础设施)

```python
class SchemaKnowledgeBase:
    """
    Schema知识库: 将数据库结构转化为可配置、可扩展的知识表示
    
    核心职责:
    1. 字段语义定义 (tissue → "解剖学组织")
    2. 值域知识管理 (标准值、同义词、变体)
    3. 查询模式模板 (常见查询结构化)
    4. 验证规则 (字段约束、值范围)
    
    设计原则:
    - 完全配置化 (JSON/YAML), 零代码修改即可扩展
    - 版本化管理, 支持Schema演进
    - 独立于LLM, 保证可预测性
    """
    
    # 配置示例 (schema_knowledge.json)
    CONFIG_EXAMPLE = {
        "fields": {
            "tissue": {
                "semantic_type": "anatomical_structure",
                "ontology_source": "UBERON",
                "value_type": "controlled_vocabulary",
                "synonyms": {
                    "brain": ["cerebral", "cerebrum", "encephalon"],
                    "liver": ["hepatic", "hepatic tissue"]
                },
                "validation_rules": {
                    "allow_fuzzy_match": True,
                    "max_edit_distance": 2
                }
            },
            "disease": {
                "semantic_type": "disease_phenotype", 
                "ontology_source": "MONDO",
                "special_values": {
                    "normal": ["healthy", "control", "wild type", "WT"],
                    "null_meaning": "not_specified"
                }
            }
        },
        "query_patterns": [
            {
                "pattern_id": "simple_filter",
                "intent": "SEARCH",
                "template": "SELECT * FROM {table} WHERE {conditions} LIMIT {limit}",
                "required_fields": [],
                "optional_fields": ["tissue", "disease", "assay"]
            },
            {
                "pattern_id": "cross_db_lookup",
                "intent": "LINEAGE", 
                "template": "...",
                "requires": ["entity_links"]
            }
        ]
    }
```

#### 2.2.2 Multi-Strategy Query Generator

```python
class QueryGenerator:
    """
    多策略查询生成器: 根据查询复杂度选择最优策略
    
    策略优先级 (从高到低):
    1. Template (模板): 已知模式，零LLM调用
    2. Rule (规则): 结构化构建，零LLM调用  
    3. LLM-Assisted (LLM辅助): 复杂语义，LLM生成后验证
    
    设计原则:
    - 简单查询不走LLM (成本控制 + 可预测性)
    - 复杂查询LLM生成后必须验证
    - 多候选并行，选择最优结果
    """
    
    async def generate(self, enriched_intent: EnrichedIntent) -> List[SQLCandidate]:
        candidates = []
        
        # 策略1: 模板匹配 (P0 - 必须支持)
        if template := self.template_matcher.match(enriched_intent):
            candidates.append(template)
            if template.confidence > 0.95:
                return candidates  # 高置信度直接返回
        
        # 策略2: 规则构建 (P0 - 必须支持)
        rule_query = self.rule_builder.build(enriched_intent)
        candidates.append(rule_query)
        
        # 策略3: LLM辅助 (P1 - 降级保障)
        if enriched_intent.complexity == "HIGH":
            llm_query = await self.llm_generator.generate(enriched_intent)
            if self.validator.syntax_check(llm_query):
                candidates.append(llm_query)
        
        return candidates
```

#### 2.2.3 Retrieval Router (扩展预留)

```python
class RetrievalRouter:
    """
    检索路由器: 统一入口，支持多种检索后端
    
    当前支持:
    - SQL (结构化精确检索)
    
    预留扩展:
    - Vector (语义相似性检索)
    - FTS (全文检索) 
    - Hybrid (混合检索)
    
    设计原则:
    - 接口统一，后端可插拔
    - 优先SQL，其他作为补充
    - 结果可融合，可验证
    """
    
    async def retrieve(self, query_plan: QueryPlan) -> RetrievalResult:
        strategy = query_plan.retrieval_strategy
        
        if strategy == "SQL_ONLY":
            return await self.sql_backend.query(query_plan)
        
        elif strategy == "SQL_WITH_EXPANSION":
            return await self.sql_backend.query_with_ontology(query_plan)
        
        elif strategy == "VECTOR_ENHANCED":
            # 预留: 向量检索增强
            sql_results = await self.sql_backend.query(query_plan)
            vector_results = await self.vector_backend.search(query_plan.semantic_query)
            return self.result_fusion.merge(sql_results, vector_results, weights=[0.7, 0.3])
        
        else:
            raise UnsupportedStrategyError(strategy)
```

---

## 3. 与过度设计的区分

### 3.1 我们不做的事情 (明确排除)

| 过度设计方向 | 不做原因 | 替代方案 |
|-------------|---------|---------|
| **多Agent协作** | 复杂度 > 收益 | 单Agent + 工具调用 |
| **自主规划Agent** | 不可预测，调试难 | 固定Pipeline + 策略选择 |
| **端到端神经网络** | 不可解释，难维护 | 模块化 + 可验证组件 |
| **实时学习** | 风险高，需大量数据 | 离线分析 + 人工审核更新 |
| **复杂推理链** | 准确率不可控 | LLM外包推理，系统聚焦检索 |

### 3.2 我们专注的事情 (核心投入)

| 核心方向 | 原因 | 投入策略 |
|---------|------|---------|
| **Schema知识库建设** | 准确性瓶颈所在 | 高优先级，人工+自动化 |
| **本体映射精度** | 生物语义关键 | 持续优化，领域专家审核 |
| **查询验证机制** | 保证结果可信 | 多维度验证，置信度评分 |
| **可解释性** | 科研场景必需 | 全程溯源，过程可视化 |

---

## 4. 实施路线图

### Phase 1: 基础设施 (4周)
**目标**: 建立可扩展的知识体系

```
Week 1-2: SchemaKnowledgeBase设计与实现
  - 配置Schema定义
  - 字段语义标注 (tissue/disease/cell_type优先)
  - 同义词库构建 (基于现有数据挖掘)
  
Week 3-4: 意图理解层重构
  - Query Classification (Simple/Complex)
  - Entity Extraction (基于SKB)
  - 与现有Rule引擎整合
```

**产出物**:
- `schema_knowledge.json` (可配置Schema知识)
- `IntentParser` (支持Simple/Complex分类)
- 基准测试: 意图识别准确率 >95%

### Phase 2: 精准度提升 (4周)
**目标**: 核心查询准确率 >98%

```
Week 5-6: 查询生成优化
  - Template Engine完善
  - Rule Builder覆盖度提升
  - Multi-candidate执行优化
  
Week 7-8: 验证与反馈机制
  - SQL Syntax Validator
  - Semantic Validator (结果合理性检查)
  - Confidence Scoring
```

**产出物**:
- 查询生成策略覆盖 >90% 查询类型
- 验证机制: Syntax 100%, Semantic 90%
- 基准测试: 154题通过率 >98%

### Phase 3: 语义增强 (4周)
**目标**: 支持模糊语义查询

```
Week 9-10: 本体集成增强
  - UBERON/MONDO/CL覆盖度提升
  - Umbrella Term扩展优化
  - 本体-数据库值映射自动化
  
Week 11-12: 混合检索初探 (预留)
  - Project Title Embedding (实验性)
  - Vector检索接口预留
  - SQL+Vector融合策略设计
```

**产出物**:
- 本体覆盖率: tissue/disease >95%
- 模糊语义查询支持 (实验性)
- Vector检索Demo (非生产)

### Phase 4: 产品化 (持续)
**目标**: 稳定、可维护、可观测

```
- 性能监控与告警
- 查询日志分析系统
- A/B测试框架
- 知识库版本管理
```

---

## 5. 技术决策记录

### ADR-001: 为什么不构建复杂推理能力

**背景**: 讨论是否在Agent内构建L3推理能力 (知识推理、假设生成)

**决策**: 明确排除L3能力作为系统核心构建

**原因**:
1. **准确性不可控**: 推理链越长，错误累积越多，难以保证科研场景所需的准确性
2. **维护成本高**: 推理规则需要领域专家持续维护，且生物学知识更新快
3. **LLM可外包**: 对于确实需要推理的场景，可将检索结果+原始问题交给LLM进行推理，Agent专注提供高质量输入
4. **聚焦核心**: 资源集中在检索准确性（Schema知识）比分散在推理能力上收益更高

**例外**: 简单的、可验证的推理（如跨库ID关联）保留在系统内

### ADR-002: 多检索途径的设计策略

**背景**: 是否立即实现SQL+Vector+KG的混合检索

**决策**: SQL为主，Vector预留接口，暂不实现KG检索

**原因**:
1. **SQL是当前瓶颈**: 当前系统92%查询可被SQL满足，应优先优化SQL准确性
2. **Vector价值待验证**: Project Title的语义检索价值需通过用户行为数据验证
3. **复杂性管理**: 混合检索的结果融合策略复杂，需充分测试
4. **预留扩展**: 架构上预留Vector检索接口，验证价值后可快速接入

**时间线**:
- P0 (Phase 1-2): SQL Only
- P1 (Phase 3): SQL + Vector (实验性)
- P2 (未来): 根据数据决定是否全量启用

### ADR-003: SchemaKnowledgeBase的配置化程度

**背景**: SKB应该代码化还是配置化

**决策**: 完全配置化 (JSON/YAML)，代码零侵入

**原因**:
1. **领域专家可参与**: 生物学家可直接编辑配置，无需开发介入
2. **快速迭代**: Schema演进无需发版
3. **版本可控**: 配置可版本管理，可回滚
4. **多环境支持**: 不同环境可加载不同配置

---

## 6. 成功标准

### 技术指标

| 指标 | 当前 | Phase 1 | Phase 2 | 目标 |
|------|------|---------|---------|------|
| 意图识别准确率 | 92% | 94% | 96% | >98% |
| SQL生成正确率 | 95% | 96% | 98% | >99% |
| 零结果查询率 | 5% | 3% | 2% | <1% |
| 平均响应时间 | 8s | 2s | 1s | <500ms |
| 复杂查询支持率 | 60% | 70% | 85% | >90% |

### 产品指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 用户查询成功率 | 85% | >95% |
| 用户满意度评分 | 3.5/5 | >4.5/5 |
| 人工干预率 | 15% | <5% |

---

## 7. 风险与应对

| 风险 | 可能性 | 影响 | 应对策略 |
|------|--------|------|---------|
| Schema知识构建工作量超预期 | 中 | 高 | 分阶段建设，优先核心字段 |
| 本体映射准确性不足 | 中 | 高 | 领域专家审核，置信度标注 |
| 用户查询复杂度超预期 | 低 | 中 | 明确能力边界，LLM兜底 |
| 技术债务累积 | 中 | 中 | 代码审查，自动化测试 |

---

## 8. 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| **SKB** | SchemaKnowledgeBase，Schema知识库 |
| **L1/L2/L3** | Agent能力层级：精确检索/语义扩展/知识推理 |
| **Simple Query** | 单表过滤，无需复杂转换 |
| **Complex Query** | 多条件组合，需要语义消解 |
| **零结果查询** | 返回空结果的查询 (可能是条件过严或理解错误) |

### B. 参考架构

- **V1架构**: 规则为主，硬编码 [已实现]
- **V2架构**: 多候选+验证，性能优化 [已实现]
- **V3架构**: 知识驱动，精准优先 [本文档]

---

*文档结束*

> "精准是科研的生命线，Agent的价值在于提供可信赖的数据访问，而非炫技。"
