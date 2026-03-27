# SCGB 南京大学部署修改说明

**部署目标**: https://biobigdata.nju.edu.cn/singledb/  
**API 路径**: https://biobigdata.nju.edu.cn/scdbAPI/  
**后端端口**: 13009

---

## 📋 修改清单

### 1. 后端修改 (backend/)

#### 1.1 API 路由前缀修改
将所有 `/api/v1` 改为 `/scdbAPI`：

| 文件 | 修改内容 |
|------|---------|
| `api/routes/query.py` | `prefix="/scdbAPI"` |
| `api/routes/explore.py` | `prefix="/scdbAPI"` |
| `api/routes/stats.py` | `prefix="/scdbAPI"` |
| `api/routes/dataset.py` | `prefix="/scdbAPI"` |
| `api/routes/downloads.py` | `prefix="/scdbAPI"` |
| `api/routes/entity.py` | `prefix="/scdbAPI"` |
| `api/routes/export.py` | `prefix="/scdbAPI"` |
| `api/routes/ontology.py` | `prefix="/scdbAPI"` |
| `api/routes/session.py` | `prefix="/scdbAPI"` |
| `api/routes/advanced_search.py` | `prefix="/scdbAPI"` |

#### 1.2 main.py 直接路由修改
```python
# 修改前
@app.get("/api/v1/info")
@app.get("/api/v1/health")

# 修改后  
@app.get("/scdbAPI/info")
@app.get("/scdbAPI/health")

# 限流中间件路径检查
if path.startswith("/assets") or path == "/scdbAPI/health" or path == "/":
```

---

### 2. 前端修改 (agent_v2/web/)

#### 2.1 API 基础 URL 修改
**文件**: `src/services/api.ts`
```typescript
// 修改前
const BASE_URL = '/api/v1';

// 修改后
const BASE_URL = 'https://biobigdata.nju.edu.cn/scdbAPI';
```

#### 2.2 WebSocket URL 修改
**文件**: `src/hooks/useWebSocket.ts`
```typescript
// 修改前
const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/query/stream`);

// 修改后
const ws = new WebSocket(`${protocol}//biobigdata.nju.edu.cn/scdbAPI/query/stream`);
```

#### 2.3 路由 basename 修改
**文件**: `src/main.tsx`
```tsx
// 修改前
<BrowserRouter>

// 修改后
<BrowserRouter basename="/singledb">
```

#### 2.4 Vite 配置修改
**文件**: `vite.config.ts`
```typescript
// 修改前
export default defineConfig({
  plugins: [react(), tailwindcss()],

// 修改后
export default defineConfig({
  base: '/singledb/',
  plugins: [react(), tailwindcss()],
```

---

### 3. Nginx 配置 (config/nginx_scgb_nju.conf)

```nginx
server {
    listen 80;
    server_name biobigdata.nju.edu.cn;

    # 前端: /singledb/ 子路径
    location /singledb/ {
        alias /opt/scgb-portal/frontend/;
        try_files $uri $uri/ /singledb/index.html;
    }

    # API: /scdbAPI/ 转发到后端
    location /scdbAPI/ {
        proxy_pass http://127.0.0.1:13009;
        ...
    }

    # WebSocket
    location /scdbAPI/query/stream {
        proxy_pass http://127.0.0.1:13009;
        ...
    }
}
```

---

### 4. Systemd 配置 (config/scgb-portal-nju.service)

```ini
[Service]
# 使用 13009 端口
ExecStart=/opt/scgb-portal/venv/bin/python -m uvicorn api.main:app \
    --host 127.0.0.1 \
    --port 13009 \
    ...

Environment=SCEQTL_CORS_ORIGINS=https://biobigdata.nju.edu.cn
```

---

## 🚀 部署步骤（给学长）

### 1. 上传部署包到服务器
```bash
scp scgb_deploy.tar.gz user@biobigdata.nju.edu.cn:/tmp/
ssh user@biobigdata.nju.edu.cn
cd /tmp && tar -xzf scgb_deploy.tar.gz
sudo mv scgb_deploy /opt/scgb-portal
```

### 2. 创建 Python 虚拟环境并安装依赖
```bash
cd /opt/scgb-portal
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn[standard] pandas numpy
```

### 3. 配置 Nginx
```bash
sudo cp config/nginx_scgb_nju.conf /etc/nginx/sites-available/scgb-portal
sudo ln -sf /etc/nginx/sites-available/scgb-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. 配置 Systemd 服务
```bash
sudo cp config/scgb-portal-nju.service /etc/systemd/system/scgb-portal.service
sudo systemctl daemon-reload
sudo systemctl enable scgb-portal
sudo systemctl start scgb-portal
```

### 5. 验证
```bash
# 检查后端
curl http://127.0.0.1:13009/scdbAPI/health

# 检查前端
# 浏览器访问 https://biobigdata.nju.edu.cn/singledb/
```

---

## 🔍 访问路径验证

| 访问地址 | 预期结果 |
|---------|---------|
| `https://biobigdata.nju.edu.cn/singledb/` | 网站首页 |
| `https://biobigdata.nju.edu.cn/scdbAPI/health` | API 健康检查 |
| `https://biobigdata.nju.edu.cn/scdbAPI/stats` | 统计数据 |

---

## ⚠️ 常见问题

### 1. 前端资源 404
检查 Nginx 配置中的 `alias` 路径是否正确，确保有尾部斜杠：
```nginx
location /singledb/ {
    alias /opt/scgb-portal/frontend/;  # ✅ 尾部有斜杠
    # 不是 /opt/scgb-portal/frontend ❌
}
```

### 2. API 请求 404
检查 Nginx 转发配置，确保 proxy_pass 末尾没有斜杠：
```nginx
location /scdbAPI/ {
    proxy_pass http://127.0.0.1:13009;  # ✅ 没有尾部斜杠
    # 不是 http://127.0.0.1:13009/ ❌
}
```

### 3. CORS 错误
检查后端是否正确设置了 CORS：
```bash
Environment=SCEQTL_CORS_ORIGINS=https://biobigdata.nju.edu.cn
```

### 4. WebSocket 连接失败
确保 Nginx 配置了 WebSocket 支持（已在配置中包含）。

---

## 📞 联系方式

如有问题，联系项目维护者。
