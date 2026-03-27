# SCGB Portal 部署包

单细胞基因表达数据统一查询平台 - 生产环境部署包

## 📁 目录结构

```
scgb_deploy/
├── backend/              # FastAPI 后端代码
│   ├── api/             # API 路由和主应用
│   ├── src/             # 核心模块
│   ├── config/          # 配置文件
│   ├── run_server.py    # 启动脚本
│   └── pyproject.toml   # Python 依赖
├── frontend/            # React 前端构建文件
│   ├── index.html
│   ├── assets/          # JS/CSS/图片
│   └── ...
├── data/                # 数据和缓存
│   ├── unified_metadata.db      # 主数据库 (1.4GB)
│   ├── ontologies/
│   │   └── ontology_cache.db    # 本体缓存
│   ├── memory/
│   │   ├── episodic.db          # 会话记忆
│   │   └── semantic.db          # 知识记忆
│   └── schema_knowledge.yaml    # Schema 知识库
├── config/              # 配置文件模板
│   ├── .env.example           # 环境变量模板
│   ├── nginx_scgb.conf        # Nginx 配置
│   └── scgb-portal.service    # Systemd 服务
├── scripts/             # 部署脚本
│   ├── install.sh            # 服务器安装脚本
│   ├── start.sh              # 本地启动脚本
│   └── deploy_to_server.sh   # 远程部署脚本
└── README.md            # 本文件
```

## 🚀 快速开始

### 方式一：本地启动（测试用）

```bash
cd scgb_deploy
./scripts/start.sh
# 或指定端口
./scripts/start.sh --port 8080
```

访问 http://localhost:8000

### 方式二：服务器部署（推荐）

#### 1. 上传部署包到服务器

```bash
# 方式A: 使用部署脚本（需要 SSH 免密登录）
./scripts/deploy_to_server.sh user@your-server-ip your.domain.com

# 方式B: 手动上传
scp -r scgb_deploy user@your-server-ip:/tmp/
ssh user@your-server-ip
sudo mv /tmp/scgb_deploy /opt/scgb-portal
```

#### 2. 在服务器上安装

```bash
cd /opt/scgb-portal
sudo bash scripts/install.sh
```

#### 3. 配置域名和 HTTPS

```bash
# 修改 Nginx 配置中的域名
sudo nano /etc/nginx/sites-available/scgb-portal

# 申请 SSL 证书（需要真实域名指向服务器）
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

#### 4. 启动服务

```bash
sudo systemctl start scgb-portal
sudo systemctl enable scgb-portal  # 开机自启
```

#### 5. 检查状态

```bash
# 查看服务状态
sudo systemctl status scgb-portal

# 查看日志
sudo journalctl -u scgb-portal -f

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/scgb-error.log
```

## ⚙️ 配置说明

### 环境变量

复制 `config/.env.example` 为 `backend/.env` 并修改：

```bash
# 数据库路径（必须是绝对路径）
SCEQTL_DB_PATH=/opt/scgb-portal/data/unified_metadata.db

# 允许的域名（生产环境必须指定）
SCEQTL_CORS_ORIGINS=https://your.domain.com

# API 限流（每分钟请求数）
SCEQTL_RATE_LIMIT=60
```

### Nginx 配置

主要修改点：
- `server_name`：改为你的域名
- `root`：确认前端文件路径正确
- `proxy_pass`：确认后端端口正确

### Systemd 服务

主要修改点：
- `User`：运行服务的用户
- `WorkingDirectory`：后端代码路径
- `Environment`：环境变量

## 🔧 常用命令

```bash
# 重启服务
sudo systemctl restart scgb-portal

# 停止服务
sudo systemctl stop scgb-portal

# 查看日志
sudo journalctl -u scgb-portal -n 100

# 重新加载 Nginx
sudo nginx -t && sudo systemctl reload nginx

# 更新代码后重启
cd /opt/scgb-portal/backend
git pull  # 或上传新代码
sudo systemctl restart scgb-portal
```

## 📊 资源占用

- **磁盘**: 约 3GB（数据库 1.5GB + 代码/日志 1.5GB）
- **内存**: 运行时 1.5-2GB，建议预留 4GB
- **CPU**: 日常使用 1 核足够，并发查询时需要 2 核
- **带宽**: 依赖查询结果大小，通常不大

## 🛡️ 安全建议

1. **必须配置 HTTPS**: 使用 Let's Encrypt 免费证书
2. **限制 CORS**: 生产环境设置 `SCEQTL_CORS_ORIGINS` 为你的域名
3. **配置防火墙**: 只开放 80/443 端口
4. **定期备份**: 数据库文件建议定期备份
5. **更新系统**: 定期运行 `sudo apt update && sudo apt upgrade`

## 🐛 故障排查

### 服务启动失败

```bash
# 检查日志
sudo journalctl -u scgb-portal -n 50

# 检查端口占用
sudo lsof -i :8000

# 手动测试启动
cd /opt/scgb-portal/backend
source ../venv/bin/activate
python run_server.py --port 8000
```

### 前端 404

检查 Nginx 配置中的 `try_files` 是否正确：
```nginx
try_files $uri $uri/ /index.html;
```

### API 请求失败

检查后端服务是否运行：
```bash
curl http://localhost:8000/scdbAPI/health
```

### 数据库错误

检查数据库文件权限：
```bash
ls -la /opt/scgb-portal/data/unified_metadata.db
# 应该可读
sudo chown scgb:scgb /opt/scgb-portal/data/unified_metadata.db
```

## 📞 支持

- 项目文档: 见原项目 README.md
- API 文档: http://your-server/docs
- 问题反馈: 联系项目维护者

## 📄 许可

与原项目保持一致
