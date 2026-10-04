FROM node:22-alpine AS dependencies
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app/frontend
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
COPY --from=dependencies /app/frontend/node_modules ./node_modules
COPY frontend ./
COPY shared /app/shared
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY --from=build /app/frontend ./
COPY --from=dependencies /app/frontend/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
