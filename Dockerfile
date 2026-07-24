# Zogency production image (doc 02 §11.2) — used for both the cloud instance
# and self-hosted client installs. Full node_modules kept so prisma migrate
# and the seed run from the same image (simplicity > size at this stage).
FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json next.config.ts postcss.config.mjs ./
# postinstall runs prisma generate, which needs the schema (copied above).
COPY src ./src
COPY public ./public
RUN npm ci

RUN npm run build

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
