# Learning to Dev in an Ops World #

This is a presentation about the development of Propsd given at [DevOpsDays NYC 2016][dod].

## Transcript ##

This is a story about an Ops team that learned to be a Dev team.

Specifically, it's a story about my team.

Hi, I'm Frank. I'm one frank guy (@onefrankguy) on Twitter, GitHub, and in real life.

This is my team. We all work at Rapid7. When I think about my team, and what we do
at Rapid7, a pattern comes to mind.

We build tools that allow one person to manage many products. And "manage" is an
important word there. Because the products I'm talking about are things like Cassandra,
Jenkins, Chef, Elasticsearch. These are not products we created. They're not
products we designed. These are products we operate.

In short, we're an Ops team.

One of the products we manage is Conqueso. Conqueso is a service for delivering dynamic
configuration to Java applications. So if you have a Jetty server with eight threads,
and you want to bump it up to sixteen threads, Conqueso gives you a UI where you
select your server, make a change, and have it picked up by the running Java application.
Conqueso is backed by a MySQL database. It has a RESTful API. It's a pretty neat
product.

About nine months ago, we ran into problems with Conqueso. Essentially, we had too many
Java applications connected to it, and it couldn't handle the load.

We realized we'd come to decision point. We could either stick with the "Ops Way" of fixing
things, or we could try something new.

The Ops Way of fixing things would be: scale up, scale out. Get a bigger database. Add more
Conqueso servers. Spend money and maybe get to the point where we could handle double our
current traffic. But what about when we needed to scale again? And after that? We realized
that Conqueso was a single point of failure and we where outgrowing its architecture.

We realized we had a chance to try something new. We could switch from being an Ops team
to being a Dev team. We could build a new product that addressed our scaling needs and
level up at the same time. This was a risk. We knew we might not have the skills to pull
it off, but we decided to give it a try.

That product is Propsd. It's a micro service that lives alongside the Java application
and delivers dynamic configuration from scalable storage like Amazon S3 and HashiCorp's
Consul.

We jumped into the design of Propsd without knowing what we where doing. We where an
Ops team coming to development for the first time. So we did the only thing we knew
how to do and said, "Let's have a meeting and figure out how to design this thing."

We have this pattern in Ops for managing servers. If I have nine Cassandra nodes, and
I need to run cleanup on all of them, I can split the work amongst my team. That pattern
is Divide and Conquer. We use it all the time.

So that was what we did with our design. We split up the work, and said, "One person
write the design docs for the HTTP interface. One person write the design docs for
how data is retrieved from S3. One person write the design docs for how properties are
layered and composed. We'll break this apart and we'll get it done."

When you take that pattern of Divide and Conquer, and you apply it to design, you wind
up with this anti-pattern of Tangled Ides.

We had meetings to review our design documents and we'd get out of them thinking everyone
was on the same page, only to realize later that when I said "API" I was talking about
RESTful end points, and when Dave said "API" he was talking about JavaScript functions.
We used the same words to describe different things, and all of the ideas got tangled
together.

Now, there is a better pattern for design, and that's the Benevolent Dictator.

One person does the design and writes up the documentation. That gives you a cohesive
unified design.

But we didn't have that. So after several of these design meetings, we where finally
like, "Words are hard." We can't communicate in prose. We're not making any progress here.
Let's write some code. Maybe then we can get everyone on the same page.

In Ops, when it's 3:00 am and the server's broken, who do you want answering that pager?
You want someone who can SSH in to the server, tail a log, read a Java stack trace,
realize that the network is saturated, diagnose that a Python health check script is
eating all the bandwidth, open Vim and craft a fix for it, write up a ticket to get the
fix into the Chef cookbook tomorrow, and go back to bed.

In short, you want a Lone Wolf. Everyone on my team is capable of doing this. Everyone on
my team can work in total isolation, make decisions with limited information, act quickly
to solve problems, and thrives in that sort of environment.

So that's how we wrote code.

And when you take a bunch of Lone Wolves who are used to operating solo, and you ask them
to collaborate on code, to solve design problems, you end up with an anti-pattern of
Knowledge Silos.

There are chunks of the Propsd code base where only one person really understands how
it works. Some of the code has a lot of test coverage and zero documentation. Some of
the code has great documentation and very little test coverage. Different parts where
written by different people, and because we started with separate ideas for our designs,
we would up with separate understandings in our code.

There is a better pattern for coding called Divide and Conquer.

If you have a unified cohesive design to start, you can break the coding into separate
parts, and then when you glue it back together you know it's all going to work. But we
didn't do that. We went from tangled ideas to a tangled code base, and it's still messy
today. There are still pockets of knowledge and dark corners of limited understanding.

Eventually, we got Propsd shipped. And as happens after you ship any product, bug reports
started to come in. So we fixed those, and we cut new releases and as far as we knew,
things where looking good.

How many people have ever found an issue in production because they happened to be tailing
a log or looking at a dashboard at just the right time?

In Ops, we have this pattern of Monitoring. We keep an eye on stuff. We check in periodically.
And we set up our machines so they let us know when they break.

So we took that pattern of Monitoring and applied it to shipping product. There's a
releases page on GitHub. You can configure notifications for when new pull requests are
opened. But that only works if people are listening.

If no one is listening, you end up with an anti-pattern called Cone of Silence.

So people would report a bug, we'd fix it, we'd cut a release, and two weeks later they'd
ask, "How's it going with that bug I reported?" And we'd say, "Uh... We fixed that in the
last release." "When did that go out?" "Two weeks ago".

It turns out the development team internal to Rapid7, who was our primary customer for
Propsd, did most of their communication via Mailing Lists. People would send email when
they shipped new software. But we didn't know that, so we weren't communicating to our
customers about new features and bug fixes.

About four months ago, once Propsd had kind of stabilized, we looked back and said, "That
was hard, and if we're going to continue as a Dev team, we need to get better. So let's
try again."

Product two-point-oh is Tokend. It adds a layer of security on top of Propsd so you can store
encrypted things like database credentials and deliver them securely to your Java application.

And we made an explicit decision at the start of Tokend not to reuse all the same anti-patterns
we'd found while building Propsd. And that's the key thing about patterns. You can make a
conscious decision at the start of a project about what pattern to apply. Once you're in it
though, patterns run on autopilot. And when you're in the middle of an anti-pattern like Tangled
Ideas, it's really hard to interrupt the argument and see that pattern.

For Tokend we made John the Benevolent Dictator, and had him do all the design, plus sign off
on code to make sure it matched the design.

Dave and I got to be code monkeys and use Divide and Conquer to write the individual pieces.
This worked out really well. Because the design is cohesive, we've been able to pick it up and
put it down as time allows.

And we set up an internal mailing list for letting people know about new releases. We're still
not sure what to do about external notifications.

When we started this, we figured we'd be learning how to Dev as an Ops team.

But what we're really learning, is how to collaborate and communicate as a team.

In short, we're learning to DevOps.

## Graphics ##

GitHub user profile pictures are copyright their original creators. The [moose photo][moose]
comes from Ryan Hagerty. Icons where based off [Pure CSS GUI icons (experimental)][icons] by Nicolas
Gallagher and the [&lt;&gt;ne div][one] project by Vincent Durand.

## License ##

Copyright 2016 Frank Mitchell, Rapid7. Unless otherwise noted, the transcript, HTML, and
CSS are licensed under a [Creative Commons Attribution-ShareAlike 3.0 Unported][cc] license.
See the "Graphics" section for licensing information about pictures and icons. The JavaScript
is [impress.js][] by Bartek Szopka under a MIT license.


[cc]: https://creativecommons.org/licenses/by-sa/3.0/ "CC BY-SA 3.0"
[moose]: https://commons.wikimedia.org/wiki/File:A_bull_moose_animal_mammal.jpg
[icons]: http://nicolasgallagher.com/pure-css-gui-icons/
[one]: http://one-div.com/
[impress.js]: https://github.com/impress/impress.js/
[dod]: https://www.devopsdays.org/events/2016-newyork/program/frank-mitchell/
