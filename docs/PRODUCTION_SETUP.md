# Xpense — Production Setup Guide

Deploy Xpense to AWS using Docker containers and Kubernetes. This is the full
production-grade setup: auto-scaling, zero-downtime deploys, managed databases,
SSL, and a CI/CD pipeline.

---

## Architecture Overview

```
                          ┌─────────────────────────────────────────┐
                          │              AWS Cloud                    │
                          │                                           │
Users ──► Telegram/WA ──► │  ALB (Load Balancer)                     │
                          │    │                                      │
Browser ────────────────► │  CloudFront CDN ──► S3 (Frontend)        │
                          │    │                                      │
                          │  EKS Cluster (Kubernetes)                 │
                          │    ├─ backend pods (2–10 replicas)        │
                          │    └─ Horizontal Pod Autoscaler           │
                          │         │                                 │
                          │  RDS PostgreSQL 15 (Multi-AZ)            │
                          │  ElastiCache Redis 7                      │
                          │  ECR (Docker image registry)              │
                          └─────────────────────────────────────────┘
```

---

## Services Used

| Service | Purpose | Cost (approx) |
|---|---|---|
| EKS | Kubernetes cluster | ~$75/month |
| EC2 (t3.small ×2) | Worker nodes | ~$30/month |
| RDS PostgreSQL (db.t3.micro) | Database | ~$15/month |
| ElastiCache (cache.t3.micro) | Redis | ~$13/month |
| ALB | Load balancer | ~$20/month |
| CloudFront + S3 | Frontend CDN | ~$1/month |
| ECR | Docker registry | ~$1/month |
| **Total** | | **~$155/month** |

> For a cheaper start, use a single EC2 instance with Docker Compose instead of EKS (~$20/month total). See the "Budget Setup" section at the bottom.

---

## Prerequisites

Install these tools on your machine:

```bash
# AWS CLI
winget install Amazon.AWSCLI

# kubectl
winget install Kubernetes.kubectl

# eksctl (EKS cluster manager)
winget install eksctl

# Helm (Kubernetes package manager)
winget install Helm.Helm

# Docker Desktop
# Download from https://www.docker.com/products/docker-desktop/
```

Configure AWS CLI:
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g. ap-south-1), Output: json
```

---

## Step 1 — Create the Docker Images

### Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### Frontend Dockerfile (`frontend/Dockerfile`)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Build and push to AWS ECR

```bash
# Create ECR repositories
aws ecr create-repository --repository-name xpense-backend --region ap-south-1
aws ecr create-repository --repository-name xpense-frontend --region ap-south-1

# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1
ECR=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Log in to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR

# Build and push backend
cd backend
docker build -t xpense-backend .
docker tag xpense-backend:latest $ECR/xpense-backend:latest
docker push $ECR/xpense-backend:latest

# Build and push frontend
cd ../frontend
docker build -t xpense-frontend --build-arg VITE_API_URL=https://api.yourdomain.com .
docker tag xpense-frontend:latest $ECR/xpense-frontend:latest
docker push $ECR/xpense-frontend:latest
```

---

## Step 2 — Create RDS PostgreSQL

```bash
# Create a subnet group (use your VPC subnet IDs)
aws rds create-db-subnet-group \
  --db-subnet-group-name xpense-db-subnet \
  --db-subnet-group-description "Xpense DB subnet" \
  --subnet-ids subnet-xxxxxx subnet-yyyyyy

# Create the PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier xpense-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username xpense \
  --master-user-password YOUR_STRONG_PASSWORD \
  --db-name xpense \
  --db-subnet-group-name xpense-db-subnet \
  --no-publicly-accessible \
  --storage-type gp3 \
  --allocated-storage 20
```

Wait ~5 minutes, then get the endpoint:
```bash
aws rds describe-db-instances --db-instance-identifier xpense-db \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

Run the schema against RDS:
```bash
psql "postgresql://xpense:YOUR_STRONG_PASSWORD@YOUR_RDS_ENDPOINT/xpense" \
  -f backend/src/db/schema.sql
```

---

## Step 3 — Create ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id xpense-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1

# Get the endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id xpense-redis --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text
```

---

## Step 4 — Create EKS Cluster

```bash
eksctl create cluster \
  --name xpense-cluster \
  --region ap-south-1 \
  --nodegroup-name xpense-nodes \
  --node-type t3.small \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 5 \
  --managed
```

This takes ~15 minutes. kubectl is configured automatically.

---

## Step 5 — Create Kubernetes Secrets

Store all sensitive config in a Kubernetes Secret:

```bash
kubectl create secret generic xpense-secrets \
  --from-literal=DATABASE_URL="postgresql://xpense:YOUR_STRONG_PASSWORD@YOUR_RDS_ENDPOINT/xpense" \
  --from-literal=REDIS_URL="redis://YOUR_ELASTICACHE_ENDPOINT:6379" \
  --from-literal=JWT_SECRET="your-256-bit-production-secret" \
  --from-literal=TELEGRAM_BOT_TOKEN="your-telegram-bot-token" \
  --from-literal=TELEGRAM_SECRET_TOKEN="your-telegram-secret" \
  --from-literal=WHATSAPP_TOKEN="your-whatsapp-token" \
  --from-literal=WHATSAPP_PHONE_ID="your-phone-id" \
  --from-literal=META_APP_SECRET="your-meta-secret" \
  --from-literal=META_VERIFY_TOKEN="your-verify-token" \
  --from-literal=CLOUDINARY_URL="cloudinary://key:secret@cloud" \
  --from-literal=RAZORPAY_KEY_ID="rzp_live_xxx" \
  --from-literal=RAZORPAY_KEY_SECRET="your-razorpay-secret" \
  --from-literal=ADMIN_PASSWORD="your-admin-password"
```

---

## Step 6 — Deploy to Kubernetes

### Backend Deployment (`k8s/backend-deployment.yaml`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xpense-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: xpense-backend
  template:
    metadata:
      labels:
        app: xpense-backend
    spec:
      containers:
        - name: backend
          image: YOUR_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/xpense-backend:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "3000"
            - name: APP_URL
              value: https://yourdomain.com
            - name: API_URL
              value: https://api.yourdomain.com
            - name: JWT_MAGIC_LINK_EXPIRY
              value: 15m
            - name: JWT_SESSION_EXPIRY
              value: 7d
          envFrom:
            - secretRef:
                name: xpense-secrets
          resources:
            requests:
              memory: 256Mi
              cpu: 100m
            limits:
              memory: 512Mi
              cpu: 500m
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: xpense-backend-svc
spec:
  selector:
    app: xpense-backend
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: xpense-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: xpense-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Ingress (`k8s/ingress.yaml`)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: xpense-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: YOUR_ACM_CERT_ARN
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80},{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
spec:
  rules:
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: xpense-backend-svc
                port:
                  number: 80
```

### Apply everything

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Verify pods are running
kubectl get pods
kubectl get ingress
```

---

## Step 7 — Deploy Frontend to S3 + CloudFront

```bash
# Build the frontend
cd frontend
npm run build

# Create S3 bucket
aws s3 mb s3://xpense-frontend-prod --region ap-south-1

# Enable static website hosting
aws s3 website s3://xpense-frontend-prod \
  --index-document index.html \
  --error-document index.html

# Upload built files
aws s3 sync dist/ s3://xpense-frontend-prod --delete

# Create CloudFront distribution (returns a distribution ID)
aws cloudfront create-distribution \
  --origin-domain-name xpense-frontend-prod.s3.ap-south-1.amazonaws.com \
  --default-root-object index.html
```

---

## Step 8 — Set Up Telegram Webhook (Production)

In production, Telegram pushes directly to your backend URL — no polling needed:

```bash
curl -X POST "https://api.telegram.org/bot YOUR_BOT_TOKEN/setWebhook" \
  -d "url=https://api.yourdomain.com/webhook/telegram" \
  -d "secret_token=your-telegram-secret"
```

Verify:
```bash
curl "https://api.telegram.org/bot YOUR_BOT_TOKEN/getWebhookInfo"
```

---

## Step 9 — Set Up WhatsApp (Meta Cloud API)

1. Go to https://developers.facebook.com → create an App → add **WhatsApp** product
2. Get a test phone number → generate a permanent token
3. Set webhook URL: `https://api.yourdomain.com/webhook/whatsapp`
4. Set verify token: matches `META_VERIFY_TOKEN` in your secrets
5. Subscribe to `messages` webhook field
6. Add all WhatsApp env vars to your Kubernetes secret and redeploy

---

## Step 10 — CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push backend image
        run: |
          cd backend
          docker build -t ${{ secrets.ECR_REGISTRY }}/xpense-backend:${{ github.sha }} .
          docker push ${{ secrets.ECR_REGISTRY }}/xpense-backend:${{ github.sha }}

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name xpense-cluster --region ap-south-1

      - name: Rolling deploy
        run: |
          kubectl set image deployment/xpense-backend \
            backend=${{ secrets.ECR_REGISTRY }}/xpense-backend:${{ github.sha }}
          kubectl rollout status deployment/xpense-backend

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Build and deploy frontend
        run: |
          cd frontend
          npm ci
          VITE_API_URL=https://api.yourdomain.com npm run build
          aws s3 sync dist/ s3://xpense-frontend-prod --delete
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## Budget Alternative — Single EC2 with Docker Compose

If EKS ($155/month) is too expensive, run everything on a single EC2 instance (~$20/month):

```bash
# Launch a t3.small EC2 instance with Ubuntu 22.04
# SSH into it, then:

# Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Clone your repo
git clone https://github.com/yourusername/xpense.git
cd xpense

# Create production .env
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Run everything
docker-compose -f docker-compose.prod.yml up -d
```

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: xpense
      POSTGRES_USER: xpense
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: https://api.yourdomain.com
    ports:
      - "80:80"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:
```

Get a free SSL certificate with Let's Encrypt:
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com
```

---

## Deployment Checklist

Before going live, verify:

- [ ] `NODE_ENV=production` is set
- [ ] `JWT_SECRET` is a strong random string (not the dev default)
- [ ] All webhook secrets are changed from dev defaults
- [ ] Database is not publicly accessible (only accessible from within VPC)
- [ ] SSL certificates are valid
- [ ] Telegram webhook is registered and verified
- [ ] WhatsApp webhook is verified in Meta dashboard
- [ ] Rate limiting is enabled
- [ ] Admin password is changed from default
- [ ] CloudWatch logs are enabled for EKS
- [ ] RDS automated backups are enabled
- [ ] Domain DNS is pointing to ALB / CloudFront

---

## Domain & SSL Setup

1. Buy a domain on **Route 53** or any registrar
2. Request a certificate in **AWS Certificate Manager (ACM)**:
   ```bash
   aws acm request-certificate \
     --domain-name yourdomain.com \
     --subject-alternative-names api.yourdomain.com \
     --validation-method DNS
   ```
3. Add the CNAME records ACM gives you to your DNS
4. Use the certificate ARN in your Ingress annotation

---

## Monitoring

Set up basic monitoring with CloudWatch:

```bash
# Enable Container Insights on EKS
aws eks update-addon \
  --cluster-name xpense-cluster \
  --addon-name amazon-cloudwatch-observability

# View logs
kubectl logs -f deployment/xpense-backend
```

Key metrics to watch:
- Backend CPU/memory (auto-scales at 70% CPU)
- RDS connections and storage
- ALB request count and error rate
- ElastiCache hit rate
