# 小型数据源说明

## 根目录文件

| 文件 | 数据源 | 记录数 | 说明 |
|------|--------|--------|------|
| `HCA.xlsx` | Human Cell Atlas | 152 donor | 优质本体注释，含 ethnicity/disease/dev_stage |
| `HTAN.tsv` | Human Tumor Atlas | 942 participant | 癌症临床数据，含 AJCC 分期 |
| `ega_scrna_metadata.xlsx` | EGA | 1,803 dataset | 元数据极稀疏（仅标题+access） |
| `PsychAD_media-1.csv` | PsychAD | 1,494 donor | 神经精神疾病（AD/SCZ），脑组织 |

## 子目录

### biscp/ — Broad Institute Single Cell Portal
- 576 个 human studies（SCP* accession）
- 仅有 study 级元数据，无样本级
- `data/processed/human_studies_v2_*.csv`

### kpmp/ — Kidney Precision Medicine Project
- 105 个 GEO series（肾病专项）
- `kpmp_series_metadata.csv`
- 所有记录实际都是 GEO 子集

### zenodo+figshare/ — 数据仓库
- Zenodo: 1,607 条, Figshare: 243 条
- 按 confidence score 筛选的单细胞相关数据集
- 大部分为 low confidence，需人工确认
- `data_human_sc/zenodo_records.csv`, `figshare_records.csv`

## 在统一数据库中的映射

| 来源 | 目标表 | 备注 |
|------|--------|------|
| HCA | projects + samples | sample_id_type='hca_donor' |
| HTAN | projects + samples | sample_id_type='htan_participant' |
| EGA | projects only | 元数据过少，无法入 samples |
| PsychAD | projects + samples | source_database='psychad', tissue='brain' |
| BISCP | projects only | source_database='biscp' |
| KPMP | projects only | source_database='kpmp' |
| Zenodo | projects only | source_database='zenodo' |
| Figshare | projects only | source_database='figshare' |
