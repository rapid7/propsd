# How to install Propsd #

[Releases of Propsd][releases] include both source tarballs and Debian
packages. Debian and Ubuntu based Linux distributions can use the pre-built
packages. Other operating systems should install Propsd from source.

## Installing from the Debian package ##

Propsd runs on the 4.4.x LTS version of Node.js, so follow the [instructions
for installing Node.js on Debian based systems][node-debian].

Download a pre-built Debian package of Propsd from [the releases
page][releases] and save it. These instructions assume you've saved the package
to `/tmp/propsd.deb`.

Use `dpkg` to install Propsd.

~~~bash
dpkg -i /tmp/propsd.deb
~~~

Propsd is installed into `/opt/propsd`.

## Installing from source ##

Propsd runs on the 4.4.x LTS version of Node.js, so follow the [instructions
for installing Node.js][node-source].

Download a tarball of the Propsd sources from [the releases page][releases] and
save it. These instructions assume you've saved the tarball to
`/tmp/propsd.tar.gz`.

Create a new folder for Propsd. These instructions assume you're using
`/opt` as that folder.

~~~bash
mkdir /opt
~~~

Use `npm` to install Propsd.

~~~bash
cd /opt
npm install /tmp/propsd.tar.gz
~~~

Propsd is installed into `/opt/node_modules/propsd`.

[releases]: https://github.com/rapid7/propsd/releases/latest
[node-debian]: https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions
[node-source]: https://nodejs.org/en/download/
