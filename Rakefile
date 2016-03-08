require 'json'
require 'fileutils'
require 'mkmf'
require 'aws-sdk'
require 'logger'

include FileUtils

task :version do
 @version = JSON.parse(File.read('package.json'))['version']
end

task :base_dir do
  @base_dir = File.dirname(File.expand_path(__FILE__))
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

desc 'Release props.d and prepare to create a release on github.com'
task :release => [:install, :shrinkwrap, :pack] do
  puts
  puts "Create a new #{@version} release on github.com and upload the propsd tarball"
  puts 'You can find directions here: https://github.com/blog/1547-release-your-software'
  puts 'Make sure you add release notes!'
end

task :package_dirs => [:base_dir] do
  mkdir_p ::File.join(@base_dir, 'pkg/opt/props.d')
  mkdir_p ::File.join(@base_dir,'pkg/usr/bin')
end

task :node_bin => [:base_dir] do
  node = find_executable('node')
  node = File.realdirpath(node)
  cp node, ::File.join(@base_dir,'pkg/usr/bin')
end

task :propsd_source => [:base_dir, :install] do
  [
    ['bin/', 'pkg/opt/props.d'],
    ['lib/', 'pkg/opt/props.d'],
    ['node_modules/', 'pkg/opt/props.d'],
    ['LICENSE', 'pkg/opt/props.d']
  ].each do |src, dst|
    cp_r ::File.join(@base_dir, src), ::File.join(@base_dir, dst)
  end 
end


task :chdir_pkg => [:package_dirs, :base_dir] do
  cd ::File.join(@base_dir, 'pkg')
end

task :deb => [:version, :chdir_pkg, :node_bin, :propsd_source] do
  sh "fpm --deb-no-default-config-files -s dir -t deb -n \"props.d\" -v #{@version} opt/ usr/"
  mkdir 'copy_to_s3'
  deb = Dir["props.d_#{@version}_*.deb"].first
  cp deb, 'copy_to_s3/'
end

task :upload_packages => [:deb] do
  s3 = Aws::S3::Resource.new(region: 'us-east-1', logger: Logger.new(STDOUT))
  Dir['copy_to_s3/**/props.d*'].each do |package|
    upload_package = ::File.basename(package)
    s3.bucket('artifacts.core-0.r7ops.com').object("propsd/#{upload_package}").upload_file(package)
  end
end

desc 'Package props.d and upload package to S3 bucket'
task :package => [:upload_packages]

desc 'Cleanup release and package artifacts'
task :clean do
  rm_f 'npm-shrinkwrap.json'
  rm_f Dir['propsd-*.tgz']
  rm_rf 'pkg' 
end

task :default => [:clean, :release, :package]
