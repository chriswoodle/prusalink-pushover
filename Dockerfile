FROM node:18

RUN corepack enable

WORKDIR /usr/app

COPY . .

RUN yarn install --immutable
RUN yarn build

ENTRYPOINT [ "yarn", "start" ]