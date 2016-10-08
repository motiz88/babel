#!/bin/sh
set -e

rm -rf .coverage-*

scripts/_get-test-directories.sh | xargs \
 -t -P4 -n15 \
 bash -c 'node node_modules/istanbul/lib/cli.js cover --dir .coverage-$$ node_modules/mocha/bin/_mocha -- --opts test/mocha.opts "$@"'

node_modules/.bin/istanbul-combine  ./.coverage-*/coverage.json -r json && \
  mv -f ./coverage/coverage-final.json ./coverage/coverage.json
