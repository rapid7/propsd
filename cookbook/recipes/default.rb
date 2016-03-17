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
  url 'https://deb.nodesource.com/node_4.x'
  distribution node['lsb']['codename']
  components ['main']
  key 'https://deb.nodesource.com/gpgkey/nodesource.gpg.key'
end

package 'nodejs'
#######################

## Fetch and install propsd
remote_file 'propsd' do
  source node['propsd']['package']['uri']
  path ::File.join(Chef::Config['file_cache_path'], "propsd-#{node['propsd']['version']}.deb")
  checksum node['propsd']['package']['checksum']

  backup false
  notifies :install, 'package[propsd]', :immediate
end

package 'propsd' do
  source resources('remote_file[propsd]').path
  provider Chef::Provider::Package::Dpkg
end

## TODO Configuration file template

## Upstart Service
template '/etc/init/propsd.conf' do
  source 'upstart.conf.erb'
  variables(
    :description => 'propsd configuration service',
    :executable => node['propsd']['executable'],
    :flags => [
      "-c #{node['propsd']['configuration']}"
    ]
  )
end

service 'propsd' do
  ## The wrapping cookbook must call `action` on this resource to start/enable
  provider Chef::Provider::Service::Upstart
end
