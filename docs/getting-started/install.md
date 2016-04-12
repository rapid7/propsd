# How to install propsd #

[Releases of propsd][releases] include both source tarballs and Debian
packages. Debian and Ubuntu based Linux distributions can use the prebuilt
packages. Other operating systems should install propsd from source.

## Installing from the Debian package ##

Propsd depends on Node.js, so follow the [instructions for installing Node.js
on Debian based systems][node-debian].

Download a prebuilt Debian package of propsd from [the releases page][releases]
and save it. These instructions assume you've saved the package to
`/tmp/propsd.deb`.

Use `dpkg` to install propsd.

~~~bash
dpkg -i /tmp/propsd.deb
~~~

Propsd is installed into `/opt/propsd`.

## Installing from source ##

Propsd depends on Node.js, so follow the [instructions for installing Node.js
on you platform][node-source].

Download a tarball of the propsd sources from [the releases page][releases] and
save it. These instructions assume you've saved the tarball to
`/tmp/propsd.tar.gz`.

Create a new folder for propsd. These instructions assume you're using
`/opt` as that folder.

~~~bash
mkdir /opt
~~~

Use `npm` to install propsd.

~~~bash
cd /opt
npm install /tmp/propsd.tar.gz
~~~

Propsd is installed into `/opt/node_modules/propsd`.

[releases]: https://github.com/rapid7/propsd/releases
[node-debian]: https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions
[node-source]: https://nodejs.org/en/download/
