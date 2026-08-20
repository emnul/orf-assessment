FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
# nginx defaults to 80; retarget to 5173 to match compose's port mapping
RUN sed -i 's/listen\s*80;/listen 5173;/' /etc/nginx/conf.d/default.conf
