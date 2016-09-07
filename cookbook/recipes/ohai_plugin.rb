#
# Cookbook Name:: propsd
# Recipe:: ohai_plugin
#
# Copyright (C) 2016 Rapid7 LLC.
#
# Distributed under terms of the MIT License. All rights not explicitly granted
# in the MIT license are reserved. See the included LICENSE file for more details.
#

ohai_plugin 'propsd_ohai_plugin' do
  path node['propsd']['ohai_plugin_path']
end
