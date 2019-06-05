#
# Cookbook Name:: propsd
# Recipe:: nodejs
#
# Copyright (C) 2017 Rapid7 LLC.
#
# Distributed under terms of the MIT License. All rights not explicitly granted
# in the MIT license are reserved. See the included LICENSE file for more details.
#

node.default['nodejs']['version'] = '8.16.0'
node.default['nodejs']['binary']['checksum'] = 'e538ffaaf2f808c084e70f1a1d2ff5559cff892cfd56e0bb67d00b0a95fc3a7a'

include_recipe 'nodejs::nodejs_from_binary'
