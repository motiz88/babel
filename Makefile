MAKEFLAGS = -j1

export NODE_ENV = test

.PHONY: build build-dist watch lint clean test-clean test-only test test-cov test-ci publish bootstrap

build: clean
	./node_modules/.bin/gulp build

build-dist: build
	cd packages/babel-polyfill; \
	scripts/build-dist.sh
	cd packages/babel-runtime; \
	node scripts/build-dist.js
	node scripts/generate-babel-types-docs.js

watch: clean
	./node_modules/.bin/gulp watch

lint:
	./node_modules/.bin/eslint packages/*/src

clean: test-clean
	rm -rf packages/*/lib
	rm -rf packages/babel-polyfill/browser*
	rm -rf packages/babel-polyfill/dist
	rm -rf coverage
	rm -rf packages/*/npm-debug*
	rm -rf .coverage-*

test-clean:
	rm -rf packages/*/test/tmp
	rm -rf packages/*/test-fixtures.json

# without lint
test-only:
	./scripts/test.sh
	make test-clean

test: lint test-only

test-cov: clean
	# rebuild with test
	rm -rf packages/*/lib
	BABEL_ENV=test; ./node_modules/.bin/gulp build
	./scripts/test-cov.sh

test-ci:
	NODE_ENV=test make bootstrap
	# if ./node_modules/.bin/semver `npm --version` -r ">=3.3.0"; then ./node_modules/.bin/flow check; fi
	./scripts/test-cov.sh
	cat ./.coverage-*/coverage.json | ./node_modules/codecov.io/bin/codecov.io.js

publish:
	git pull --rebase
	rm -rf packages/*/lib
	BABEL_ENV=production make build-dist
	make test
	# not using lerna independent mode atm, so only update packages that have changed since we use ^
	./node_modules/.bin/lerna publish --only-explicit-updates
	make clean
	#./scripts/build-website.sh

bootstrap:
	npm install
	./node_modules/.bin/lerna bootstrap
	make build
	cd packages/babel-runtime; \
	npm install; \
	node scripts/build-dist.js
