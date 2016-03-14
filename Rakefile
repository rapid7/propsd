require 'json'
require 'fileutils'
require 'mkmf'
require 'aws-sdk'
require 'logger'

include FileUtils

def package_json
 @package_json ||= JSON.parse(File.read('package.json'))
end

def version
  package_json['version']
end

def name
  package_json['name']
end

def description
  package_json['description']
end

def license
  package_json['license']
end

def homepage
  package_json['homepage']
end

def target_version
  ::File.read(::File.join(@base_dir, '.nvmrc')).strip()
end

def install_dir
  ::File.join('pkg', 'opt', name)
end

def config_dir
  ::File.join(install_dir, 'config')
end

def base_dir
  @base_dir ||= File.dirname(File.expand_path(__FILE__))
end

task :install do
  sh 'npm install --only=prod'
end

task :shrinkwrap => [:install] do
  sh 'npm shrinkwrap'
end

task :pack => [:shrinkwrap] do
  sh 'npm pack'
end

desc "Release #{name} and prepare to create a release on github.com"
task :release => [:install, :shrinkwrap, :pack] do
  puts
  puts "Create a new #{version} release on github.com and upload the #{name} tarball"
  puts 'You can find directions here: https://github.com/blog/1547-release-your-software'
  puts 'Make sure you add release notes!'
end

task :package_dirs do
  mkdir_p ::File.join(base_dir, install_dir)
  mkdir_p ::File.join(base_dir, config_dir)
end

task :propsd_source => [:install] do
  ['bin/', 'lib/', 'node_modules/', 'LICENSE'].each do |src|
    cp_r ::File.join(base_dir, src), ::File.join(base_dir, install_dir)
  end
  cp ::File.join(base_dir, 'config', 'defaults.json'), ::File.join(base_dir, config_dir)
end


task :chdir_pkg => [:package_dirs] do
  cd ::File.join(base_dir, 'pkg')
end

task :deb => [:chdir_pkg, :propsd_source] do
  command = [
    'fpm',
    '--deb-no-default-config-files',
    "--depends \"nodejs = #{target_version}\"",
    "--license \"#{license}\"",
    "--url \"#{homepage}\"",
    "--description \"#{description}\"",
    '-s dir',
    '-t deb',
    "-n \"#{name}\"",
    "-v #{version}",
    'opt/'
    ].join(' ')
  sh command
  mkdir 'copy_to_s3'
  deb = Dir["#{name}_#{version}_*.deb"].first
  cp deb, 'copy_to_s3/'
end

task :upload_packages => [:deb] do
  s3 = Aws::S3::Resource.new(region: 'us-east-1', logger: Logger.new(STDOUT))
  Dir["copy_to_s3/**/#{name}*"].each do |package|
    upload_package = ::File.basename(package)
    s3.bucket('artifacts.core-0.r7ops.com').object("#{name}/#{upload_package}").upload_file(package)
  end
end

desc "Package #{name} and upload package to S3 bucket"
task :package => [:upload_packages]

desc 'Cleanup release and package artifacts'
task :clean do
  rm_f 'npm-shrinkwrap.json'
  rm_f Dir["#{name}-*.tgz"]
  rm_rf 'pkg'
end

task :default => [:clean, :release, :package]
