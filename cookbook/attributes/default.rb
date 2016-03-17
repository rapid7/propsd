
default['propsd']['directory'] = '/opt/propsd'
default['propsd']['executable'] = ::File.join(node['propsd']['directory'], 'bin/server.js')

default['propsd']['version'] = '1.0.0'

## TODO Artifact path and hash
default['propsd']['package']['uri'] = 'https://github.com/rapid7/propsd/releases'\
                                      "/download/#{node['propsd']['version']}/"\
                                      "propsd-#{node['propsd']['version']}-xxx.deb"
default['propsd']['package']['checksum'] = 'hexhexhex'
