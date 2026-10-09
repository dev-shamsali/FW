import type { Files } from "./parts.js";
import type { ProjectOptions } from "./options.js";

const dbName = (name: string): string => name.replace(/[^A-Za-z0-9_]/g, "_");

export function dockerFiles(o: ProjectOptions, name: string): Files {
  const ts = o.language === "ts";
  const dockerfile = ts
    ? `# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
`
    : `# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
`;

  const db = dbName(name);
  const appEnv = (url: string) => `      NODE_ENV: production
      PORT: "5000"
      CORS_ORIGIN: \${CORS_ORIGIN:-}
      TRUST_PROXY: \${TRUST_PROXY:-0}${url ? `\n      DATABASE_URL: ${url}` : ""}${o.auth ? `\n      JWT_SECRET: \${JWT_SECRET:?set JWT_SECRET in .env}` : ""}`;

  let compose: string;
  if (o.database === "mongodb") {
    compose = `services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
${appEnv(`mongodb://mongo:27017/${db}`)}
    depends_on:
      mongo:
        condition: service_healthy
    restart: unless-stopped

  # Development database without authentication. Enable authentication and a private network for real deployments.
  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mongo-data:
`;
  } else if (o.database === "mysql") {
    compose = `services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
${appEnv(`mysql://root:\${MYSQL_ROOT_PASSWORD}@mysql:3306/${db}`)}
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  # Use a URL-safe MYSQL_ROOT_PASSWORD (no @ : / ? # characters), because it is embedded in DATABASE_URL.
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:?set MYSQL_ROOT_PASSWORD in .env}
      MYSQL_DATABASE: ${db}
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p\\"$$MYSQL_ROOT_PASSWORD\\" --silent"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  mysql-data:
`;
  } else {
    compose = `services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
${appEnv("")}
    restart: unless-stopped
`;
  }

  return {
    Dockerfile: dockerfile,
    ".dockerignore": "node_modules\ndist\ncoverage\n.env\n.env.*\n!.env.example\n.git\nDockerfile\ndocker-compose.yml\n.github\ntests\n",
    "docker-compose.yml": compose,
  };
}
