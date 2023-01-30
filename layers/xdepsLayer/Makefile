.PHONY: build-xdepsLayer

ARTIFACTS_DIR ?= .

# default target
build-xdepsLayer:
	@# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-build.html
	@# https://github.com/aws/aws-lambda-builders/blob/master/aws_lambda_builders/workflows/custom_make/DESIGN.md
	@# https://github.com/aws/aws-lambda-builders/blob/master/aws_lambda_builders/workflows/custom_make/workflow.py
	@# sam build creates temp dir ($SCRATCH_DIR) where it copies everything from CodeUrl ($SOURCE_DIR) except some
	@# common exclusions (for @makefile@ build method it's ".aws-sam" and ".git"), so we have separate copy of source
	@# it provides us with $ARTIFACTS_DIR: the location where we should put final layer content

	@# given that MAKE is invoked with from PWD=$SCRATCH_DIR, we need to copy manifest files to $ARTIFACTS_DIR
	@# and run installation process for npm and pip from final locations

	rsync -Rahv --delete ./nodejs/package.json ./nodejs/package-lock.json ./python/requirements.txt "$(ARTIFACTS_DIR)/"

	@# https://docs.npmjs.com/cli/v8/commands/npm-ci
	@# npm ci uses package-lock.json only; package.json is copied for reference only

	(cd "$(ARTIFACTS_DIR)/nodejs" && npm --prefix=. ci)

	@# FYI --no-compile option asks pip to NOT create bytecode cache (__pycache__ folders)
	@# this is needed just to make layer builds consistent across different build hosts
	@# BUT I suppose it MAY have side effects, however, BuildMethod: pythonX.X also does not result
	@# in __pycache__ folders being created, although it uses `pip download` instead of `pip install` and
	@# excludes them instead of skipping their creation, see
	@# https://github.com/aws/aws-lambda-builders/blob/master/aws_lambda_builders/workflows/python_pip/workflow.py

	(cd "$(ARTIFACTS_DIR)/python" && pip install --upgrade --no-compile --requirement ./requirements.txt --target .)
