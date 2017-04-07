## Use package.json as the source of truth
project_path = ::File.expand_path('../../', __FILE__)
package_dot_json = JSON.parse(IO.read(::File.join(project_path, 'package.json')))

name package_dot_json['name']
description 'Install and configure https://github.com/rapid7/propsd'

maintainer 'Rapid7 Inc.'
maintainer_email 'coreservices@rapid7.com'

issues_url package_dot_json['bugs']['url']
source_url package_dot_json['homepage']

license package_dot_json.fetch('license', 'MIT License, 2016')
long_description IO.read(::File.join(project_path, 'README.md')) rescue ''
version package_dot_json.fetch('version', '0.0.1')

depends 'ohai', '~> 4.2'
