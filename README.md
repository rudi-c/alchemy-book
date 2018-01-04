![Alchemy Book](https://raw.githubusercontent.com/rudi-c/alchemy-book/master/alchemybook.gif)

# The Alchemy Book

This application is a toy collaborative editor that demonstrates using
Conflict-Free Replicated Data Types (CRDTs) to achieve real-time synchronization. The server 
is written in  Elixir and mostly of the CRDT logic is written in Typescript.

The aim of this project is educative and optimized for understandability rather
than performance. The blog post that explains the intuition behind this technique
can be found at
[A simple approach to building a real-time collaborative text editor](http://digitalfreepen.com/2017/10/06/simple-real-time-collaborative-text-editor.html).

I named the project Alchemy Book since I thought it would look nice with a blackboard
theme. Since this is not going to compete with Google Docs/Dropbox Paper/etc anyway, practicality
is not a concern.

## Setup

Assuming you have Elixir installed, and Postgres installed and running
(see Elixir & Phoenix [setup guide](https://hexdocs.pm/phoenix/up_and_running.html))

```
mix deps.get
mix ecto.create
mix ecto.migrate
```

Run with

```
mix phoenix.server
```

## Typescript

Install the Typescript compiler and linter globally

```
npm install -g tslint typescript
```

and run the linter with `npm run lint`

## Testing

We use Ava

```
npm install -g ava
```

which you can run with `npm test`

## Elixir static checking

Use `mix dialyzer` to do static checking with Dialyzer. The first time should
take a lot of time as it runs on the dependencies too, although the results will
be cached. Note that there are still a lot of (what I think are) spurious
warnings. This is to be fixed later.

## Deploying

There's two ways to deploy to production.

1) The simple way is to checkout this repository (or your fork) within your
server and setup Erlang, Elixir, and all the appropriate tools (this is the
same as running it a prod build locally).

2) Send the self-contained package in `alchemy_book.tar.gz` to your server,
unpack and run. This is less work than (1) and can be done with uncommited
changes which can be useful for testing. The thing I haven't figured out with
this approach is how to include and run the ecto migrate script, in the package,
so I still do (1) when I need to run `mix ecto.migrate`.

In either case, you'll want to make a production build. Create a symbolic link
to your `prod.secret.exs` file (and maybe to your deploy script too):

```
ln -s <path>/prod.secret.exs config/prod.secret.exs
```

with

```
config :alchemy_book, AlchemyBook.Endpoint,
  secret_key_base: "<secret key>"

# Configure your database
config :alchemy_book, AlchemyBook.Repo,
  adapter: Ecto.Adapters.Postgres,
  username: "<username>",
  password: "<password>",
  database: "alchemy_book_prod",
  pool_size: 20
```

Compile a production build with.

```
MIX_ENV=prod mix phoenix.digest
MIX_ENV=prod mix release --env=prod
```

The database will need to be created and migrated in production mode too:
```
MIX_ENV=prod mix ecto.create
MIX_ENV=prod mix ecto.migrate
```

And run with

```
PORT=8080 _build/prod/rel/alchemy_book/bin/alchemy_book <console/foreground/start>
```

# Technical notes

## Logoot

This repository contains a mostly faithful implementation of [Logoot](https://hal.archives-ouvertes.fr/inria-00432368/document).
Note that Logoot was not originally designed for real-time editing. It was designed as a way
to implement a decentralized Wikipedia with a unique ID for each line and sending line
insertion/removals. I just changed it to be character-based (send individual character changes). This
means that the memory overhead is huge (10x the size of the text itself)
but that should be ok as most people don't write text documents of more than a few megabytes.

Logoot is supposed to work in the absence of a central server, and I think it should
still be possible here, with some minor changes. The current implementation uses a
centralized server though to relay messages between clients.

## Phoenix Presence CRDT

The presence indicator (that shows who else is present in the document) as well as cursor position is implemented using the Presence library that ships with Phoenix. Fun fact, Presence is itself a CRDT.

## Notes about the code

I tried to keep a reasonably good code quality and write comments so that it's easy
for people to poke around the code. However, a couple of heads-up:

- There is some unused code laying around for signing up, logging in and creating documents
per user. It originally started that way, but I figured that it's simpler to just have
anonymous document sessions for the purpose of a demo.

- There's an unfinished attempt at using a more efficient order statistics tree for storing
CRDT characters. I left it there since it makes the array-based implementation better abstracted
even if it's not used.

- I used immutable data structures where possible (it's hard when CodeMirror is inherently
stateful). It's not really necessary, but you'll notice there's a bit of functional-style
programming inspired from OCaml at places.

## Things that would be nice to implement

- [ ] Re-enable user login and implement access control
- [ ] Linting for .tsx and .ex files
- [ ] Upgrade to Elixir 1.5 and Phoenix 3
- [ ] Having characters fade-in and fade-out when remote changes arrive would be cool
- [ ] Fuzzy testing for the CRDT logic
