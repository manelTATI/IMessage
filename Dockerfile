# --- Stage 1: Build Frontend ---
FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/Frontend

COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY Frontend/ ./

ENV VITE_API_URL=

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN npm run build


# --- Stage 2: Build Backend ---
FROM node:22-bookworm-slim AS backend-build

WORKDIR /app/Backend

COPY Backend/package.json Backend/package-lock.json ./
RUN npm install --no-audit --no-fund

COPY Backend/ ./

RUN npm run build


# --- Stage 3: Production ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY Backend/package.json Backend/package-lock.json ./

RUN npm install --omit=dev --no-audit --no-fund

COPY --from=backend-build /app/Backend/dist ./dist
COPY --from=frontend-build /app/Frontend/dist ./public

EXPOSE 3001

USER node

CMD ["node", "dist/server.js"]