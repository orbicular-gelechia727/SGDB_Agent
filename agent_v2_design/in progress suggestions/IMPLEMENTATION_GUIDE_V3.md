# SCeQTL-Agent V3 实施指南

> 配套 ARCHITECTURE_V3_AGENT_SYSTEM.md 的实现操作手册

---

## 1. 快速开始

### 1.1 初始化Schema知识库

```bash
# 1. 创建配置目录
mkdir -p agent_v2/data/knowledge_base

# 2. 生成初始配置 (从现有代码提取)
python3 << 'EOF'
import json

# 从现有代码提取的初始知识
knowledge = {
    "version": "1.0",
    "fields": {
        "tissue": {
            "semantic_type": "anatomical_structure",
            "ontology_source": "UBERON",
            "synonyms": {
                "brain": ["cerebral", "cerebellum", "hippocampus", "大脑", "脑"],
                "liver": ["hepatic", "肝脏", "肝"],
                "lung": ["pulmonary", "肺"],
                "heart": ["cardiac", "心脏", "心"],
                "blood": ["PBMC", "peripheral blood", "血液"],
            }
        },
        "disease": {
            "semantic_type": "disease_phenotype",
            "ontology_source": "MONDO",
            "synonyms": {
                "cancer": ["tumor", "carcinoma", "malignant", "癌", "肿瘤"],
                "Alzheimer's disease": ["Alzheimer", "AD", "阿尔茨海默", "老年痴呆"],
            },
            "special_values": {
                "normal": ["healthy", "control", "正常", "健康", "对照"]
            }
        },
        "assay": {
            "semantic_type": "experimental_assay",
            "ontology_source": "EFO",
            "synonyms": {
                "10x 3' v3": ["10x", "10x chromium", "chromium"],
                "Smart-seq2": ["smart-seq", "smartseq"],
            }
        },
        "cell_type": {
            "semantic_type": "cell_type",
            "ontology_source": "CL",
            "synonyms": {
                "T cell": ["T-cell", "T细胞", "CD4", "CD8"],
                "B cell": ["B-cell", "B细胞"],
                "macrophage": ["巨噬细胞"],
            }
        }
    },
    "query_patterns": [
        {
            "pattern_id": "simple_filter",
            "intent": "SEARCH",
            "template": "SELECT * FROM v_sample_with_hierarchy WHERE {conditions} LIMIT {limit}",
            "complexity_score": 2
        },
        {
            "pattern_id": "statistics_breakdown",
            "intent": "STATISTICS",
            "template": "SELECT {group_field}, COUNT(*) FROM v_sample_with_hierarchy WHERE {conditions} GROUP BY {group_field}",
            "complexity_score": 4
        }
    ]
}

with open('agent_v2/data/knowledge_base/schema_v1.json', 'w') as f:
    json.dump(knowledge, f, indent=2, ensure_ascii=False)

print("✓ Schema knowledge created")
EOF
```

---

## 2. Phase 1 实施清单

### Week 1-2: SchemaKnowledgeBase

- [ ] **Day 1-2**: 创建 `src/knowledge/schema_kb.py`
  - SchemaKnowledgeBase 类
  - FieldKnowledge / QueryPattern dataclass
  - 加载/解析/查询接口

- [ ] **Day 3-4**: 集成到现有系统
  - 在 CoordinatorAgent 中初始化 SKB
  - 替换 parser 中的硬编码同义词
  - 保持向后兼容

- [ ] **Day 5-7**: 测试与验证
  - 单元测试: SKB加载和查询
  - 集成测试: 端到端查询
  - 基准测试: 准确率对比

**验收标准**:
- [ ] 所有 tissue/disease/assay 同义词从配置加载
- [ ] 零硬编码 (除ID正则外)
- [ ] 查询准确率 >= 现有水平 (92%)

### Week 3-4: Intent理解优化

- [ ] **Day 8-10**: 查询分类器
  - Simple vs Complex 分类逻辑
  - 基于实体数量和类型
  - 置信度评估

- [ ] **Day 11-14**: 验证与调优
  - 154题基准测试
  - 错误案例分析
  - 配置调优

**验收标准**:
- [ ] Simple查询识别准确率 >95%
- [ ] 意图分类准确率 >95%

---

## 3. 关键代码模式

### 3.1 SchemaKnowledgeBase使用

```python
from src.knowledge.schema_kb import SchemaKnowledgeBase

# 初始化
skb = SchemaKnowledgeBase("data/knowledge_base/schema_v1.json")

# 术语扩展
expanded = skb.expand_term("brain", "tissue")
# -> ["brain", "cerebral", "cerebellum", "hippocampus", "大脑", "脑"]

# 标准化
normalized = skb.normalize_term("tumor", "disease")
# -> "cancer"

# 获取查询模式
pattern = skb.get_query_pattern("SEARCH", ["tissue", "disease"])
```

### 3.2 新的查询流程

```python
async def query_v3(self, user_input: str) -> AgentResponse:
    # 1. 意图解析 (使用SKB)
    parsed = await self.parser.parse(user_input)
    
    # 2. 知识增强 (术语扩展)
    enriched = self.knowledge_enricher.enrich(parsed)
    
    # 3. 策略选择
    strategy = self.select_strategy(enriched)
    
    # 4. 查询生成
    if strategy == "SQL_TEMPLATE":
        sql = self.template_generator.generate(enriched)
    elif strategy == "SQL_RULE":
        sql = self.rule_generator.generate(enriched)
    else:  # LLM_ASSISTED
        sql = await self.llm_generator.generate(enriched)
    
    # 5. 执行与验证
    result = await self.executor.execute_with_validation(sql)
    
    # 6. 结果合成
    return self.synthesizer.synthesize(result, enriched)
```

---

## 4. 测试策略

### 4.1 单元测试

```python
# tests/unit/test_schema_kb.py
def test_term_expansion():
    skb = SchemaKnowledgeBase(TEST_CONFIG)
    
    # 测试英文同义词
    result = skb.expand_term("brain", "tissue")
    assert "cerebral" in result
    assert "cerebellum" in result
    
    # 测试中文同义词
    result = skb.expand_term("大脑", "tissue")
    assert "brain" in result

def test_normalization():
    skb = SchemaKnowledgeBase(TEST_CONFIG)
    
    # 测试疾病标准化
    assert skb.normalize_term("tumor", "disease") == "cancer"
    assert skb.normalize_term("正常", "disease") == "normal"
```

### 4.2 集成测试

```python
# tests/integration/test_v3_pipeline.py
async def test_simple_query():
    agent = create_test_agent()
    
    response = await agent.query("找肝癌的10x数据")
    
    assert response.total_count > 0
    assert "liver" in str(response.filters) or "hepatic" in str(response.filters)
    assert response.confidence > 0.8
```

### 4.3 基准测试

```bash
# 运行154题基准测试
python3 tests/benchmark/run_benchmark.py --compare-v2-v3

# 预期结果:
# V2: 92.2% (baseline)
# V3 Phase 1: >= 92% (保持)
# V3 Phase 2: >= 95% (提升)
```

---

## 5. 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| 配置复杂度上升 | 提供配置验证工具；默认配置开箱即用 |
| 性能下降 | 配置懒加载；缓存频繁访问的知识 |
| 准确率下降 | 保留原有规则作为fallback；A/B测试 |

---

## 6. 下一步

完成Phase 1后，继续:
1. Phase 2: 查询验证机制 (Week 5-8)
2. Phase 3: 语义增强 (Week 9-12)
3. 产品化与监控 (持续)

---

*文档版本: 1.0 | 最后更新: 2026-03-16*
