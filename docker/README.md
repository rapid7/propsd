# Docker Context
Everything in this directory (and all sub-directories) is transferred to the docker daemon when running docker build. This is called the context (see the [Dockerfile reference](https://docs.docker.com/engine/reference/builder/) for more info).

Please do not place files in this directory unless they are necessary for building the Propsd container.

## Building
**NOTE**: `initialize-context.sh` depends on `jq` to parse the current version from `package.json`. Please install this pre-requisite.

1. Run `bundle install` from the repository root.
2. Run `initialize-context.sh` to bootstrap your docker context (from this directory).
3. Update the version number in Dockerfile to match the reported version from `initialize-context.sh`.
4. Run `docker build . -t propsd -t propsd:$version` to tag the newly built version.
