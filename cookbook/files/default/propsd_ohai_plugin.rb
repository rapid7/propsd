require 'json'

Ohai.plugin(:Propsd) do
  provides 'propsd_plugin'

  PROPSD_HOST = 'localhost' unless defined?(PROPSD_HOST)
  PROPSD_PORT = 9100 unless defined?(PROPSD_PORT)

  def can_propsd_connect?(addr, port, timeout = 2)
    t = Socket.new(Socket::Constants::AF_INET, Socket::Constants::SOCK_STREAM, 0)
    saddr = Socket.pack_sockaddr_in(port, addr)
    connected = false

    begin
      t.connect_nonblock(saddr)
    rescue Errno::EINPROGRESS
      r, w, e = IO.select(nil, [t], nil, timeout)
      if !w.nil?
        connected = true
      else
        begin
          t.connect_nonblock(saddr)
        rescue Errno::EISCONN
          t.close
          connected = true
        rescue SystemCallError
        end
      end
    rescue SystemCallError
    end
    Ohai::Log.debug("can_propsd_connect? == #{connected}")
    connected
  end

  def get_properties
    response = http_client.get('/v1/properties')
    if response.code != "200"
      raise 'Unable to get properties from propsd'
    else
      props = response.body
      props = ::JSON.parse(props)
    end
  rescue JSON::JSONError
    raise 'Error parsing JSON properties'
  rescue StandardError
    raise 'Error connecting to propsd'
  end

  def http_client
    Net::HTTP.start(PROPSD_HOST, PROPSD_PORT).tap { |h| h.read_timeout = 30 }
  end

  collect_data(:default) do
    propsd_plugin Mash.new
    if can_propsd_connect?(PROPSD_HOST, PROPSD_PORT)
      props = get_properties
      props.each_pair do |k,v|
        propsd[k] = v
      end
    end
  end
end
