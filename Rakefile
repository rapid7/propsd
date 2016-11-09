require 'json'
require 'fileutils'
require 'mkmf'
require 'aws-sdk'
require 'logger'
require 'rake/clean'
require 'octokit'

include FileUtils

CLIENT_ID = ENV['GITHUB_CLIENT_ID']
CLIENT_TOKEN = ENV['GITHUB_CLIENT_TOKEN']
ARTIFACT_BUCKET = ENV['ARTIFACT_BUCKET']

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

def repo
  package_json['repository']['url'].sub('.git', '')
end

def target_version
  `node --version`.strip.delete('v')
end

def max_version
  target_version.split('.').first.to_f + 1
end

def install_dir
  ::File.join('pkg', 'opt', "#{name}-#{version}")
end

def config_dir
  ::File.join(install_dir, 'config')
end

def pkg_dir
  ::File.join(base_dir, 'pkg')
end

def base_dir
  @base_dir ||= File.dirname(File.expand_path(__FILE__))
end

def github_client
  @client unless @client.nil?
  @client = Octokit::Client.new(:client_id => CLIENT_ID, :access_token => CLIENT_TOKEN)
end

def github_repo
  @repo unless @repo.nil?
  @repo = Octokit::Repository.from_url(repo)
end

task :install do
  sh 'npm install --production'
  # This is required because the conditional package bundles a devDependency
  # that bundles conditional and causes shrinkwrap to complain
  sh 'npm prune --production'
end

task :shrinkwrap => [:install] do
  sh 'npm shrinkwrap'
end

task :pack => [:shrinkwrap] do
  sh 'npm pack'
end

task :package_dirs do
  mkdir_p ::File.join(base_dir, install_dir)
  mkdir_p ::File.join(base_dir, config_dir)
end

task :source => [:install] do
  ['bin/', 'lib/', 'node_modules/', 'LICENSE', 'package.json'].each do |src|
    cp_r ::File.join(base_dir, src), ::File.join(base_dir, install_dir)
  end
  cp ::File.join(base_dir, 'config', 'defaults.json'), ::File.join(base_dir, config_dir)
end

task :chdir_pkg => [:package_dirs] do
  cd pkg_dir
end

task :deb => [:chdir_pkg, :source] do
  command = [
    'bundle',
    'exec',
    'fpm',
    '--deb-no-default-config-files',
    "--depends \"nodejs >= #{target_version}\"",
    "--depends \"nodejs << #{max_version}\"",
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
end

task :upload_packages do
  cd pkg_dir
  mkdir 'copy_to_s3'
  deb = Dir["#{name}_#{version}_*.deb"].first
  cp deb, 'copy_to_s3/'
  s3 = Aws::S3::Resource.new(region: 'us-east-1', logger: Logger.new(STDOUT))
  Dir["copy_to_s3/**/#{name}*"].each do |package|
    upload_package = ::File.basename(package)
    s3.bucket(ARTIFACT_BUCKET).object("#{name}/#{upload_package}").upload_file(package)
  end
end

desc "Release #{name} and prepare to create a release on github.com"
task :release do
  puts
  puts "Create a new #{version} release on github.com and upload the #{name} tarball"
  puts 'You can find directions here: https://github.com/blog/1547-release-your-software'
  puts 'Make sure you add release notes!'

  cp ::File.join(base_dir, "#{name}-#{version}.tgz"), pkg_dir

  begin
    latest_release = github_client.latest_release(github_repo)
  rescue Octokit::NotFound
    latest_release = OpenStruct.new(name: 'master')
  end

  release = github_client.create_release(
    github_repo,
    "v#{version}",
    :name => "v#{version}", :draft => true
  )

  [
    ::File.join(pkg_dir, "#{name}-#{version}.tgz"),
    ::File.join(pkg_dir, "#{name}_#{version}_amd64.deb")
  ].each do |f|
    github_client.upload_asset(release.url, f)
  end
  puts "Draft release created at #{release.html_url}. Make sure you add release notes!"
  compare_url = "#{github_repo.url}/compare/#{latest_release.name}...#{release.name}"
  puts "You can find a diff between this release and the previous one here: #{compare_url}"
end

desc "Package #{name}"
task :package => [:install, :shrinkwrap, :pack, :deb]

CLEAN.include 'npm-shrinkwrap.json'
CLEAN.include "#{name}-*.tgz"
CLEAN.include 'pkg/'
CLEAN.include '**/.DS_Store'
CLEAN.include 'node_modules/'

task :default => [:clean, :package, :release]
task :upload => [:clean, :package, :upload_packages]
