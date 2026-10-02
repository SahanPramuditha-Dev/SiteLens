FROM node:20-alpine

WORKDIR /usr/src/app

# Copy monorepo config
COPY package*.json ./
COPY apps/cli/package.json ./apps/cli/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/rule-definitions/package.json ./packages/rule-definitions/
COPY packages/technology-detector/package.json ./packages/technology-detector/

RUN npm install

# Copy source
COPY . .

# Build required packages
RUN npm run build --workspace=@sitelens/shared-types
RUN npm run build --workspace=@sitelens/technology-detector
RUN npm run build --workspace=@sitelens/rule-definitions

ENTRYPOINT ["node", "apps/cli/index.js"]
