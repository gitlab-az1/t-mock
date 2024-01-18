#!/bin/bash

set -e

cleanup() {
  sleep 0.1

  cd ..
  rm -rf ./__build__/

  exit 0
}


rm -rf ./__build__/
mkdir ./__build__/

clear

git clone https://github.com/gitlab-az1/t-mock.git ./__build__/

cd ./__build__/

yarn install
yarn build:no-fix && NODE_ENV=production node ./post-build.js

rm -rf ./node_modules/
rm -rf ./src/
rm -rf ./.eslint*
rm -rf ./.gitignore
rm -rf ./babel.config.js
rm -rf ./jest.config.js
rm -rf ./post-build.js
rm -rf ./tsconfig.json
rm -rf ./yarn*

cd ./dist/
mv ./* ..
cd ..

rm -rf ./dist/
rm -rf ./package.json

# VERSION=$(cat ./package.build.json | python3 -c "import sys, json; print(json.load(sys.stdin)['version'])")

mv ./package.build.json ./package.json

# cd ./utils/
# rm -rf ./_appversion.js

# touch ./_appversion.js
# echo "'use strict';\nObject.defineProperty(exports, '__esModule', {value: true});\nexports.version = exports.default = void 0;\nconst version = exports.version = '$VERSION';\nvar _default = exports.default = version;" >> ./_appversion.js

# cd ..

npm publish --access public || cleanup

cleanup
