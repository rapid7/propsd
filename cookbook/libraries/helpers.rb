class Chef::Recipe
  ##
  # Allow a recipe to find its cookbook's version
  ##
  def cookbook_version
    run_context.cookbook_collection[cookbook_name].version
  end
end

##
# Version and Download URI helpers
##
module Propsd
  module Helpers
    class << self
      def github_download(owner, repo, version)
        "https://github.com/#{owner}/#{repo}/releases/download/v#{version}/propsd_#{version}_amd64.deb"
      end
    end
  end
end
