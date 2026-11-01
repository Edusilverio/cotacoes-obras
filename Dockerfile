# ---- Build ----
FROM node:22-slim AS build
WORKDIR /app
# O projeto usa Bun (bun.lock) e NAO tem package-lock.json.
# Copiamos so o package.json e resolvemos com npm install (nao "npm ci").
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
