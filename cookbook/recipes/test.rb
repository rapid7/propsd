#
# Cookbook Name:: propsd
# Recipe:: test
#
# Copyright (C) 2017 Rapid7 LLC.
#
# Distributed under terms of the MIT License. All rights not explicitly granted
# in the MIT license are reserved. See the included LICENSE file for more details.
#

node.default['propsd']['config']['index']['bucket'] = 'my.test.bucket'

include_recipe 'propsd::default'

resources('service[propsd]').action([:start, :enable])

include_recipe "#{ cookbook_name}::ohai_plugin"

::Chef::Log.info("PROPSD PLUGIN -- #{node['propsd_plugin']}")
