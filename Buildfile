build_name 'propsd'

autoversion.create_tags false
autoversion.search_tags false

cookbook.depends 'propsd' do |propsd|
  propsd.path './cookbook'
end
