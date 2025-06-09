# Dockerfile for gs-wa-chatbot
FROM node:20-alpine as base
WORKDIR /usr/src/app
COPY package*.json ./

# Install dependencies
RUN npm install

# --- Development image (with nodemon for hot reload) ---
FROM base as dev
RUN npm install -g nodemon
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:debug"]

# --- Production image ---
FROM base as prod
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
