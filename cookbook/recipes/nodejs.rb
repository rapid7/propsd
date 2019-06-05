#
# Cookbook Name:: propsd
# Recipe:: nodejs
#
# Copyright (C) 2017 Rapid7 LLC.
#
# Distributed under terms of the MIT License. All rights not explicitly granted
# in the MIT license are reserved. See the included LICENSE file for more details.
#

node.default['nodejs']['version'] = '4.8.2'
node.default['nodejs']['binary']['checksum'] = '4d4a37f980bb2770c44d7123864650d0823bae696d7db09d9ed83028cab32fd3'

include_recipe 'nodejs::nodejs_from_binary'
