#!/bin/sh
set -e

scripts/_get-test-directories.sh | xargs -t -P4 -n15 node node_modules/istanbul/lib/cli.js cover node_modules/mocha/bin/_mocha -- --opts test/mocha.opts
