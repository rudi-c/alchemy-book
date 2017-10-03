# The Alchemy Book

This application is currently "pre-launch", as in the demo is working, but there's still tons of bugs to fix. A blog post on this project is also coming soon.

## Setup

Assuming you have Elixir installed

```
mix deps.get
mix ecto.create
mix ecto.migrate
```

Run with

```
mix phoenix.server
```

## Elixir tatic checking

Use `mix dialyzer` to do static checking with Dialyzer. The first time should
take a lot of time as it runs on the dependencies too, although the results will
be cached. Note that there are still a lot of (what I think are) spurious
warnings. This is to be fixed later.

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