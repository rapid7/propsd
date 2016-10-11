FROM node:argon
MAINTAINER PlatformDeliveryBelfast <PlatformDelivery_BFS@rapid7.com>

# TODO: Make this dynamic?
ENV version 1.4.3

# Pull in /opt/propsd-VERSION and link it to /opt/propsd
ADD resources/propsd-${version}.tar.gz /
RUN ln -s /opt/propsd-${version} /opt/propsd

RUN mkdir /etc/propsd
COPY resources/propsd-config.json /etc/propsd/config.json

# root      2838  0.0  0.1  61672  1352 ?        Ss   Sep29   0:00 su -c /opt/propsd/bin/server.js -c /etc/propsd/config.json propsd
# propsd    2840  0.1  4.5 1229280 46604 ?       Ssl  Sep29  18:52 node /opt/propsd/bin/server.js -c /etc/propsd/config.json
CMD node /opt/propsd/bin/server.js -c /etc/propsd/config.json
