# Well hello.

.PHONY: help
help:
	@echo '### Targets:'
	@echo 'dev-env          (dev) make external deps up-to-date'
	@#echo 'dev-lint         (dev) run eslint'
	@#echo 'build            ...'


.PHONY: dev-deps
dev-deps:
	sudo apt install jq -y
	pip install awscli aws-sam-cli
	pip install dynamodump
	pip install yq

.PHONY: dev-env
dev-env: layers/xdepsLayer

.PHONY: dev-lint
ESLINT = node_modules/.bin/eslint
#ESLINT_TODO += auth cards cors kyc loans merchants psa recovery users
ESLINT_TODO += merchantPopulators/migrate.js
ESLINT_TODO += merchantPopulators/migrateDirect.js
dev-lint: $(ESLINT_TODO) | $(ESLINT)
	@# printf '<%s>\n' $?
	$(ESLINT) $?

.PHONY: build
#build: node_modules
#    @# bash ./stageLayers.sh


####################################################################################################

node_modules: package.json
	npm install
	touch -cm node_modules

$(ESLINT): | node_modules
	npm i --no-save eslint standard

####################################################################################################

.PHONY: layers/xdepsLayer
layers/xdepsLayer:
	$(MAKE) -C $@

