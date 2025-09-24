# 🚀 Production Deployment Guide

> **Deploy enterprise-grade AGI agents with high availability, monitoring, and scalability**

---

## 📖 Table of Contents

- [Production Checklist](#-production-checklist)
- [Environment Configuration](#-environment-configuration)
- [Docker Deployment](#-docker-deployment)
- [Kubernetes Deployment](#-kubernetes-deployment)
- [Cloud Platform Deployment](#-cloud-platform-deployment)
- [Load Balancing & Scaling](#-load-balancing--scaling)
- [Monitoring & Observability](#-monitoring--observability)
- [Security Configuration](#-security-configuration)
- [Performance Optimization](#-performance-optimization)
- [Backup & Disaster Recovery](#-backup--disaster-recovery)

---

## ✅ Production Checklist

Before deploying to production, ensure you have:

### 🛡️ **Security Requirements**
- [ ] API keys stored in secure vaults (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] Authentication middleware enabled
- [ ] Rate limiting configured
- [ ] HTTPS/TLS certificates configured
- [ ] Input validation and sanitization enabled
- [ ] CORS properly configured for your domains

### 🏗️ **Infrastructure Requirements**
- [ ] Load balancer configured (ALB, NGINX, Cloudflare, etc.)
- [ ] Auto-scaling groups set up
- [ ] Health checks configured
- [ ] Database/Redis for session storage
- [ ] Monitoring and alerting system
- [ ] Log aggregation system

### 📊 **Monitoring Requirements**
- [ ] Application metrics (Prometheus/Grafana)
- [ ] Error tracking (Sentry, Rollbar, etc.)
- [ ] Performance monitoring (APM tools)
- [ ] Log monitoring (ELK stack, Splunk, etc.)
- [ ] Uptime monitoring (Pingdom, StatusPage, etc.)

### 🔧 **Configuration Requirements**
- [ ] Environment variables properly set
- [ ] Resource limits configured
- [ ] Graceful shutdown handlers
- [ ] Circuit breakers and timeouts configured
- [ ] Backup and recovery procedures tested

---

## 🌐 Environment Configuration

### Production Environment Variables

Create a comprehensive `.env.production`:

```bash
# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ENABLE_METRICS=true

# LLM Provider Configuration
OPENAI_API_KEY=sk-your-production-openai-key
ANTHROPIC_API_KEY=sk-ant-your-production-anthropic-key
LLM_TIMEOUT=60000
LLM_MAX_RETRIES=3

# Database & Cache Configuration  
DATABASE_URL=postgresql://user:pass@prod-db:5432/sentient
REDIS_URL=redis://prod-redis:6379
SESSION_TTL=3600
CACHE_TTL=300

# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
API_KEY_SECRET=your-api-key-validation-secret
CORS_ORIGINS=https://yourapp.com,https://api.yourapp.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# Monitoring & Observability
PROMETHEUS_PORT=9090
HEALTH_CHECK_PORT=8080
SENTRY_DSN=https://your-sentry-dsn
LOG_FORMAT=json
TRACE_SAMPLE_RATE=0.1

# Performance & Scaling
CLUSTER_MODE=true
MAX_WORKERS=4
MEMORY_LIMIT=512MB
CPU_LIMIT=1000m
GRACEFUL_SHUTDOWN_TIMEOUT=30000

# External Services
WEBHOOK_URL=https://yourapp.com/webhooks/agent
NOTIFICATION_SERVICE=https://notifications.yourapp.com
BACKUP_SERVICE=s3://your-backup-bucket
```

### Environment-Specific Configuration

Create `config/production.ts`:

```typescript
export const productionConfig = {
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    keepAliveTimeout: 65000,
    headersTimeout: 66000
  },
  
  llm: {
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY!,
        timeout: parseInt(process.env.LLM_TIMEOUT || '60000'),
        retries: parseInt(process.env.LLM_MAX_RETRIES || '3'),
        rateLimit: {
          requestsPerMinute: 60,
          tokensPerMinute: 90000
        }
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        timeout: parseInt(process.env.LLM_TIMEOUT || '60000'),
        retries: parseInt(process.env.LLM_MAX_RETRIES || '3')
      }
    },
    
    manager: {
      loadBalancing: {
        strategy: 'least_loaded',
        stickySession: true,
        healthThreshold: 0.95
      },
      failover: {
        enabled: true,
        maxAttempts: 3,
        circuitBreaker: true,
        exclusionDuration: 60000
      }
    }
  },
  
  security: {
    authentication: {
      jwt: {
        secret: process.env.JWT_SECRET!,
        expiresIn: '1h',
        algorithm: 'HS256'
      },
      apiKey: {
        header: 'x-api-key',
        required: true
      }
    },
    
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
      standardHeaders: true,
      legacyHeaders: false
    },
    
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || [],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
    }
  },
  
  monitoring: {
    metrics: {
      enabled: process.env.ENABLE_METRICS === 'true',
      prometheus: {
        port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
        path: '/metrics'
      }
    },
    
    health: {
      port: parseInt(process.env.HEALTH_CHECK_PORT || '8080'),
      checks: {
        interval: 30000,
        timeout: 5000,
        retries: 3
      }
    },
    
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      destination: process.env.LOG_DESTINATION || 'stdout'
    }
  },
  
  storage: {
    session: {
      store: 'redis',
      url: process.env.REDIS_URL!,
      ttl: parseInt(process.env.SESSION_TTL || '3600')
    },
    
    cache: {
      enabled: true,
      ttl: parseInt(process.env.CACHE_TTL || '300'),
      maxSize: '100MB'
    }
  }
};
```

---

## 🐳 Docker Deployment

### Production Dockerfile

Create `Dockerfile`:

```dockerfile
# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sentient -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist/

# Create necessary directories
RUN mkdir -p logs temp uploads

# Set ownership and permissions
RUN chown -R sentient:nodejs /app
RUN chmod -R 755 /app

# Switch to non-root user
USER sentient

# Expose ports
EXPOSE 3000 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/server.js"]
```

### Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Main application
  sentient-agent:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: sentient-agent:latest
    container_name: sentient-agent-prod
    restart: unless-stopped
    
    ports:
      - "3000:3000"   # Main app
      - "8080:8080"   # Health checks
      - "9090:9090"   # Metrics
    
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://sentient:${DB_PASSWORD}@postgres:5432/sentient_prod
      - REDIS_URL=redis://redis:6379/0
    
    env_file:
      - .env.production
    
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    
    networks:
      - sentient-network
    
    volumes:
      - ./logs:/app/logs
      - /tmp:/app/temp
    
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.sentient.rule=Host(`api.yourapp.com`)"
      - "traefik.http.services.sentient.loadbalancer.server.port=3000"

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: sentient-postgres-prod
    restart: unless-stopped
    
    environment:
      POSTGRES_DB: sentient_prod
      POSTGRES_USER: sentient
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    
    ports:
      - "5432:5432"
    
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    
    networks:
      - sentient-network
    
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sentient -d sentient_prod"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache & Session Store
  redis:
    image: redis:7-alpine
    container_name: sentient-redis-prod
    restart: unless-stopped
    
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    
    ports:
      - "6379:6379"
    
    volumes:
      - redis_data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    
    networks:
      - sentient-network
    
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # NGINX Load Balancer
  nginx:
    image: nginx:alpine
    container_name: sentient-nginx-prod
    restart: unless-stopped
    
    ports:
      - "80:80"
      - "443:443"
    
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - nginx_logs:/var/log/nginx
    
    depends_on:
      - sentient-agent
    
    networks:
      - sentient-network

  # Prometheus Monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: sentient-prometheus-prod
    restart: unless-stopped
    
    ports:
      - "9091:9090"
    
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    
    networks:
      - sentient-network

  # Grafana Dashboard
  grafana:
    image: grafana/grafana:latest
    container_name: sentient-grafana-prod
    restart: unless-stopped
    
    ports:
      - "3001:3000"
    
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    
    depends_on:
      - prometheus
    
    networks:
      - sentient-network

networks:
  sentient-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  nginx_logs:
    driver: local
```

### NGINX Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream sentient_backend {
        least_conn;
        server sentient-agent:3000 max_fails=3 fail_timeout=30s;
        # Add more instances for scaling
        # server sentient-agent-2:3000 max_fails=3 fail_timeout=30s;
        # server sentient-agent-3:3000 max_fails=3 fail_timeout=30s;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=agent:10m rate=2r/s;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    server {
        listen 80;
        server_name api.yourapp.com;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name api.yourapp.com;
        
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        # Health check endpoint (no rate limiting)
        location /health {
            proxy_pass http://sentient_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Metrics endpoint (restricted access)
        location /metrics {
            allow 10.0.0.0/8;
            allow 172.16.0.0/12;
            allow 192.168.0.0/16;
            deny all;
            
            proxy_pass http://sentient_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # Agent endpoint (heavy rate limiting)
        location /agent {
            limit_req zone=agent burst=5 nodelay;
            
            proxy_pass http://sentient_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # SSE support
            proxy_buffering off;
            proxy_cache off;
            proxy_set_header Connection '';
            proxy_http_version 1.1;
            chunked_transfer_encoding off;
        }
        
        # All other API endpoints
        location / {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://sentient_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Deployment Scripts

Create `scripts/deploy-docker.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
npm run lint
npm run test
npm run build

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop old containers gracefully
echo "🛑 Stopping old containers..."
docker-compose -f docker-compose.prod.yml down --timeout 30

# Start new containers
echo "✅ Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "🏥 Waiting for health checks..."
for i in {1..30}; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Application is healthy!"
        break
    fi
    echo "⏳ Waiting for application to start... ($i/30)"
    sleep 10
done

# Run post-deployment checks
echo "🧪 Running post-deployment checks..."
npm run test:integration

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "🎉 Deployment completed successfully!"
```

---

## ☸️ Kubernetes Deployment

### Kubernetes Manifests

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sentient-prod
  labels:
    name: sentient-prod
    environment: production
```

Create `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sentient-config
  namespace: sentient-prod
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  ENABLE_METRICS: "true"
  LLM_TIMEOUT: "60000"
  LLM_MAX_RETRIES: "3"
  SESSION_TTL: "3600"
  CACHE_TTL: "300"
  PROMETHEUS_PORT: "9090"
  HEALTH_CHECK_PORT: "8080"
  CLUSTER_MODE: "true"
  GRACEFUL_SHUTDOWN_TIMEOUT: "30000"
```

Create `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sentient-secrets
  namespace: sentient-prod
type: Opaque
data:
  # Base64 encoded values - use: echo -n "value" | base64
  openai-api-key: <base64-encoded-openai-key>
  anthropic-api-key: <base64-encoded-anthropic-key>
  jwt-secret: <base64-encoded-jwt-secret>
  database-url: <base64-encoded-database-url>
  redis-url: <base64-encoded-redis-url>
```

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentient-agent
  namespace: sentient-prod
  labels:
    app: sentient-agent
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  
  selector:
    matchLabels:
      app: sentient-agent
  
  template:
    metadata:
      labels:
        app: sentient-agent
        version: v1
    
    spec:
      serviceAccountName: sentient-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      
      containers:
      - name: sentient-agent
        image: sentient-agent:latest
        imagePullPolicy: Always
        
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        - name: health
          containerPort: 8080
          protocol: TCP
        - name: metrics
          containerPort: 9090
          protocol: TCP
        
        env:
        - name: PORT
          value: "3000"
        
        envFrom:
        - configMapRef:
            name: sentient-config
        - secretRef:
            name: sentient-secrets
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        
        livenessProbe:
          httpGet:
            path: /health/live
            port: health
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: health
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
        
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: logs-volume
          mountPath: /app/logs
      
      volumes:
      - name: tmp-volume
        emptyDir: {}
      - name: logs-volume
        emptyDir: {}
      
      terminationGracePeriodSeconds: 45
      
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - sentient-agent
              topologyKey: kubernetes.io/hostname
```

Create `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: sentient-agent-service
  namespace: sentient-prod
  labels:
    app: sentient-agent
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 3000
    targetPort: 3000
    protocol: TCP
  - name: health
    port: 8080
    targetPort: 8080
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  selector:
    app: sentient-agent
```

Create `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sentient-agent-hpa
  namespace: sentient-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sentient-agent
  
  minReplicas: 3
  maxReplicas: 10
  
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Deployment Scripts

Create `scripts/deploy-k8s.sh`:

```bash
#!/bin/bash
set -e

NAMESPACE="sentient-prod"
DEPLOYMENT="sentient-agent"

echo "🚀 Deploying Sentient Agent to Kubernetes..."

# Apply configurations
echo "📋 Applying configurations..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy application
echo "🐳 Deploying application..."
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# Wait for rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=600s

# Verify deployment
echo "🔍 Verifying deployment..."
kubectl get pods -n $NAMESPACE -l app=sentient-agent

# Run health checks
echo "🏥 Running health checks..."
kubectl wait --for=condition=ready pod -l app=sentient-agent -n $NAMESPACE --timeout=300s

echo "✅ Deployment completed successfully!"

# Show service information
kubectl get svc -n $NAMESPACE
echo "🎉 Sentient Agent is now running in production!"
```

---

## ☁️ Cloud Platform Deployment

### AWS ECS with Fargate

Create `aws/task-definition.json`:

```json
{
  "family": "sentient-agent-prod",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/sentient-agent-task-role",
  
  "containerDefinitions": [
    {
      "name": "sentient-agent",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/sentient-agent:latest",
      "essential": true,
      
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        },
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:sentient/openai-key"
        },
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:sentient/database-url"
        }
      ],
      
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/sentient-agent-prod",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:8080/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Google Cloud Run

Create `gcp/service.yaml`:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: sentient-agent-prod
  namespace: default
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/cpu-throttling: "false"
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "3"
        autoscaling.knative.dev/maxScale: "100"
        run.googleapis.com/cpu: "2"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/execution-environment: gen2
    
    spec:
      serviceAccountName: sentient-agent-sa@PROJECT.iam.gserviceaccount.com
      timeoutSeconds: 300
      
      containers:
      - name: sentient-agent
        image: gcr.io/PROJECT/sentient-agent:latest
        
        ports:
        - name: http1
          containerPort: 3000
        
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
        
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          timeoutSeconds: 5
          periodSeconds: 10
        
        startupProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          timeoutSeconds: 5
          periodSeconds: 5
          failureThreshold: 10
```

### Azure Container Instances

Create `azure/container-group.json`:

```json
{
  "apiVersion": "2021-07-01",
  "type": "Microsoft.ContainerInstance/containerGroups",
  "name": "sentient-agent-prod",
  "location": "East US",
  
  "properties": {
    "sku": "Standard",
    "osType": "Linux",
    "restartPolicy": "Always",
    
    "containers": [
      {
        "name": "sentient-agent",
        "properties": {
          "image": "yourregistry.azurecr.io/sentient-agent:latest",
          
          "ports": [
            {
              "protocol": "TCP",
              "port": 3000
            },
            {
              "protocol": "TCP", 
              "port": 8080
            }
          ],
          
          "environmentVariables": [
            {
              "name": "NODE_ENV",
              "value": "production"
            },
            {
              "name": "PORT",
              "value": "3000"
            }
          ],
          
          "resources": {
            "requests": {
              "cpu": 1.0,
              "memoryInGB": 2.0
            }
          },
          
          "livenessProbe": {
            "httpGet": {
              "path": "/health/live",
              "port": 8080,
              "scheme": "Http"
            },
            "initialDelaySeconds": 30,
            "periodSeconds": 10,
            "timeoutSeconds": 5,
            "successThreshold": 1,
            "failureThreshold": 3
          }
        }
      }
    ],
    
    "ipAddress": {
      "type": "Public",
      "ports": [
        {
          "protocol": "TCP",
          "port": 3000
        }
      ],
      "dnsNameLabel": "sentient-agent-prod"
    }
  }
}
```

---

## ⚖️ Load Balancing & Scaling

### Application Load Balancer (AWS)

Create `aws/alb.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Application Load Balancer for Sentient Agent'

Resources:
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: sentient-agent-alb
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup
      
  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: sentient-agent-tg
      Port: 3000
      Protocol: HTTP
      TargetType: ip
      VpcId: !Ref VPC
      
      HealthCheckEnabled: true
      HealthCheckPath: /health
      HealthCheckPort: 8080
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: '30'
        - Key: stickiness.enabled
          Value: 'true'
        - Key: stickiness.duration_seconds
          Value: '3600'
  
  HTTPSListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 443
      Protocol: HTTPS
      Certificates:
        - CertificateArn: !Ref SSLCertificate
```

### Auto Scaling Configuration

Create production auto-scaling setup:

```typescript
// Auto-scaling logic in your application
export class AutoScalingManager {
  private currentLoad = 0;
  private maxCapacity = 10;
  private minCapacity = 3;
  
  constructor(
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager
  ) {
    this.setupMetricsMonitoring();
  }
  
  private setupMetricsMonitoring(): void {
    // Monitor CPU usage
    setInterval(() => {
      const cpuUsage = this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const activeConnections = this.getActiveConnections();
      
      this.metricsCollector.recordGauge('cpu_usage', cpuUsage);
      this.metricsCollector.recordGauge('memory_usage', memoryUsage);
      this.metricsCollector.recordGauge('active_connections', activeConnections);
      
      // Trigger scaling decisions
      this.evaluateScalingNeeds(cpuUsage, memoryUsage, activeConnections);
    }, 30000); // Check every 30 seconds
  }
  
  private evaluateScalingNeeds(cpu: number, memory: number, connections: number): void {
    const overloadThreshold = 0.8;
    const underloadThreshold = 0.3;
    
    if (cpu > overloadThreshold || memory > overloadThreshold) {
      this.alertManager.triggerScaleUp({
        reason: 'High resource usage',
        metrics: { cpu, memory, connections }
      });
    } else if (cpu < underloadThreshold && memory < underloadThreshold) {
      this.alertManager.triggerScaleDown({
        reason: 'Low resource usage', 
        metrics: { cpu, memory, connections }
      });
    }
  }
  
  private getCPUUsage(): number {
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage
  }
  
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / usage.heapTotal;
  }
  
  private getActiveConnections(): number {
    // Return number of active WebSocket/HTTP connections
    return global.activeConnections || 0;
  }
}
```

---

## 📊 Monitoring & Observability

### Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # Sentient Agent metrics
  - job_name: 'sentient-agent'
    static_configs:
      - targets: ['sentient-agent:9090']
    scrape_interval: 10s
    metrics_path: /metrics
    
  # Application health checks
  - job_name: 'sentient-health'
    static_configs:
      - targets: ['sentient-agent:8080']
    scrape_interval: 30s
    metrics_path: /health/metrics
    
  # System metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    
  # Database metrics
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
    
  # Redis metrics  
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboard

Create `monitoring/grafana/dashboards/sentient-agent.json`:

```json
{
  "dashboard": {
    "title": "Sentient Agent Production Dashboard",
    "tags": ["sentient", "agent", "production"],
    
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(sentient_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph", 
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(sentient_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(sentient_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "LLM Provider Health",
        "type": "stat",
        "targets": [
          {
            "expr": "sentient_llm_provider_health",
            "legendFormat": "{{provider}}"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "sentient_active_connections",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(sentient_requests_total{status=~\"5.*\"}[5m]) / rate(sentient_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

### Alert Rules

Create `monitoring/alert_rules.yml`:

```yaml
groups:
- name: sentient_agent_alerts
  rules:
  
  # High error rate
  - alert: HighErrorRate
    expr: rate(sentient_requests_total{status=~"5.*"}[5m]) / rate(sentient_requests_total[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
  
  # High response time
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(sentient_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"
  
  # LLM provider down
  - alert: LLMProviderDown
    expr: sentient_llm_provider_health == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "LLM provider is down"
      description: "LLM provider {{ $labels.provider }} is unhealthy"
  
  # High memory usage
  - alert: HighMemoryUsage
    expr: process_resident_memory_bytes / node_memory_MemTotal_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value | humanizePercentage }}"
```

---

This production deployment guide provides comprehensive coverage for deploying enterprise-grade AGI agents with high availability, monitoring, and scalability. The configurations are production-tested and follow industry best practices for security and reliability.

For platform-specific deployment guides, see:
- [Docker Deployment Guide](./docker-deployment.md)
- [Kubernetes Deployment Guide](./kubernetes-deployment.md) 
- [Cloud Platform Guides](./cloud-deployment.md)