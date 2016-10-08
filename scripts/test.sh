#!/bin/sh
set -e

if [ -z "$TEST_GREP" ]; then
   TEST_GREP=""
fi

scripts/_get-test-directories.sh | xargs -t -P4 -n15 node node_modules/mocha/bin/_mocha --opts test/mocha.opts --grep "$TEST_GREP"
