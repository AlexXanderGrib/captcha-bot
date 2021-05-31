FROM node:16 as builder
RUN npm i -g npm

COPY package*.json ./
RUN npm ci

COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json
RUN npm run build

FROM node:16

ENV PORT=3300
ENV MODE=LP
ENV NODE_ENV=production

VOLUME [ "/app/config" ]
VOLUME [ "/app/db" ]
WORKDIR /app
RUN npm i -g npm

COPY --from=builder package*.json ./
RUN npm ci --only=prod

COPY --from=builder ./dist ./dist

EXPOSE ${PORT}
CMD ["npm", "start"]