FROM node:22-slim

WORKDIR /app

# 仅安装生产依赖（express / bcryptjs / jsonwebtoken 均为纯 JS，无原生编译）
COPY package.json ./
RUN npm install --omit=dev

# 复制源码（node:sqlite 为 Node 22 内置，无需额外安装）
COPY . .

# 数据目录指向持久卷挂载点（CloudBase 云托管挂载 CFS 到 /data）
# 本地不设 DATA_DIR 时自动回退到 ./data，行为与之前一致
ENV DATA_DIR=/data

EXPOSE 8787

CMD ["node", "index.js"]
