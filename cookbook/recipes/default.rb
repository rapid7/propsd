#
# Cookbook Name:: propsd
# Recipe:: default
#
# Copyright (C) 2016 Rapid7 LLC.
#
# Distributed under terms of the MIT License. All rights not explicitly granted
# in the MIT license are reserved. See the included LICENSE file for more details.
#

#######################
## Install NodeJS 4.x
#
# This should be moved into a shared cookbook
##
include_recipe 'apt::default'

apt_repository 'nodejs-4x' do
  uri 'https://deb.nodesource.com/node_4.x'
  distribution node['lsb']['codename']
  components ['main']
  key 'https://deb.nodesource.com/gpgkey/nodesource.gpg.key'
end

package 'nodejs'
#######################


group node['propsd']['group'] do
  system true
end

user node['propsd']['user'] do
  comment 'propsd operator'
  system true

  gid node['propsd']['group']
  home node['propsd']['paths']['directory']
end

directory node['propsd']['paths']['directory'] do
  owner node['propsd']['user']
  group node['propsd']['group']
  mode '0755'

  recursive true
end

## Fetch and install propsd
remote_file 'propsd' do
  source Propsd::Helpers.github_download('rapid7', 'propsd', cookbook_version.version)
  path ::File.join(Chef::Config['file_cache_path'], "propsd-#{cookbook_version.version}.deb")

  action :create_if_missing
  backup false
end

package 'propsd' do
  source resources('remote_file[propsd]').path
  provider Chef::Provider::Package::Dpkg
end

## Upstart Service
template '/etc/init/propsd.conf' do
  owner node['propsd']['user']
  group node['propsd']['group']

  source 'upstart.conf.erb'
  variables(
    :description => 'propsd configuration service',
    :user => node['propsd']['user'],
    :grouop => node['propsd']['group'],
    :executable => node['propsd']['paths']['executable'],
    :flags => [
      "-c #{node['propsd']['paths']['configuration']}"
    ]
  )
end

directory 'propsd-configuration-directory' do
  path ::File.dirname(node['propsd']['paths']['configuration'])

  owner node['propsd']['user']
  group node['propsd']['group']
  mode '0755'

  recursive true
end

template 'propsd-configuration' do
  path node['propsd']['paths']['configuration']
  source 'json.erb'

  owner node['propsd']['user']
  group node['propsd']['group']

  variables(:properties => node['propsd']['config'])
end

service 'propsd' do
  ## The wrapping cookbook must call `action` on this resource to start/enable
  provider Chef::Provider::Service::Upstart
end
