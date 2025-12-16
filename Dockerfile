# ============================================
# Stage 1: Builder - Construir la aplicación
# ============================================
FROM node:22-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias necesarias para Prisma
RUN apk add --no-cache openssl libc6-compat

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (necesarias para el build)
RUN npm ci

# Copiar el código fuente
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

# Construir la aplicación
RUN npm run build

# Verificar que el build fue exitoso
RUN ls -la dist/ && \
    if [ ! -f dist/main.js ] && [ ! -f dist/src/main.js ]; then \
        echo "ERROR: No se encontró el archivo main.js después del build"; \
        echo "Contenido de dist/:"; \
        find dist/ -type f; \
        exit 1; \
    fi

# ============================================
# Stage 2: Runner - Imagen de producción
# ============================================
FROM node:22-alpine AS runner

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias necesarias para Prisma en runtime
RUN apk add --no-cache openssl libc6-compat dumb-init

# Crear usuario no-root para mayor seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copiar package files
COPY package*.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar schema de Prisma
COPY --from=builder /app/prisma ./prisma

# Generar cliente de Prisma (necesario en la imagen final)
RUN npx prisma generate

# Copiar código compilado desde el builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Verificar que el archivo main existe (para debugging)
RUN ls -la /app/dist/ || echo "Warning: dist directory structure:"

# Cambiar al usuario no-root
USER nestjs

# Exponer el puerto
EXPOSE 3000

# Variables de entorno por defecto (se pueden sobrescribir en ECS)
ENV NODE_ENV=production \
    PORT=3000

# Health check para ECS Fargate / ALB
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Usar exec form con dumb-init para manejo correcto de señales
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main || node dist/main"]