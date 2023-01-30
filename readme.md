Run npm install for the dependencies for ramda, nanoid, node-html-parser, and bcryptjs.
Then run stageLayers.sh. Try deploying SAM Application with AWS CLI / AWS Toolkit.
It may be missing a few .bin in layers. Copy manually if need be.
The stack is ready to be deployed now.

==============


## World setup

1. Production (`prod`) instance
    * current **production** sometimes referred as **live**, this should be fixed (for now it's fixed)
    * strictly single instance
    * running on well-known single fixed AWS account (in the cloud): `pollen-prod` is suggested for profile name
    * by default build/deploy on latest commit from `master` git branch (for now it's not forced)

2. Test (`test`) instances
    * currently this is referred as `test` instance everywhere
    * alternative database/banking credentials (configurable via template)
    * environment is much like `prod`, runs in the AWS cloud: `pollen-test` is suggested for profile name
    * build/deploy on specified git commit or unclean repo

3. Local (`mock`) instance(s)
    * environment **should be** inherited from `prod`, but with strictly alternative database/banking credentials (banking ops provide random data) (for now it's not forced)
    * runs LOCALLY with `docker-compose` utilizing `sam local start-api` and dedicated local database container; (I suggest it to be NOT configurable to run in AWS, but huh... You may need to)
    * build/deploy not needed, changes applied locally/instantly (with an exception of changes to Cloudormation template)
    * due to being run locally, there's no AWS profile needed, but it's suggested to use `pollen-mock` to be specific on this (and for cloud deployment)


## Coarse roadmap for fixing up devops things

- [x] Fix hardcoded accounts, roles and regions in SAM templates where possible
- [x] Provide `package.json` and `requirements.txt` for functions and layers where needed; scale down layer count; eliminate `stageLayers` and related things
- [x] Make `docker/compose` be able to provide endpoints which does not require database to be avaliable (like `/getparams`)
- [x] Provide a way to run dynamodb locally with same schema and sample data
- [x] Fix any other hardcoded things in SAM templates
- [x] NEED TESTING: Make `docker/compose` be able to provide full functionality locally (except banking)
- [x] Make SAM templates modular; perfect goal is to collapse everything to single parametrized template.yml
- [x] Finalize build/deploy workflow for all types of instances
- [ ] Fix directory structure to be more self-explainational




## THE DOCUMENTATION DOWN BELOW IS UNDER DEVELOPMENT

**Do not use it or USE WITH MAXIMUM CARE!**


## workstation prereqs: common (TL;DR)

You probably have those already, so proceed to project-specific section below.

    # python
    sudo apt install python3 python3-pip -y

    # docker
    sudo apt install docker.io -y

    # FYI docker fix for usage w/o sudo
    # add yourself to docker group and relogin for membership to take effect
    sudo adduser $(whoami) docker && exec "$SHELL"

    # docker-compose
    sudo apt install docker-compose -y


### workstation prereqs: project-specific

    # AWS(-SAM) cli
    pip3 install awscli aws-sam-cli


## local development process

    git clone ...

Make sure you have `pollen-mock` AWS profile (may be empty). For test/prod deployment you should have separate `pollen-test` and `pollen-prod` accounts properly configured.
It may refer to any developer account, just make sure it DOES NOT POINT TO PRODUCTION PROFILE `pollen-prod`!
**Separate them, use different credentials!**

    aws configure --profile pollen-mock


### project-specific prereqs

Get things installed for your system by issuing:

    make dev-deps

NOTE: It's about Ubuntu and uses `sudo apt ...` somewhere, be ready for that.


### TBD: project-specific local services

Use `docker/compose` instead of bare `docker-compose` invocation: it's a convenience wrapper script.

Running `docker/compose` w/o args is the same as

    docker/compose up --build --remove-orphans

and will bring everything up and running in foreground.

However you may want it to do it's job in bg, so just add `--detach`:

    docker/compose up --build --remove-orphans --detach

Other compose commands are available as usual, like:

    docker/compose logs -f

**NOTE:** you should restart services on every `template.yml change`, this is not automated.

* TBD: `api-local` is a just a `sam local start-api ...` wrapper.
* `dynamodb-local` provides (suddenly!) a local persistent DynamoDB instance. See below for provisioning instructions.


### local DynamoDB needs manual provisioning from test environment

There's a `tool/ddb` to rescue. Be sure that you have project-specific prereqs installed. The process is simple, but describes only LOCAL
provisioning; if you need `pollen-mock` in the cloud, you're on your own (but things aren't different so much).

1. Create a local dump of remote DynamoDB resources for given stack:
```bash
AWS_PROFILE=pollen-test tool/ddb rpull v201-debug-test /tmp/ddb-rdump

```

2. Upload that dump to local DynamoDB instance:
```bash
AWS_PROFILE=pollen-mock tool/ddb lpush /tmp/ddb-rdump/.v201-debug-test
```
**NOTE:** There may be some issues with schema, e.g. for `loanTable` like those:
```
Unknown parameter in LocalSecondaryIndexes[0]: "IndexSizeBytes", must be one of: IndexName, KeySchema, Projection
Unknown parameter in LocalSecondaryIndexes[0]: "ItemCount", must be one of: IndexName, KeySchema, Projection
Unknown parameter in LocalSecondaryIndexes[0]: "IndexArn", must be one of: IndexName, KeySchema, Projection
```
You should go to `/tmp/ddb-rdump/...table.../schema.json` and fix it manually: just delete extra keys at specified location(s) and retry.
It's related to old `boto3` for `dynamodump`, I suppose.

3. Ensure that locally everything is in place now:
```bash
AWS_PROFILE=pollen-mock aws dynamodb list-tables --endpoint-url http://localhost:8000
```

4. Dump location `/tmp/ddb-rdump` may be wiped now.


### build/deploy

No project-specific packages are required to build things, thanks to `--use-container`.
Code resources should also autopopulate their dependencies (via package.json && requirements.txt).

There's a tool for that: `tool/ci`.

    # by default build always use --cached to speedup sequential rebuilds
    # however, separate `build` operation is only for reference and review purposes:
    # `deploy` always does a full non-cached build (this is by design).
    AWS_PROFILE=pollen-test tool/ci build test

    # so for DEPLOY:
    AWS_PROFILE=pollen-test tool/ci deploy test


## Migrating to MariaDB

An example for `v201-debug-test` (`test` instance); other stacks walkthrough should be similar.

**WARN: THIS WILL FLUSH EVERYTHING! HANDLE WITH CARE!!! KNOW WHAT YOU ARE DOING! MAKE BACKUPS ALWAYS!**

**WARN: Your local timezone MUST be UTC for DATETIME values to be consistent. Remember to use `./node` instead of `node` or set up your environment properly!**

**WARN: REMEMBER that DynamoDB snapshots MAY NOT BE CONSISTENT if there were any writes while dump was in progress!!! Pause source instance API to be sure everything is OK!**

1. For the first time, go edit `tool/sql-schema/00-init.sql`, patching and uncommenting `CREATE DATABASE ...; USE ...` line.
It's also worth mentioning that `tool/db` also need temporary patching for an initial invocation: you should comment out appropriate `CFG[database]`; it's just because target database doesn't exist yet.

2. Init target MariaDB instance (**FLUSHES EVERYTHING! MAKE BACKUP FIRST!**)
```bash
INST=test tool/db < tool/sql-schema/00-init.sql
```

3. Create a local dump of remote DynamoDB resources for given stack.
```bash
AWS_PROFILE=pollen-test tool/ddb rpull v201-debug-test tmp/ddb-rdump
```

4. Patch migration tool (`tool/ddb2sql.js`) locally, enabling `dothings` variable for desired entities;
then run it, feeding it with dump created earlier (remember to use full path to dump dir containing symlinks for logical table names):
```bash
DUMP_DIR=tmp/ddb-rdump/.v201-debug-test MYSQLCFG="$(INST=test DUMP=url tool/db)" ./node tool/ddb2sql.js
```

5. Review unimported fields: use `INST=test tool/db` to select `_rest*` column from tables where it's not equal to '{}'

6. (optional) Review differences: use `tool/test-client-read.js` to test consistency
(you should either point local stack to source DynamoDB instance or import dump locally, for latter refer to 'local DynamoDB provisioning').
E.g. (`SCOPE` may not only be `loan_query`, of course; see source):
```bash
(SCOPE=loan_query; colordiff -u <(AWS_PROFILE=pollen-test ./node tool/test-client-read.js "$SCOPE" dynamo) <(MYSQLCFG="$(INST=test DUMP=url tool/db)" ./node tool/test-client-read.js "$SCOPE" mysql)) | less -RS
```

7. Change default client export in `layers/commonLayer/nodejs/node_modules/pp-dbapi/compat/{loan,user,merchant}.js` for designated instance mode.

8. Things done, so commit (optionally), deploy (depending on your instance mode) & pray.
