#
# Cookbook Name:: propsd
# Recipe:: default
#
# Copyright (C) 2016 Rapid7 LLC.
#
# Distributed under terms of the MIT License. All rights not explicitly granted
# in the MIT license are reserved. See the included LICENSE file for more details.
#

node.default['propsd']['version'] = cookbook_version

group node['propsd']['group'] do
  system true
end

user node['propsd']['user'] do
  comment 'propsd operator'
  system true

  gid node['propsd']['group']
  home node['propsd']['paths']['directory']
end

## Fetch and install propsd
remote_file 'propsd' do
  source Propsd::Helpers.github_download('rapid7', 'propsd', node['propsd']['version'])
  path ::File.join(Chef::Config['file_cache_path'], "propsd-#{node['propsd']['version']}.deb")

  action :create_if_missing
  backup false
end

version_dir = "#{ node['propsd']['paths']['directory'] }-#{ node['propsd']['version'] }"

package 'propsd' do
  source resources('remote_file[propsd]').path
  provider Chef::Provider::Package::Dpkg
end

## Symlink the version dir to the specified propsd directory
link node['propsd']['paths']['directory'] do
  to version_dir

  notifies :restart, 'service[propsd]' if node['propsd']['enable']
end

if Chef::VersionConstraint.new("> 14.04").include?(node['platform_version'])
  service_script_path = '/etc/systemd/system/propsd.service'
  service_script = 'systemd.service.erb'
  service_provider = Chef::Provider::Service::Systemd
else
  service_script_path = '/etc/init/propsd.conf'
  service_script = 'upstart.conf.erb'
  service_provider = Chef::Provider::Service::Upstart
end

# Set service script
template service_script_path do
  source service_script
  variables(
    :description => 'propsd configuration service',
    :user => node['propsd']['user'],
    :executable => node['propsd']['paths']['executable'],
    :flags => [
      "-c #{node['propsd']['paths']['configuration']}"
    ]
  )
end

directory 'propsd-configuration-directory' do
  path ::File.dirname(node['propsd']['paths']['configuration'])
  mode '0755'

  recursive true
end

template 'propsd-configuration' do
  path node['propsd']['paths']['configuration']
  source 'json.erb'

  variables(:properties => node['propsd']['config'])
  notifies :restart, 'service[propsd]' if node['propsd']['enable']
end

service 'propsd' do
  action node['propsd']['enable'] ? [:start, :enable] : [:stop, :disable]
  provider service_provider
end
