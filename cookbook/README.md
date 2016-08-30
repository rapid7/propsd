# Propsd Cookbook

## Recipies

### default.rb

Install and configure propsd.  You will need to overide the `propsd-configuration` and the `props-service` to do anything useful; see the `test.rb` recipe for an example.  

### ohai_plugin.rb

Install propsd ohai plugin

## Attributes

* `node['propsd']['user']` - User that owns the Propsd installation (default: `propsd`)
* `node['propsd']['group']` - Group that owns the Propsd installation (default: `propsd`)
* `node['propsd']['paths']['directory']` - The location of the Propsd installation (default: `/opt/propsd`)
* `node['propsd']['paths']['configuration']` - The location of the Propsd configuration file (default: `/etc/propsd/config.json`)
* `node['propsd']['ohai_plugin_path']` - Ohai Plugin Path; directory the Propsd plugin will get installed 

## Usage

Simply add `recipe[propsd::default]` to a run list.

Additionally, to use the ohai plugin add `recipe[propsd::ohai_plugin]` to a run list.
