# SCeQTL-Agent 架构升级：高质量资源与参考文献

> **文档版本**: 1.0  
> **日期**: 2026-03-18  
> **目的**: 精选Agent领域和生物医学数据检索方向最值得关注的高质量论文、项目和资源  
> **筛选标准**: 高影响力（引用/Stars）、高相关度、高时效性

---

## 目录

1. [核心论文（必读）](#1-核心论文必读)
2. [Text2SQL与NL2Code](#2-text2sql与nl2code)
3. [Agent架构与设计模式](#3-agent架构与设计模式)
4. [本体与知识图谱](#4-本体与知识图谱)
5. [生物医学数据检索](#5-生物医学数据检索)
6. [优秀开源项目](#6-优秀开源项目)
7. [技术博客与教程](#7-技术博客与教程)
8. [学习路线图](#8-学习路线图)

---

## 1. 核心论文（必读）

### 1.1 Agent架构基础

| 论文 | 作者/年份 | 核心贡献 | 必读理由 |
|------|----------|---------|---------|
| **[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)** | Yao et al., ICLR 2023 | 提出ReAct范式：推理(Reasoning)与行动(Acting)交错进行 | Agent设计的基础范式，我们Coordinator的核心模式 |
| **[Reflexion: Self-Reflective Agents](https://arxiv.org/abs/2303.11366)** | Shinn et al., NeurIPS 2023 | 通过自我反思提升Agent性能 | 记忆与学习机制的参考 |
| **[DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines](https://arxiv.org/abs/2310.03714)** | Khattab et al., 2023 | 声明式LM编程框架 | 模块化Agent架构的先进实践 |
| **[AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation](https://arxiv.org/abs/2308.08155)** | Wu et al., 2023 | 微软多Agent对话框架 | 复杂任务分解的参考架构 |
| **[Agents: An Open-source Framework for Autonomous Language Agents](https://arxiv.org/abs/2309.07870)** | Zhou et al., 2023 | 开源Agent框架综述与实现 | 对比学习现有框架设计 |

---

### 1.2 Text2SQL与自然语言到代码

| 论文 | 作者/年份 | 核心贡献 | 必读理由 |
|------|----------|---------|---------|
| **[DIN-SQL: Decomposed In-Context Learning of Text-to-SQL with Self-Correction](https://arxiv.org/abs/2304.11015)** | Pourreza & Rafiei, 2023 | 分解式Text2SQL：Schema Linking → Classification → SQL Generation | 与我们3阶段SQL生成策略高度相关 |
| **[SQL-PaLM: Improved Large Language Model Adaptation for Text-to-SQL](https://arxiv.org/abs/2306.00739)** | Sun et al., 2023 | 基于PaLM的Text2SQL，引入多种提示技术 | 开源Text2SQL的SOTA参考 |
| **[CHASE-SQL: Multi-Path Reasoning and Preference-Based Candidate Selection in Text-to-SQL](https://arxiv.org/abs/2410.01943)** | Pourreza et al., 2024 | **多候选SQL生成 + 选择策略** | ⭐ **强烈推荐** - 直接对应我们的多候选SQL策略 |
| **[MAC-SQL: A Conversational Text-to-SQL Dataset](https://arxiv.org/abs/1906.09392)** | Yu et al., 2019 | 多轮对话Text2SQL基准 | 多轮查询处理的参考 |
| **[Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task](https://arxiv.org/abs/1809.08887)** | Yu et al., EMNLP 2018 | Text2SQL领域最重要基准数据集 | 评估方法论参考 |

> **重点研读**: CHASE-SQL 的多候选策略与我们当前的3候选SQL生成策略直接对应，其候选选择方法（基于执行结果和启发式规则）值得深入借鉴。

---

### 1.3 RAG与检索增强生成

| 论文 | 作者/年份 | 核心贡献 | 必读理由 |
|------|----------|---------|---------|
| **[Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)** | Lewis et al., NeurIPS 2020 | RAG基础框架 | RAG范式奠基之作 |
| **[Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection](https://arxiv.org/abs/2310.11511)** | Asai et al., 2023 | 自适应检索决策 | 检索vs直接生成的权衡策略 |
| **[Corrective Retrieval Augmented Generation](https://arxiv.org/abs/2401.15884)** | Yan et al., 2024 | 可纠正的RAG框架 | 检索结果验证与修正 |
| **[RAG-Fusion: Retrieval-Augmented Generation with Multi-Query](https://arxiv.org/abs/2402.03367)** | Raudaschl, 2024 | 多查询扩展与融合 | 与我们的本体扩展策略相似 |

---

### 1.4 工具使用与Function Calling

| 论文 | 作者/年份 | 核心贡献 | 必读理由 |
|------|----------|---------|---------|
| **[Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761)** | Schick et al., 2023 | 模型自学使用工具 | 工具学习的里程碑 |
| **[Gorilla: Large Language Model Connected with Massive APIs](https://arxiv.org/abs/2305.15334)** | Patil et al., 2023 | LLM与大规模API连接 | API选择与调用学习 |
| **[ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs](https://arxiv.org/abs/2307.16789)** | Qin et al., 2023 | 大规模工具学习 | 工具选择的系统性方法 |
| **[Efficient Tool Use with Chain-of-Abstraction Reasoning](https://arxiv.org/abs/2401.17464)** | Gao et al., 2024 | 抽象链推理提升工具使用效率 | 减少工具调用次数的策略 |

---

## 2. Text2SQL与NL2Code

### 2.1 进阶论文

| 论文 | 核心要点 |
|------|---------|
| **[Pi-SQL: Privacy-Preserving Text-to-SQL](https://arxiv.org/abs/2403.00827)** | 隐私保护的Text2SQL，含Schema匿名化 |
| **[SQLBench: A Benchmark for Compositional Text-to-SQL](https://arxiv.org/abs/2401.12373)** | 组合式Text2SQL基准 |
| **[Graphix: Graph-Aware Injection for Text-to-SQL](https://arxiv.org/abs/2309.05542)** | 利用数据库关系图提升生成质量 |
| **[RESDSQL: Decoupled Schema Linking and Skeleton Parsing for Text-to-SQL](https://arxiv.org/abs/2302.05965)** | 解耦Schema链接与SQL骨架解析 |

### 2.2 关键洞见

```
Text2SQL最新趋势（2024）:
1. 从单一生成 → 多候选 + 选择 (CHASE-SQL)
2. 从端到端 → 模块化分解 (Schema Linking → SQL Generation)
3. 从静态Schema → 动态Schema检索 (RESDSQL)
4. 从单一查询 → 多轮对话上下文 (MAC-SQL)
5. 从通用模型 → 领域特化微调

我们的架构已经走在正确道路上：
✓ 多候选SQL生成
✓ Schema introspection
✓ 模块化pipeline
⚠ 需要加强: 候选选择策略、领域特定优化
```

---

## 3. Agent架构与设计模式

### 3.1 设计模式论文

| 论文 | 核心概念 | 适用场景 |
|------|---------|---------|
| **[LLM+P: Empowering Large Language Models with Optimal Planning Proficiency](https://arxiv.org/abs/2304.11477)** | LLM + 经典规划器 | 需要严格逻辑的规划任务 |
| **[Reasoning with Language Model is Planning with World Model](https://arxiv.org/abs/2305.14992)** | LLM作为世界模型 | 多步决策与模拟 |
| **[LLM As A System Service](https://arxiv.org/abs/2401.16765)** | LLM作为系统服务 | 企业级架构设计 |
| **[A Survey on Large Language Model based Autonomous Agents](https://arxiv.org/abs/2308.11432)** | 全面综述 | 系统性了解Agent领域 |

### 3.2 记忆与学习

| 论文 | 核心贡献 |
|------|---------|
| **[MemoryBank: Enhancing Large Language Models with Long-Term Memory](https://arxiv.org/abs/2305.10250)** | 长期记忆机制 |
| **[MemorySandbox: A Framework for Safe and Flexible LLM Memory](https://arxiv.org/abs/2406.07543)** | 记忆的安全性与灵活性 |
| **[Lifelong Learning with LLMs: A Theoretical Framework](https://arxiv.org/abs/2402.00146)** | LLM持续学习理论 |

### 3.3 推荐设计模式

```
针对我们的场景，推荐的设计模式组合:

1. Coordinator: ReAct (Reasoning + Acting)
   └── Tool Use模式: 10个核心工具
   └── 最大步数限制: 8步

2. Query Understanding: Chain-of-Thought + 规则引擎
   └── 简单查询 → 规则快速路径 (70%)
   └── 复杂查询 → LLM深度解析 (30%)

3. SQL Generation: Multi-Candidate + Execution-Based Selection
   └── 参考: CHASE-SQL
   └── 3候选并行执行
   └── 首个有效结果胜出

4. Ontology Resolution: Retrieval-Augmented Generation
   └── 本地本体缓存 (99%查询)
   └── LLM辅助消歧 (1%边缘情况)

5. Memory: Three-Layer Architecture
   └── Working: 会话上下文
   └── Episodic: 历史查询记录  
   └── Semantic: 成功模式提取
```

---

## 4. 本体与知识图谱

### 4.1 生物医学本体论文

| 论文 | 核心贡献 |
|------|---------|
| **[The Unified Medical Language System (UMLS): A Research Perspective](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC308795/)** | UMLS体系结构综述 |
| **[Uberon: An Integrative Multi-Species Anatomy Ontology](https://genomebiology.biomedcentral.com/articles/10.1186/gb-2012-13-1-r5)** | UBERON本体详细介绍 |
| **[The Cell Ontology: Structured Representation of Cell Types](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3419062/)** | CL细胞本体 |
| **[MONDO: A Unified Disease Ontology](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7779646/)** | MONDO疾病本体 |

### 4.2 本体匹配与扩展

| 论文 | 核心贡献 |
|------|---------|
| **[Ontology Matching: The State of the Art](https://www.sciencedirect.com/science/article/pii/S0957417411000422)** | 本体匹配综述 |
| **[BERTMap: A BERT-based Ontology Alignment System](https://arxiv.org/abs/2110.03602)** | 基于BERT的本体对齐 |
| **[SPARQL Query Generation from Natural Language](https://arxiv.org/abs/2305.03727)** | 本体感知的查询生成 |

### 4.3 关键技术洞见

```
本体解析的关键挑战与解决方案:

挑战1: Umbrella Term扩展
- "brain" 应该包括哪些子项？
- 参考: UBERON层级 + 数据库实际值分布
- 策略: 基于用户意图的动态深度控制

挑战2: 术语歧义
- "cortex" 可能指 cerebral cortex 或 renal cortex
- 参考: 上下文感知消歧 (BERTMap思想)
- 策略: 基于共现模式的消歧

挑战3: 跨本体映射
- UBERON tissue → 数据库tissue字段的实际值
- 参考: 值对齐 + 同义词扩展
- 策略: 离线构建映射表 + 运行时模糊匹配
```

---

## 5. 生物医学数据检索

### 5.1 直接相关工作

| 项目/论文 | 描述 | 与我们的关系 |
|----------|------|-------------|
| **[SRAgent](https://github.com/ArcInstitute/SRAgent)** | Arc Institute的SRA数据发现Agent | 直接竞品，专注数据发现而非统一查询 |
| **[CellAtria](https://www.cellatlas.io/)** | AstraZeneca的细胞数据平台 | 聚焦数据浏览与下载 |
| **[CellAgent](https://www.biorxiv.org/content/10.1101/2023.07.26.550634v1)** | 单细胞数据对话Agent | 聚焦对话交互，无跨库融合 |
| **[GeneAgent](https://github.com/allenai/GeneAgent)** | Allen Institute的基因数据Agent | 聚焦基因注释而非样本检索 |

### 5.2 数据库整合工作

| 论文 | 核心贡献 |
|------|---------|
| **[DataMed: A DataSearch Engine for Reusable Data](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5345273/)** | 生物医学数据搜索引擎 |
| **[Google Dataset Search](https://arxiv.org/abs/1905.04176)** | 数据集通用搜索 |
| **[FAIR Data Principles](https://www.nature.com/articles/sdata201618)** | 数据可发现性标准 |

### 5.3 差异化分析

```
与现有工作的关键差异:

SRAgent (Arc Institute):
✓ 强大的SRA数据发现能力
✓ 使用BioTools进行工具调用
✗ 仅做数据发现，不做统一查询
✗ 无跨库融合
✗ 无本体感知扩展

我们的优势:
✓ 统一查询12个数据库
✓ 本体感知语义扩展 (113K术语)
✓ 跨库去重与融合
✓ 数据血缘追溯
✓ 混合TAG范式 (Text2SQL + Ontology + Fusion)
```

---

## 6. 优秀开源项目

### 6.1 Agent框架

| 项目 | Stars | 核心特点 | 学习价值 |
|------|-------|---------|---------|
| **[LangChain](https://github.com/langchain-ai/langchain)** | 95k+ | 最通用的LLM应用框架 | 工具设计、Chain模式 |
| **[LangGraph](https://github.com/langchain-ai/langgraph)** | 9k+ | 用于构建Agent工作流 | 状态管理、多Agent协调 |
| **[AutoGen](https://github.com/microsoft/autogen)** | 35k+ | 微软多Agent对话框架 | 对话流程、角色定义 |
| **[CrewAI](https://github.com/joaomdmoura/crewAI)** | 24k+ | 多Agent团队协作 | 任务分配、结果整合 |
| **[DSPy](https://github.com/stanfordnlp/dspy)** | 19k+ | 声明式LM编程 | 模块化优化、自动提示 |
| **[Semantic Kernel](https://github.com/microsoft/semantic-kernel)** | 22k+ | 微软AI SDK | 插件系统、规划器 |
| **[LlamaIndex](https://github.com/run-llama/llama_index)** | 37k+ | 数据索引与RAG | RAG优化、索引策略 |

### 6.2 Text2SQL专项

| 项目 | Stars | 描述 |
|------|-------|------|
| **[Vanna](https://github.com/vanna-ai/vanna)** | 12k+ | 开源Text2SQL框架，支持RAG |
| **[SQLCoder](https://github.com/defog-ai/sqlcoder)** | 3k+ | 开源Text2SQL模型 |
| **[DataLine](https://github.com/RamiAwar/dataline)** | 4k+ | 数据对话工具 |
| **[WrenAI](https://github.com/Canner/WrenAI)** | 1k+ | 文本到数据的开源AI代理 |

### 6.3 推荐深度研读

```
优先级推荐:

1. DSPy (最高优先级)
   - 模块化Agent设计的最佳实践
   - 自动提示优化
   - 与我们Protocol-based DI架构契合

2. LlamaIndex 
   - RAG模式的工程化实现
   - 查询引擎 + 检索器 + 响应合成
   - 与我们Ontology Resolution层相似

3. LangGraph
   - 状态机驱动的Agent工作流
   - 支持循环、条件分支
   - 可用于优化Coordinator流程

4. Vanna
   - Text2SQL的完整产品化实现
   - 训练+推理一体化
   - 参考其SQL验证策略
```

---

## 7. 技术博客与教程

### 7.1 高质量博客

| 作者/来源 | 文章/系列 | 核心价值 |
|----------|----------|---------|
| **[Lilian Weng](https://lilianweng.github.io/)** | [LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-llm-agent/) | Agent领域最权威综述 |
| **[Eugene Yan](https://eugeneyan.com/writing/)** | [Patterns for Building LLM-based Systems](https://eugeneyan.com/writing/llm-patterns/) | LLM系统设计模式 |
| **[Chip Huyen](https://huyenchip.com/blog/)** | [Building LLM Applications for Production](https://huyenchip.com/2023/04/11/llm-engineering.html) | 生产级LLM应用 |
| **[Hamelsmu](https://hamel.dev/blog/)** | [Evals for LLMs](https://hamel.dev/blog/posts/evals/) | LLM评估方法论 |
| **[Jason Liu](https://jxnl.co/writing/)** | [RAG Techniques](https://jxnl.co/writing/2024/01/07/rag-techniques/) | RAG高级技巧 |
| **[LangChain Blog](https://blog.langchain.dev/)** | 官方博客 | 最新实践与设计决策 |
| **[Pinecone Blog](https://www.pinecone.io/learn/)** | RAG系列文章 | 向量检索+RAG深度解析 |

### 7.2 视频教程

| 来源 | 内容 | 链接 |
|------|------|------|
| **Andrej Karpathy** | Let's build GPT: from scratch | YouTube |
| **DeepLearning.AI** | LangChain课程 | deeplearning.ai |
| **AI Engineer Summit** | 2023/2024 演讲合集 | YouTube |
| **LangChain官方** | 官方教程系列 | YouTube |

---

## 8. 学习路线图

### 8.1 针对本体语义扩展问题 (P0)

```
Week 1-2: 基础强化
├── 论文: CHASE-SQL (多候选SQL选择)
├── 论文: BERTMap (本体对齐)
├── 项目: DSPy (模块化设计)
└── 实践: 优化umbrella term扩展逻辑

Week 3-4: 深入本体处理
├── 论文: UBERON/MONDO本体论文
├── 论文: Ontology Matching综述
├── 项目: 构建动态本体扩展器
└── 评估: 设计本体扩展测试集
```

### 8.2 针对复杂实体抽取问题 (P0)

```
Week 1-2: 实体抽取技术
├── 论文: Named Entity Recognition Survey
├── 论文: BERT for Biomedical NER
├── 项目: 关系抽取模块
└── 实践: 嵌套条件处理

Week 3-4: 语义解析
├── 论文: Semantic Parsing Survey
├── 论文: Text2SQL最新进展
├── 项目: 复杂查询解析器
└── 集成: 与现有parser整合
```

### 8.3 针对跨库融合问题 (P1)

```
Week 1-2: 实体对齐
├── 论文: Entity Resolution Survey
├── 论文: Deep Learning for ER
├── 项目: 相似度匹配算法
└── 实践: 基于特征的identity hash

Week 3-4: 数据融合
├── 论文: Data Fusion Techniques
├── 论文: Truth Discovery
├── 项目: 质量评分系统
└── 评估: 去重准确率评估
```

### 8.4 推荐学习顺序

```
Phase 1 (立即开始):
1. Lilian Weng的Agent综述 (建立全局视野)
2. CHASE-SQL论文 (解决多候选SQL选择)
3. DSPy项目源码 (模块化架构参考)
4. 我们的代码重构 (应用所学)

Phase 2 (深入专项):
1. BERTMap + Ontology Matching (本体扩展优化)
2. LangGraph (工作流优化)
3. Entity Resolution论文 (跨库融合)
4. 原型实现与评估

Phase 3 (拓展视野):
1. AutoGen/CrewAI (多Agent设计)
2. RAG-Fusion/Self-RAG (检索优化)
3. 生物医学文献 (领域知识)
4. 论文写作准备
```

---

## 附录：快速参考卡片

### 立即阅读的Top 5论文

1. **CHASE-SQL** - 多候选SQL选择策略
2. **Lilian Weng的Agent综述** - Agent设计全景
3. **DIN-SQL** - 分解式Text2SQL
4. **ReAct** - 推理与行动交替范式
5. **BERTMap** - 本体对齐深度方法

### 立即查看的Top 3项目

1. **DSPy** - 声明式Agent编程
2. **LlamaIndex** - RAG工程实践
3. **Vanna** - Text2SQL产品化

### 关键概念对照表

| 我们系统中的概念 | 学术/工业界的对应术语 |
|----------------|---------------------|
| Coordinator | Agent / ReAct Loop / Controller |
| Tool Registry | Function Registry / API Library |
| Query Understanding | Semantic Parsing / Intent Classification |
| Ontology Resolution | Entity Linking / Ontology Mapping |
| SQL Generation | Text2SQL / Semantic Parsing |
| Cross-DB Fusion | Entity Resolution / Data Integration |
| Answer Synthesis | Response Generation / Summarization |
| Memory System | State Management / Context Tracking |

---

**文档维护**: 随着学习的深入，建议在此文档中添加个人笔记和关键洞察。
