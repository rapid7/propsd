#!/usr/bin/env bash

version=$(jq --raw-output '.version' ../package.json)

git_rev="$(git rev-parse --short=16 HEAD)"
[[ -z "$(git status -s)" ]] && git_rev="${git_rev} with local modifications"

echo "Building/packaging propsd version v${version} (at git ref ${git_rev})..."
rake clean package_source

echo "Copying propsd version v${version} into docker context..."
cp ../pkg/opt/propsd-${version}.tar.gz ./resources/
