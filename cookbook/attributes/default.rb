
default['propsd']['user'] = 'propsd'
default['propsd']['group'] = 'propsd'

default['propsd']['paths']['directory'] = '/opt/propsd'
default['propsd']['paths']['executable'] = ::File.join(node['propsd']['paths']['directory'], 'bin/server.js')
default['propsd']['paths']['configuration'] = '/etc/propsd/config.json'

default['propsd']['config'] = Mash.new
default['propsd']['version'] = nil
default['propsd']['enable'] = true

default['propsd']['ohai_plugin_path'] = nil
