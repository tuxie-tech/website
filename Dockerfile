FROM node:current AS build

ARG FEATURE_SQUARE_SALES
ARG FEATURE_SALES_EMAIL

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]